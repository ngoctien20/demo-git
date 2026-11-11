"""Run only against the disposable PostgreSQL service used by this workflow."""
from pathlib import Path
import sys
from uuid import uuid4

import httpx
import psycopg
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.main import Settings, create_app


def connect():
    return psycopg.connect("dbname=tien404_qa host=127.0.0.1 user=postgres", autocommit=True)


with connect() as db:
    actor, outsider, tenant, other = (uuid4() for _ in range(4))
    for uid, tid in ((actor, tenant), (outsider, other)):
        db.execute("INSERT INTO auth.users VALUES (%s)", (uid,))
        db.execute("INSERT INTO tenants(id,slug,name) VALUES (%s,%s,'QA')", (tid,str(tid)))
        db.execute("INSERT INTO tenant_memberships(tenant_id,user_id,role) VALUES (%s,%s,'owner')", (tid,uid))
        db.execute("INSERT INTO products(tenant_id,sku,name,price_vnd,stock_on_hand) VALUES (%s,'QA','Sample',150000,4)", (tid,))

tokens = {str(actor):actor, str(outsider):outsider}
def provider(request):
    assert request.url.path == "/auth/v1/user"
    uid = tokens.get(request.headers["Authorization"].removeprefix("Bearer "))
    return httpx.Response(200,json={"id":str(uid)}) if uid else httpx.Response(401)

app = create_app(Settings("https://qa.invalid","fixture"),transport=httpx.MockTransport(provider),commerce_connect=connect)
with TestClient(app) as client, connect() as db:
    root = f"/api/v1/tenants/{tenant}/orders"
    def send(method,path,key,body=None,user=actor):
        return client.request(method,path,headers={"Authorization":"Bearer "+str(user),"Idempotency-Key":key},json=body)
    assert client.post(root,json={"items":{"QA":1}}).status_code == 401
    assert send("POST",root,"create-qa",{"items":{"QA":1},"actor":str(actor)}).status_code == 422
    assert send("POST",root,"create-qa",{"items":{"QA":1}},outsider).status_code == 403
    reply = send("POST",root,"create-qa",{"items":{"QA":1}})
    assert reply.status_code == 200, reply.text
    oid = reply.json()["order_id"]
    order = root+"/"+oid
    assert send("POST",root,"create-qa",{"items":{"QA":1}}).json()==reply.json()
    def amounts():
        return db.execute("""SELECT i.quantity,o.total_vnd,p.stock_on_hand FROM orders o
                             JOIN order_items i ON i.order_id=o.id JOIN products p ON p.id=i.product_id
                             WHERE o.id=%s""",(oid,)).fetchone()
    db.execute("UPDATE products SET price_vnd=200000 WHERE tenant_id=%s",(tenant,))
    for n,key,expected in [(4,"quantity-up",200),(4,"quantity-up",200),(2,"quantity-up",409),
                           (5,"quantity-overstock",409),(2,"quantity-down",200)]:
        assert send("PUT",order+"/quantity",key,{"sku":"QA","quantity":n}).status_code == expected
    assert amounts()==(2,300000,2)
    assert send("PUT",order+"/quantity","quantity-up",{"sku":"QA","quantity":4}).status_code == 200
    assert amounts()==(2,300000,2)
    foreign = f"/api/v1/tenants/{other}/orders/{oid}"
    for path in (order,foreign):
        expected = 403 if path==order else 404
        assert send("POST",path+"/cancel","cancel-qa",user=outsider).status_code == expected
    assert send("POST",order+"/confirm","confirm-qa").status_code == 200
    assert send("POST",order+"/confirm","confirm-qa").status_code == 200
    assert send("PUT",order+"/quantity","locked-qa",{"sku":"QA","quantity":3}).status_code == 409
    for _ in range(2):
        assert send("POST",order+"/cancel","cancel-qa").status_code == 200
    assert amounts()==(2,300000,4)
    assert db.execute("SELECT count(*) FROM app_private.audit_events WHERE request_id=%s",(oid,)).fetchone()==(5,)

    # Exercise both SQL limits through HTTP, including rollback and same-key retry.
    db.execute("UPDATE products SET price_vnd=1000000000000,stock_on_hand=2000 WHERE tenant_id=%s",(tenant,))
    excessive = send("POST",root,"limit-create",{"items":{"QA":1001}})
    assert (excessive.status_code, excessive.json()["detail"]) == (409, "order_total_limit")
    boundary = send("POST",root,"limit-create",{"items":{"QA":1000}})
    assert boundary.status_code == 200
    boundary_order = root + "/" + boundary.json()["order_id"]
    overflow = send("PUT",boundary_order+"/quantity","limit-edit",{"sku":"QA","quantity":1001})
    assert (overflow.status_code, overflow.json()["detail"]) == (409, "order_total_limit")
    def boundary_state():
        return db.execute("""SELECT o.status,o.total_vnd,i.quantity,p.stock_on_hand FROM orders o
                             JOIN order_items i ON i.order_id=o.id JOIN products p ON p.id=i.product_id
                             WHERE o.id=%s""",(boundary.json()["order_id"],)).fetchone()
    assert boundary_state() == ("pending",10**15,1000,1000)
    db.execute("UPDATE products SET stock_on_hand=2147483647 WHERE tenant_id=%s",(tenant,))
    for result in (send("PUT",boundary_order+"/quantity","limit-edit",{"sku":"QA","quantity":999}),
                   send("POST",boundary_order+"/cancel","limit-cancel")):
        assert (result.status_code,result.json()["detail"]) == (409,"stock_limit")
    assert boundary_state() == ("pending",10**15,1000,2147483647)
    db.execute("UPDATE products SET stock_on_hand=0 WHERE tenant_id=%s",(tenant,))
    assert send("POST",boundary_order+"/cancel","limit-cancel").status_code == 200
    assert boundary_state() == ("cancelled",10**15,1000,1000)

print("PASS merchant HTTP transactions, limit conflicts, atomic rollback and retry")
