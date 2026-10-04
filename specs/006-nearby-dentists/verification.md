# Nearby dentists verification

## Source checks

- Read-only inspection of current test profiles found four NC ZIPs: 27519, 27577, 27858, 27863. No names, emails, or account IDs were copied into the fixture.
- Directory fixture loads for all four ZIPs and the company plans used by those profiles. ZIP centers use the 2026 Census ZCTA Gazetteer; office names, ratings, phone numbers, network membership, street labels, and map pins are sample data.
- Backend `python -m pytest -q`: passed, including directory validation, plan isolation, ordering, authenticated route, and empty/error outcomes.
- Frontend `npm test`: 29 Vitest tests and the Firebase configuration Node test passed. Result cards, map coordinates, signed-in request shape, failure states, and onboarding consistency are covered.
- Frontend `npm run build`: passed. `git diff --check`: clean.
- `rg` found no `DEMO_EMPLOYEES`, `profile-employee`, or “Fictional employee and company plan” selector in the React source or CSS.
- `.dockerignore` and `.gcloudignore` explicitly include `backend/fixtures/dentists.json` in the production build context.

## Release

Pending Cloud Run and Firebase Hosting update. No repeated authenticated website smoke test is planned at the user's direction; the tests above cover the new behavior without reading or writing account data during release.
