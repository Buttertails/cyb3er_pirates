# Personalized chatbot verification

## Baseline and current state

Worktree: feat/personalized-chatbot at /tmp/cyb3er-personalized-chatbot.
Baseline: 165 backend tests pass in the clean verification environment.
Read-only cloud inventory: existing dental-api in cyb3r-pirates, us-central1;
only GOOGLE_CLOUD_PROJECT is configured. Existing agent is in us-east1,
ea6d5b47-1426-4edd-b895-7d4f275f0a65. It contains Start, Procedure,
Network and Estimate, four intents including defaults, and zero webhooks.
Estimate has a static unavailable response, which explains the unchanged demo.

Sanitized full before snapshot: chat/agent-config/live-before-2026-10-03.json.
Restore: use the saved resource definitions for this exact agent and compare
against the live resource before any rollback; do not replace teammate changes
unreviewed. No remote mutations yet. No Firebase/Auth/data changes.
