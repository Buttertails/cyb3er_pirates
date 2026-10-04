"""Preview or apply one CX branch for an unknown dentist network."""

import argparse
import copy
import json
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path


AGENT_PREFIX = "projects/cyb3r-pirates/locations/us-east1/agents/"
BASE_URL = "https://us-east1-dialogflow.googleapis.com/v3/"

UNSURE_PHRASES = [
    "I'm not sure which network my dentist is in",
    "I don't know if my dentist is in network",
    "I'm unsure about the dentist network",
    "I haven't picked a dentist yet",
    "I don't know my network",
    "Not sure whether they are in network",
    "How can I tell if my dentist is in network?",
    "I need to check the dentist's network",
    "I have no idea if they're covered as in network",
    "I am not sure",
]


def unsure_intent_body():
    return {
        "displayName": "network.unsure",
        "priority": 500000,
        "trainingPhrases": [
            {"parts": [{"text": phrase}], "repeatCount": 1}
            for phrase in UNSURE_PHRASES
        ],
    }


def guide_page_body(network_page):
    return {
        "displayName": "Network Unsure",
        "entryFulfillment": {"messages": [{"text": {"text": [
            "That's okay. Ask your dentist whether they participate in your "
            "plan's network. For now, choose one network to estimate; you can "
            "switch later."
        ]}}]},
        "transitionRoutes": [{"condition": "true", "targetPage": network_page}],
    }


def network_routes(existing, intent_name, guide_page):
    return [{"intent": intent_name, "targetPage": guide_page}] + copy.deepcopy(existing)


def request(method, path, token, body=None, **params):
    suffix = "?" + urllib.parse.urlencode(params) if params else ""
    call = urllib.request.Request(
        BASE_URL + path + suffix,
        method=method,
        headers={"Authorization": "Bearer " + token,
                 "X-Goog-User-Project": "cyb3r-pirates",
                 "Content-Type": "application/json"},
        data=None if body is None else json.dumps(body).encode(),
    )
    with urllib.request.urlopen(call, timeout=30) as response:
        return json.load(response)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    snapshot = json.loads(args.snapshot.read_text())
    agent = snapshot["agent"]["name"]
    flow = snapshot["flow"]["name"]
    network = next(p for p in snapshot["pages"] if p["displayName"] == "Network")
    if not agent.startswith(AGENT_PREFIX) or not flow.startswith(agent + "/"):
        raise SystemExit("Unexpected target agent or flow; no changes made.")
    if any(p["displayName"] == "Network Unsure" for p in snapshot["pages"]):
        raise SystemExit("Network Unsure page already exists; no changes made.")
    if any(i["displayName"] == "network.unsure" for i in snapshot["intents"]):
        raise SystemExit("network.unsure intent already exists; no changes made.")
    print(json.dumps({"preview": True, "new_page": "Network Unsure",
                      "new_intent": "network.unsure", "training_phrases": len(UNSURE_PHRASES),
                      "network_routes_before": len(network.get("transitionRoutes", []))}))
    if not args.apply:
        return
    token = subprocess.run(["gcloud", "auth", "print-access-token"],
                           check=True, text=True, capture_output=True).stdout.strip()
    live_network = request("GET", network["name"], token)
    if live_network.get("transitionRoutes", []) != network.get("transitionRoutes", []):
        raise SystemExit("Network routes changed since snapshot; no changes made.")
    if live_network.get("form") != network.get("form"):
        raise SystemExit("Network form changed since snapshot; no changes made.")
    live_pages = request("GET", flow + "/pages", token, pageSize=100).get("pages", [])
    live_intents = request("GET", agent + "/intents", token,
                           languageCode="en", pageSize=100).get("intents", [])
    if any(p["displayName"] == "Network Unsure" for p in live_pages) or any(
            i["displayName"] == "network.unsure" for i in live_intents):
        raise SystemExit("Target page or intent was created since snapshot; no changes made.")
    intent = request("POST", agent + "/intents", token, unsure_intent_body(),
                     languageCode="en")
    page = request("POST", flow + "/pages", token, guide_page_body(network["name"]))
    routes = network_routes(network.get("transitionRoutes", []),
                            intent["name"], page["name"])
    request("PATCH", network["name"], token,
            {"name": network["name"], "transitionRoutes": routes},
            updateMask="transitionRoutes")
    live_network = request("GET", network["name"], token)
    live_page = request("GET", page["name"], token)
    if (live_network["transitionRoutes"][0].get("targetPage") != page["name"]
            or live_page["transitionRoutes"][0].get("targetPage") != network["name"]):
        raise SystemExit("Live readback differs; inspect the agent before proceeding.")
    print(json.dumps({"verified": True, "new_page": page["displayName"],
                      "network_routes_after": len(live_network["transitionRoutes"])}))


if __name__ == "__main__":
    main()
