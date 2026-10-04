# Deployment contract

Project cyb3r-pirates; region us-central1; Run service dental-api. Preserve all
current /api paths. Hosting rewrite /api/** forwards the full path to the server.
Waitress starts main:app in /app/backend and listens on 0.0.0.0:$PORT.

GET /api/health, /api/catalog, /api/mock-plans: 200.
POST /api/estimate with C0 adult filling, in_network and demo reference date:
200 with shared-engine totals. GET /api/me without login: 401.
POST /api/chat and /api/dialogflow/webhook without configured keys: explicit 503.
Hosting serves existing frontend and /__/firebase/init.json for this project.

Only dental-api and Hosting are updated. Existing function, Firebase data/Auth,
billing settings, agent configuration and cleanup policy are preserved.
