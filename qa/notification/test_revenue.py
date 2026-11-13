"""Disposable PostgreSQL. Includes local-midnight boundaries and a foreign paid order."""
from uuid import uuid4
import psycopg

with psycopg.connect("dbname=tien404_qa") as db:
    user, a, b = [uuid4() for _ in range(3)]
    db.execute("insert into auth.users values(%s)",(user,))
    for shop in (a,b):
        db.execute("insert into tenants(id,slug,name) values(%s,%s,'QA')",(shop,str(shop)+'-qa' if str(shop)[0].isalpha() else 'qa-'+str(shop)))
    db.execute("insert into tenant_memberships(tenant_id,user_id,role) values(%s,%s,'owner')",(a,user))
    sku=db.execute("insert into products(tenant_id,sku,name,price_vnd) values(%s,'TEST','QA',100) returning id",(a,)).fetchone()[0]
    for shop,stamp,status,total in [(a,'2026-11-11T16:59:59Z','paid',80),(a,'2026-11-11T17:00:00Z','paid',200),
        (a,'2026-11-12T16:59:59Z','pending',500),(a,'2026-11-12T16:59:59Z','cancelled',30),
        (a,'2026-11-12T17:00:00Z','paid',90),(b,'2026-11-12T09:00:00Z','paid',999)]:
        order=db.execute("insert into orders(tenant_id,created_at,status,total_vnd) values(%s,%s,%s,%s) returning id",(shop,stamp,status,total)).fetchone()[0]
        if total==200:
            db.execute("insert into order_items(tenant_id,order_id,product_id,quantity,unit_price_vnd) values(%s,%s,%s,2,100)",(a,order,sku))
    db.execute("select set_config('request.jwt.claim.sub',%s,true)",(str(user),))
    db.execute("set local role authenticated")
    def report(shop,start,end):
        return db.execute("select merchant_revenue_v3(%s,%s,%s)",(shop,start,end)).fetchone()[0]
    r=report(a,'2026-11-12','2026-11-12')
    stats=r['periods']['current']
    assert stats==dict(orders=3,pending=1,paid=1,cancelled=1,paid_order_value_vnd='200',unpaid_order_value_vnd='500',order_face_value_vnd='730',avg_paid_order_vnd='200')
    assert r['periods']['previous']['paid_order_value_vnd']=='80' and r['gross_profit_vnd'] is None and r['cash_received_vnd'] is None
    assert r['top_skus_by_units']==[dict(sku='TEST',units=2,paid_line_vnd='200')]
    for shop,start,end,err in [(b,'2026-11-12','2026-11-12',psycopg.errors.InsufficientPrivilege),
        (a,'2025-01-01','2026-12-31',psycopg.errors.InvalidParameterValue)]:
        try:
            with db.transaction(): report(shop,start,end)
        except err: pass
        else: raise AssertionError('scope or range accepted')
    db.rollback()
print('PASS: paid cohort, pending/cancelled, top SKU, Vietnam midnight, previous period, missing costs and tenant denial')
