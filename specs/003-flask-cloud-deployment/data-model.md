# Deployment state

No application entities change. Delivery identifies source commit, container
image, Cloud Run service/revision, Hosting release, and verification results.
States: prepared -> built -> server verified -> Hosting released -> delivered.
Failure before server verification preserves the previous Hosting deployment.
Private credentials remain outside source and upload artifacts.
