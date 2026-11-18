#!/usr/bin/env python3
"""B4 SQL registry syntax, uniqueness and cross-installation isolation.
Uses only temporary local SQLite; no Supabase, D1, network, credentials, or PII.
"""
import pathlib
import sqlite3
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
SCHEMA=(ROOT/"sql"/"001_disposable_registry_only.sql").read_text()
INSTALL_A="qa-install-"+"a"*20
INSTALL_B="qa-install-"+"b"*20
FPR_A="1"*64
FPR_B="2"*64
NOW=1795000000000

INSERT="""INSERT INTO v19_b4_installation_registry
(installation_ref,provider,environment,tenant_ref,store_ref,status,proof_kind,
binding_sha256,registry_revision,effective_from_ms,expires_at_ms)
VALUES (?,?,?,?,?,?,?,?,?,?,?)"""
SELECT="""SELECT installation_ref,provider,environment,tenant_ref,store_ref,status,
proof_kind,binding_sha256,registry_revision,effective_from_ms,expires_at_ms
FROM v19_b4_installation_registry
WHERE installation_ref=? AND provider=? AND environment=? LIMIT 2"""

def fixture(i=INSTALL_A,store="qa-store-a000001",tenant="qa-tenant-shared0001",fingerprint=FPR_A):
    return(i,"zalo_bot","staging",tenant,store,"QA_LOCKED",
           "SYNTHETIC_FIXTURE_ONLY",fingerprint,1,NOW-5000,NOW+5000)

class RegistrySqlite(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(":memory:",isolation_level=None)
        self.db.executescript(SCHEMA)

    def tearDown(self):
        self.db.close()

    def test_exact_fixture_can_be_selected(self):
        self.db.execute(INSERT,fixture())
        result=self.db.execute(SELECT,(INSTALL_A,"zalo_bot","staging")).fetchall()
        self.assertEqual(len(result),1)
        self.assertEqual(result[0][0],INSTALL_A)

    def test_duplicate_same_provider_installation_rejected_by_pk(self):
        self.db.execute(INSERT,fixture())
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(INSERT,fixture(store="qa-store-b000001"))

    def test_separate_stores_same_tenant_can_be_registered(self):
        self.db.execute(INSERT,fixture())
        self.db.execute(INSERT,fixture(INSTALL_B,"qa-store-b000001",fingerprint=FPR_B))
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM v19_b4_installation_registry").fetchone(),(2,))
        rowB=self.db.execute(SELECT,(INSTALL_B,"zalo_bot","staging")).fetchone()
        self.assertEqual(rowB[4],"qa-store-b000001")
        self.assertNotEqual(rowB[7],FPR_A)

    def test_no_cross_provider_lookup(self):
        self.db.execute(INSERT,fixture())
        self.assertEqual(self.db.execute(SELECT,(INSTALL_A,"zalo_oa","staging")).fetchall(),[])

    def test_non_staging_record_disallowed(self):
        bad=list(fixture());bad[2]="production"
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(INSERT,bad)

    def test_cannot_insert_real_owner_proof(self):
        bad=list(fixture());bad[6]="OWNER_APPROVED"
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(INSERT,bad)

    def test_cannot_insert_unlocked_status(self):
        bad=list(fixture());bad[5]="ENABLED"
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(INSERT,bad)

    def test_invalid_binding_fingerprint_shape_rejected(self):
        bad=list(fixture());bad[7]="short"
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(INSERT,bad)

    def test_bad_tenant_or_store_prefix_disallowed(self):
        bad=list(fixture());bad[3]="real-customer-tenant"
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(INSERT,bad)
        bad=list(fixture());bad[4]="real-customer-store"
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(INSERT,bad)

    def test_expiration_precedes_start_disallowed(self):
        bad=list(fixture());bad[10]=bad[9]
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(INSERT,bad)

if __name__=="__main__":
    unittest.main(verbosity=2)
