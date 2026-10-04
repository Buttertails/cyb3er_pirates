"""The care batch must decide every conflict and cap before a Firestore write."""

import pytest

import store


class Snap:
    def __init__(self, value=None):
        self.value = value
        self.exists = value is not None

    def to_dict(self):
        return self.value


class Ref:
    def __init__(self, key):
        self.key = key

    def collection(self, name):
        return Ref(self.key + "/" + name)

    def document(self, name):
        return Ref(self.key + "/" + name)


class Client:
    def collection(self, name):
        return Ref(name)


class Transaction:
    def __init__(self, stored):
        self.stored = stored
        self.writes = []

    def get(self, ref):
        return iter([Snap(self.stored.get(ref.key))])

    def create(self, ref, value):
        self.writes.append(("create", ref.key, value))

    def set(self, ref, value, merge=False):
        self.writes.append(("set", ref.key, value))


def report(sid, paid):
    return {
        "submission_id": sid, "employee_id": "demo-a-pat", "procedure": "filling",
        "category": "general", "date": "2026-09-01", "cost_cents": 20000,
        "you_paid_cents": 0, "insurance_paid_cents": paid,
    }


def test_conflicting_later_report_causes_no_batch_writes():
    prior = report("care-222", 50)
    stored = {"users/account/demo_employees/demo-a-pat/procedures/care-222": prior}
    tx = Transaction(stored)
    with pytest.raises(store.CareConflict):
        store._apply_care_batch(tx, Client(), "account", "demo-a-pat",
                                [report("care-111", 50), report("care-222", 100)],
                                {"2026-01-01": 25000}, 750000)
    assert tx.writes == []


def test_plan_year_total_checked_before_any_batch_write():
    tx = Transaction({"users/account/demo_employees/demo-a-pat/usage_totals/2026-01-01":
                      {"known_paid_cents": 10000}})
    with pytest.raises(ValueError):
        store._apply_care_batch(tx, Client(), "account", "demo-a-pat",
                                [report("care-111", 20000)],
                                {"2026-01-01": 725000}, 750000)
    assert tx.writes == []
