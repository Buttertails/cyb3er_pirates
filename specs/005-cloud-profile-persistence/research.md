# Research and decisions

## Identity

**Decision**: Reuse Firebase ID token verification in `backend/auth.py`; use the verified UID for all profile, report, and chat reads. The chosen fictional employee remains explicit and server-validated. **Rationale**: Profile company labels do not map reliably to demo fixture company IDs, and different users may select the same fictional employee. **Alternative**: Infer a plan from saved company; rejected due to mismatched identifiers and account isolation.

## Storage and retries

**Decision**: Merge profile fields into `users/{uid}` and store reports at `users/{uid}/demo_employees/{employee_id}/procedures/{submission_id}`. Use Firestore create semantics and compare content for retries. **Rationale**: Merge preserves teammate-added fields; stable IDs avoid double counting. **Alternative**: Append arbitrary IDs; rejected due to retry duplication.

## Usage calculation

**Decision**: Convert known insurer-paid dollars to integer cents and add them to fixture usage as `UsageRecord`s for the report's plan year; unknown payments contribute zero. Use the existing engine for summaries and estimates. **Rationale**: Chat and webhook need one financial source of truth. **Alternative**: Cache a balance in profile; rejected due to drift.

## Frontend

**Decision**: Keep unsupported `intake.*` step events as browser-held navigation selections. Send profile updates and completed care to authenticated routes; request the connected estimate regardless of wizard mode. Show service failures instead of fabricated financial results.

## Delivery

**Decision**: Update existing Cloud Run and Hosting after tests. Do not create Firebase resources or change IAM/rules. Current `/api/health` and location writes already prove the cloud path exists.
