"""Server-side sandbox for a verified channel ingress. Never feed actor/shop/sender from an AI prompt."""
import hashlib
import json
from uuid import uuid4
from app.commerce_transactions import authorize, checkout, CommerceRejected


def preview(db, shop, actor, sender, cart, ingress_id):
    if not isinstance(ingress_id,str) or not 1<=len(ingress_id)<=256 or not sender or not isinstance(cart, dict) or not 1 <= len(cart) <= 100:
        raise CommerceRejected('invalid_request')
    lines=[]
    with db.transaction():
        with db.cursor() as cur:
            authorize(cur,shop,actor)
        sender_hash=hashlib.sha256(sender.encode()).digest()
        # Serialize replacement for this tenant/sender, including first use.
        db.execute("select pg_advisory_xact_lock(hashtextextended(%s,0))",(str(shop)+sender_hash.hex(),))
        previous=db.execute("""select id,lines,actor_id from notification_private.order_previews
                             where tenant_id=%s and sender_hash=%s and ingress_id=%s""",(shop,sender_hash,ingress_id)).fetchone()
        if previous:
            if previous[2]!=actor or {sku:q for sku,q,_ in previous[1]}!=cart:
                raise CommerceRejected('event_conflict')
            return previous[0],previous[1]
        for sku,qty in sorted(cart.items()):
            if type(qty) is not int or not 1<=qty<=10000:
                raise CommerceRejected('invalid_quantity')
            item=db.execute("select price_vnd from public.products where tenant_id=%s and sku=%s and is_active and stock_on_hand>=%s",
                            (shop,sku,qty)).fetchone()
            if not item:
                raise CommerceRejected('unavailable')
            lines.append([sku,qty,item[0]])
        db.execute("""update notification_private.order_previews set withdrawn=true
                      where tenant_id=%s and sender_hash=%s and order_id is null and not withdrawn""",(shop,sender_hash))
        token=uuid4()
        db.execute("""insert into notification_private.order_previews(id,tenant_id,actor_id,sender_hash,ingress_id,lines)
                      values (%s,%s,%s,%s,%s,%s::jsonb)""",
                   (token,shop,actor,sender_hash,ingress_id,json.dumps(lines)))
    return token,lines


def confirm(db, shop, actor, sender, token, confirmed):
    if confirmed is not True:
        raise CommerceRejected('confirmation_required')
    with db.transaction():
        row=db.execute("""select lines,order_id,expires_at>now() and not withdrawn from notification_private.order_previews
                          where id=%s and tenant_id=%s and actor_id=%s and sender_hash=%s for update""",
                       (token,shop,actor,hashlib.sha256(sender.encode()).digest())).fetchone()
        if not row:
            raise CommerceRejected('invalid_preview')
        with db.cursor() as cur:
            authorize(cur,shop,actor)
        if row[1]: return row[1]
        if not row[2]: raise CommerceRejected('preview_expired')
        for sku,qty,price in row[0]:
            current=db.execute("""select price_vnd from public.products where tenant_id=%s and sku=%s
                                and is_active and stock_on_hand>=%s for update""",(shop,sku,qty)).fetchone()
            if not current or current[0]!=price:
                raise CommerceRejected('preview_changed')
        order=checkout(db,shop,actor,str(token),{sku:qty for sku,qty,price in row[0]})
        check=db.execute("select status,total_vnd from public.orders where tenant_id=%s and id=%s",(shop,order)).fetchone()
        if check!=('pending',sum(q*p for _,q,p in row[0])):
            raise CommerceRejected('order_not_verified')
        db.execute("update notification_private.order_previews set order_id=%s where id=%s",(order,token))
        return order


def withdraw(db, shop, actor, sender, token):
    with db.transaction():
        with db.cursor() as cur:
            authorize(cur,shop,actor)
        return bool(db.execute("""update notification_private.order_previews set withdrawn=true
            where id=%s and tenant_id=%s and actor_id=%s and sender_hash=%s and order_id is null
            returning id""",(token,shop,actor,hashlib.sha256(sender.encode()).digest())).fetchone())
