"""Add one global CX answer for questions about changing dental plans."""

import argparse
import copy
import json
import subprocess
from pathlib import Path

from tools.dialogflow.network_unsure import request


AGENT = ("projects/cyb3r-pirates/locations/us-east1/agents/"
         "ea6d5b47-1426-4edd-b895-7d4f275f0a65")
FLOW = AGENT + "/flows/00000000-0000-0000-0000-000000000000"
PHRASES = [
    "Can I switch to a different dental plan?",
    "Does my employer offer a different dental plan?",
    "Can I change my dental insurance?",
    "What if I want another insurance plan?",
    "Is there a better plan for braces?",
    "Could I upgrade my dental coverage?",
    "Can I enroll in a different plan?",
    "When can I change my plan?",
    "I want to change my dental benefits",
    "Are there other insurance options at my company?",
    "Would another plan cover this treatment?",
    "Can I switch plans before my procedure?",
]
GUIDANCE = ("This demo shows one current plan for your employer, so I can't compare "
            "another plan or change enrollment here. Ask HR or your benefits team "
            "whether other plans or enrollment changes are available. We can keep "
            "exploring your procedure and costs under your current plan.")


def plan_change_intent():
    return {"displayName": "plan.change.question", "priority": 500000,
            "trainingPhrases": [{"parts": [{"text": phrase}], "repeatCount": 1}
                                for phrase in PHRASES]}


def plan_change_routes(existing, intent_name):
    guidance = {"intent": intent_name,
                "triggerFulfillment": {"messages": [{"text": {"text": [GUIDANCE]}}]}}
    return [guidance] + copy.deepcopy(existing)


def _token():
    return subprocess.run(["gcloud", "auth", "print-access-token"], check=True,
                          text=True, capture_output=True).stdout.strip()


def _capture(path, token):
    flow = request("GET", FLOW, token)
    intents = request("GET", AGENT + "/intents", token,
                      languageCode="en", pageSize=100).get("intents", [])
    snapshot = {"agent": AGENT,
                "flow": {"name": FLOW, "transitionRoutes": flow.get("transitionRoutes", [])},
                "intent_names": [item["displayName"] for item in intents]}
    path.write_text(json.dumps(snapshot, indent=2) + "\n")
    print(json.dumps({"snapshot": str(path), "routes": len(snapshot["flow"]["transitionRoutes"]),
                      "intent_count": len(snapshot["intent_names"])}))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--capture", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if args.capture and args.apply:
        parser.error("Capture and apply are separate steps.")
    if args.capture:
        _capture(args.snapshot, _token())
        return
    snapshot = json.loads(args.snapshot.read_text())
    if snapshot["agent"] != AGENT or snapshot["flow"]["name"] != FLOW:
        raise SystemExit("Unexpected target agent or flow; no changes made.")
    if "plan.change.question" in snapshot["intent_names"]:
        raise SystemExit("Plan-change intent already exists; no changes made.")
    print(json.dumps({"preview": True, "new_intent": "plan.change.question",
                      "new_phrases": len(PHRASES),
                      "flow_routes_before": len(snapshot["flow"]["transitionRoutes"])}))
    if not args.apply:
        return
    token = _token()
    live_flow = request("GET", FLOW, token)
    live_intents = request("GET", AGENT + "/intents", token,
                           languageCode="en", pageSize=100).get("intents", [])
    if live_flow.get("transitionRoutes", []) != snapshot["flow"]["transitionRoutes"]:
        raise SystemExit("Flow routes changed since snapshot; no changes made.")
    if any(item["displayName"] == "plan.change.question" for item in live_intents):
        raise SystemExit("Plan-change intent appeared since snapshot; no changes made.")
    intent = request("POST", AGENT + "/intents", token, plan_change_intent(),
                     languageCode="en")
    proposed = plan_change_routes(snapshot["flow"]["transitionRoutes"], intent["name"])
    request("PATCH", FLOW, token, {"name": FLOW, "transitionRoutes": proposed},
            updateMask="transitionRoutes")
    readback = request("GET", FLOW, token).get("transitionRoutes", [])
    if readback[0].get("intent") != intent["name"] or readback[1:] != proposed[1:]:
        raise SystemExit("Live route readback differs; inspect the agent.")
    print(json.dumps({"verified": True, "intent": intent["displayName"],
                      "flow_routes_after": len(readback)}))


if __name__ == "__main__":
    main()
