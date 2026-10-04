# Verification scope

From backend/, run `python -m pytest` with backend/requirements.txt and pytest
installed. Test credentials are fake and external calls are replaced.

Verify employee-specific allowance, two company plans, changed-network results,
signed-context rejection, webhook authorization and failure behavior. Existing
user routes and engine tests remain passing.

Live testing needs separately authorized deployment, server configuration and
remote webhook attachment. No live connection is claimed here.
