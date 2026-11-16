"""Independent disposable SQLite concurrency tests (NO Meta sends).
Uses unique constraints and separate connections/processes, not an in-memory
Set. This DOES NOT certify Supabase PostgreSQL RLS or live n8n concurrency.
"""
import concurrent.futures
import multiprocessing
import os
from pathlib import Path
import tempfile
import unittest

from sqlite_one_shot_reference import (
    setup, authorize, claim_once, count_claims, attest_no_real_external_dependency
)

NOW = 1795000000000
CAMPAIGN = "QA_DISPOSABLE_CAMPAIGN_03B"
PAGE = "QA_PAGE_SYNTHETIC_03B"
RECIPIENT = "QA_PSID_SYNTHETIC_03B"
PROFILE = "QA_GREETING_SHA_SYNTHETIC_03B"
EVENT = "QA_META_MID_SYNTHETIC_03B"
MARKER = "TIEN404-CANARY-LIVE02"


def attempt(db_path: str, event: str = EVENT, campaign: str = CAMPAIGN,
            page: str = PAGE, recipient: str = RECIPIENT, profile: str = PROFILE,
            marker: str = MARKER, now_ms: int = NOW):
    return claim_once(db_path, campaign=campaign, page=page,
                      recipient=recipient, profile=profile,
                      event=event, marker=marker, now_ms=now_ms)


def child_claim(db_path, start_event, output):
    start_event.wait(10)
    output.put(attempt(db_path))


class CanaryAtomicOneShotTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = str(Path(self.tmp.name) / "qa_one_shot.db")
        setup(self.path)
        authorize(self.path, campaign=CAMPAIGN, page=PAGE, recipient=RECIPIENT,
                  profile=PROFILE, now_ms=NOW)

    def tearDown(self):
        self.tmp.cleanup()

    def test_one_attempt_succeeds_and_duplicate_is_blocked(self):
        self.assertEqual(attempt(self.path), "CLAIM_WON")
        self.assertEqual(attempt(self.path), "BLOCKED")
        self.assertEqual(count_claims(self.path), 1)

    def test_same_campaign_new_event_does_not_rearm(self):
        self.assertEqual(attempt(self.path), "CLAIM_WON")
        self.assertEqual(attempt(self.path, event="NEW_FAKE_EVENT"), "BLOCKED")
        self.assertEqual(count_claims(self.path), 1)

    def test_same_event_cannot_be_claimed_on_another_campaign(self):
        authorize(self.path, campaign="QA_OTHER_CAMPAIGN", page=PAGE,
                  recipient=RECIPIENT, profile=PROFILE, now_ms=NOW)
        self.assertEqual(attempt(self.path), "CLAIM_WON")
        self.assertEqual(attempt(self.path, campaign="QA_OTHER_CAMPAIGN"), "BLOCKED")
        self.assertEqual(count_claims(self.path), 1)

    def test_wrong_page_is_blocked(self):
        self.assertEqual(attempt(self.path, page="OTHER_PAGE"), "BLOCKED")
        self.assertEqual(count_claims(self.path), 0)

    def test_wrong_recipient_is_blocked(self):
        self.assertEqual(attempt(self.path, recipient="OTHER_PSID"), "BLOCKED")
        self.assertEqual(count_claims(self.path), 0)

    def test_wrong_approved_profile_is_blocked(self):
        self.assertEqual(attempt(self.path, profile="ATTACKER_PROFILE"), "BLOCKED")
        self.assertEqual(count_claims(self.path), 0)

    def test_message_alone_cannot_authorize_without_campaign(self):
        self.assertEqual(attempt(self.path, campaign="NOT_AUTHORIZED"), "BLOCKED")
        self.assertEqual(count_claims(self.path), 0)

    def test_wrong_marker_is_blocked(self):
        self.assertEqual(attempt(self.path, marker="PLACE_ORDER"), "BLOCKED")
        self.assertEqual(count_claims(self.path), 0)

    def test_revoked_campaign_is_blocked(self):
        from sqlite3 import connect
        with connect(self.path) as conn:
            conn.execute("UPDATE approvals SET state='REVOKED'")
        self.assertEqual(attempt(self.path), "BLOCKED")
        self.assertEqual(count_claims(self.path), 0)

    def test_expired_campaign_is_blocked(self):
        self.assertEqual(attempt(self.path, now_ms=NOW+600001), "BLOCKED")
        self.assertEqual(count_claims(self.path), 0)

    def test_not_yet_valid_campaign_is_blocked(self):
        self.assertEqual(attempt(self.path, now_ms=NOW-2000), "BLOCKED")
        self.assertEqual(count_claims(self.path), 0)

    def test_thread_race_24_separate_sqlite_connections_one_winner(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=24) as pool:
            results = list(pool.map(lambda _: attempt(self.path), range(24)))
        self.assertEqual(results.count("CLAIM_WON"), 1, results)
        self.assertEqual(results.count("BLOCKED"), 23, results)
        self.assertEqual(count_claims(self.path), 1)

    def test_process_race_8_independent_workers_one_winner(self):
        ctx = multiprocessing.get_context("fork") if os.name == "posix" \
              else multiprocessing.get_context("spawn")
        start_event, q = ctx.Event(), ctx.Queue()
        workers = [
            ctx.Process(target=child_claim, args=(self.path,start_event,q))
            for _ in range(8)
        ]
        for p in workers:
            p.start()
        start_event.set()
        results = [q.get(timeout=20) for _ in workers]
        for p in workers:
            p.join(20)
            self.assertEqual(p.exitcode, 0)
        self.assertEqual(results.count("CLAIM_WON"), 1, results)
        self.assertEqual(results.count("BLOCKED"), 7, results)
        self.assertEqual(count_claims(self.path), 1)

    def test_commit_survives_worker_reconnect_or_crash_after_claim(self):
        self.assertEqual(attempt(self.path), "CLAIM_WON")
        # Hypothetical worker crash AFTER commit but BEFORE Meta HTTP.
        # New worker MUST NOT attempt a second provider message.
        self.assertEqual(attempt(self.path), "BLOCKED")
        self.assertEqual(count_claims(self.path), 1)

    def test_timeout_unknown_delivery_cannot_be_retried(self):
        self.assertEqual(attempt(self.path), "CLAIM_WON")
        # A provider timeout is NOT reliable evidence of no delivery.
        self.assertEqual(attempt(self.path, event="RETRY_EVENT"), "BLOCKED")
        self.assertEqual(count_claims(self.path), 1)

    def test_unavailable_database_blocks_claim(self):
        result = attempt("/this/path/does/not/exist.db")
        self.assertEqual(result, "ERROR_BLOCKED")

    def test_no_external_send_or_hosted_database_call(self):
        policy = attest_no_real_external_dependency()
        self.assertTrue(policy["fixture_only"])
        self.assertFalse(policy["postgres_implementation_hosted_tested"])
        self.assertEqual(policy["provider_messages_sent"], 0)
        self.assertEqual(policy["orders_written"], 0)
        self.assertFalse(policy["can_send"])
        self.assertFalse(policy["can_publish"])

    def test_postgres_source_contract_is_explicitly_review_only(self):
        base = Path(__file__).resolve().parent
        schema = (base/"PRIVATE_PAGE_ONE_SHOT_SCHEMA_REVIEW_ONLY.sql").read_text()
        claim = (base/"PRIVATE_ONE_SHOT_ATOMIC_CLAIM_REVIEW_ONLY.sql").read_text()
        self.assertIn("FORCE ROW LEVEL SECURITY", schema)
        self.assertIn("REVOKE ALL ON SCHEMA", schema)
        self.assertIn("ON CONFLICT DO NOTHING", claim)
        self.assertIn("FOR UPDATE OF a", claim)
        self.assertIn("RETURNING canary_id", claim)
        self.assertIn("BEGIN TRANSACTION", claim)
        self.assertIn("COMMIT;", claim)
        self.assertNotIn("SECURITY DEFINER", claim.upper())
        self.assertNotIn("GRANT EXECUTE", schema.upper())
        self.assertNotIn("DROP TABLE", schema.upper())

    def test_no_real_meta_tokens_or_psids_in_fixture(self):
        base = Path(__file__).resolve().parent
        joined = (base/"sqlite_one_shot_reference.py").read_text()
        self.assertNotIn("graph.facebook.com", joined)
        self.assertNotIn("pages_messaging_token", joined)
        self.assertNotIn("SUPABASE_SERVICE_ROLE_KEY", joined)


if __name__ == "__main__":
    unittest.main()
