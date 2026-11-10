import unittest
from check_fixture import check, PREFIX


class FixtureTests(unittest.TestCase):
    def fixture(self, *nodes):
        return {"active": False, "nodes": [{"type": PREFIX + "manualTrigger"}, *nodes]}

    def test_inert_fixture(self):
        self.assertTrue(check(self.fixture({"type": PREFIX + "noOp"})))

    def test_reject_external_or_unknown(self):
        for suffix in ("httpRequest", "googleSheets", "executeWorkflow", "code", "webhook", "other"):
            with self.subTest(suffix=suffix):
                self.assertFalse(check(self.fixture({"type": PREFIX + suffix})))

    def test_reject_active_and_missing_metadata(self):
        graph = self.fixture()
        for active in (True, None):
            graph["active"] = active
            self.assertFalse(check(graph))

    def test_reject_credentials_and_node_parameters(self):
        for extra in ({"credentials": {"mock": {}}}, {"parameters": {"value": "expression"}}):
            self.assertFalse(check(self.fixture({"type": PREFIX + "noOp", **extra})))

    def test_require_one_trigger(self):
        self.assertFalse(check({"active": False, "nodes": []}))
        self.assertFalse(check(self.fixture({"type": PREFIX + "manualTrigger"})))
