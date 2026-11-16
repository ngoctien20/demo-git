"""Real disposable persistence and cross-channel QA, NOT a live Messenger/Zalo test."""
import dataclasses
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import unittest

from disposable_order_continuity import DisposableCommerce, QAContext

ROOT=Path(__file__).resolve().parents[2]
STUDIO="qa/v147-custom-studio/studio-core.js"
def source_fixtures():
    proc=subprocess.run(
      ["node","-e",
       "const {FIXTURES}=require('./"+STUDIO+"');process.stdout.write(JSON.stringify(FIXTURES));"],
       cwd=ROOT,check=True,capture_output=True,text=True,timeout=10)
    return json.loads(proc.stdout)

FIXTURES=source_fixtures()

class OrderContinuityQA(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix="tien404-v15010a-disposable-")
        self.path=os.path.join(self.tmp.name,"commerce-qa-only.sqlite3")
        self.db=sqlite3.connect(self.path)
        self.lab=DisposableCommerce(self.db,FIXTURES)
        self.a_m=self.lab.issue_qa_fixture("A","messenger","customer","qa_customer_a_messenger")
        self.a_z=self.lab.issue_qa_fixture("A","zalo_bot","customer","qa_customer_a_zalo")
        self.a_o=self.lab.issue_qa_fixture("A","zalo_bot","owner","qa_owner_a_zalo")
        self.b_o=self.lab.issue_qa_fixture("B","zalo_bot","owner","qa_owner_b_zalo")
        self.b_m=self.lab.issue_qa_fixture("B","messenger","customer","qa_customer_b_messenger")
        self.c_m=self.lab.issue_qa_fixture("C","messenger","customer","qa_customer_c_messenger")
        self.c_o=self.lab.issue_qa_fixture("C","zalo_bot","owner","qa_owner_c_zalo")

    def tearDown(self):
        self.db.close()
        self.tmp.cleanup()

    def persist_a(self,quantity=2,key="QA_REQ_MESSENGER_A_0001"):
        p=self.lab.prepare(self.a_m,"A001",quantity)
        self.assertEqual(p["status"],"ORDER_DRAFT")
        result=self.lab.confirm(self.a_m,p["draft_id"],key,True)
        self.assertEqual(result["status"],"QA_PERSISTED")
        return p,result

    def link_zalo_a(self):
        ch=self.lab.begin_link(self.a_m)
        self.assertEqual(ch["status"],"CHALLENGE_CREATED_QA_ONLY")
        r=self.lab.complete_link(self.a_z,ch["challenge_id"],ch["one_time_token"],True)
        self.assertEqual(r["status"],"QA_LINKED_ONE_TIME")
        return ch

    def test_reuse_existing_v147_three_shop_fixtures(self):
        self.assertEqual(FIXTURES["A"]["tenantId"],FIXTURES["B"]["tenantId"])
        self.assertNotEqual(FIXTURES["A"]["tenantId"],FIXTURES["C"]["tenantId"])
        self.assertEqual(self.lab.counts()["stores"],3)

    def test_same_sku_lookups_resolve_different_store_prices(self):
        prices=[self.lab.catalog(ctx,"A001")["product"]["price_vnd"]
            for ctx in (self.a_m,self.b_m,self.c_m)]
        self.assertEqual(prices,[159000,209000,259000])

    def test_synthetic_catalog_not_hosted(self):
        out=self.lab.catalog(self.a_m,"A001")
        self.assertEqual(out["source"],"DISPOSABLE_SQLITE")
        self.assertEqual(out["provider_sends"],0)

    def test_missing_product_denied(self):
        self.assertEqual(self.lab.catalog(self.a_m,"Z999")["status"],
            "NOT_FOUND_OR_NOT_AUTHORIZED")

    def test_untrusted_actor_cannot_instantiate_context(self):
        self.assertIsNone(self.lab.issue_qa_fixture("A","zalo_bot","owner","fake_owner"))

    def test_cross_store_role_claim_forgery_denied(self):
        forged=dataclasses.replace(self.b_o,shop="A")
        self.assertEqual(self.lab.catalog(forged,"A001")["status"],
            "NOT_FOUND_OR_NOT_AUTHORIZED")

    def test_tamper_channel_denied(self):
        forged=dataclasses.replace(self.a_m,channel="zalo_bot")
        self.assertEqual(self.lab.catalog(forged,"A001")["status"],
            "NOT_FOUND_OR_NOT_AUTHORIZED")

    def test_invalid_hmac_denied(self):
        forged=dataclasses.replace(self.a_m,proof="0"*64)
        self.assertEqual(self.lab.catalog(forged,"A001")["status"],
            "NOT_FOUND_OR_NOT_AUTHORIZED")

    def test_cross_instance_hmac_denied(self):
        other=DisposableCommerce(sqlite3.connect(":memory:"),FIXTURES)
        try:
            self.assertEqual(other.catalog(self.a_m,"A001")["status"],
                "NOT_FOUND_OR_NOT_AUTHORIZED")
        finally:other.db.close()

    def test_draft_no_order_before_confirmation(self):
        draft=self.lab.prepare(self.a_m,"A001",2)
        self.assertEqual(draft["status"],"ORDER_DRAFT")
        self.assertEqual(self.lab.counts()["orders"],0)

    def test_missing_confirmation_denied(self):
        draft=self.lab.prepare(self.a_m,"A001",2)
        result=self.lab.confirm(self.a_m,draft["draft_id"],"QA_NO_CONFIRM_100",False)
        self.assertEqual(result["status"],"CONFIRMATION_REQUIRED")
        self.assertEqual(self.lab.counts()["orders"],0)

    def test_confirm_actual_disposable_db_persist(self):
        draft,result=self.persist_a()
        self.assertTrue(result["order_id"].startswith("TEST-"))
        self.assertEqual(self.lab.counts()["orders"],1)
        self.assertFalse(result["stock_deducted"])
        self.assertEqual(self.lab.lookup_order(self.a_m,result["order_id"])["total_vnd"],318000)
        # Distinct SQLite connection confirms data really persisted to filesystem.
        with sqlite3.connect(self.path) as fresh:
            rows=fresh.execute("SELECT count(*) FROM qa_orders").fetchone()[0]
            self.assertEqual(rows,1)

    def test_order_lookup_by_messenger_customer(self):
        _,saved=self.persist_a()
        out=self.lab.lookup_order(self.a_m,saved["order_id"])
        self.assertEqual(out["status"],"QA_ORDER_FOUND")
        self.assertEqual(out["order_status"],"QA_PERSISTED")
        self.assertEqual(out["sku"],"A001")
        self.assertEqual(out["quantity"],2)
        self.assertEqual(out["unit_price_vnd"],159000)
        self.assertFalse(out["pii_exposed"])

    def test_zalo_unlinked_customer_denied_even_if_knows_exact_order_id(self):
        _,saved=self.persist_a()
        out=self.lab.lookup_order(self.a_z,saved["order_id"])
        self.assertEqual(out["status"],"VERIFICATION_REQUIRED")
        self.assertFalse(out["pii_exposed"])

    def test_real_sqlite_messenger_to_zalo_continuity_after_link(self):
        _,saved=self.persist_a()
        self.link_zalo_a()
        from_zalo=self.lab.lookup_order(self.a_z,saved["order_id"])
        self.assertEqual(from_zalo["status"],"QA_ORDER_FOUND")
        self.assertEqual(from_zalo["order_id"],saved["order_id"])
        self.assertEqual(from_zalo["total_vnd"],318000)
        self.assertEqual(from_zalo["orders_created_by_lookup"],0)
        self.assertEqual(self.lab.counts()["orders"],1)
        self.assertEqual(from_zalo["hosted_reads"],0)

    def test_owner_a_can_lookup_same_qa_order(self):
        _,saved=self.persist_a()
        self.assertEqual(self.lab.lookup_order(self.a_o,saved["order_id"])["status"],
            "QA_ORDER_FOUND")

    def test_owner_b_cannot_read_owner_a_order_same_tenant(self):
        _,saved=self.persist_a()
        self.assertEqual(self.lab.lookup_order(self.b_o,saved["order_id"])["status"],
            "NOT_FOUND_OR_NOT_AUTHORIZED")

    def test_owner_c_cannot_read_shop_a_order_different_tenant(self):
        _,saved=self.persist_a()
        self.assertEqual(self.lab.lookup_order(self.c_o,saved["order_id"])["status"],
            "NOT_FOUND_OR_NOT_AUTHORIZED")

    def test_customer_b_cannot_read_a_order_even_matching_sku(self):
        _,saved=self.persist_a()
        self.assertEqual(self.lab.lookup_order(self.b_m,saved["order_id"])["status"],
            "NOT_FOUND_OR_NOT_AUTHORIZED")

    def test_unknown_order_same_generic_denial(self):
        self.assertEqual(self.lab.lookup_order(self.a_o,"TEST-NOT-EXISTS")["status"],
            "NOT_FOUND_OR_NOT_AUTHORIZED")

    def test_store_a_link_token_cannot_link_shop_b(self):
        ch=self.lab.begin_link(self.a_m)
        b_z=self.lab.issue_qa_fixture("B","zalo_bot","customer","qa_customer_b_zalo")
        out=self.lab.complete_link(b_z,ch["challenge_id"],ch["one_time_token"],True)
        self.assertEqual(out["status"],"INVALID_OR_EXPIRED_CHALLENGE")

    def test_otp_wrong_token_is_denied(self):
        ch=self.lab.begin_link(self.a_m)
        out=self.lab.complete_link(self.a_z,ch["challenge_id"],"QA_WRONG_OTP",True)
        self.assertEqual(out["status"],"INVALID_OR_EXPIRED_CHALLENGE")
        self.assertEqual(self.lab.lookup_order(self.a_z,"TEST-UNKNOWN")["status"],
            "VERIFICATION_REQUIRED")

    def test_otp_consumed_once_only(self):
        ch=self.link_zalo_a()
        again=self.lab.complete_link(self.a_z,ch["challenge_id"],ch["one_time_token"],True)
        self.assertEqual(again["status"],"INVALID_OR_EXPIRED_CHALLENGE")

    def test_otp_no_consent_cannot_link(self):
        ch=self.lab.begin_link(self.a_m)
        out=self.lab.complete_link(self.a_z,ch["challenge_id"],ch["one_time_token"],False)
        self.assertEqual(out["status"],"CONSENT_REQUIRED")

    def test_otp_rate_limit_three_wrong_attempts(self):
        ch=self.lab.begin_link(self.a_m)
        for _ in range(3):
            self.assertEqual(self.lab.complete_link(
              self.a_z,ch["challenge_id"],"wrong",True)["status"],
                "INVALID_OR_EXPIRED_CHALLENGE")
        self.assertEqual(self.lab.complete_link(
          self.a_z,ch["challenge_id"],ch["one_time_token"],True)["status"],
            "INVALID_OR_EXPIRED_CHALLENGE")

    def test_messenger_cannot_complete_zalo_only_link(self):
        ch=self.lab.begin_link(self.a_m)
        self.assertEqual(self.lab.complete_link(
          self.a_m,ch["challenge_id"],ch["one_time_token"],True)["status"],
            "VERIFICATION_REQUIRED")

    def test_duplicate_confirmation_same_key_returns_same_order(self):
        p,s=self.persist_a()
        again=self.lab.confirm(self.a_m,p["draft_id"],"QA_REQ_MESSENGER_A_0001",True)
        self.assertEqual(again["order_id"],s["order_id"])
        self.assertTrue(again["idempotent_replay"])
        self.assertEqual(self.lab.counts()["orders"],1)

    def test_duplicate_confirmation_other_key_does_not_create_second_order(self):
        p,s=self.persist_a()
        r=self.lab.confirm(self.a_m,p["draft_id"],"QA_REQUEST_CHANGED_0002",True)
        self.assertEqual(r["status"],"DRAFT_ALREADY_PERSISTED_NO_NEW_ORDER")
        self.assertEqual(self.lab.counts()["orders"],1)

    def test_same_request_key_new_draft_does_not_duplicate(self):
        _,s=self.persist_a()
        p2=self.lab.prepare(self.a_m,"A001",2)
        r=self.lab.confirm(self.a_m,p2["draft_id"],"QA_REQ_MESSENGER_A_0001",True)
        self.assertEqual(r["order_id"],s["order_id"])
        self.assertEqual(self.lab.counts()["orders"],1)

    def test_same_request_key_different_quantity_conflicts(self):
        self.persist_a()
        p2=self.lab.prepare(self.a_m,"A001",1)
        r=self.lab.confirm(self.a_m,p2["draft_id"],"QA_REQ_MESSENGER_A_0001",True)
        self.assertEqual(r["status"],"IDEMPOTENCY_CONFLICT")
        self.assertEqual(self.lab.counts()["orders"],1)

    def test_distinct_drafts_and_request_keys_create_distinct_qa_orders(self):
        _,a=self.persist_a()
        p2=self.lab.prepare(self.a_m,"A001",1)
        b=self.lab.confirm(self.a_m,p2["draft_id"],"QA_REQ_NEW_0002",True)
        self.assertNotEqual(a["order_id"],b["order_id"])
        self.assertEqual(self.lab.counts()["orders"],2)

    def test_price_changed_between_prepare_and_confirm_blocks_commit(self):
        p=self.lab.prepare(self.a_m,"A001",2)
        self.lab.set_qa_state("A","change_price",169000)
        r=self.lab.confirm(self.a_m,p["draft_id"],"QA_PRICE_CHANGED_0001",True)
        self.assertEqual(r["status"],"PRICE_CHANGED_RECONFIRM")
        self.assertEqual(self.lab.counts()["orders"],0)

    def test_stock_changed_between_prepare_and_confirm_blocks_commit(self):
        p=self.lab.prepare(self.a_m,"A001",2)
        self.lab.set_qa_state("A","change_stock",1)
        r=self.lab.confirm(self.a_m,p["draft_id"],"QA_STOCK_CHANGED_0001",True)
        self.assertEqual(r["status"],"INSUFFICIENT_STOCK")
        self.assertEqual(self.lab.counts()["orders"],0)

    def test_out_of_stock_before_prepare_blocks_draft(self):
        self.lab.set_qa_state("A","change_stock",0)
        self.assertEqual(self.lab.prepare(self.a_m,"A001",2)["status"],"INSUFFICIENT_STOCK")

    def test_zero_negative_noninteger_quantity_denied(self):
        for q in (0,-1,1.5,"2",True,1001):
            with self.subTest(q=q):
                self.assertEqual(self.lab.prepare(self.a_m,"A001",q)["status"],"INVALID_QUANTITY")

    def test_invalid_request_key_denied(self):
        p=self.lab.prepare(self.a_m,"A001",2)
        self.assertEqual(self.lab.confirm(self.a_m,p["draft_id"],"x",True)["status"],
            "INVALID_IDEMPOTENCY_KEY")

    def test_owner_revocation_immediately_blocks_existing_context(self):
        _,saved=self.persist_a()
        self.lab.set_qa_state("A","revoke_owner",True)
        self.assertEqual(self.lab.lookup_order(self.a_o,saved["order_id"])["status"],
            "NOT_FOUND_OR_NOT_AUTHORIZED")

    def test_paused_shop_immediately_blocks_existing_context(self):
        _,saved=self.persist_a()
        self.lab.set_qa_state("A","pause_store",True)
        self.assertEqual(self.lab.lookup_order(self.a_o,saved["order_id"])["status"],
            "NOT_FOUND_OR_NOT_AUTHORIZED")

    def test_paused_zalo_channel_immediately_blocks_qa_lookup(self):
        _,saved=self.persist_a()
        self.link_zalo_a()
        self.lab.set_qa_state("A","pause_zalo",True)
        self.assertEqual(self.lab.lookup_order(self.a_z,saved["order_id"])["status"],
            "NOT_FOUND_OR_NOT_AUTHORIZED")

    def test_stale_or_mutated_actor_store_cannot_read(self):
        _,saved=self.persist_a()
        bad=dataclasses.replace(self.a_o,shop="B")
        self.assertEqual(self.lab.lookup_order(bad,saved["order_id"])["status"],
            "NOT_FOUND_OR_NOT_AUTHORIZED")

    def test_unknown_customer_with_only_order_code_cannot_read(self):
        _,saved=self.persist_a()
        anonymous=QAContext("fake","A","zalo_bot","customer","qa_same_name","fake")
        self.assertEqual(self.lab.lookup_order(anonymous,saved["order_id"])["status"],
            "NOT_FOUND_OR_NOT_AUTHORIZED")

    def test_order_lookup_never_creates_new_order(self):
        _,saved=self.persist_a()
        self.link_zalo_a()
        for _ in range(4):
            self.assertEqual(self.lab.lookup_order(self.a_z,saved["order_id"])["status"],
                "QA_ORDER_FOUND")
        self.assertEqual(self.lab.counts()["orders"],1)

    def test_cannot_access_hosted_db_or_send_provider(self):
        _,saved=self.persist_a()
        out=self.lab.lookup_order(self.a_o,saved["order_id"])
        self.assertEqual(out["hosted_reads"],0)
        self.assertEqual(out["provider_sends"],0)
        self.assertEqual(self.lab.counts()["hosted_orders_written"],0)

    def test_no_pii_columns_in_schema(self):
        sql="\n".join(row[0] for row in self.db.execute(
            "SELECT sql FROM sqlite_master WHERE type='table'"))
        self.assertNotIn("phone",sql.lower())
        self.assertNotIn("address",sql.lower())
        self.assertNotIn("psid",sql.lower())

    def test_cross_shop_store_product_fk_blocks_mismatch(self):
        f=FIXTURES
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
               "INSERT INTO qa_orders VALUES(?,?,?,?,?,?,?,?,?,?,?)",
               ("TEST-INVALID-FK",f["A"]["tenantId"],f["A"]["storeId"],
                "qa_canonical_a_customer","Z999",1,100,100,"QA_PERSISTED",
                "QA_CROSS_FK_001","QA_DRAFT_INVALID"))
        self.assertEqual(self.lab.counts()["orders"],0)

if __name__=="__main__":
    unittest.main(verbosity=2)
