# Dental Benefits Optimizer — Backend

Python Firebase Cloud Functions backend. The deterministic benefits engine lives
in `dental/` and has **no Firebase dependency**, so it is fully unit-testable on
its own. The Cloud Functions layer (`main.py` + `store.py`) wires that engine to
Firestore and exposes a small REST API.

## Layout

```
backend/
  dental/            # pure, Firestore-agnostic engine (unit-testable)
    models.py        # Firestore-shaped dataclasses (plan, employee, usage, ...)
    catalog.py       # CDT procedure catalog + seed data (frontend-aligned IDs)
    engine.py        # coverage/cost math + bonus features
    sequencing.py    # cross-plan-year timing optimizer
  store.py           # Firestore repository layer (the only Firestore access)
  main.py            # Flask app wrapped as the `api` Cloud Function
  tests/             # pytest suite for the engine
```

## How dental coverage is modeled

A plan is a rulebook of numbers: coverage rates per category
(preventive 100% / basic 80% / major 50%), an **annual maximum** (what the plan
pays per person per year), a **deductible** (paid before coverage), **waiting
periods**, and **frequency limits** (e.g. 2 cleanings/year). The employee's
**usage ledger** records what's already been claimed this plan year, which is
how we know remaining annual max and whether frequency limits are hit.

A claim adjudicates in this order: allowed amount → eligibility (waiting
period / frequency) → deductible → coverage rate → cap at remaining annual max →
employee owes the rest.

## Run the tests (no Firebase needed)

```powershell
# from backend/
python -m pip install pytest
python -m pytest
```

## Run the API locally (Firebase emulators)

```powershell
# from the repo root (where firebase.json lives)
python -m venv backend/venv
backend/venv/Scripts/Activate.ps1
python -m pip install -r backend/requirements.txt
firebase emulators:start
```

Then seed sample data and try the engine:

```powershell
# seed Acme employer + plan + Jane + usage history
curl -X POST http://localhost:5001/<project>/us-central1/api/seed

# estimate cost for a root canal + crown using the seeded employee
curl -X POST http://localhost:5001/<project>/us-central1/api/estimate `
  -H "Content-Type: application/json" `
  -d '{"employer_id":"acme-co","employee_id":"emp-jane","procedures":["root-canal","crown-bridge"]}'
```

### Fictional plans (`Data/plans.json`)

Company plans are supplied as JSON in `Data/plans.json`. Each plan has a
`planId`, a `name` ("A"/"B"/"C"), a `group` flag, a `maxCoverage` annual
maximum (`-1` means unlimited), and separate `adult` / `children` blocks. A
member block lists the _categories_ it covers (`Routine`, `Basic`, `Major`,
`Orthodontia`) plus `premium`, `premiumCovered`, and `deductible` (`-1` means
none). An empty `covered` list means that member type isn't offered.

`dental/mock_plans.py` mirrors this JSON (`MockPlan` / `MemberCoverage`) and
adapts a plan + member type onto the engine's `EmployerPlan`: covered
categories get conventional rates (preventive 100% / basic 80% / major 50% /
ortho 50%), uncovered categories get 0%, `maxCoverage: -1` becomes an
effectively unlimited maximum, and `deductible: -1` becomes `$0`.

List the plans with `GET /api/mock-plans`.

### Resolving a plan on engine endpoints (no Firestore)

Every engine endpoint resolves its plan from one of three sources, in priority
order, so the frontend/demo can call the model without Firestore:

```json
// 1. By fictional plan id from Data/plans.json (member_type: adult|children)
POST /api/estimate
{
  "plan_id": 0,
  "member_type": "adult",
  "procedures": ["crown-bridge"],
  "network": "in_network",
  "as_of": "2026-06-15"
}

// 2. By inline plan (and optional usage)
POST /api/estimate
{
  "plan": { "...EmployerPlan dict..." },
  "usage": [ { "...UsageRecord dict..." } ],
  "procedures": ["crown-bridge"]
}

// 3. By Firestore IDs
POST /api/estimate
{ "employer_id": "acme-co", "employee_id": "emp-jane", "procedures": ["crown-bridge"] }
```

## API summary

| Method | Path                                           | Purpose                                |
| ------ | ---------------------------------------------- | -------------------------------------- |
| GET    | `/api/health`                                  | health check                           |
| GET    | `/api/catalog`                                 | procedure catalog                      |
| GET    | `/api/mock-plans`                              | fictional plans from `Data/plans.json` |
| POST   | `/api/employers`                               | create employer                        |
| GET    | `/api/employers/<eid>`                         | read employer                          |
| POST   | `/api/employers/<eid>/plans`                   | create plan                            |
| GET    | `/api/employers/<eid>/plans/<pid>`             | read plan                              |
| POST   | `/api/employers/<eid>/employees`               | create employee                        |
| GET    | `/api/employers/<eid>/employees/<empid>`       | read employee                          |
| POST   | `/api/employers/<eid>/employees/<empid>/usage` | add usage record                       |
| GET    | `/api/employers/<eid>/employees/<empid>/usage` | list usage                             |
| POST   | `/api/estimate`                                | coverage/cost estimate                 |
| POST   | `/api/compare`                                 | in-network vs out-of-network           |
| POST   | `/api/reminders`                               | end-of-year unused-benefit reminders   |
| POST   | `/api/sequence`                                | cross-plan-year timing optimizer       |
| POST   | `/api/seed`                                    | load sample data                       |

Money is returned in dollars (floats) in API responses; internally the engine
works in integer **cents** to avoid rounding drift.
