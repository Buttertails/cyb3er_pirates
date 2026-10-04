"""Preview or apply one small CX menu-intent and network-alias batch."""

import argparse
import copy
import json
import subprocess
from pathlib import Path

from tools.dialogflow.training_batch import resource_request


MENU_PHRASES = {
    "benefits.review": [
        "How much of my annual benefit is left?",
        "Show my benefits balance",
        "Have I used any dental benefits this year?",
        "How much has my plan paid so far?",
        "How much of my annual maximum remains?",
        "Can I see my recorded dental usage?",
        "What's left in my dental allowance?",
        "Check my remaining annual maximum",
        "Show my current benefits usage",
        "Where do I stand with my plan limit?",
    ],
    "estimate.start": [
        "Help me estimate dental care",
        "I want a cost estimate for dental treatment",
        "Can we price a procedure?",
        "What might I owe for dental work?",
        "Estimate my out of pocket cost",
        "How much would a treatment cost me?",
        "Help me check the cost of a procedure",
        "Can you estimate my dental bill?",
        "I have dental work coming up",
        "Let's look at a treatment cost",
    ],
    "network.compare": [
        "Compare in network and out of network costs",
        "Is it cheaper to stay in network?",
        "What happens if my dentist is out of network?",
        "Can you compare dentist network options?",
        "Should I see an in network dentist?",
        "Show the difference between network choices",
        "How does being out of network affect my cost?",
        "Compare network coverage",
        "Help me choose a network option",
        "Would an outside dentist cost more?",
    ],
}

NETWORK_SYNONYMS = {
    "in_network": ["in my network", "within my network", "participating dentist"],
    "out_of_network": ["outside my network", "not in my network", "nonparticipating dentist"],
}


def phrase_text(phrase):
    return "".join(part.get("text", "") for part in phrase.get("parts", []))


def expand_intent(intent):
    updated = copy.deepcopy(intent)
    phrases = updated.setdefault("trainingPhrases", [])
    existing = {phrase_text(phrase).casefold() for phrase in phrases}
    added = 0
    for text in MENU_PHRASES[intent["displayName"]]:
        if text.casefold() not in existing:
            phrases.append({"parts": [{"text": text}], "repeatCount": 1})
            existing.add(text.casefold())
            added += 1
    return updated, added


def expand_network_entity(entity_type):
    updated = copy.deepcopy(entity_type)
    added = 0
    for entry in updated.get("entities", []):
        existing = {synonym.casefold() for synonym in entry.get("synonyms", [])}
        for synonym in NETWORK_SYNONYMS.get(entry["value"], []):
            if synonym.casefold() not in existing:
                entry.setdefault("synonyms", []).append(synonym)
                existing.add(synonym.casefold())
                added += 1
    return updated, added


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    snapshot = json.loads(args.snapshot.read_text())
    intents = {intent["displayName"]: intent for intent in snapshot["intents"]
               if intent["displayName"] in MENU_PHRASES}
    if set(intents) != set(MENU_PHRASES):
        raise SystemExit("Expected menu intents are missing; no changes made.")
    entity = next(e for e in snapshot["entities"]
                  if e["displayName"] == "dentist_network")
    agent = snapshot["agent"]["name"]
    if not agent.startswith("projects/cyb3r-pirates/locations/us-east1/agents/"):
        raise SystemExit("Unexpected target agent; no changes made.")
    if any(not intent["name"].startswith(agent + "/") for intent in intents.values()):
        raise SystemExit("Intent outside target agent; no changes made.")
    proposed = {name: expand_intent(intent)[0] for name, intent in intents.items()}
    additions = {name: expand_intent(intent)[1] for name, intent in intents.items()}
    entity_after, aliases = expand_network_entity(entity)
    print(json.dumps({"preview": True, "new_phrases": additions,
                      "new_network_synonyms": aliases}))
    if not args.apply:
        return
    token = subprocess.run(["gcloud", "auth", "print-access-token"], check=True,
                           text=True, capture_output=True).stdout.strip()
    # Check every target before writing any of them.
    for name, before in intents.items():
        current = resource_request("GET", before["name"], token)
        if current.get("trainingPhrases", []) != before.get("trainingPhrases", []):
            raise SystemExit(f"{name} changed since snapshot; no changes made.")
    current_entity = resource_request("GET", entity["name"], token)
    if current_entity.get("entities", []) != entity.get("entities", []):
        raise SystemExit("Network entity changed since snapshot; no changes made.")
    for name, before in intents.items():
        resource_request("PATCH", before["name"], token,
                         {"name": before["name"],
                          "trainingPhrases": proposed[name]["trainingPhrases"]},
                         update_mask="trainingPhrases")
    resource_request("PATCH", entity["name"], token,
                     {"name": entity["name"], "entities": entity_after["entities"]},
                     update_mask="entities")
    for name, before in intents.items():
        current = resource_request("GET", before["name"], token)
        wanted = {phrase_text(p) for p in proposed[name]["trainingPhrases"]}
        actual = {phrase_text(p) for p in current["trainingPhrases"]}
        if not wanted.issubset(actual):
            raise SystemExit(f"{name} readback differs; inspect live agent.")
    current_entity = resource_request("GET", entity["name"], token)
    if {e["value"]: set(e["synonyms"]) for e in current_entity["entities"]} != {
            e["value"]: set(e["synonyms"]) for e in entity_after["entities"]}:
        raise SystemExit("Network entity readback differs; inspect live agent.")
    print(json.dumps({"verified": True, "new_phrases": additions,
                      "new_network_synonyms": aliases}))


if __name__ == "__main__":
    main()
