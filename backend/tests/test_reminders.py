"""Delivery state machine, runner, and the inactivity campaign."""

from __future__ import annotations

from datetime import timedelta

import pytest

import reminders
from dental.models import UserProfile
from email_delivery import EmailDeliveryError
from reminder_campaigns import InactivityCampaign
from tests.reminder_fakes import (NOW, FakeAuthUser, FakeClock, FakeEmailSender, FakeMonotonic,
                                  MemoryReminderRepository)

SIGN_IN = "https://app.example.com/index.html"
CANDIDATE = reminders.ReminderCandidate("inactivity", "uid-1", "cycle-1", NOW - timedelta(days=1))


def profile(uid, age_days, cycle=None, **extra):
    return UserProfile(uid=uid, last_sign_in_at=NOW - timedelta(days=age_days),
                       inactivity_cycle_id=cycle or f"cycle-{uid}", **extra)


def runner(repo, sender=None, auth=None, **kwargs):
    return reminders.ReminderRunner(
        repo, auth or (lambda _uid: FakeAuthUser()), sender or FakeEmailSender(),
        FakeClock(), sign_in_url=SIGN_IN, **kwargs)


def inactivity_counts(result):
    return result["campaigns"]["inactivity"]


# --------------------------------------------------------------------------- #
# Keys and boundaries
# --------------------------------------------------------------------------- #

def test_exact_ninety_day_boundary_is_inclusive():
    assert not reminders.is_inactive(NOW - timedelta(days=90) + timedelta(seconds=1), NOW)
    assert reminders.is_inactive(NOW - timedelta(days=90), NOW)
    assert not reminders.is_inactive(None, NOW)


def test_idempotency_key_is_stable_private_and_campaign_scoped():
    key = reminders.delivery_idempotency_key("inactivity", "uid-1", "cycle-1")
    assert key == reminders.delivery_idempotency_key("inactivity", "uid-1", "cycle-1")
    assert key.startswith("inactivity-reminder/") and len(key) == len("inactivity-reminder/") + 64
    assert "uid-1" not in key and "cycle-1" not in key
    assert key != reminders.delivery_idempotency_key("benefits", "uid-1", "cycle-1")
    assert key != reminders.delivery_idempotency_key("inactivity", "uid-2", "cycle-1")
    assert CANDIDATE.doc_id == "inactivity-cycle-1"
    assert CANDIDATE.idempotency_key == key


# --------------------------------------------------------------------------- #
# State machine tables
# --------------------------------------------------------------------------- #

LIVE = NOW + timedelta(minutes=1)
EXPIRED = NOW - timedelta(seconds=1)
OLD = NOW - timedelta(hours=23)


@pytest.mark.parametrize("delivery,outcome,status", [
    (None, "claimed", "claimed"),
    ({"status": "skipped_auth"}, "claimed", "claimed"),
    ({"status": "sent"}, "terminal", None),
    ({"status": "permanent_failed"}, "terminal", None),
    ({"status": "delivery_unknown"}, "terminal", None),
    ({"status": "claimed", "lease_owner": "other", "lease_expires_at": LIVE}, "leased", None),
    ({"status": "sending", "lease_owner": "other", "lease_expires_at": LIVE}, "leased", None),
    ({"status": "claimed", "lease_owner": "other", "lease_expires_at": EXPIRED}, "claimed", "claimed"),
    ({"status": "sending", "lease_owner": "other", "lease_expires_at": EXPIRED,
      "first_attempt_at": NOW - timedelta(hours=1)}, "claimed", "claimed"),
    ({"status": "sending", "lease_owner": "other", "lease_expires_at": EXPIRED,
      "first_attempt_at": OLD}, "terminal", "delivery_unknown"),
    ({"status": "retryable_failed", "failure_uncertain": True, "first_attempt_at": OLD},
     "terminal", "delivery_unknown"),
    ({"status": "retryable_failed", "failure_uncertain": False, "first_attempt_at": OLD,
      "attempt_count": 2}, "claimed", "claimed"),
    ({"status": "retryable_failed", "attempt_count": 5}, "terminal", "permanent_failed"),
])
def test_decide_claim(delivery, outcome, status):
    got, fields = reminders.decide_claim(delivery, CANDIDATE, "job", NOW)
    assert got == outcome
    assert (fields or {}).get("status") == status
    if outcome == "claimed":
        assert fields["lease_owner"] == "job"
        assert fields["lease_expires_at"] == NOW + reminders.LEASE_DURATION
        assert fields["idempotency_key"] == CANDIDATE.idempotency_key
        assert fields["attempt_count"] == int((delivery or {}).get("attempt_count") or 0)


def test_decide_claim_keeps_first_attempt_for_the_idempotency_clock():
    first = NOW - timedelta(hours=2)
    _, fields = reminders.decide_claim({"status": "retryable_failed", "first_attempt_at": first,
                                        "attempt_count": 1}, CANDIDATE, "job", NOW)
    assert fields["first_attempt_at"] == first


@pytest.mark.parametrize("delivery,ok", [
    ({"status": "claimed", "lease_owner": "job", "lease_expires_at": LIVE}, True),
    ({"status": "claimed", "lease_owner": "other", "lease_expires_at": LIVE}, False),
    ({"status": "claimed", "lease_owner": "job", "lease_expires_at": EXPIRED}, False),
    ({"status": "sent", "lease_owner": None}, False),
    (None, False),
])
def test_decide_sending_requires_the_live_lease(delivery, ok):
    fields = reminders.decide_sending(delivery, "job", NOW)
    assert (fields is not None) is ok
    if ok:
        assert fields["status"] == "sending"
        assert fields["attempt_count"] == 1
        assert fields["first_attempt_at"] == NOW


def test_decide_sent_records_once_and_clears_the_lease():
    fields = reminders.decide_sent({"status": "sending", "lease_owner": "job"}, "msg-1", NOW)
    assert fields["status"] == "sent" and fields["provider_message_id"] == "msg-1"
    assert fields["lease_owner"] is None
    assert reminders.decide_sent({"status": "sent"}, "msg-2", NOW) is None


@pytest.mark.parametrize("delivery,error,status,code", [
    ({"first_attempt_at": NOW, "attempt_count": 1},
     EmailDeliveryError("retryable_rate_limit", retryable=True), "retryable_failed", "retryable_rate_limit"),
    ({"first_attempt_at": NOW, "attempt_count": 5},
     EmailDeliveryError("retryable_rate_limit", retryable=True), "permanent_failed", "retry_limit"),
    ({"first_attempt_at": OLD, "attempt_count": 2},
     EmailDeliveryError("retryable_provider", retryable=True, uncertain=True),
     "delivery_unknown", "idempotency_window_expired"),
    ({"first_attempt_at": NOW, "attempt_count": 1},
     EmailDeliveryError("retryable_provider", retryable=True, uncertain=True),
     "retryable_failed", "retryable_provider"),
    ({"first_attempt_at": NOW, "attempt_count": 1},
     EmailDeliveryError("permanent_request"), "permanent_failed", "permanent_request"),
])
def test_decide_failure(delivery, error, status, code):
    fields = reminders.decide_failure({"status": "sending", **delivery}, error, NOW)
    assert (fields["status"], fields["failure_code"]) == (status, code)
    assert fields["lease_owner"] is None


@pytest.mark.parametrize("delivery,expected", [
    (None, "skipped_auth"),
    ({"status": "skipped_auth"}, "skipped_auth"),
    ({"status": "sent"}, None),
    ({"status": "delivery_unknown"}, None),
    ({"status": "sending", "lease_owner": "j", "lease_expires_at": EXPIRED}, None),
    ({"status": "claimed", "lease_owner": "j", "lease_expires_at": LIVE}, None),
    ({"status": "retryable_failed"}, "keep"),
])
def test_decide_skip_never_overwrites_progress(delivery, expected):
    fields = reminders.decide_skip(delivery, "disabled", CANDIDATE, NOW)
    if expected is None:
        assert fields is None
    elif expected == "keep":
        assert fields == {"last_checked_at": NOW}
    else:
        assert fields["status"] == "skipped_auth" and fields["failure_code"] == "disabled"


# --------------------------------------------------------------------------- #
# Runner with the inactivity campaign
# --------------------------------------------------------------------------- #

def test_runner_sends_once_then_counts_terminal_without_auth_lookup():
    repo = MemoryReminderRepository([profile("eligible", 90), profile("young", 89)])
    sender = FakeEmailSender()
    lookups = []

    def auth(uid):
        lookups.append(uid)
        return FakeAuthUser()

    first = runner(repo, sender, auth).run([InactivityCampaign()])
    second = runner(repo, sender, auth).run([InactivityCampaign()])

    assert inactivity_counts(first)["sent"] == 1
    assert inactivity_counts(second)["already_terminal"] == 1
    assert lookups == ["eligible"]
    assert len(sender.calls) == 1
    call = sender.calls[0]
    assert call["to"] == "person@example.com"
    assert call["message"].subject == "Please review your dental profile"
    assert call["idempotency_key"] == reminders.delivery_idempotency_key("inactivity", "eligible", "cycle-eligible")
    delivery = repo.deliveries[("eligible", "inactivity-cycle-eligible")]
    assert delivery["status"] == "sent" and delivery["attempt_count"] == 1
    assert delivery["eligible_at"] == NOW
    assert first["incomplete"] is False


def test_profiles_without_a_cycle_are_not_candidates():
    legacy = UserProfile(uid="legacy", last_sign_in_at=NOW - timedelta(days=200))
    repo = MemoryReminderRepository([legacy])
    assert inactivity_counts(runner(repo).run([InactivityCampaign()]))["candidates"] == 0


@pytest.mark.parametrize("user,code", [
    (FakeAuthUser(email=None), "missing_email"),
    (FakeAuthUser(email_verified=False), "unverified_email"),
    (FakeAuthUser(disabled=True), "disabled"),
    (None, "missing_account"),
])
def test_unsendable_accounts_are_skipped_and_audited(user, code):
    repo = MemoryReminderRepository([profile("skip", 100)])
    sender = FakeEmailSender()
    result = runner(repo, sender, lambda _uid: user).run([InactivityCampaign()])
    assert inactivity_counts(result)["skipped_auth"] == 1
    assert repo.deliveries[("skip", "inactivity-cycle-skip")]["failure_code"] == code
    assert sender.calls == []


def test_auth_lookup_failure_is_skipped_with_a_redacted_code():
    def auth(_uid):
        raise RuntimeError("secret detail")

    repo = MemoryReminderRepository([profile("skip", 100)])
    runner(repo, auth=auth).run([InactivityCampaign()])
    assert repo.deliveries[("skip", "inactivity-cycle-skip")]["failure_code"] == "auth_lookup_failed"


def test_allow_unverified_flag_only_relaxes_verification():
    repo = MemoryReminderRepository([profile("unverified", 100), profile("disabled", 100),
                                     profile("no-email", 100)])
    users = {"unverified": FakeAuthUser(email_verified=False),
             "disabled": FakeAuthUser(email_verified=False, disabled=True),
             "no-email": FakeAuthUser(email=None, email_verified=False)}
    sender = FakeEmailSender()
    result = runner(repo, sender, users.get, allow_unverified=True).run([InactivityCampaign()])
    assert inactivity_counts(result)["sent"] == 1
    assert inactivity_counts(result)["skipped_auth"] == 2
    assert [c["to"] for c in sender.calls] == ["person@example.com"]


def test_skipped_account_is_retried_once_it_becomes_sendable():
    repo = MemoryReminderRepository([profile("later", 100)])
    runner(repo, auth=lambda _uid: FakeAuthUser(email_verified=False)).run([InactivityCampaign()])
    result = runner(repo).run([InactivityCampaign()])
    assert inactivity_counts(result)["sent"] == 1


def test_sign_in_between_query_and_claim_is_stale():
    repo = MemoryReminderRepository([profile("raced", 100)])
    repo.before_claim = lambda r, c: r.profiles.__setitem__("raced", profile("raced", 0, "new-cycle"))
    sender = FakeEmailSender()
    result = runner(repo, sender).run([InactivityCampaign()])
    assert inactivity_counts(result)["stale"] == 1
    assert sender.calls == []
    assert repo.deliveries == {}


def test_live_lease_held_by_another_run_is_counted_as_leased():
    repo = MemoryReminderRepository([profile("busy", 100)])
    repo.deliveries[("busy", "inactivity-cycle-busy")] = {
        "status": "claimed", "lease_owner": "other-job", "lease_expires_at": LIVE}
    sender = FakeEmailSender()
    result = runner(repo, sender).run([InactivityCampaign()])
    assert inactivity_counts(result)["leased"] == 1
    assert inactivity_counts(result)["already_terminal"] == 0
    assert sender.calls == []


def test_lease_lost_before_sending_does_not_send():
    repo = MemoryReminderRepository([profile("lost", 100)])
    repo.before_sending = lambda r, c: r.deliveries[(c.uid, c.doc_id)].update(lease_owner="other")
    sender = FakeEmailSender()
    result = runner(repo, sender).run([InactivityCampaign()])
    assert inactivity_counts(result)["leased"] == 1
    assert sender.calls == []


def test_transient_failure_is_retryable_and_resent_with_the_same_key():
    repo = MemoryReminderRepository([profile("retry", 100)])
    failing = FakeEmailSender(EmailDeliveryError("retryable_transport", retryable=True, uncertain=True))
    result = runner(repo, failing).run([InactivityCampaign()])
    assert inactivity_counts(result)["retryable_failed"] == 1
    assert repo.deliveries[("retry", "inactivity-cycle-retry")]["status"] == "retryable_failed"

    working = FakeEmailSender()
    runner(repo, working).run([InactivityCampaign()])
    assert working.calls[0]["idempotency_key"] == failing.calls[0]["idempotency_key"]
    assert repo.deliveries[("retry", "inactivity-cycle-retry")]["attempt_count"] == 2


def test_permanent_failure_is_not_retried():
    repo = MemoryReminderRepository([profile("bad", 100)])
    runner(repo, FakeEmailSender(EmailDeliveryError("permanent_request"))).run([InactivityCampaign()])
    sender = FakeEmailSender()
    result = runner(repo, sender).run([InactivityCampaign()])
    assert inactivity_counts(result)["already_terminal"] == 1
    assert sender.calls == []


def test_terminal_records_do_not_consume_the_batch():
    repo = MemoryReminderRepository([profile("old", 120), profile("next", 100)])
    repo.deliveries[("old", "inactivity-cycle-old")] = {"status": "sent"}
    sender = FakeEmailSender()
    result = runner(repo, sender).run([InactivityCampaign()], batch_size=1)
    assert inactivity_counts(result)["already_terminal"] == 1
    assert inactivity_counts(result)["sent"] == 1
    assert result["incomplete"] is False


def test_batch_limit_marks_the_run_incomplete():
    repo = MemoryReminderRepository([profile(f"u{i}", 100 + i) for i in range(3)])
    result = runner(repo).run([InactivityCampaign()], batch_size=2)
    assert inactivity_counts(result)["sent"] == 2
    assert inactivity_counts(result)["incomplete"] is True
    assert result["incomplete"] is True


def test_oversized_batch_is_clamped():
    repo = MemoryReminderRepository([profile(f"u{i}", 100 + i) for i in range(30)])
    result = runner(repo).run([InactivityCampaign()], batch_size=999)
    assert inactivity_counts(result)["sent"] == reminders.MAX_BATCH_SIZE


def test_time_budget_stops_before_another_send():
    repo = MemoryReminderRepository([profile(f"u{i}", 100 + i) for i in range(3)])
    result = runner(repo, monotonic=FakeMonotonic(step=20), budget_seconds=45).run([InactivityCampaign()])
    assert inactivity_counts(result)["sent"] < 3
    assert result["incomplete"] is True


def test_dry_run_counts_without_writing_or_sending():
    repo = MemoryReminderRepository([profile("eligible", 100), profile("skip", 100)])
    users = {"eligible": FakeAuthUser(), "skip": FakeAuthUser(disabled=True)}
    sender = FakeEmailSender()
    result = runner(repo, sender, users.get).run([InactivityCampaign()], dry_run=True)
    assert result["dry_run"] is True
    assert inactivity_counts(result)["would_send"] == 1
    assert inactivity_counts(result)["skipped_auth"] == 1
    assert repo.writes == 0
    assert sender.calls == []


def test_result_contains_counts_only():
    repo = MemoryReminderRepository([profile("secret-uid", 100)])
    text = repr(runner(repo).run([InactivityCampaign()]))
    assert "secret-uid" not in text and "@" not in text and "reminder/" not in text


def test_campaign_order_is_fixed():
    assert reminders.ordered_campaigns(["benefits", "inactivity"]) == ["inactivity", "benefits"]
    assert reminders.ordered_campaigns(["benefits"]) == ["benefits"]
