"""Connect uploaded procedure documents to the existing Procedure page."""

import json
import subprocess

from network_unsure import request


AGENT = "projects/cyb3r-pirates/locations/us-east1/agents/ea6d5b47-1426-4edd-b895-7d4f275f0a65"
FLOW = AGENT + "/flows/00000000-0000-0000-0000-000000000000"


def main():
    token = subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()
    flow = request("GET", FLOW, token)
    pages = request("GET", FLOW + "/pages", token, pageSize=100).get("pages", [])
    procedure = next(page for page in pages if page["displayName"] == "Procedure")
    handlers = flow.get("eventHandlers", [])
    existing = [handler for handler in handlers if handler.get("event") == "document.uploaded"]
    if existing:
        if existing[0].get("targetPage") != procedure["name"]:
            raise SystemExit("Existing document handler points elsewhere; no changes made.")
        print("Document handoff already configured.")
        return
    handlers.append({"event": "document.uploaded", "targetPage": procedure["name"]})
    request("PATCH", FLOW, token, {"name": FLOW, "eventHandlers": handlers}, updateMask="eventHandlers")
    updated = request("GET", FLOW, token)
    if not any(handler.get("event") == "document.uploaded" and handler.get("targetPage") == procedure["name"] for handler in updated.get("eventHandlers", [])):
        raise SystemExit("Document handoff readback failed.")
    print(json.dumps({"event": "document.uploaded", "target_page": procedure["displayName"], "verified": True}))


if __name__ == "__main__":
    main()
