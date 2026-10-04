# Nearby dentists verification

## Source checks

- Read-only inspection of current test profiles found four NC ZIPs: 27519, 27577, 27858, 27863. No names, emails, or account IDs were copied into the fixture.
- Directory fixture loads for all four ZIPs and the company plans used by those profiles. ZIP centers use the 2026 Census ZCTA Gazetteer; office names, ratings, phone numbers, network membership, street labels, and map pins are sample data.
- Backend `python -m pytest -q`: passed, including directory validation, plan isolation, ordering, authenticated route, and empty/error outcomes.
- Frontend `npm test`: 32 Vitest tests and the Firebase configuration Node test passed. Result cards, map coordinates, signed-in request shape, failure states, onboarding consistency, and saved-office preservation are covered.
- Frontend `npm run build`: passed. `git diff --check`: clean.
- `rg` found no `DEMO_EMPLOYEES`, `profile-employee`, or “Fictional employee and company plan” selector in the React source or CSS.
- `.dockerignore` and `.gcloudignore` explicitly include `backend/fixtures/dentists.json` in the production build context.
- Review found that the first version could clear a saved office or block sign-in when the directory failed. Sign-in no longer calls the directory, and guided office selection loads it when needed. Service failures retain a saved office and show a retry message. The new regression tests passed after the fix.

## Release

- Cloud Build `b011a3ac-1bf8-4447-b5fc-07cd2185093d` succeeded using the existing source bucket, compute service account, and `gcf-artifacts` repository. Image: `us-central1-docker.pkg.dev/cyb3r-pirates/gcf-artifacts/dental-api:0d3d654`.
- Existing Cloud Run service `dental-api` serves revision `dental-api-00006-7lx` at 100% traffic. Previous ready revision `dental-api-00005-lnl` remains available for rollback; no rollback was performed.
- Existing Firebase Hosting site released `sites/cyb3r-pirates/releases/1791096180757000` from version `1875abb8be5aa6c8`, uploading the three React build files. Live HTML references the expected `index-qdeccueU.js` and `index-dNjnPsME.css` assets. The existing Hosting API rewrite returned `{"status":"ok"}` from `/api/health`.
- A fresh remote branch check found `inoutbranch`, `ui-updates`, `sequenceUIbranch`, and `react` all ancestors of the deployed source commit. The employee demo dropdown was not reintroduced.
- No repeated authenticated website smoke test was run at the user's direction. No Firebase Auth, Firestore, or other cloud resources were changed during this release.
