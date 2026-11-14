"""Run inside the existing disposable Postgres job after schema installation."""
import json
from pathlib import Path
from uuid import uuid4

import psycopg
from commerce_preview import stage_checkout_preview
from order_preview import confirm

cart = json.loads(Path(__file__).with_name("v3_cart_3069.json").read_text())[0]
with psycopg.connect("dbname=tien404_qa", autocommit=True) as db:
    # Roll back the fixtures so restore rehearsal retains its original evidence.
    with db.transaction(force_rollback=True):
        shop, owner = uuid4(), uuid4()
        routes = {"demo_tien404": shop}
        db.execute("insert into auth.users values (%s)", (owner,))
        db.execute("insert into tenants(id,name,slug) values (%s,'QA','qa-cart-v3-bridge')", (shop,))
        db.execute("insert into tenant_memberships(tenant_id,user_id,role) values (%s,%s,'owner')", (shop,owner))
        for line in cart["lines"]:
            db.execute("insert into products(tenant_id,sku,name,price_vnd,stock_on_hand) values (%s,%s,'QA',%s,%s)",
                       (shop,line["sku"],line["unitPriceVnd"],line["stock"]))
        args = (db,routes,"demo_tien404",owner,"fixture-sender")
        token = stage_checkout_preview(*args, "fixture-1",cart)
        assert db.execute("select count(*) from orders where tenant_id=%s",(shop,)).fetchone()==(0,)
        db.execute("update products set price_vnd=1 where tenant_id=%s and sku='F-101'",(shop,))
        try:
            stage_checkout_preview(*args,"fixture-stale",cart)
        except ValueError as error:
            assert str(error)=="catalog changed"
        else:
            raise AssertionError("stale catalog accepted")
        assert db.execute("select count(*) from notification_private.order_previews where tenant_id=%s and not withdrawn",(shop,)).fetchone()==(1,)
        db.execute("update products set price_vnd=159000 where tenant_id=%s and sku='F-101'",(shop,))
        order = confirm(db,shop,owner,"fixture-sender",token,True)
        assert confirm(db,shop,owner,"fixture-sender",token,True)==order
        assert db.execute("select status,total_vnd from orders where tenant_id=%s and id=%s",(shop,order)).fetchone()==("pending",607000)
        assert db.execute("select count(*) from notification_private.notification_events where tenant_id=%s and order_id=%s",(shop,order)).fetchone()==(1,)
        assert db.execute("select count(*) from notification_private.notification_outbox where tenant_id=%s",(shop,)).fetchone()==(0,)
print("PASS V3 preview -> PostgreSQL checkout/readback, stale rollback, one event, no recipient")
