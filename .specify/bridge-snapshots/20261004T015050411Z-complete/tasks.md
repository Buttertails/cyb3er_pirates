# Tasks: Standalone Flask cloud deployment

Source: approved design, spec.md, plan.md and contracts/deployment.md.
Execution is inline through the bridge; all deployment actions explicitly
requested by the user. Keep private credentials and unrelated resources intact.

## Phase 1: Production Runtime

- [x] T001 [US1] Verify a failing production-startup probe before adding root Dockerfile, .dockerignore and .gcloudignore; run the real Waitress command in a copied production layout to prove port binding, Data/fixtures loading, calculation routes and preserved auth rejection (FR-001, FR-003, FR-005).

## Phase 2: Hosting Integration

- [x] T002 [US1] Verify the missing Hosting backend route, then add only the /api/** Cloud Run dental-api rewrite in firebase.json, preserving Firebase project, Auth and Firestore configuration; verify source exclusions and current application tests (FR-002, FR-004, FR-005).

## Phase 3: Cloud Delivery

- [x] T003 [US1] Commit source and build the production Dockerfile into the existing gcf-artifacts repository using the existing source bucket and service account; deploy dental-api in us-central1 with min 0/max 2 instances, 1 CPU, 512 MiB, concurrency 4 and timeout 60 seconds; verify direct live routes before switching Hosting and record evidence in specs/003-flask-cloud-deployment/verification.md (FR-001, FR-003, FR-006, FR-007).

## Phase 4: Review and Verification

- [x] T004 Request review, verify application suites and production checks, publish only Firebase Hosting and verify frontend, proxy routes, project config and login rejection; record deployed revision and remaining chat setup in specs/003-flask-cloud-deployment/verification.md, merge delivery changes into main, complete bridge and assess convergence (FR-004, FR-007, FR-008, SC-001 through SC-004).

## Dependencies and Delivery

T001 -> T002 -> T003 -> T004. One deployment story, executed sequentially.
Independent file checks may run together; builds, server release, verification
and Hosting release remain sequential. No parallel agent implementation needed.
Existing function remains available for rollback; no Git push is requested.


## Phase 5: Corrective Dependency Gate

- [x] T005 Resolve the reproduced incompatible dependency set in backend/requirements.txt by pinning google-cloud-firestore to the baseline-tested 2.34.0; verify a clean requirements install and full backend suite before T001/T003 proceed; retain every other team pin (FR-001, FR-004, SC-004).

T005 runs before unfinished T001 because the original requirement set cannot
build; this corrective gate preserves all prior task IDs and descriptions.
