import unittest
from knowledge import retrieve


class LabKnowledgeTests(unittest.TestCase):
    def setUp(self):
        self.record = dict(id="fixture", version="qa-1", status="approved",
                           scope="industry", tenant=None, industry="fashion",
                           topic="đổi size", answer="Nội dung thử nghiệm")
        self.shop = dict(self.record, scope="shop", tenant="A", id="fixture-A")

    def ask(self, *records, tenant="A", industry="fashion", question="doi size"):
        return retrieve(question, records, tenant=tenant, industry=industry)

    def test_scoped_override_with_unaccented_question(self):
        self.assertEqual(self.ask(self.record, self.shop)["id"], "fixture-A")

    def test_no_cross_store_or_anonymous(self):
        self.assertIsNone(self.ask(self.shop, tenant="B"))
        self.assertIsNone(self.ask(self.record, tenant=None))

    def test_no_cross_industry_or_mislabelled_shop(self):
        self.assertIsNone(self.ask(self.record, industry="grocery"))
        self.assertIsNone(self.ask(dict(self.record, tenant="B")))

    def test_drafts_conflicts_missing_versions_and_unknowns(self):
        for change in ({"version":""}, {"status":"draft"}, {"scope":"public"}):
            self.assertIsNone(self.ask(dict(self.record, **change)))
        self.assertIsNone(self.ask(self.record, dict(self.record, id="conflict")))
        self.assertIsNone(self.ask(self.record, question="phí mỗi tháng"))
