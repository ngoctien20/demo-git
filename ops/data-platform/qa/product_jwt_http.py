"""Exercise the actual PostgREST JWT verifier with ephemeral CI identities on loopback."""
import base64
import hashlib
import hmac
import json
import os
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4

import psycopg


SHOPS = ("9c8c524c-88db-4771-8ab0-a4316298494c", "4b12fc28-4fc3-4b06-bbf1-72a1f62ad5c5")


def encoded(value):
    return base64.urlsafe_b64encode(value).rstrip(b"=")


def sign(subject, key):
    header = encoded(b'{"alg":"HS256","typ":"JWT"}')
    claims = encoded(json.dumps({"role": "authenticated", "sub": subject, "exp": int(time.time())+300}).encode())
    message = header + b"." + claims
    return (message+b"."+encoded(hmac.digest(key, message, hashlib.sha256))).decode()


def request(path, token=None, body=None, method="GET"):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = Request("http://127.0.0.1:3011/" + path, method=method, headers=headers,
                  data=None if body is None else json.dumps(body).encode())
    try:
        response = urlopen(req, timeout=8)
    except HTTPError as error:
        response = error
    with response:
        data = response.read()
        return response.status, json.loads(data) if data else None


def denied(result, expected):
    status, body = result
    assert (status, body.get("code")) == (expected, "42501"), (status, body.get("code"))


def main():
    users = [str(uuid4()) for _ in range(4)]
    with psycopg.connect("host=127.0.0.1 dbname=tien404_qa user=postgres") as db:
        for i, tenant in enumerate(SHOPS):
            slug = "qa-staging-shop-" + ("a","b")[i] + "-20261110"
            db.execute("insert into tenants(id,slug,name) values (%s,%s,'QA')", (tenant,slug))
        for uid in users:
            db.execute("insert into auth.users values (%s)", (uid,))
        for uid,tenant,role in zip(users, (SHOPS[0],SHOPS[1],SHOPS[0]), ("owner","manager","staff")):
            db.execute("insert into tenant_memberships(tenant_id,user_id,role) values (%s,%s,%s)",(tenant,uid,role))

    key = os.environ["PGRST_JWT_SECRET"].encode()
    a,b,staff, outsider = [sign(uid,key) for uid in users]
    endpoint = "rpc/save_merchant_product"
    def payload(shop):
        return dict(p_tenant=shop,p_sku="QA",p_name="Fixture",p_price=150000,p_active=True,
                    p_initial_stock=2,p_expected_updated_at=None)
    for token, shop in zip((a,b),SHOPS):
        status,version = request(endpoint,token,payload(shop),"POST")
        assert status == 200 and isinstance(version,str)
        edit = dict(payload(shop),p_initial_stock=None,p_price=160000,p_expected_updated_at=version)
        status,new_version = request(endpoint,token,edit,"POST")
        assert status == 200 and new_version != version
        status,body = request(endpoint,token,edit,"POST")
        assert status >= 400
        assert body["code"]=="40001"
    for index,token in enumerate((a,b)):
        own,other = SHOPS[index], SHOPS[1-index]
        status,rows = request("products?select=tenant_id,price_vnd,stock_on_hand",token)
        assert (status,rows)==(200,[{"tenant_id":own,"price_vnd":160000,"stock_on_hand":2}])
        assert request("products?select=id&tenant_id=eq."+other,token)==(200,[])
        denied(request(endpoint,token,payload(other),"POST"),403)
        denied(request("products?tenant_id=eq."+own,token,{"stock_on_hand":1},"PATCH"),403)
        denied(request("tenant_memberships?user_id=eq."+users[index],token,{"role":"owner"},"PATCH"),403)
    for token in (staff,outsider):
        denied(request(endpoint,token,payload(SHOPS[0]),"POST"),403)
    assert request("products?select=id",outsider)==(200,[])
    denied(request("products?select=id"),401)
    denied(request(endpoint,None,payload(SHOPS[0]),"POST"),401)
    assert request("products?select=id",sign(users[0],b"wrong-signature"))[0]==401
    print("PASS: signed HTTP A/B reads, scoped RPC create/edit, stale edits, direct writes, role escalation, staff/nonmember, anonymous and forged signature")


if __name__ == "__main__":
    main()
