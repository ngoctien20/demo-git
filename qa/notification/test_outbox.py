"""Run on disposable CI PostgreSQL only, with the pinned commerce backend on PYTHONPATH."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

import psycopg
from app.commerce_transactions import checkout, cancel


def connect():
    return psycopg.connect("dbname=tien404_qa", autocommit=True)


def simultaneous(fn):
    barrier = Barrier(2)
    def work(i):
        with connect() as worker:
            barrier.wait(timeout=10)
            return fn(worker, i)
    with ThreadPoolExecutor(2) as pool:
        return list(pool.map(work, (0, 1)))


def claim(db, channel):
    return db.execute("select id,claim_token from notification_private.claim(%s)", (channel,)).fetchall()


def finish(db, row, outcome, receipt=None):
    return db.execute("select notification_private.finish(%s,%s,%s,%s)", (*row, outcome, receipt)).fetchone()[0]


with connect() as db:
    shops = [uuid4(), uuid4()]
    users = [uuid4(), uuid4()]
    for i, (shop, actor) in enumerate(zip(shops, users)):
        db.execute("insert into auth.users values (%s)", (actor,))
        db.execute("insert into tenants(id,name,slug) values (%s,'QA',%s)", (shop, f"fixture-{i}"))
        db.execute("insert into tenant_memberships(tenant_id,user_id,role) values (%s,%s,'owner')", (shop, actor))
        db.execute("insert into products(tenant_id,sku,name,price_vnd,stock_on_hand) values (%s,'QA','test',200,4)", (shop,))
        for channel in ('dashboard', 'gmail', 'telegram'):
            db.execute("""insert into notification_private.routes
                  (tenant_id,merchant_id,channel,enabled,verified,consent) values (%s,%s,%s,true,true,true)""",
                       (shop, actor, channel))
    def order(worker, i=0):
        return checkout(worker, shops[i], users[i], 'same-request', {'QA': 2})
    first, replay = simultaneous(lambda worker, _: order(worker))
    assert first == replay
    claims = simultaneous(lambda worker, _: claim(worker, 'telegram'))
    assert sorted(map(len, claims)) == [0, 1]
    row = next(rows[0] for rows in claims if rows)
    assert not finish(db, (row[0], uuid4()), 'accepted', 'invalid')
    assert finish(db, row, 'accepted', 'mock-only') and not finish(db, row, 'accepted', 'mock-only')
    assert not claim(db, 'telegram')
    row = claim(db, 'gmail')[0]
    assert finish(db, row, 'not_dispatched') and not claim(db, 'gmail')
    db.execute("update notification_private.notification_outbox set next_retry_at=now() where id=%s", (row[0],))
    retry = claim(db, 'gmail')[0]
    assert retry[1] != row[1] and finish(db, retry, 'ambiguous') and not claim(db, 'gmail')
    other = order(db, 1)
    assert other != first
    row = claim(db, 'gmail')[0]
    db.execute("update notification_private.notification_outbox set claimed_at=now()-interval '6 minutes' where id=%s", (row[0],))
    assert db.execute('select notification_private.expire_claims()').fetchone()==(1,)
    assert not finish(db, row, 'accepted', 'late') and not claim(db, 'gmail')
    db.execute("update notification_private.routes set consent=false where channel='telegram' and tenant_id=%s", (shops[1],))
    assert not claim(db, 'telegram')
    db.execute("update notification_private.routes set consent=true where channel='telegram' and tenant_id=%s", (shops[1],))
    assert not claim(db, 'telegram')  # new consent cannot revive an old recipient snapshot
    try:
        with db.transaction():
            checkout(db, shops[0], users[0], 'rollback-check', {'QA':1})
            raise RuntimeError('simulate failed commit')
    except RuntimeError:
        pass
    assert db.execute('select count(*) from notification_private.notification_events').fetchone()==(2,)
    assert db.execute('select count(*) from notification_private.notification_outbox').fetchone()==(6,)
    assert db.execute("select count(*) from public.orders where status='pending' and total_vnd=400").fetchone()==(2,)
    try:
        db.execute("insert into app_private.audit_events(tenant_id,actor_id,event_type,request_id) values (%s,%s,'checkout',%s)",
                   (shops[1],users[1],str(first)))
    except psycopg.errors.NoDataFound:
        pass
    else:
        raise AssertionError('forged audit accepted')
    for i, shop in enumerate(shops):
        with db.transaction():
            db.execute("select set_config('request.jwt.claim.sub', %s, true)", (str(users[i]),))
            db.execute("set local role authenticated")
            inbox = db.execute("select * from merchant_notification_inbox(%s)", (shop,)).fetchall()
            channels = db.execute("select * from merchant_notification_channels(%s)", (shop,)).fetchall()
            assert [r[0] for r in channels] == ['zalo','telegram','gmail','messenger','dashboard']
            assert channels[0][1:] == (False,False,'waiting_for_owner')
            assert db.execute("select * from merchant_notification_channels(%s)", (shops[1-i],)).fetchall()==[]
            assert len(inbox)==1 and inbox[0][1]==(first,other)[i] and inbox[0][3] is None
            assert len(inbox[0][4])==3
            if i==1:
                assert next(d for d in inbox[0][4] if d["channel"]=="telegram")["status"]=="blocked"
            assert next(d for d in inbox[0][4] if d["channel"]=="dashboard")["status"]=="accepted"
            assert db.execute("select * from merchant_notification_inbox(%s)", (shops[1-i],)).fetchall()==[]
            for target, expected in [(shops[1-i],False),(shop,True),(shop,True)]:
                assert db.execute("select mark_merchant_notification_viewed(%s,%s)",(target,inbox[0][0])).fetchone()==(expected,)
            assert db.execute("select viewed_at is not null from merchant_notification_inbox(%s)",(shop,)).fetchone()==(True,)
    assert db.execute("select count(*) from orders where status='pending'").fetchone()==(2,)
    cancel(db,shops[0],users[0],first)
    assert db.execute('select stock_on_hand from products where tenant_id=%s',(shops[0],)).fetchone()==(4,)
print("PASS: checkout, routing, rollback, two-worker claim, receipt fencing, retry, ambiguity, crash and cross-shop forgery")
