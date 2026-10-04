import unittest

from tools.dialogflow.plan_change import plan_change_intent, plan_change_routes


class PlanChangeTests(unittest.TestCase):
    def test_training_covers_current_plan_and_switching_questions(self):
        phrases = [part["text"] for phrase in plan_change_intent()["trainingPhrases"]
                   for part in phrase["parts"]]
        self.assertGreaterEqual(len(phrases), 10)
        self.assertEqual(len(phrases), len(set(phrases)))
        self.assertIn("Can I switch to a different dental plan?", phrases)
        self.assertIn("Does my employer offer a different dental plan?", phrases)

    def test_guidance_keeps_current_page_and_existing_routes(self):
        original = [{"intent": "intent/help", "triggerFulfillment": {"messages": []}},
                    {"condition": "true", "targetPage": "page/menu"}]
        routes = plan_change_routes(original, "intent/plan-change")
        self.assertEqual(routes[1:], original)
        self.assertEqual(original[0]["intent"], "intent/help")
        self.assertEqual(routes[0]["intent"], "intent/plan-change")
        self.assertNotIn("targetPage", routes[0])
        response = routes[0]["triggerFulfillment"]["messages"][0]["text"]["text"][0]
        self.assertIn("HR", response)
        self.assertIn("current plan", response)
        self.assertIn("procedure", response)


if __name__ == "__main__":
    unittest.main()
