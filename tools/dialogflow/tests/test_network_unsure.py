import unittest

from tools.dialogflow.network_unsure import (
    guide_page_body, network_routes, unsure_intent_body,
)


class NetworkUnsureTests(unittest.TestCase):
    def test_intent_has_distinct_unsure_examples(self):
        body = unsure_intent_body()
        phrases = [p["parts"][0]["text"] for p in body["trainingPhrases"]]
        self.assertGreaterEqual(len(phrases), 8)
        self.assertEqual(len(set(phrases)), len(phrases))
        self.assertIn("I don't know if my dentist is in network", phrases)

    def test_guide_explains_next_step_and_returns_to_existing_network_page(self):
        network_name = "agents/demo/flows/start/pages/network"
        body = guide_page_body(network_name)
        self.assertIn("Network Unsure", body["displayName"])
        text = body["entryFulfillment"]["messages"][0]["text"]["text"][0]
        self.assertIn("ask your dentist", text.casefold())
        self.assertIn("switch later", text)
        self.assertEqual(body["transitionRoutes"],
                         [{"condition": "true", "targetPage": network_name}])

    def test_network_route_preserves_completion_route(self):
        original = [{"condition": '$page.params.status = "FINAL"',
                     "targetPage": "estimate", "name": "old"}]
        routes = network_routes(original, "intent/unsure", "page/guide")
        self.assertEqual(len(routes), 2)
        self.assertEqual(routes[1], original[0])
        self.assertEqual(routes[0], {"intent": "intent/unsure",
                                     "targetPage": "page/guide"})
        self.assertEqual(len(original), 1)


if __name__ == "__main__":
    unittest.main()
