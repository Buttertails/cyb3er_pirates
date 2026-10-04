"""Firestore transaction bodies for reminder deliveries and the sign-in backfill.

A fake transaction enforces Firestore's rule that every read precedes the first
write, and records writes so stale or lost-lease paths can assert none happen.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

import reminders
import store
from chat_profiles import load_profiles
from email_delivery import EmailDeliveryError
from reminder_campaigns import BenefitsCampaign, InactivityCampaign
from tests.reminder_fakes import NOW

LIVE = NOW + timedelta(minutes=1)


class Snap:
    def __init__(self, key, value):
        self.id = key.rsplit("/", 1)[-1]
        self.value = value
        self.exists = value is not None

    def to_dict(self):
        return dict(self.value) if self.value is not None else None


class Query:
    def __init__(self, prefix, limit):
        self.prefix = prefix
        self.limit_count = limit


class Ref:
    def __init__(self, key):
        self.key = key

    def collection(self, name):
        return Ref(self.key + "/" + name)

    def document(self, name):
        return Ref(self.key + "/" + name)

    def limit(self, count):
        return Query(self.key + "/", count)


class Client:
    def collection(self, name):
        return Ref(name)


class Transaction:
    def __init__(self, stored):
        self.stored = stored
        self.writes = []

    def get(self, target):
        assert not self.writes, "read after write"
        if isinstance(target, Query):
            keys = sorted(k for k in self.stored
                          if k.startswith(target.prefix) and "/" not in k[len(target.prefix):])
            return iter([Snap(k, self.stored[k]) for k in keys][:target.limit_count])
        return iter([Snap(target.key, self.stored.get(target.key))])

    def set(self, ref, value, merge=False):
        assert merge, "delivery writes must merge"
        self.writes.append((ref.key, value))


def inactivity_candidate(uid="u1", cycle="cycle-1"):
    return reminders.ReminderCandidate("inactivity", uid, cycle, NOW - timedelta(days=1))


def delivery_key(candidate):
    return f"users/{candidate.uid}/reminder_deliveries/{candidate.doc_id}"


def user_key(uid):
    return f"users/{uid}"


def inactive_profile(cycle="cycle-1"):
    return {"last_sign_in_at": NOW - timedelta(days=100), "inactivity_cycle_id": cycle}


# --------------------------------------------------------------------------- #
# Claim
# --------------------------------------------------------------------------- #

def test_claim_writes_a_leased_delivery_after_rechecking():
    candidate = inactivity_candidate()
    tx = Transaction({user_key("u1"): inactive_profile()})
    assert store._apply_claim(tx, Client(), InactivityCampaign(), candidate, "job", NOW) == "claimed"
    [(key, fields)] = tx.writes
    assert key == delivery_key(candidate)
    assert fields["status"] == "claimed" and fields["lease_owner"] == "job"
    assert "@" not in repr(fields)


@pytest.mark.parametrize("stored_profile", [None, inactive_profile("new-cycle"),
                                            {"last_sign_in_at": NOW, "inactivity_cycle_id": "cycle-1"}])
def test_stale_claim_writes_nothing(stored_profile):
    stored = {user_key("u1"): stored_profile} if stored_profile else {}
    tx = Transaction(stored)
    assert store._apply_claim(tx, Client(), InactivityCampaign(), inactivity_candidate(), "job", NOW) == "stale"
    assert tx.writes == []


@pytest.mark.parametrize("delivery,outcome", [
    ({"status": "sent"}, "terminal"),
    ({"status": "claimed", "lease_owner": "other", "lease_expires_at": LIVE}, "leased"),
])
def test_claim_respects_existing_deliveries(delivery, outcome):
    candidate = inactivity_candidate()
    tx = Transaction({user_key("u1"): inactive_profile(), delivery_key(candidate): delivery})
    assert store._apply_claim(tx, Client(), InactivityCampaign(), candidate, "job", NOW) == outcome
    assert tx.writes == []


def test_benefits_claim_reads_care_reports_inside_the_transaction():
    campaign = BenefitsCampaign(load_profiles())
    candidate = reminders.ReminderCandidate(
        "benefits", "u1", "2026-01-01", datetime(2026, 10, 1, tzinfo=timezone.utc),
        employee_id="demo-a-pat", plan_year_label="2026")
    care = "users/u1/demo_employees/demo-a-pat/procedures/care-1"
    report = {"submission_id": "care-1", "employee_id": "demo-a-pat", "procedure": "crown-bridge",
              "category": "general", "date": "2026-09-01", "cost_cents": 100000,
              "you_paid_cents": 0, "insurance_paid_cents": 60000}
    clean = Transaction({user_key("u1"): {"company": "acme-co"}})
    assert store._apply_claim(clean, Client(), campaign, candidate, "job", NOW) == "claimed"
    used = Transaction({user_key("u1"): {"company": "acme-co"}, care: report})
    assert store._apply_claim(used, Client(), campaign, candidate, "job", NOW) == "stale"
    assert used.writes == []


# --------------------------------------------------------------------------- #
# Later transitions
# --------------------------------------------------------------------------- #

def test_mark_sending_checks_the_lease_owner():
    candidate = inactivity_candidate()
    mine = {"status": "claimed", "lease_owner": "job", "lease_expires_at": LIVE}
    tx = Transaction({delivery_key(candidate): mine})
    assert store._apply_mark_sending(tx, Client(), candidate, "job", NOW) is True
    assert tx.writes[0][1]["status"] == "sending"

    theirs = Transaction({delivery_key(candidate): {**mine, "lease_owner": "other"}})
    assert store._apply_mark_sending(theirs, Client(), candidate, "job", NOW) is False
    assert theirs.writes == []


def test_skip_never_overwrites_a_sent_delivery():
    candidate = inactivity_candidate()
    tx = Transaction({delivery_key(candidate): {"status": "sent"}})
    store._apply_skip(tx, Client(), candidate, "disabled", NOW)
    assert tx.writes == []


def test_sent_and_failure_transitions():
    candidate = inactivity_candidate()
    sending = {"status": "sending", "lease_owner": "job", "attempt_count": 1, "first_attempt_at": NOW}
    tx = Transaction({delivery_key(candidate): sending})
    store._apply_mark_sent(tx, Client(), candidate, "msg-1", NOW)
    assert tx.writes[0][1]["status"] == "sent"

    failed = Transaction({delivery_key(candidate): sending})
    store._apply_failure(failed, Client(), candidate, EmailDeliveryError("permanent_request"), NOW)
    assert failed.writes[0][1]["status"] == "permanent_failed"


# --------------------------------------------------------------------------- #
# Sign-in backfill
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("data,expected_keys", [
    ({"last_sign_in_at": "2026-10-04T04:10:20.123456+00:00"}, {"last_sign_in_at", "inactivity_cycle_id"}),
    ({"last_sign_in_at": "2026-10-04T04:10:20+00:00", "inactivity_cycle_id": "c"}, {"last_sign_in_at"}),
    ({"last_sign_in_at": NOW}, {"inactivity_cycle_id"}),
    ({"last_sign_in_at": NOW, "inactivity_cycle_id": "c"}, None),
    ({"last_sign_in_at": "garbage"}, None),
    ({"last_sign_in_at": "2026-10-04T04:10:20"}, None),
    ({}, None),
])
def test_backfill_fields(data, expected_keys):
    fields = store._backfill_fields(data)
    if expected_keys is None:
        assert fields is None
    else:
        assert set(fields) == expected_keys
        if "last_sign_in_at" in fields:
            assert fields["last_sign_in_at"] == datetime(2026, 10, 4, 4, 10, 20,
                                                         fields["last_sign_in_at"].microsecond,
                                                         tzinfo=timezone.utc)


def test_backfill_rereads_inside_the_transaction():
    tx = Transaction({user_key("u1"): {"last_sign_in_at": NOW, "inactivity_cycle_id": "fresh"}})
    assert store._apply_backfill(tx, Client(), "u1") is False
    assert tx.writes == []
    stale = Transaction({user_key("u1"): {"last_sign_in_at": "2026-10-04T04:10:20+00:00"}})
    assert store._apply_backfill(stale, Client(), "u1") is True
    assert stale.writes[0][0] == user_key("u1")
