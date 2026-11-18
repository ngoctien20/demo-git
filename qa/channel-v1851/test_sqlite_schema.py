"""V18.5.1 SQLite schema contract QA. Local disposable DB, NEVER real D1."""
from __future__ import annotations
import hashlib
import hmac
import sqlite3
import tempfile
import threading
import unittest
from pathlib import Path

SCHEMA = Path(__file__).with_name("d1-private-schema-preview.sql").read_text()
KEY = b"TIEN404_SYNTHETIC_D1_LEDGER_KEY_NOT_REAL_123456"
NOW = 1795000000000

def digest(*parts: str) -> str:
    return hmac.new(KEY, "|".join(parts).encode(), hashlib.sha256).hexdigest()

class D1Preview(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.dbpath = str(Path(self.temp.name) / "offline_qa.sqlite")
        with sqlite3.connect(self.dbpath) as db:
            db.executescript(SCHEMA)
            db.execute(
                "INSERT INTO qa_widget_installations "
                "(widget_id,tenant_id,store_id,mode,install_version,status,"
                "allowed_origin,domain_verified_at_ms,domain_verified_until_ms,"
                "subscription_active,shop_active,approved_at_ms,updated_at_ms)"
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                ("widget_a","tenant_shared","store_a","MERCHANT_SANDBOX",1,"RELEASED",
                 "https://shop-a.qa.invalid",NOW-10000,NOW+100000,1,1,NOW-10000,NOW)
            )
            db.execute(
                "INSERT INTO qa_widget_installations "
                "(widget_id,tenant_id,store_id,mode,install_version,status,"
                "allowed_origin,domain_verified_at_ms,domain_verified_until_ms,"
                "subscription_active,shop_active,approved_at_ms,updated_at_ms)"
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                ("widget_b","tenant_shared","store_b","MERCHANT_SANDBOX",1,"RELEASED",
                 "https://shop-b.qa.invalid",NOW-10000,NOW+100000,1,1,NOW-10000,NOW)
            )
    def tearDown(self):
        self.temp.cleanup()

    def test_different_store_ids_are_independently_indexed(self):
        with sqlite3.connect(self.dbpath) as db:
            rows=db.execute(
                "SELECT store_id FROM qa_widget_installations "
                "WHERE tenant_id=? AND widget_id=? AND status='RELEASED'",
                ("tenant_shared","widget_b")
            ).fetchall()
            self.assertEqual(rows,[("store_b",)])
            self.assertNotEqual(
                digest("tenant_shared","store_a","widget_a","evt_1"),
                digest("tenant_shared","store_b","widget_b","evt_1")
            )

    def test_event_digest_insert_or_ignore_replay(self):
        item=digest("tenant_shared","store_a","widget_a","signed_session_x","event_1")
        with sqlite3.connect(self.dbpath) as db:
            result1=db.execute(
                "INSERT OR IGNORE INTO qa_widget_event_claims "
                "(event_digest,widget_id,expires_at_ms,created_at_ms)"
                "VALUES(?,?,?,?)",(item,"widget_a",NOW+900000,NOW))
            self.assertEqual(result1.rowcount,1)
            result2=db.execute(
                "INSERT OR IGNORE INTO qa_widget_event_claims "
                "(event_digest,widget_id,expires_at_ms,created_at_ms)"
                "VALUES(?,?,?,?)",(item,"widget_a",NOW+900000,NOW))
            self.assertEqual(result2.rowcount,0)
            total=db.execute("SELECT COUNT(*) FROM qa_widget_event_claims").fetchone()[0]
            self.assertEqual(total,1)

    def test_quota_atomic_upsert_denies_after_limit(self):
        bucket=digest("tenant_shared","store_a","widget_a","PUBLIC_PREVIEW","minute_1")
        sql=(
            "INSERT INTO qa_widget_quota_buckets "
            "(bucket_digest,widget_id,operation,bucket_start_ms,count,expires_at_ms)"
            "VALUES (?,?,?,?,1,?) "
            "ON CONFLICT(bucket_digest) DO UPDATE SET "
            "count=qa_widget_quota_buckets.count+1 "
            "WHERE qa_widget_quota_buckets.count < ? "
            "RETURNING count")
        with sqlite3.connect(self.dbpath) as db:
            values=[]
            for _ in range(5):
                row=db.execute(sql,(bucket,"widget_a","PUBLIC_PREVIEW",NOW, NOW+120000,3)).fetchone()
                values.append(None if row is None else row[0])
            self.assertEqual(values,[1,2,3,None,None])
            self.assertEqual(db.execute(
                "SELECT count FROM qa_widget_quota_buckets WHERE bucket_digest=?",
                (bucket,)
            ).fetchone()[0],3)

    def test_cross_connection_same_event_stays_one(self):
        event=digest("tenant_shared","store_a","widget_a","signed_session_x","evt_race")
        result=[]
        lock=threading.Lock()
        def claim():
            with sqlite3.connect(self.dbpath,timeout=3) as db:
                changed=db.execute(
                    "INSERT OR IGNORE INTO qa_widget_event_claims "
                    "(event_digest,widget_id,expires_at_ms,created_at_ms)"
                    "VALUES(?,?,?,?)",(event,"widget_a",NOW+900000,NOW)
                ).rowcount
            with lock:result.append(changed)
        threads=[threading.Thread(target=claim) for _ in range(6)]
        for t in threads:t.start()
        for t in threads:t.join()
        self.assertEqual(sorted(result),[0,0,0,0,0,1])

    def test_bad_mode_and_negative_quota_rejected(self):
        with sqlite3.connect(self.dbpath) as db:
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute(
                    "UPDATE qa_widget_installations SET mode='PRODUCTION_ADMIN' "
                    "WHERE widget_id='widget_a'")
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute(
                    "INSERT INTO qa_widget_quota_buckets "
                    "(bucket_digest,widget_id,operation,bucket_start_ms,count,expires_at_ms)"
                    "VALUES(?,?,?,?,?,?)",
                    (digest("negative"),"widget_a","SESSION_OPEN",NOW,-1,NOW+100000)
                )

if __name__=="__main__":
    unittest.main()
