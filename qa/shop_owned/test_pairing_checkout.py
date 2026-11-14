"""Disposable PostgreSQL only. Two synthetic shops and simulated subject contexts."""
from uuid import uuid4
from secrets import token_bytes
from zalo_claim import claim_from_fixture
import psycopg
from order_preview import preview, confirm


def context(db, subject):
    db.execute("select set_config('request.jwt.claim.sub',%s,true),set_config('request.jwt.claim.role','authenticated',true)", (str(subject),))


def fixture(db, label):
    shop, owner = uuid4(), uuid4()
    route = tuple("qa-" + item + "-" + label for item in ("tenant","store","bot"))
    db.execute("insert into auth.users values(%s)",(owner,))
    db.execute("insert into tenants(id,slug,name) values(%s,%s,'QA')",(shop,route[0]))
    db.execute("insert into tenant_memberships(tenant_id,user_id,role) values(%s,%s,'owner')",(shop,owner))
    db.execute("insert into products(tenant_id,sku,name,price_vnd,stock_on_hand) values(%s,'F01','QA',%s,10)",(shop,159000 if label=="a" else 210000))
    db.execute("insert into tien404_r1_qa.shop_bots(tenant_key,store_key,bot_key,credential_ref,catalog_source_ref) values(%s,%s,%s,%s,%s)",(*route,"fixture-"+label,"catalog-"+label))
    db.execute("insert into tien404_r1_qa.tenant_identity_map values(%s,%s,%s,%s)",(*route,shop))
    return shop,owner,route


with psycopg.connect("dbname=tien404_qa",autocommit=True) as db, db.transaction(force_rollback=True):
    shops=[fixture(db,s) for s in ("a","b")]
    fixture_key=token_bytes(32)
    for i,(shop,owner,route) in enumerate(shops):
        context(db,owner)
        code_id,code=db.execute("select * from tien404_r1_qa.issue_owner_challenge(%s,%s,%s)",route).fetchone()
        other=shops[1-i]
        event={"stage":"READ_ONLY","accepted":True,"eventName":"message.text.received",
               "chatType":"PRIVATE","chatId":"qa-chat","messageId":"qa-mid","text":f"GHÉP {code_id} {code}"}
        assert not claim_from_fixture(db,other[2],event,fixture_key)
        assert not claim_from_fixture(db,route,{**event,"accepted":False},fixture_key)
        assert not claim_from_fixture(db,route,{**event,"chatType":"GROUP"},fixture_key)
        assert claim_from_fixture(db,route,event,fixture_key)
        assert not claim_from_fixture(db,route,event,fixture_key)
        accept="select tien404_r1_qa.confirm_owner_pairing_v3_qa(%s,%s,%s,%s)"
        context(db,other[1])
        assert db.execute(accept,(*route,code_id)).fetchone()==(False,)
        context(db,owner)
        assert db.execute(accept,(*route,code_id)).fetchone()==(True,)
        assert db.execute(accept,(*route,code_id)).fetchone()==(False,)
        token,_=preview(db,shop,owner,"customer",{"F01":2},"preview-1")
        order=confirm(db,shop,owner,"customer",token,True)
        assert confirm(db,shop,owner,"customer",token,True)==order
        def notices():
            return db.execute("""select o.status,o.destination_id,o.attempts from notification_private.notification_outbox o
              join notification_private.notification_events e on (e.tenant_id,e.id)=(o.tenant_id,o.event_id)
              where e.tenant_id=%s and e.order_id=%s and o.channel='zalo_bot'""",(shop,order)).fetchall()
        assert notices()==[("held",code_id,0)]
        assert db.execute("select * from notification_private.claim('zalo_bot')").fetchall()==[]
        db.execute("update tien404_r1_qa.owner_bindings set status='revoked' where bot_key=%s",(route[2],))
        token,_=preview(db,shop,owner,"customer",{"F01":1},"preview-2")
        order=confirm(db,shop,owner,"customer",token,True)
        assert notices()==[]
print("PASS two shops: challenge, scoped claim, owner confirmation, checkout replay, held notice, no claim, revoke")
