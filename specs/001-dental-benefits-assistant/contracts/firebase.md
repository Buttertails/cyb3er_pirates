# Firebase Database Contract

Planning only. Firebase resources, emulator configuration, seeding commands,
credentials and database contents have not been created.

## Service Boundary

Cloud Firestore stores employee profiles and benefits usage. Python accesses it
using the Firebase Admin SDK. The JavaScript frontend calls Python, which also
supplies Dialogflow fulfillment results. Company plan and procedure facts stay
in validated JSON.

The initial identity assumption is a fictional employee selector. Firebase
Authentication sign-in is excluded from the first demo by user choice. If sign-in is added, update the canonical specification,
API identity contract and tasks before implementation.

## Configuration and Access

Future configuration includes FIREBASE_PROJECT_ID and optional
FIRESTORE_EMULATOR_HOST. The emulator host is host:port without a scheme.
Live credentials use backend Application Default Credentials or runtime
service identity. Service-account files and tokens stay outside version control.

Python server SDK access uses IAM; browser Security Rules do not authorize the
Python API. Configure direct browser Firestore access as denied for this
architecture. The employee selector is for fictional demo data only.

## Import and Reads

Use the collections in [data-model.md](../data-model.md). The import command
validates all input before writing and creates absent seed documents. Reimporting
the same fixture set preserves report totals. Reject incompatible baseline data
or use a new fixture-set identity.

Runtime employee choices, profiles and period usage come from Firestore. Policy
references resolve to the validated JSON company list. Report a recoverable
storage-unavailable error when Firestore cannot be read or written; never claim
a failed report was saved. Local conversation mode still uses the configured
Firestore store.

## Report Transaction

Read employee context, existing submission and period totals before writes.
Verify a matching retry or validate a new amount against the annual allowance,
then create a submission and update reported_cents in one transaction.
Use a canonical request fingerprint for conflicting ID reuse.

A transaction retry performs only database operations and deterministic local
checks; it does not send messages or create another report elsewhere.

## Development and Verification

Use a demo- project ID for isolated emulator tests. The future firebase.json
documents emulator ports. Export/import retains emulator state when stopping
and restarting the emulator; restarting Python alone retains database state.

Future tests cover baseline import idempotency, estimate read-only behavior,
report confirmation, duplicate/conflicting retries, concurrent reports, period
and employee isolation, and database failure recovery. A live read/write check,
when cloud configuration is available, is recorded separately from emulator
results. Creating or publishing cloud resources is outside planning.
