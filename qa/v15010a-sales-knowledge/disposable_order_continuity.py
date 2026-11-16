"""TIEN404 V15.0-10A: disposable SQLite Commerce QA ONLY.

A single shared synthetic Order source for Messenger and Zalo simulations.
No Supabase, Meta, Zalo, n8n, network, real credentials or actual customer data.
Auth context HMACs are LOCAL QA fixtures, NOT real provider/JWT signatures.
"""
from __future__ import annotations
from dataclasses import dataclass
import hashlib
import hmac
import json
import secrets
import sqlite3
import time


@dataclass(frozen=True)
class QAContext:
    """Untrusted unless checked against this lab's ephemeral signed session registry."""
    session: str
    shop: str
    channel: str
    actor_role: str
    actor_ref: str
    proof: str


class DisposableCommerce:
    """Dependency-injected sqlite3 connection; caller must supply a disposable QA DB."""

    REGISTRY = {
        ("A", "messenger", "customer", "qa_customer_a_messenger"),
        ("A", "zalo_bot", "customer", "qa_customer_a_zalo"),
        ("A", "zalo_oa", "customer", "qa_customer_a_oa"),
        ("A", "zalo_bot", "owner", "qa_owner_a_zalo"),
        ("B", "messenger", "customer", "qa_customer_b_messenger"),
        ("B", "zalo_bot", "customer", "qa_customer_b_zalo"),
        ("B", "zalo_bot", "owner", "qa_owner_b_zalo"),
        ("C", "messenger", "customer", "qa_customer_c_messenger"),
        ("C", "zalo_bot", "owner", "qa_owner_c_zalo"),
    }

    def __init__(self, connection: sqlite3.Connection, studio_fixtures: dict):
        if not isinstance(connection, sqlite3.Connection):
            raise ValueError("DISPOSABLE_SQLITE_CONNECTION_REQUIRED")
        if set(studio_fixtures) != {"A", "B", "C"}:
            raise ValueError("EXISTING_V147_SHOP_FIXTURES_REQUIRED")
        self.db = connection
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA foreign_keys = ON")
        self._secret = secrets.token_bytes(32)
        self._sessions: dict[str, tuple[str, str, str, str, float]] = {}
        self.fixtures = studio_fixtures
        self._create_synthetic_schema()
        self._seed_from_original_studio()

    def _create_synthetic_schema(self):
        self.db.executescript("""
        CREATE TABLE qa_stores(
          tenant_id TEXT NOT NULL, store_id TEXT NOT NULL PRIMARY KEY,
          status TEXT NOT NULL CHECK(status IN ('ACTIVE','PAUSED')),
          UNIQUE(tenant_id, store_id)
        );
        CREATE TABLE qa_products(
          tenant_id TEXT NOT NULL, store_id TEXT NOT NULL,
          sku TEXT NOT NULL, name TEXT NOT NULL,
          price_vnd INTEGER NOT NULL CHECK(price_vnd>=0),
          stock INTEGER NOT NULL CHECK(stock>=0),
          PRIMARY KEY(tenant_id,store_id,sku),
          FOREIGN KEY(tenant_id,store_id)
            REFERENCES qa_stores(tenant_id,store_id)
        );
        CREATE TABLE qa_channel_state(
          store_id TEXT NOT NULL, channel TEXT NOT NULL,
          active INTEGER NOT NULL CHECK(active IN (0,1)),
          PRIMARY KEY(store_id,channel),
          FOREIGN KEY(store_id) REFERENCES qa_stores(store_id)
        );
        CREATE TABLE qa_owners(
          tenant_id TEXT NOT NULL,store_id TEXT NOT NULL,
          actor_ref TEXT NOT NULL,active INTEGER NOT NULL CHECK(active IN (0,1)),
          PRIMARY KEY(store_id,actor_ref),
          FOREIGN KEY(tenant_id,store_id)
            REFERENCES qa_stores(tenant_id,store_id)
        );
        CREATE TABLE qa_customer_links(
          store_id TEXT NOT NULL, channel TEXT NOT NULL,
          external_ref TEXT NOT NULL,customer_ref TEXT NOT NULL,
          PRIMARY KEY(store_id,channel,external_ref),
          FOREIGN KEY(store_id) REFERENCES qa_stores(store_id)
        );
        CREATE TABLE qa_order_drafts(
          draft_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,store_id TEXT NOT NULL,
          customer_ref TEXT NOT NULL,sku TEXT NOT NULL,
          quantity INTEGER NOT NULL CHECK(quantity>0),
          quoted_price INTEGER NOT NULL CHECK(quoted_price>=0),
          stage TEXT NOT NULL CHECK(stage IN ('ORDER_DRAFT','CUSTOMER_CONFIRMED')),
          FOREIGN KEY(tenant_id,store_id,sku)
            REFERENCES qa_products(tenant_id,store_id,sku)
        );
        CREATE TABLE qa_orders(
          order_id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,store_id TEXT NOT NULL,
          customer_ref TEXT NOT NULL,sku TEXT NOT NULL,
          quantity INTEGER NOT NULL CHECK(quantity>0),
          unit_price_vnd INTEGER NOT NULL CHECK(unit_price_vnd>=0),
          total_vnd INTEGER NOT NULL CHECK(total_vnd>=0),
          status TEXT NOT NULL CHECK(status='QA_PERSISTED'),
          idempotency_key TEXT NOT NULL,
          UNIQUE(tenant_id,store_id,idempotency_key),
          FOREIGN KEY(tenant_id,store_id,sku)
            REFERENCES qa_products(tenant_id,store_id,sku)
        );
        CREATE TABLE qa_link_challenges(
          challenge_id TEXT PRIMARY KEY, store_id TEXT NOT NULL,
          customer_ref TEXT NOT NULL, token_hash TEXT NOT NULL,
          expires_at REAL NOT NULL, consumed INTEGER NOT NULL DEFAULT 0
            CHECK(consumed IN (0,1)), attempts INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY(store_id) REFERENCES qa_stores(store_id)
        );
        """)

    def _seed_from_original_studio(self):
        for shop, f in self.fixtures.items():
            p = f["product"]
            self.db.execute(
                "INSERT INTO qa_stores VALUES(?,?,?)",
                (f["tenantId"], f["storeId"], "ACTIVE"))
            self.db.execute(
                "INSERT INTO qa_products VALUES(?,?,?,?,?,?)",
                (f["tenantId"],f["storeId"],p["sku"],p["name"],
                 p["priceVnd"],p["stock"]))
            for channel in ("messenger","zalo_bot","zalo_oa","web_widget"):
                self.db.execute(
                    "INSERT INTO qa_channel_state VALUES(?,?,1)",
                    (f["storeId"],channel))
            self.db.execute(
                "INSERT INTO qa_owners VALUES(?,?,?,1)",
                (f["tenantId"],f["storeId"],"qa_owner_"+shop.lower()+"_zalo"))
        # An already verified Messenger customer link. Zalo is UNLINKED until challenge.
        for shop in ("A","B","C"):
            store = self.fixtures[shop]["storeId"]
            self.db.execute("INSERT INTO qa_customer_links VALUES(?,?,?,?)",
                (store,"messenger","qa_customer_"+shop.lower()+"_messenger",
                 "qa_canonical_"+shop.lower()+"_customer"))
        self.db.commit()

    def issue_qa_fixture(self, shop,channel,actor_role,actor_ref):
        """Creates an HMAC-covered synthetic fixture; NO provider attestation."""
        if (shop,channel,actor_role,actor_ref) not in self.REGISTRY:
            return None
        sid=secrets.token_hex(16)
        fields=(shop,channel,actor_role,actor_ref,time.time()+300)
        self._sessions[sid]=fields
        msg="|".join((sid,shop,channel,actor_role,actor_ref)).encode()
        proof=hmac.new(self._secret,msg,hashlib.sha256).hexdigest()
        return QAContext(sid,shop,channel,actor_role,actor_ref,proof)

    def _validate(self, ctx):
        if not isinstance(ctx, QAContext) or not ctx.session in self._sessions:
            return None
        fields=self._sessions[ctx.session]
        if fields[:4] != (ctx.shop,ctx.channel,ctx.actor_role,ctx.actor_ref):
            return None
        if time.time()>fields[4] or (ctx.shop,ctx.channel,ctx.actor_role,ctx.actor_ref) not in self.REGISTRY:
            return None
        msg="|".join((ctx.session,ctx.shop,ctx.channel,ctx.actor_role,ctx.actor_ref)).encode()
        if not hmac.compare_digest(
            hmac.new(self._secret,msg,hashlib.sha256).hexdigest(),ctx.proof
        ):
            return None
        f=self.fixtures[ctx.shop]
        store=self.db.execute(
            "SELECT status FROM qa_stores WHERE tenant_id=? AND store_id=?",
            (f["tenantId"],f["storeId"])).fetchone()
        channel=self.db.execute(
            "SELECT active FROM qa_channel_state WHERE store_id=? AND channel=?",
            (f["storeId"],ctx.channel)).fetchone()
        if not store or store["status"]!="ACTIVE" or not channel or channel["active"]!=1:
            return None
        if ctx.actor_role=="owner":
            o=self.db.execute(
                "SELECT active FROM qa_owners WHERE tenant_id=? AND store_id=? AND actor_ref=?",
                (f["tenantId"],f["storeId"],ctx.actor_ref)).fetchone()
            if not o or o["active"]!=1:return None
        return f

    def _customer(self,ctx,f):
        if ctx.actor_role!="customer":return None
        row=self.db.execute("""
          SELECT customer_ref FROM qa_customer_links
          WHERE store_id=? AND channel=? AND external_ref=?""",
          (f["storeId"],ctx.channel,ctx.actor_ref)).fetchone()
        return row["customer_ref"] if row else None

    @staticmethod
    def denied():
        return {"status":"NOT_FOUND_OR_NOT_AUTHORIZED","pii_exposed":False,
                "provider_sends":0,"live_order_writes":0}

    def catalog(self,ctx,sku):
        f=self._validate(ctx)
        if not f:return self.denied()
        p=self.db.execute("""
          SELECT sku,name,price_vnd,stock FROM qa_products
          WHERE tenant_id=? AND store_id=? AND sku=?""",
          (f["tenantId"],f["storeId"],sku)).fetchone()
        return ({"status":"SYNTHETIC_CATALOG","source":"DISPOSABLE_SQLITE",
          "product":dict(p),"provider_sends":0} if p else self.denied())

    def prepare(self,ctx,sku,quantity):
        f=self._validate(ctx)
        customer=self._customer(ctx,f) if f else None
        if not customer:return {"status":"VERIFICATION_REQUIRED","live_order_writes":0}
        if isinstance(quantity,bool) or not isinstance(quantity,int) or not (1<=quantity<=1000):
            return {"status":"INVALID_QUANTITY"}
        result=self.catalog(ctx,sku)
        if result["status"]!="SYNTHETIC_CATALOG":return self.denied()
        p=result["product"]
        if quantity>p["stock"]:return {"status":"INSUFFICIENT_STOCK","live_order_writes":0}
        draft_id="DRAFT-"+secrets.token_hex(8).upper()
        self.db.execute("INSERT INTO qa_order_drafts VALUES(?,?,?,?,?,?,?,'ORDER_DRAFT')",
          (draft_id,f["tenantId"],f["storeId"],customer,sku,quantity,p["price_vnd"]))
        self.db.commit()
        return {"status":"ORDER_DRAFT","draft_id":draft_id,"sku":sku,
           "quantity":quantity,"unit_price_vnd":p["price_vnd"],
           "expected_total_vnd":quantity*p["price_vnd"],"live_order_writes":0,
           "stock_deducted":False}

    def confirm(self,ctx,draft_id,idempotency_key,explicit_customer_confirmation=False):
        f=self._validate(ctx)
        customer=self._customer(ctx,f) if f else None
        if not customer:return {"status":"VERIFICATION_REQUIRED","live_order_writes":0}
        if explicit_customer_confirmation is not True:return {"status":"CONFIRMATION_REQUIRED"}
        if not isinstance(idempotency_key,str) or not 8<=len(idempotency_key)<=90:
            return {"status":"INVALID_IDEMPOTENCY_KEY"}
        d=self.db.execute("""
          SELECT * FROM qa_order_drafts WHERE draft_id=? AND tenant_id=? AND store_id=?
            AND customer_ref=?""",
          (draft_id,f["tenantId"],f["storeId"],customer)).fetchone()
        if not d:return self.denied()
        existing=self.db.execute("""
          SELECT * FROM qa_orders
          WHERE tenant_id=? AND store_id=? AND idempotency_key=?""",
          (f["tenantId"],f["storeId"],idempotency_key)).fetchone()
        if existing:
            if (existing["customer_ref"],existing["sku"],existing["quantity"],
                existing["unit_price_vnd"])!=(customer,d["sku"],d["quantity"],d["quoted_price"]):
                return {"status":"IDEMPOTENCY_CONFLICT","live_order_writes":0}
            return {"status":"QA_PERSISTED","order_id":existing["order_id"],
               "idempotent_replay":True,"stock_deducted":False,"live_order_writes":0}
        current=self.catalog(ctx,d["sku"])
        if current["status"]!="SYNTHETIC_CATALOG":return self.denied()
        p=current["product"]
        if p["price_vnd"]!=d["quoted_price"]:
            return {"status":"PRICE_CHANGED_RECONFIRM","live_order_writes":0}
        if p["stock"]<d["quantity"]:
            return {"status":"INSUFFICIENT_STOCK","live_order_writes":0}
        order_id="TEST-"+secrets.token_hex(8).upper()
        self.db.execute("INSERT INTO qa_orders VALUES(?,?,?,?,?,?,?,?,?,?)",
          (order_id,f["tenantId"],f["storeId"],customer,d["sku"],
           d["quantity"],p["price_vnd"],p["price_vnd"]*d["quantity"],
           "QA_PERSISTED",idempotency_key))
        self.db.execute(
          "UPDATE qa_order_drafts SET stage='CUSTOMER_CONFIRMED' WHERE draft_id=?",
          (draft_id,))
        self.db.commit()
        return {"status":"QA_PERSISTED","order_id":order_id,"idempotent_replay":False,
          "stock_deducted":False,"live_order_writes":0,"provider_sends":0,
          "source":"DISPOSABLE_SQLITE_ONLY"}

    def begin_link(self,ctx):
        f=self._validate(ctx)
        customer=self._customer(ctx,f) if f else None
        if not customer or ctx.channel!="messenger":
            return {"status":"VERIFICATION_REQUIRED"}
        cid="QLINK-"+secrets.token_hex(10)
        token=secrets.token_urlsafe(24)
        digest=hashlib.sha256((cid+":"+token).encode()).hexdigest()
        self.db.execute("INSERT INTO qa_link_challenges VALUES(?,?,?,?,?,0,0)",
          (cid,f["storeId"],customer,digest,time.time()+180))
        self.db.commit()
        # Token visible ONLY in this fake test response; NEVER log or persist raw OTP.
        return {"status":"CHALLENGE_CREATED_QA_ONLY",
          "challenge_id":cid,"one_time_token":token,"expires_in_seconds":180}

    def complete_link(self,ctx,challenge_id,one_time_token,consent=False):
        f=self._validate(ctx)
        if not f or ctx.actor_role!="customer" or ctx.channel not in ("zalo_bot","zalo_oa"):
            return {"status":"VERIFICATION_REQUIRED"}
        if consent is not True:return {"status":"CONSENT_REQUIRED"}
        row=self.db.execute("""
          SELECT * FROM qa_link_challenges WHERE challenge_id=? AND store_id=?""",
          (challenge_id,f["storeId"])).fetchone()
        if not row or row["consumed"] or row["expires_at"]<=time.time() or row["attempts"]>=3:
            return {"status":"INVALID_OR_EXPIRED_CHALLENGE"}
        digest=hashlib.sha256((challenge_id+":"+str(one_time_token)).encode()).hexdigest()
        if not hmac.compare_digest(digest,row["token_hash"]):
            self.db.execute("UPDATE qa_link_challenges SET attempts=attempts+1 WHERE challenge_id=?",
              (challenge_id,));self.db.commit()
            return {"status":"INVALID_OR_EXPIRED_CHALLENGE"}
        self.db.execute("""
          INSERT INTO qa_customer_links(store_id,channel,external_ref,customer_ref)
          VALUES(?,?,?,?)
          ON CONFLICT(store_id,channel,external_ref)
          DO NOTHING""",(f["storeId"],ctx.channel,ctx.actor_ref,row["customer_ref"]))
        saved=self.db.execute("""
          SELECT customer_ref FROM qa_customer_links
          WHERE store_id=? AND channel=? AND external_ref=?""",
          (f["storeId"],ctx.channel,ctx.actor_ref)).fetchone()
        if not saved or saved["customer_ref"]!=row["customer_ref"]:
            return {"status":"EXTERNAL_IDENTITY_ALREADY_BOUND"}
        self.db.execute("UPDATE qa_link_challenges SET consumed=1 WHERE challenge_id=?",
            (challenge_id,));self.db.commit()
        return {"status":"QA_LINKED_ONE_TIME","store_scoped":True,
             "hosted_identity_linked":False}

    def lookup_order(self,ctx,order_id):
        """The order ID itself is never sufficient to authorize a read."""
        f=self._validate(ctx)
        if not f:return self.denied()
        if ctx.actor_role=="customer":
            canonical=self._customer(ctx,f)
            if not canonical:return {"status":"VERIFICATION_REQUIRED","pii_exposed":False}
        else:canonical=None
        r=self.db.execute("""
           SELECT order_id,store_id,customer_ref,sku,quantity,unit_price_vnd,total_vnd,status
           FROM qa_orders WHERE tenant_id=? AND store_id=? AND order_id=?""",
          (f["tenantId"],f["storeId"],order_id)).fetchone()
        if not r or (ctx.actor_role=="customer" and r["customer_ref"]!=canonical):
            return self.denied()
        # No phone/address/PSID is present in this synthetic test schema.
        return {"status":"QA_ORDER_FOUND","order_id":r["order_id"],
           "sku":r["sku"],"quantity":r["quantity"],
           "unit_price_vnd":r["unit_price_vnd"],"total_vnd":r["total_vnd"],
           "order_status":r["status"],"source":"DISPOSABLE_SQLITE_ONLY",
           "pii_exposed":False,"orders_created_by_lookup":0,
           "provider_sends":0,"hosted_reads":0}

    def set_qa_state(self,shop,what,value):
        """Internal test-only mutation, not remotely accessible."""
        f=self.fixtures[shop]
        if what=="pause_store":
            self.db.execute("UPDATE qa_stores SET status=? WHERE store_id=?",
                ("PAUSED" if value else "ACTIVE",f["storeId"]))
        elif what=="revoke_owner":
            self.db.execute("UPDATE qa_owners SET active=? WHERE store_id=?",
                (0 if value else 1,f["storeId"]))
        elif what=="pause_zalo":
            self.db.execute("UPDATE qa_channel_state SET active=? WHERE store_id=? AND channel='zalo_bot'",
                (0 if value else 1,f["storeId"]))
        elif what=="change_price":
            self.db.execute("UPDATE qa_products SET price_vnd=? WHERE store_id=?",
                (value,f["storeId"]))
        elif what=="change_stock":
            self.db.execute("UPDATE qa_products SET stock=? WHERE store_id=?",
                (value,f["storeId"]))
        else:raise ValueError("UNKNOWN_QA_MUTATION")
        self.db.commit()

    def counts(self):
        return {"orders":self.db.execute("SELECT count(*) FROM qa_orders").fetchone()[0],
          "products":self.db.execute("SELECT count(*) FROM qa_products").fetchone()[0],
          "stores":self.db.execute("SELECT count(*) FROM qa_stores").fetchone()[0],
          "hosted_orders_written":0,"provider_sends":0}
