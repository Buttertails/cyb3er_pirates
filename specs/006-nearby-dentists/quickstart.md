# Validation quickstart: Nearby in-network dentists

## Prerequisites

Use the existing backend and frontend development setup with fictional plans.
The sample office fixture should cover the distinct saved ZIPs selected from
the team's current test accounts. Use a signed-in test account with a saved
company and ZIP; no new cloud service is needed.

## Automated checks

From `backend/`, run the existing pytest suite. It must cover fixture
validation, raw-distance ordering, company-plan filtering, account context,
and all empty outcomes. From `frontend/`, run `npm test` and
`npm run build`; the chat card and onboarding choice tests must pass.

## Manual scenarios

1. Sign in with a seeded North Carolina test account, open the chat, choose
   Find in-network dentists, and verify up to five closest sample offices
   appear within three seconds under normal demo conditions.
2. Check each card's address, sample rating, fictional phone, approximate
   miles and Open in Maps pin. Distances must be ascending.
3. Sign in with a test account on a different company plan at a supported ZIP.
   Verify no office exclusive to the first plan appears.
4. Remove a test account's ZIP through the existing profile flow or use an
   account without one. Verify the chat asks for a ZIP.
5. Use an unsupported ZIP and verify the explicit no-results message.
6. Simulate request failure and verify retry appears with no stale list.
7. Confirm the onboarding office choices at a supported ZIP show the same
   office names and distances as the chat directory.
8. Confirm the profile has no demo employee selector and existing chat,
   estimate, login and saved-plan flows still open.

For a cloud release, check the existing API health endpoint and Hosting app
after deploying through the project's current path. Record the deployed
revision and the outcomes of the authenticated scenarios.
