# Feature validation scenarios

Prerequisites: bridge executing approved tasks; fictional dataset and current
Flask/CX configuration available; existing Firebase sign-in for website tests.
No account creation, usage writes or database seeding required for verification.
This is a validation artifact; implementation belongs exclusively to tasks.md.

Baseline commands from repository root:
- /tmp/cyb3er-flask-verify-venv/bin/python -m pytest backend/tests
- node frontend/tests/firebase-config.test.mjs
Use the equivalent project venv if the temporary verification environment is
unavailable. Run new Node chat/card/timeline tests as added by canonical tasks.

1. Website live chat: select fictional Pat; request filling, ask what deductible
   means mid-intake, resume, estimate, change network, restore. Repeat with Lee's
   different company. Capture actual CX session/page transitions and shared
   result consistency, never private tokens (SC-001).
2. Options: covered/partial/excluded and exhausted examples; budget-fit and
   no-cheaper/unsupported outcomes; check all values against shared engine
   and original usage unchanged (SC-002).
3. Timing: supported stages in order across reset; same services all-now
   baseline; deadline preventing deferral; explicit fictional lifetime-cap case
   and unknown-rule case. No unsupported savings (SC-003).
4. Cards/timeline: change network/date/option and restore; recorded/proposed/reset
   labels and policy-year summaries remain consistent; delayed older reply cannot
   replace current selection; keyboard-only navigation works (SC-004).
5. Recovery: ambiguity/unsupported questions, missing/expired session, wrong
   webhook auth, forged inputs, CX timeout, retry and confirmed restart (SC-005).

Record each release and rollback point in verification.md. Publish only intended
Flask image/Hosting/agent batches to existing project. Preserve prior function,
Firebase data/providers and unrelated cloud settings. Fake-service tests are
necessary but do not establish live conversation completion.
