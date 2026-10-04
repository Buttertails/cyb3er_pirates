# Research and decisions

## Identity

**Decision**: Reuse Firebase ID token verification in `backend/auth.py`; use the verified UID for all profile, report, and chat reads. The chosen fictional employee remains explicit and server-validated. **Rationale**: Profile company labels do not map reliably to demo fixture company IDs, and different users may select the same fictional employee. **Alternative**: Infer a plan from saved company; rejected due to mismatched identifiers and account isolation.

## Storage and retries

**Decision**: Merge only supplied profile fields into `users/{uid}`, avoiding stale whole-profile writes. Store reports at `users/{uid}/demo_employees/{employee_id}/procedures/{submission_id}`. A Firestore transaction checks all batch IDs and a per-plan-year recorded-payment total before any writes, then creates reports and updates the total atomically. **Rationale**: Partial merge preserves concurrent edits; transaction preserves idempotency and the annual cap. **Alternative**: Separate create calls after a stream read; rejected due to races and partial writes.

## Usage calculation

**Decision**: Convert known insurer-paid dollars to integer cents and add them to fixture usage as `UsageRecord`s for the report's plan year; unknown payments contribute zero. Use the existing engine for summaries and estimates. **Rationale**: Chat and webhook need one financial source of truth. **Alternative**: Cache a balance in profile; rejected due to drift.

## Frontend

**Decision**: Keep unsupported `intake.*` step events as browser-held navigation selections. Send profile updates and completed care to authenticated routes; request an authenticated estimate for the explicitly selected fictional employee and confirmed usage regardless of wizard mode. Retain older browser-only history visibly labeled unverified. Show service failures instead of fabricated financial results.

## Delivery

**Decision**: Update existing Cloud Run and Hosting after tests. Do not create Firebase resources or change IAM/rules. Current `/api/health` and location writes already prove the cloud path exists.
