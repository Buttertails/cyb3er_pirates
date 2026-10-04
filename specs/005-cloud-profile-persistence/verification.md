# Verification

## Local implementation checks

- Backend: `/tmp/cyb3er-flask-verify-venv/bin/python -m pytest` in `backend/`: 186 passed after review corrections.
- Frontend: `node --test frontend/tests/*.test.mjs`: 3 files passed.
- `git diff --check`: clean.
- Tests cover cloud profile fields surviving location edits, separate accounts, validated and idempotent completed-care reports, annual allowance cap, UID-bound chat sessions, account/employee separation, matching chatbot and webhook benefit usage, no local financial fallback, and no duplicate results-page script declarations.
- Independent review found five Important issues. Corrections cover field-level profile merges, atomic care batches and annual totals, selected-employee estimates/benefits, and visibly retained browser-only history.

## Cloud delivery

Pending tested source build, existing Cloud Run service update, Hosting publish and live checks.

Prior Cloud Run revision before this feature: `dental-api-00003-txq`. Preserve the existing service identity, limits, environment, Firebase Auth, Firestore database and Hosting rewrite.
