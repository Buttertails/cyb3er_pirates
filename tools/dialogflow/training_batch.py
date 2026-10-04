"""Preview or apply one scoped Dialogflow CX language-training batch.

The input is a sanitized snapshot of the live agent. An apply stops if either
target resource changed after the snapshot; only the intended fields are patched.
"""

import argparse
import copy
import json
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path


PROCEDURE_PHRASES = [
    ("My dentist says I need a ", "filling", ""),
    ("My dentist recommended a ", "root canal", ""),
    ("I am getting a ", "crown", " soon"),
    ("I need to have a ", "tooth pulled", ""),
    ("Could you estimate an ", "implant", " for me?"),
    ("How much would ", "braces", " cost with my plan?"),
    ("I am planning to get ", "clear aligners", ""),
    ("Can you check my coverage for ", "dentures", "?"),
    ("My dentist proposed a ", "bridge", ""),
    ("What would I pay for a ", "cleaning", "?"),
    ("I may need ", "veneers", ""),
    ("Can you help me with a ", "dental exam", "?"),
]

PROCEDURE_SYNONYMS = {
    "cleaning": ["regular cleaning", "routine teeth cleaning"],
    "exam-xrays": ["dental exam", "dental x rays"],
    "filling": ["fill my cavity", "tooth filling"],
    "extraction": ["tooth pulled", "pull a tooth"],
    "root-canal": ["endodontic treatment"],
    "crown-bridge": ["tooth crown", "fixed dental bridge"],
    "implant": ["tooth replacement implant"],
    "dentures": ["full dentures", "partial denture"],
    "orthodontics": ["metal braces", "traditional braces"],
}


def phrase_key(phrase):
    return tuple((part.get("text", ""), part.get("parameterId", ""))
                 for part in phrase.get("parts", []))


def add_phrases(intent):
    updated = copy.deepcopy(intent)
    phrases = updated.setdefault("trainingPhrases", [])
    existing = {phrase_key(phrase) for phrase in phrases}
    added = 0
    for prefix, procedure, suffix in PROCEDURE_PHRASES:
        parts = []
        if prefix:
            parts.append({"text": prefix})
        parts.append({"text": procedure, "parameterId": "procedure_id"})
        if suffix:
            parts.append({"text": suffix})
        phrase = {"parts": parts, "repeatCount": 1}
        if phrase_key(phrase) not in existing:
            phrases.append(phrase)
            existing.add(phrase_key(phrase))
            added += 1
    return updated, added


def repair_article_annotations(intent):
    """Correct only this batch's article spans, keeping live phrase IDs."""
    updated = copy.deepcopy(intent)
    expected_text = {prefix + procedure + suffix
                     for prefix, procedure, suffix in PROCEDURE_PHRASES}
    repaired = 0
    for phrase in updated.get("trainingPhrases", []):
        parts = phrase.get("parts", [])
        if "".join(part.get("text", "") for part in parts) not in expected_text:
            continue
        for index, part in enumerate(parts):
            value = part.get("text", "")
            if part.get("parameterId") != "procedure_id" or index == 0:
                continue
            for article in ("a ", "an "):
                if value.startswith(article):
                    parts[index - 1]["text"] += article
                    part["text"] = value[len(article):]
                    repaired += 1
                    break
    return updated, repaired


def add_synonyms(entity_type):
    updated = copy.deepcopy(entity_type)
    added = 0
    for entry in updated.get("entities", []):
        existing = {synonym.casefold() for synonym in entry.get("synonyms", [])}
        for synonym in PROCEDURE_SYNONYMS.get(entry["value"], []):
            if synonym.casefold() not in existing:
                entry.setdefault("synonyms", []).append(synonym)
                existing.add(synonym.casefold())
                added += 1
    return updated, added


def resource_request(method, name, token, body=None, *, update_mask=None):
    suffix = "?languageCode=en"
    if update_mask:
        suffix += "&" + urllib.parse.urlencode({"updateMask": update_mask})
    url = "https://us-east1-dialogflow.googleapis.com/v3/" + name + suffix
    request = urllib.request.Request(
        url,
        method=method,
        headers={"Authorization": "Bearer " + token,
                 "X-Goog-User-Project": "cyb3r-pirates",
                 "Content-Type": "application/json"},
        data=None if body is None else json.dumps(body).encode(),
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--repair-articles", action="store_true")
    args = parser.parse_args()
    snapshot = json.loads(args.snapshot.read_text())
    intent = next(i for i in snapshot["intents"] if i["displayName"] == "procedure.direct")
    entity = next(e for e in snapshot["entities"] if e["displayName"] == "dental_procedure")
    if not intent["name"].startswith("projects/cyb3r-pirates/locations/us-east1/agents/"):
        raise SystemExit("Unexpected target agent; no changes made.")
    if not entity["name"].startswith(snapshot["agent"]["name"] + "/"):
        raise SystemExit("Entity does not belong to the snapshotted agent.")
    if args.repair_articles:
        intent_after, repair_count = repair_article_annotations(intent)
        entity_after, synonym_count = entity, 0
        print(json.dumps({"preview": True, "intent": "procedure.direct",
                          "article_spans_to_correct": repair_count}))
    else:
        intent_after, phrase_count = add_phrases(intent)
        entity_after, synonym_count = add_synonyms(entity)
        print(json.dumps({"preview": True, "intent": "procedure.direct",
                          "existing_phrases": len(intent.get("trainingPhrases", [])),
                          "new_phrases": phrase_count,
                          "entity": "dental_procedure", "new_synonyms": synonym_count}))
    if not args.apply:
        return
    token = subprocess.run(["gcloud", "auth", "print-access-token"], check=True,
                           text=True, capture_output=True).stdout.strip()
    current_intent = resource_request("GET", intent["name"], token)
    current_entity = resource_request("GET", entity["name"], token)
    if current_intent.get("trainingPhrases", []) != intent.get("trainingPhrases", []):
        raise SystemExit("Intent training changed since snapshot; no changes made.")
    if current_entity.get("entities", []) != entity.get("entities", []):
        raise SystemExit("Procedure entity changed since snapshot; no changes made.")
    resource_request("PATCH", intent["name"], token,
                     {"name": intent["name"], "trainingPhrases": intent_after["trainingPhrases"]},
                     update_mask="trainingPhrases")
    if not args.repair_articles:
        resource_request("PATCH", entity["name"], token,
                         {"name": entity["name"], "entities": entity_after["entities"]},
                         update_mask="entities")
    verified_intent = resource_request("GET", intent["name"], token)
    verified_entity = resource_request("GET", entity["name"], token)
    wanted_phrases = {phrase_key(p) for p in intent_after["trainingPhrases"]}
    actual_phrases = {phrase_key(p) for p in verified_intent["trainingPhrases"]}
    wanted_entities = {entry["value"]: set(entry["synonyms"])
                       for entry in entity_after["entities"]}
    actual_entities = {entry["value"]: set(entry["synonyms"])
                       for entry in verified_entity["entities"]}
    if not wanted_phrases.issubset(actual_phrases) or wanted_entities != actual_entities:
        raise SystemExit("Live readback did not match proposed training; inspect the agent.")
    print(json.dumps({"verified": True,
                      "phrase_total": len(verified_intent["trainingPhrases"]),
                      "new_synonyms": synonym_count}))


if __name__ == "__main__":
    main()
