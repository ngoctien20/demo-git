"""Offline safety contract checks for staged private Postgres Agent Factory migration.
These tests do not reach Supabase, n8n or incur model costs.
"""
import pathlib
import re
import unittest

SQL = (pathlib.Path(__file__).resolve().parents[1] / "sql" / "control_plane_v1.sql").read_text("utf-8")

class PrivateFactorySchemaContract(unittest.TestCase):
    def test_private_schema_and_no_browser_api_grants(self):
        self.assertIn("CREATE SCHEMA IF NOT EXISTS factory_private",SQL)
        self.assertIn("REVOKE ALL ON SCHEMA factory_private FROM PUBLIC, anon, authenticated",SQL)
        self.assertIn("REVOKE ALL ON ALL FUNCTIONS IN SCHEMA factory_private FROM PUBLIC,anon,authenticated",SQL)
        self.assertIn("REVOKE ALL ON ALL TABLES IN SCHEMA factory_private FROM PUBLIC,anon,authenticated",SQL)
    def test_five_rls_tables(self):
        for table in ("agents","config","tasks","events","agent_runs"):
            with self.subTest(table=table):
                self.assertIn("ALTER TABLE factory_private."+table+" ENABLE ROW LEVEL SECURITY",SQL)
    def test_only_existing_agent_ids_in_registry(self):
        for agent_id in ("HbTA0yKnJSoVAhJE","QAvg1lczAAwo2iWN","cVrtLOENAUSGhEfL","SZrYOLXZt2MdcTDc"):
            self.assertIn(agent_id,SQL)
    def test_default_zero_budget_and_two_parallel(self):
        self.assertIn("max_parallel integer NOT NULL DEFAULT 2",SQL)
        self.assertIn("max_fix_rounds integer NOT NULL DEFAULT 2",SQL)
        self.assertIn("max_monthly_budget_cents integer NOT NULL DEFAULT 0",SQL)
        self.assertIn("budget_cents integer NOT NULL DEFAULT 0",SQL)
    def test_lease_row_lock_and_revision_cas(self):
        self.assertIn("FOR UPDATE",SQL)
        self.assertIn("STALE_REVISION",SQL)
        self.assertIn("LEASE_REQUIRED",SQL)
        self.assertIn("pg_advisory_xact_lock",SQL)
    def test_independent_qa_and_review_required(self):
        self.assertIn("INDEPENDENT_QA_EVIDENCE_REQUIRED",SQL)
        self.assertIn("INDEPENDENT_REVIEW_EVIDENCE_REQUIRED",SQL)
        self.assertIn("RELEASE_GATES_NOT_MET",SQL)
        self.assertIn("review_sha",SQL)
    def test_production_and_model_cost_fail_closed(self):
        self.assertIn("PRODUCTION_FORBIDDEN",SQL)
        self.assertIn("MODEL_CALL_REQUIRES_SEPARATE_BUDGET_APPROVAL",SQL)
        self.assertIn("BUDGET_EXCEEDED",SQL)
    def test_no_security_definer_or_public_api_side_effects(self):
        self.assertNotIn("SECURITY DEFINER",SQL)
        self.assertNotRegex(SQL,r"\bCREATE\s+TABLE\s+public\.")
        self.assertNotRegex(SQL,r"\bGRANT\s+(?:INSERT|UPDATE|DELETE|ALL)\b")
    def test_event_id_deduplication(self):
        self.assertIn("UNIQUE(task_key,event_id)",SQL)
        self.assertIn("UNIQUE(task_key,revision)",SQL)
        self.assertIn("RETURN t.revision; -- idempotent replay",SQL)

if __name__=="__main__": unittest.main()
