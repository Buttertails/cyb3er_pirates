"""Early-October unused-benefits campaign."""

from __future__ import annotations

from dataclasses import replace
from datetime import date, datetime, timedelta, timezone

import pytest

import reminders
from chat_profiles import load_profiles
from dental import mock_plans
from dental.models import UsageRecord, UserProfile
from reminder_campaigns import (BenefitsCampaign, InactivityCampaign, benefits_standing,
                                qualifies_for_benefits_reminder)
from tests.reminder_fakes import NOW, FakeAuthUser, FakeClock, FakeEmailSender, MemoryReminderRepository

SIGN_IN = "https://app.example.com/index.html"
PROFILES = load_profiles()


def user(uid, company, **extra):
    return UserProfile(uid=uid, company=company, **extra)


def run(repo, when=NOW, sender=None, campaigns=None, **kwargs):
    sender = sender or FakeEmailSender()
    result = reminders.ReminderRunner(
        repo, lambda _uid: FakeAuthUser(), sender, FakeClock(when), sign_in_url=SIGN_IN,
    ).run(campaigns or [BenefitsCampaign(PROFILES)], **kwargs)
    return result, sender


def care(paid_cents, month="2026-09-01", sid="care-901"):
    return {"submission_id": sid, "employee_id": "demo-a-pat", "procedure": "filling",
            "category": "general", "date": month, "cost_cents": paid_cents,
            "you_paid_cents": 0, "insurance_paid_cents": paid_cents}


def at(day: date) -> datetime:
    return datetime(day.year, day.month, day.day, 12, tzinfo=timezone.utc)


# --------------------------------------------------------------------------- #
# Standing and threshold
# --------------------------------------------------------------------------- #

def test_demo_employees_standing_on_2026_10_04():
    assert [qualifies_for_benefits_reminder(benefits_standing(PROFILES.employee(eid), [], NOW.date()),
                                            NOW.date())
            for eid in ("demo-a-pat", "demo-c-lee", "demo-a-sam")] == [True, True, False]


def test_standing_reports_the_plan_year_window_and_label():
    standing = benefits_standing(PROFILES.employee("demo-a-pat"), [], NOW.date())
    assert standing.plan_year_start == date(2026, 1, 1)
    assert standing.resets_on == date(2027, 1, 1)
    assert standing.window_opens_on == date(2026, 10, 1)
    assert (standing.annual_maximum_cents, standing.used_cents) == (750000, 25000)
    assert standing.plan_year_label == "2026"


def test_exactly_ten_percent_used_qualifies_and_one_cent_more_does_not():
    pat = PROFILES.employee("demo-a-pat")
    def usage(cents):
        return replace(pat, usage=[UsageRecord("u", "filling", "2026-02-01", cents)])
    assert qualifies_for_benefits_reminder(benefits_standing(usage(75000), [], NOW.date()), NOW.date())
    assert not qualifies_for_benefits_reminder(benefits_standing(usage(75001), [], NOW.date()), NOW.date())


def test_confirmed_care_counts_toward_usage():
    pat = PROFILES.employee("demo-a-pat")
    assert not qualifies_for_benefits_reminder(benefits_standing(pat, [care(50001)], NOW.date()), NOW.date())
    unknown = {**care(50001), "insurance_paid_cents": None}
    assert qualifies_for_benefits_reminder(benefits_standing(pat, [unknown], NOW.date()), NOW.date())


def test_last_years_usage_does_not_count():
    pat = PROFILES.employee("demo-a-pat")
    last_year = replace(pat, usage=[UsageRecord("u", "crown-bridge", "2025-11-01", 700000)])
    assert qualifies_for_benefits_reminder(benefits_standing(last_year, [], NOW.date()), NOW.date())


@pytest.mark.parametrize("day,expected", [
    (date(2026, 9, 30), False),
    (date(2026, 10, 1), True),
    (date(2026, 12, 31), True),
    (date(2027, 1, 1), False),
])
def test_window_edges(day, expected):
    pat = replace(PROFILES.employee("demo-a-pat"), usage=[])
    assert qualifies_for_benefits_reminder(benefits_standing(pat, [], day), day) is expected


def test_threshold_and_lead_are_configurable():
    lee = PROFILES.employee("demo-c-lee")  # $500 of $12,000 used (95.8% left)
    standing = benefits_standing(lee, [], date(2026, 9, 15), lead_months=4)
    assert qualifies_for_benefits_reminder(standing, date(2026, 9, 15))
    assert not qualifies_for_benefits_reminder(standing, date(2026, 9, 15), remaining_percent=96)


@pytest.mark.parametrize("maximum", [mock_plans.UNLIMITED_ANNUAL_MAX_CENTS, 0])
def test_unlimited_and_zero_maximums_are_excluded(maximum):
    pat = PROFILES.employee("demo-a-pat")
    plan = replace(pat.plan, annual_maximum_cents=maximum)
    standing = benefits_standing(replace(pat, plan=plan, usage=[]), [], NOW.date())
    assert not qualifies_for_benefits_reminder(standing, NOW.date())


def test_non_calendar_plan_year_label():
    pat = PROFILES.employee("demo-a-pat")
    plan = replace(pat.plan, plan_year_start_month=7)
    standing = benefits_standing(replace(pat, plan=plan, usage=[]), [], date(2027, 4, 2))
    assert standing.plan_year_label == "2026–2027"
    assert standing.window_opens_on == date(2027, 4, 1)


# --------------------------------------------------------------------------- #
# Campaign through the runner
# --------------------------------------------------------------------------- #

def demo_repo(**reports):
    return MemoryReminderRepository(
        [user("pat-user", "acme-co"), user("lee-user", "demo-company-2"),
         user("sam-user", "demo-company-3"), user("other-user", "other"), user("blank-user", None)],
        reports)


def test_pat_and_lee_mapped_users_get_one_email_each_and_sam_none():
    repo = demo_repo()
    result, sender = run(repo)
    counts = result["campaigns"]["benefits"]
    assert counts["candidates"] == 2 and counts["sent"] == 2
    assert sorted(c["idempotency_key"] for c in sender.calls) == sorted(
        reminders.delivery_idempotency_key("benefits", uid, "2026-01-01") for uid in ("lee-user", "pat-user"))
    message = sender.calls[0]["message"]
    assert message.subject == "Your dental benefits reset soon"
    assert "2026 plan year" in message.text and "January 1, 2027" in message.text
    assert SIGN_IN + "?reminder=benefits" in message.text
    assert repo.deliveries[("pat-user", "benefits-2026-01-01")]["eligible_at"] == datetime(
        2026, 10, 1, tzinfo=timezone.utc)

    again, sender2 = run(repo)
    assert again["campaigns"]["benefits"]["already_terminal"] == 2
    assert sender2.calls == []


def test_next_plan_year_is_eligible_again():
    repo = demo_repo()
    run(repo)
    result, sender = run(repo, when=at(date(2027, 10, 2)))
    assert result["campaigns"]["benefits"]["sent"] == 3  # Sam's 2026 usage no longer counts
    assert {c["idempotency_key"] for c in sender.calls} == {
        reminders.delivery_idempotency_key("benefits", uid, "2027-01-01")
        for uid in ("pat-user", "lee-user", "sam-user")}


def test_nothing_is_queried_before_the_window_opens():
    class NoQueries(MemoryReminderRepository):
        def company_profiles(self, companies):
            raise AssertionError("queried outside the window")

    result, sender = run(NoQueries([user("pat-user", "acme-co")]), when=at(date(2026, 9, 30)))
    assert result["campaigns"]["benefits"]["candidates"] == 0
    assert sender.calls == []


def test_care_added_before_the_claim_makes_it_stale():
    repo = demo_repo()

    def add_care(r, candidate):
        if candidate.uid == "pat-user":
            r.reports[("pat-user", "demo-a-pat")] = [care(60000)]

    repo.before_claim = add_care
    result, sender = run(repo)
    assert result["campaigns"]["benefits"]["stale"] == 1
    assert [c["idempotency_key"] for c in sender.calls] == [
        reminders.delivery_idempotency_key("benefits", "lee-user", "2026-01-01")]


def test_company_change_before_the_claim_makes_it_stale():
    repo = demo_repo()
    repo.before_claim = lambda r, c: r.profiles.__setitem__(c.uid, user(c.uid, "demo-company-3"))
    result, sender = run(repo)
    assert result["campaigns"]["benefits"]["stale"] == 2
    assert sender.calls == []


def test_user_eligible_for_both_campaigns_gets_two_separate_emails():
    both = user("both", "acme-co", last_sign_in_at=NOW - timedelta(days=120),
                inactivity_cycle_id="cycle-both")
    repo = MemoryReminderRepository([both])
    result, sender = run(repo, campaigns=[InactivityCampaign(), BenefitsCampaign(PROFILES)])
    assert result["campaigns"]["inactivity"]["sent"] == 1
    assert result["campaigns"]["benefits"]["sent"] == 1
    assert [c["message"].subject for c in sender.calls] == [
        "Please review your dental profile", "Your dental benefits reset soon"]
    assert len({c["idempotency_key"] for c in sender.calls}) == 2
    assert set(repo.deliveries) == {("both", "inactivity-cycle-both"), ("both", "benefits-2026-01-01")}
