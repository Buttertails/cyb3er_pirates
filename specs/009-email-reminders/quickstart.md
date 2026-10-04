# Quickstart: Account Reminder Emails

## 1. Local checks (no email, no Firestore)

```bash
cd backend
venv/bin/python -m pytest
venv/bin/python run_reminders.py preview --as-of 2026-10-04
cd ../frontend && npm test && npm run build
```

`preview` prints both emails and the demo benefits standing. On 2026-10-04, `demo-a-pat` and `demo-c-lee` qualify and `demo-a-sam` doesn't. Check that neither email contains amounts or dental history.

## 2. Emulator run (optional; needs Java 21 for firebase-tools 15)

```bash
firebase emulators:start --only firestore,auth --project demo-reminders
# in another shell, from backend/ (the Firestore emulator owns port 8080, so don't run Flask on 8080)
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 GOOGLE_CLOUD_PROJECT=demo-reminders
venv/bin/python -m pytest tests/test_reminder_emulator.py     # seeds, runs, wipes
venv/bin/python run_reminders.py backfill-sign-ins            # preview legacy string timestamps
venv/bin/python run_reminders.py run --dry-run --now 2026-10-04T12:00:00Z
venv/bin/python run_reminders.py run --sender log             # prints emails, records deliveries
venv/bin/python run_reminders.py run --sender log             # second pass sends nothing
```

`run` and `backfill-sign-ins` refuse to start without `FIRESTORE_EMULATOR_HOST`. The repo-root admin key would otherwise point them at production.

## 3. Production setup (manual, owner-approved)

Each of these steps changes live infrastructure, so run them only with the owner's go-ahead.

1. **Resend.**
   - Verify a sending domain (SPF/DKIM). Without one, Resend only delivers to the account owner.
   - Create an API key with sending access only.
2. **Secret.**
   - Store the key: `printf %s "$KEY" | gcloud secrets create resend-api-key --data-file=-`
   - Grant the Cloud Run runtime service account `roles/secretmanager.secretAccessor`.
3. **Scheduler identity.**
   - Create the service account: `gcloud iam service-accounts create reminder-scheduler`
   - Grant it `roles/run.invoker` on `dental-api`, or leave the service public; the route checks the token either way.
4. **Configure Cloud Run.** Use `--update-*`, never `--set-env-vars`, which would erase the chat settings.

   ```bash
   gcloud run services update dental-api --region us-central1 \
     --update-env-vars=REMINDER_FROM_EMAIL="Dental Deal Detector <reminders@YOUR-DOMAIN>",APP_SIGN_IN_URL=https://cyb3r-pirates.web.app/index.html,REMINDER_JOB_AUDIENCE=https://dental-api-nrl7quagra-uc.a.run.app,REMINDER_JOB_SERVICE_ACCOUNT=reminder-scheduler@cyb3r-pirates.iam.gserviceaccount.com,REMINDER_ALLOW_UNVERIFIED=true \
     --update-secrets=RESEND_API_KEY=resend-api-key:latest
   ```

   - `REMINDER_ALLOW_UNVERIFIED=true` is needed today because sign-up doesn't verify email addresses.
   - Optional overrides: `REMINDER_BENEFITS_LEAD_MONTHS` (default 3) and `REMINDER_BENEFITS_REMAINING_PERCENT` (default 90).
5. **Deploy** the backend image as usual. Firestore needs no new indexes.
6. **Backfill** sign-in timestamps written before this release. Preview first, then apply:
   - `run_reminders.py backfill-sign-ins --allow-production`
   - then the same command with `--apply`
7. **Cloud Scheduler, starting in dry-run mode.** It must target the direct Cloud Run URL, not Hosting.

   ```bash
   gcloud scheduler jobs create http dental-reminders-daily --location=us-central1 \
     --schedule="0 14 * * *" --time-zone=Etc/UTC \
     --uri=https://dental-api-nrl7quagra-uc.a.run.app/api/internal/reminders/run \
     --http-method=POST --headers=Content-Type=application/json --message-body='{"dry_run":true}' \
     --oidc-service-account-email=reminder-scheduler@cyb3r-pirates.iam.gserviceaccount.com \
     --oidc-token-audience=https://dental-api-nrl7quagra-uc.a.run.app \
     --attempt-deadline=90s --max-retry-attempts=3 --min-backoff=10m --max-backoff=1h
   ```

   - Trigger it once with `gcloud scheduler jobs run dental-reminders-daily --location=us-central1`.
   - Review the counts in the Cloud Run logs (`Reminder job … finished`).
8. **Go live.** After the counts look right, switch the job body to `{}`:

   ```bash
   gcloud scheduler jobs update http dental-reminders-daily --location=us-central1 --message-body='{}'
   ```

   - The minimum backoff (10 minutes) is longer than the 5-minute claim lease, so a retry never collides with the run before it.
   - A 503 response means retryable work remains.

## 4. Manual product checks

- Open `/index.html?reminder=benefits`. The sign-in page says "Sign in to see how much of your dental benefit is left." After signing in, a non-stale account lands on Profile with "You still have $X of your $Y annual dental benefit…", shown once.
- Change the value to `?reminder=__proto__` (or anything else). Nothing extra appears and sign-in goes to the assistant.
- A user whose last sign-in is more than 90 days old gets the recent-dental-work update first. Answering that nothing changed records the sign-in. With the benefits link, the user then returns to Profile.
