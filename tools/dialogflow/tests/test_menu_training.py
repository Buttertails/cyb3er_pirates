import copy
import unittest

from tools.dialogflow.menu_training import expand_intent, expand_network_entity


class MenuTrainingTests(unittest.TestCase):
    def test_expands_each_menu_intent_without_changing_existing_examples(self):
        for name in ("benefits.review", "estimate.start", "network.compare"):
            original = {"displayName": name, "trainingPhrases": [
                {"id": "old", "parts": [{"text": "original phrase"}]},
            ]}
            unchanged = copy.deepcopy(original)
            updated, added = expand_intent(original)
            self.assertEqual(original, unchanged)
            self.assertEqual(updated["trainingPhrases"][0], original["trainingPhrases"][0])
            self.assertGreaterEqual(added, 8)
            self.assertEqual(len({p["parts"][0]["text"].casefold()
                                  for p in updated["trainingPhrases"]}),
                             len(updated["trainingPhrases"]))
            twice, second_add = expand_intent(updated)
            self.assertEqual(second_add, 0)
            self.assertEqual(twice, updated)

    def test_network_aliases_preserve_canonical_values(self):
        original = {"entities": [
            {"value": "in_network", "synonyms": ["in network"]},
            {"value": "out_of_network", "synonyms": ["out of network"]},
        ]}
        updated, added = expand_network_entity(original)
        self.assertEqual(added, 6)
        self.assertEqual([e["value"] for e in updated["entities"]],
                         ["in_network", "out_of_network"])
        self.assertIn("outside my network", updated["entities"][1]["synonyms"])
        self.assertEqual(original["entities"][1]["synonyms"], ["out of network"])


if __name__ == "__main__":
    unittest.main()
