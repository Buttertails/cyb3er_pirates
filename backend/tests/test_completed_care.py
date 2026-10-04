from datetime import date

import pytest

from completed_care import parse_report, report_usage
from chat_profiles import load_profiles


def test_report_has_stable_month_and_known_usage():
    employee = load_profiles().employee("demo-a-pat")
    report = parse_report({
        "submission_id": "care-123",
        "procedure": "filling",
        "category": "general",
        "date": "2026-09",
        "cost": 200,
        "you_paid": 40,
        "insurance_paid": 160,
    }, employee, today=date(2026, 10, 3))
    assert report["date"] == "2026-09-01"
    assert report["insurance_paid_cents"] == 16000
    assert report_usage(report).plan_pays_cents == 16000


def test_unknown_insurer_payment_is_not_known_usage():
    employee = load_profiles().employee("demo-a-pat")
    report = parse_report({"submission_id": "care-124", "procedure": "cleaning",
                           "category": "checkup", "date": "2026-09",
                           "cost": None, "you_paid": None, "insurance_paid": None},
                          employee, today=date(2026, 10, 3))
    assert report["insurance_paid_cents"] is None
    assert report_usage(report) is None


@pytest.mark.parametrize("change", [
    {"procedure": "severe-pain"}, {"date": "2026-11"},
    {"insurance_paid": -1}, {"cost": 100, "you_paid": 60, "insurance_paid": 50},
    {"category": "checkup"}, {"submission_id": "../../unsafe"},
])
def test_invalid_report_rejected(change):
    employee = load_profiles().employee("demo-a-pat")
    body = {"submission_id": "care-125", "procedure": "filling", "category": "general",
            "date": "2026-09", "cost": 200, "you_paid": 40, "insurance_paid": 160}
    body.update(change)
    with pytest.raises(ValueError):
        parse_report(body, employee, today=date(2026, 10, 3))
