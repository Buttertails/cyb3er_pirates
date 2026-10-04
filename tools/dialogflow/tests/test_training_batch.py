import copy
import unittest

from tools.dialogflow.training_batch import (
    add_phrases, add_synonyms, phrase_key, repair_article_annotations,
)


class TrainingBatchTests(unittest.TestCase):
    def test_add_phrases_preserves_existing_and_annotates_procedure(self):
        original = {
            "name": "agents/demo/intents/procedure",
            "trainingPhrases": [
                {"id": "old", "parts": [{"text": "I need "},
                                         {"text": "braces", "parameterId": "procedure_id"}]}
            ],
        }
        unchanged = copy.deepcopy(original)
        updated, added = add_phrases(original)
        self.assertEqual(original, unchanged)
        self.assertEqual(updated["trainingPhrases"][0], original["trainingPhrases"][0])
        self.assertGreaterEqual(added, 8)
        self.assertEqual(len({phrase_key(p) for p in updated["trainingPhrases"]}),
                         len(updated["trainingPhrases"]))
        for phrase in updated["trainingPhrases"][1:]:
            self.assertEqual(sum(part.get("parameterId") == "procedure_id"
                                 for part in phrase["parts"]), 1)
            value = next(part["text"] for part in phrase["parts"]
                         if part.get("parameterId") == "procedure_id")
            self.assertFalse(value.startswith(("a ", "an ")))
        twice, second_add = add_phrases(updated)
        self.assertEqual(second_add, 0)
        self.assertEqual(twice, updated)

    def test_add_synonyms_only_expands_existing_canonical_values(self):
        original = {"entities": [
            {"value": "filling", "synonyms": ["filling", "cavity filling"]},
            {"value": "orthodontics", "synonyms": ["orthodontics", "braces"]},
        ]}
        unchanged = copy.deepcopy(original)
        updated, added = add_synonyms(original)
        self.assertEqual(original, unchanged)
        self.assertGreater(added, 0)
        self.assertEqual([entry["value"] for entry in updated["entities"]],
                         ["filling", "orthodontics"])
        self.assertIn("cavity filling", updated["entities"][0]["synonyms"])
        self.assertIn("metal braces", updated["entities"][1]["synonyms"])
        twice, second_add = add_synonyms(updated)
        self.assertEqual(second_add, 0)
        self.assertEqual(twice, updated)

    def test_repair_our_article_annotation_without_changing_words_or_id(self):
        original = {"trainingPhrases": [
            {"id": "live-id", "parts": [
                {"text": "My dentist says I need "},
                {"text": "a filling", "parameterId": "procedure_id"},
            ]},
            {"id": "other", "parts": [{"text": "Someone wants a ", "parameterId": "other"}]},
        ]}
        updated, repaired = repair_article_annotations(original)
        self.assertEqual(repaired, 1)
        self.assertEqual(updated["trainingPhrases"][0]["id"], "live-id")
        self.assertEqual(updated["trainingPhrases"][0]["parts"], [
            {"text": "My dentist says I need a "},
            {"text": "filling", "parameterId": "procedure_id"},
        ])
        self.assertEqual(updated["trainingPhrases"][1], original["trainingPhrases"][1])
        self.assertEqual(original["trainingPhrases"][0]["parts"][1]["text"], "a filling")


if __name__ == "__main__":
    unittest.main()
