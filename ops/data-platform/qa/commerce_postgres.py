"""Disposable CI database only. Run after loading schema.staging.sql."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4
import sys
from pathlib import Path

import psycopg

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.commerce_transactions import CommerceRejected, checkout, cancel

def connect():
    return psycopg.connect("dbname=tien404_qa host=127.0.0.1 user=postgres", autocommit=True)

def simultaneous(action):
    gate = Barrier(2)
    def worker(i):
        with connect() as separate:
            gate.wait(timeout=10)
            try:
                return action(separate, i)
            except CommerceRejected as error:
                return str(error)
    with ThreadPoolExecutor(2) as pool:
        return list(pool.map(worker, (0,1)))

with connect() as conn:
    actor, shop, other = uuid4(), uuid4(), uuid4()
    conn.execute("INSERT INTO auth.users VALUES (%s)", (actor,))
    for tid, slug in ((shop,"shop-a"),(other,"shop-b")):
        conn.execute("INSERT INTO tenants(id,slug,name) VALUES (%s,%s,%s)", (tid,slug,slug))
        conn.execute("INSERT INTO products(tenant_id,sku,name,price_vnd,stock_on_hand) VALUES (%s,'ONE','Fixture',12345,2)", (tid,))
    conn.execute("INSERT INTO tenant_memberships(tenant_id,user_id,role) VALUES (%s,%s,'owner')",(shop,actor))
    def stocks():
        return [conn.execute("SELECT stock_on_hand FROM products WHERE tenant_id=%s",(t,)).fetchone()[0] for t in (shop,other)]
    def rejected(reason, tenant, key, cart):
        try:
            checkout(conn,tenant,actor,key,cart)
        except CommerceRejected as err:
            assert str(err)==reason
        else:
            raise AssertionError(reason)
    rejected("access_denied",other,"foreign-key",{"ONE":1})
    rejected("unavailable",shop,"rollback-key",{"ONE":1,"ZZ-MISSING":1})
    assert stocks()==[2,2]
    assert conn.execute("SELECT count(*) FROM app_private.order_idempotency").fetchone()==(0,)
    ids=simultaneous(lambda c,i:checkout(c,shop,actor,"same-key",{"ONE":1}))
    assert ids[0]==ids[1] and stocks()==[1,2]
    assert checkout(conn,shop,actor,"same-key",{"ONE":1})==ids[0]
    rejected("key_conflict",shop,"same-key",{"ONE":2})
    race=simultaneous(lambda c,i:checkout(c,shop,actor,"last-unit-"+str(i),{"ONE":1}))
    assert race.count("unavailable")==1 and stocks()==[0,2]
    assert conn.execute("SELECT count(*),sum(total_vnd) FROM orders").fetchone()==(2,24690)
    simultaneous(lambda c,i:cancel(c,shop,actor,ids[0]))
    assert stocks()==[1,2]
    assert conn.execute("SELECT count(*) FROM orders WHERE status='cancelled'").fetchone()==(1,)
    assert conn.execute("SELECT count(*) FROM app_private.audit_events").fetchone()==(3,)
print("PASS PostgreSQL: tenant denial, partial rollback, duplicate retry, payload conflict, last-unit race, authoritative price, double cancellation, audit.")
