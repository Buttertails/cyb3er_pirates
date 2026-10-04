# Data model

## Account profile

Firestore path `users/{uid}`. Existing `uid`, `email`, `state`, `zip` remain. Optional `name`, `company`, `office`, `last_sign_in_at` are field-level merge-written. UID comes from verified ID token only. Profile response includes `location` object for compatibility.

## Fictional employee

Loaded from validated fixture with `employee_id`, `company_id`, `plan_id`, `plan`, `usage`, and `fixture_set_id`. A saved company label never substitutes for `employee_id`. Unknown IDs are rejected.

## Completed-care report

Path `users/{uid}/demo_employees/{employee_id}/procedures/{submission_id}`. Fields: `submission_id`, `employee_id`, `procedure`, `category`, `date` (first day of service month), nullable `cost_cents`, `you_paid_cents`, `insurance_paid_cents`, and `recorded_at`. Known insurer payment is a usage contribution; null is explicitly unknown. Identical retry returns the existing record; conflicting retry fails.

The same employee's `usage_totals/{plan_year}` document records known insurer-paid cents committed through the report API. A transaction checks this total together with fixture seed usage and writes the full report batch atomically.

## Signed chat context

Signed token contains `uid`, `employee_id`, `fixture_set_id`, session ID and expiry. Old context lacking UID is rejected with restart. Webhook verifies context before account-specific reads.
