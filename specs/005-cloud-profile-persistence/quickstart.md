# Validation quickstart

1. Run backend pytest and frontend Node tests.
2. Sign in as account A, save name/company/office, save location, reload, and confirm all fields remain. Account B must see only its own profile.
3. Select Pat, record a supported completed procedure with known insurer payment. Reload report and chat; remaining allowance decreases once. Retry same submission; no second decrease. Reuse ID with different content; reject.
4. Select Lee and account B; neither inherits A's Pat report. A report with unknown insurer payment appears in history without invented usage.
5. Make an estimate without confirming care; allowance remains unchanged. Disconnect API; profile/result pages show retry rather than a successful local result.
6. After deployment, check Hosting `/api/health`, asset versions, Cloud Run revision, and one authenticated profile/report/chat journey. Record revision and rollback path without logging tokens or report content.
