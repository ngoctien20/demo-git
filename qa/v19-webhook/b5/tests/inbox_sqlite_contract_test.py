#!/usr/bin/env python3
"""B5 local SQLite semantics on exact SQL extracted from candidate Worker code.
No credentials, no remote D1, no webhook, no production commerce.
"""
import pathlib,re,sqlite3,tempfile,threading,unittest
from concurrent.futures import ThreadPoolExecutor

BASE=pathlib.Path(__file__).resolve().parents[1]
CODE=(BASE/"durable-inbox-contract.mjs").read_text()
SCHEMA=(BASE/"sql"/"001_local_worker_binding_qa.sql").read_text()
NOW=1795000000000
SCOPE="a"*64
EVENT="b"*64
PAYLOAD="c"*64

def sql(name):
    match=re.search(r'^\s*'+re.escape(name)+r':\[(.*?)\]\.join\(" "\)',CODE,re.S|re.M)
    if match is None:
        raise AssertionError("No Worker SQL: "+name)
    return " ".join(re.findall(r'"([^"]*)"',match.group(1)))
ADMIT=sql("admit")
CLAIM=sql("claim")
ACK=sql("ack")
FAIL=sql("fail")
SWEEP=sql("sweepExhausted")

class InboxSQL(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(":memory:",isolation_level=None)
        self.db.executescript(SCHEMA)
    def tearDown(self):
        self.db.close()
    def admit(self,db=None,event=EVENT,payload=PAYLOAD,fixture="QA_FIXTURE_SQL"):
        return (db or self.db).execute(ADMIT,(SCOPE,event,payload,fixture,NOW)).fetchone()
    def claim(self,now=NOW,token="lease-qa-test",event=EVENT,db=None,lease=500):
        return (db or self.db).execute(CLAIM,(SCOPE,event,now,token,now+lease)).fetchone()

    def test_admit_once_and_duplicate_count(self):
        self.assertEqual(self.admit(),("QA_READY_NO_SEND",1))
        self.assertEqual(self.admit(),("QA_READY_NO_SEND",2))
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM v19_b5_qa_inbox").fetchone(),(1,))

    def test_changed_payload_or_fixture_rejected(self):
        self.admit()
        self.assertIsNone(self.admit(payload="e"*64))
        self.assertIsNone(self.admit(fixture="QA_FIXTURE_OTHER"))
        self.assertEqual(self.db.execute("SELECT delivery_observations FROM v19_b5_qa_inbox").fetchone(),(1,))

    def test_claim_only_once_then_valid_ack(self):
        self.admit()
        self.assertEqual(self.claim(),("QA_LEASED_NO_SEND",1,"lease-qa-test"))
        self.assertIsNone(self.claim(token="different"))
        self.assertEqual(self.db.execute(ACK,(SCOPE,EVENT,"lease-qa-test",NOW+2)).fetchone(),("QA_DONE_NO_SEND",1))
        self.assertIsNone(self.claim(now=NOW+1000,token="late"))

    def test_stale_ack_after_lease_expiry_denied(self):
        self.admit();self.claim(lease=100)
        self.assertIsNone(self.db.execute(ACK,(SCOPE,EVENT,"lease-qa-test",NOW+101)).fetchone())
        self.assertEqual(self.claim(now=NOW+101,token="new-token"),("QA_LEASED_NO_SEND",2,"new-token"))
        self.assertIsNone(self.db.execute(ACK,(SCOPE,EVENT,"lease-qa-test",NOW+102)).fetchone())

    def test_failure_backoff_and_dead_letter_three_attempts(self):
        self.admit()
        now=NOW
        for idx in range(1,4):
            token="lease-"+str(idx)
            self.assertEqual(self.claim(now=now,token=token),("QA_LEASED_NO_SEND",idx,token))
            result=self.db.execute(FAIL,(SCOPE,EVENT,token,now+1,now+201,"QA_ERROR")).fetchone()
            self.assertEqual(result,(("QA_RETRY_NO_SEND" if idx<3 else "QA_DLQ_NO_SEND"),idx))
            self.assertIsNone(self.claim(now=now+199,token="premature"))
            now+=250
        self.assertIsNone(self.claim(now=now,token="exhausted"))

    def test_expired_third_lease_can_be_swept_to_dead_letter(self):
        self.admit()
        for idx,offset in enumerate((0,101,202),start=1):
            now=NOW+offset
            self.assertEqual(self.claim(now=now,token="lease-"+str(idx),lease=100)[1],idx)
        row=self.db.execute(SWEEP,(SCOPE,EVENT,NOW+303)).fetchone()
        self.assertEqual(row,("QA_DLQ_NO_SEND",3))
        self.assertIsNone(self.db.execute(SWEEP,(SCOPE,EVENT,NOW+304)).fetchone())

    def test_fixture_constraint_prevents_non_synthetic_content(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.admit(fixture="REAL_CUSTOMER_CHAT")
        with self.assertRaises(sqlite3.IntegrityError):
            self.admit(fixture="QA_FIXTURE_bad")

    def test_concurrent_exact_inbox_claim_is_atomic(self):
        with tempfile.TemporaryDirectory() as td:
            dbpath=pathlib.Path(td)/"local.sqlite"
            setup=sqlite3.connect(dbpath)
            setup.executescript(SCHEMA)
            setup.execute(ADMIT,(SCOPE,EVENT,PAYLOAD,"QA_FIXTURE_CONCURRENT",NOW))
            setup.commit();setup.close()
            barrier=threading.Barrier(8)
            def worker(n):
                d=sqlite3.connect(dbpath,timeout=15,isolation_level=None)
                d.execute("PRAGMA busy_timeout=15000")
                barrier.wait(timeout=10)
                try:return d.execute(CLAIM,(SCOPE,EVENT,NOW,"lease-"+str(n),NOW+500)).fetchone()
                finally:d.close()
            with ThreadPoolExecutor(max_workers=8) as ex:
                results=list(ex.map(worker,range(8)))
            self.assertEqual(sum(1 for r in results if r is not None),1)
            check=sqlite3.connect(dbpath)
            self.assertEqual(check.execute("SELECT attempts FROM v19_b5_qa_inbox").fetchone(),(1,))
            check.close()

if __name__=="__main__":
    unittest.main(verbosity=2)
