#!/usr/bin/env python3
"""Offline SQLite validation for the EXACT SQL strings in ingress-candidate.mjs.
No Cloudflare D1 connection, no remote requests, no credentials.
"""
import pathlib
import re
import sqlite3
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = (ROOT / "ingress-candidate.mjs").read_text()
SCHEMA = (ROOT / "sql" / "001_disposable_only.sql").read_text()

def sql(name):
    match = re.search(
        r'export const ' + re.escape(name) + r' = \[(.*?)\]\.join\(" "\);',
        SOURCE, flags=re.S
    )
    if not match:
        raise AssertionError("Missing SQL constant " + name)
    return " ".join(re.findall(r'"([^"]+)"', match.group(1)))

RATE = sql("RATE_SQL")
EVENT = sql("EVENT_SQL")
SCOPE_A = "a" * 64
SCOPE_B = "b" * 64
EVENT_X = "c" * 64
PAYLOAD_X = "d" * 64
PAYLOAD_Y = "e" * 64
NOW = 1795000000000
BUCKET = NOW - NOW % 60000

class SQLiteSemantics(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:", isolation_level=None)
        self.db.executescript(SCHEMA)

    def tearDown(self):
        self.db.close()

    def rate(self, scope=SCOPE_A, bucket=BUCKET, maximum=3):
        return self.db.execute(RATE, (scope, bucket, NOW, maximum)).fetchone()

    def event(self, scope=SCOPE_A, event=EVENT_X, payload=PAYLOAD_X):
        return self.db.execute(EVENT, (scope,event,payload,NOW)).fetchone()

    def test_atomic_sqlite_rate_1_to_limit_and_null_over_limit(self):
        self.assertEqual(self.rate(), (1,))
        self.assertEqual(self.rate(), (2,))
        self.assertEqual(self.rate(), (3,))
        self.assertIsNone(self.rate())
        self.assertEqual(
            self.db.execute("SELECT hits FROM v19_b3_rate_windows").fetchone(),
            (3,)
        )

    def test_buckets_and_installations_are_independent(self):
        for _ in range(3):
            self.rate(SCOPE_A,BUCKET)
        self.assertIsNone(self.rate(SCOPE_A,BUCKET))
        self.assertEqual(self.rate(SCOPE_A,BUCKET+60000), (1,))
        self.assertEqual(self.rate(SCOPE_B,BUCKET), (1,))
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM v19_b3_rate_windows").fetchone(), (3,))

    def test_event_retry_one_row_and_attempt_count(self):
        self.assertEqual(self.event(), (1,))
        self.assertEqual(self.event(), (2,))
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM v19_b3_event_claims").fetchone(), (1,))
        self.assertEqual(self.db.execute("SELECT state,attempts FROM v19_b3_event_claims").fetchone(), ("QA_ADMITTED_NO_SEND",2))

    def test_same_id_changed_payload_is_rejected_by_one_statement(self):
        self.assertEqual(self.event(), (1,))
        self.assertIsNone(self.event(payload=PAYLOAD_Y))
        self.assertEqual(self.db.execute("SELECT attempts,payload_key FROM v19_b3_event_claims").fetchone(), (1,PAYLOAD_X))

    def test_same_event_key_different_installations_two_rows(self):
        self.assertEqual(self.event(SCOPE_A), (1,))
        self.assertEqual(self.event(SCOPE_B), (1,))
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM v19_b3_event_claims").fetchone(), (2,))

    def test_primary_key_and_scope_constraints(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO v19_b3_event_claims VALUES(?,?,?,?,?,?)",
                ("invalid",EVENT_X,PAYLOAD_X,NOW,1,"QA_ADMITTED_NO_SEND")
            )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO v19_b3_event_claims VALUES(?,?,?,?,?,?)",
                (SCOPE_A,EVENT_X,PAYLOAD_X,NOW,1,"LIVE_SENT")
            )

    def test_rate_is_atomic_under_concurrent_writers(self):
        # Real local SQLite, separate connections, exact SQL candidate.
        # NOT Cloudflare D1 operational integration, but validates SQL semantics.
        with tempfile.TemporaryDirectory() as temporary:
            path = pathlib.Path(temporary) / "isolated.sqlite3"
            init = sqlite3.connect(path)
            init.executescript(SCHEMA)
            init.commit()
            init.close()
            workers=10
            barrier=threading.Barrier(workers)

            def attempt(_):
                db=sqlite3.connect(path, timeout=15, isolation_level=None)
                db.execute("PRAGMA busy_timeout=15000")
                barrier.wait(timeout=10)
                try:
                    row=db.execute(RATE,(SCOPE_A,BUCKET,NOW,4)).fetchone()
                    return row is not None
                finally:
                    db.close()

            with ThreadPoolExecutor(max_workers=workers) as pool:
                outcomes=list(pool.map(attempt,range(workers)))
            self.assertEqual(sum(outcomes),4)
            verify=sqlite3.connect(path)
            try:
                self.assertEqual(verify.execute("SELECT hits FROM v19_b3_rate_windows").fetchone(),(4,))
            finally:
                verify.close()

    def test_event_claim_is_atomic_under_concurrent_identical_writers(self):
        with tempfile.TemporaryDirectory() as temporary:
            path=pathlib.Path(temporary)/"claims.sqlite3"
            init=sqlite3.connect(path)
            init.executescript(SCHEMA)
            init.commit()
            init.close()
            workers=8
            barrier=threading.Barrier(workers)

            def attempt(_):
                db=sqlite3.connect(path, timeout=15, isolation_level=None)
                db.execute("PRAGMA busy_timeout=15000")
                barrier.wait(timeout=10)
                try:
                    return db.execute(EVENT,(SCOPE_A,EVENT_X,PAYLOAD_X,NOW)).fetchone()
                finally:
                    db.close()
            with ThreadPoolExecutor(max_workers=workers) as pool:
                results=list(pool.map(attempt,range(workers)))
            self.assertEqual(sorted(x[0] for x in results),list(range(1,workers+1)))
            verify=sqlite3.connect(path)
            try:
                self.assertEqual(
                    verify.execute("SELECT COUNT(*), MAX(attempts) FROM v19_b3_event_claims").fetchone(),
                    (1,workers)
                )
            finally:verify.close()

if __name__ == "__main__":
    unittest.main(verbosity=2)
