"""PostgreSQL transaction primitives. No HTTP route. Tenant and actor come from a trusted caller."""
import hashlib
import json
from uuid import UUID


class CommerceRejected(ValueError):
    pass


def checkout(connection, tenant: UUID, actor: UUID, key: str, cart: dict[str, int]) -> UUID:
    if not isinstance(key, str) or not 8 <= len(key) <= 128 or not 1 <= len(cart) <= 100:
        raise CommerceRejected("invalid_request")
    for sku, quantity in cart.items():
        if not isinstance(sku, str) or not sku.strip() or len(sku) > 80:
            raise CommerceRejected("invalid_sku")
        if type(quantity) is not int or not 1 <= quantity <= 10000:
            raise CommerceRejected("invalid_quantity")
    digest = hashlib.sha256(json.dumps(cart, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    with connection.transaction(), connection.cursor() as c:
        authorize(c, tenant, actor)
        c.execute("""INSERT INTO app_private.order_idempotency (tenant_id,request_key,request_sha256)
                     VALUES (%s,%s,%s) ON CONFLICT (tenant_id,request_key) DO NOTHING""", (tenant,key,digest))
        c.execute("""SELECT request_sha256,order_id FROM app_private.order_idempotency
                     WHERE tenant_id=%s AND request_key=%s FOR UPDATE""", (tenant,key))
        previous, order = c.fetchone()
        if previous != digest:
            raise CommerceRejected("key_conflict")
        if order:
            return order
        total = 0
        items = []
        for sku, quantity in sorted(cart.items()):
            c.execute("""UPDATE public.products SET stock_on_hand=stock_on_hand-%s,updated_at=now()
                         WHERE tenant_id=%s AND sku=%s AND is_active AND stock_on_hand >= %s
                         RETURNING id,price_vnd""", (quantity,tenant,sku,quantity))
            product = c.fetchone()
            if not product:
                raise CommerceRejected("unavailable")
            product_id, price = product
            items.append((product_id, quantity, price))
            total += quantity * price
        c.execute("""INSERT INTO public.orders (tenant_id,total_vnd,order_source)
                     VALUES (%s,%s,'api') RETURNING id""", (tenant,total))
        order = c.fetchone()[0]
        c.executemany("""INSERT INTO public.order_items (tenant_id,order_id,product_id,quantity,unit_price_vnd)
                         VALUES (%s,%s,%s,%s,%s)""", [(tenant,order,*item) for item in items])
        c.execute("UPDATE app_private.order_idempotency SET order_id=%s WHERE tenant_id=%s AND request_key=%s",
                  (order,tenant,key))
        audit(c, tenant, actor, order, "checkout")
        return order


def authorize(cursor, tenant, actor):
    cursor.execute("""SELECT 1 FROM public.tenant_memberships WHERE tenant_id=%s AND user_id=%s
                      AND active AND role IN ('owner','manager') FOR SHARE""", (tenant,actor))
    if not cursor.fetchone():
        raise CommerceRejected("access_denied")


def audit(cursor, tenant, actor, order, event):
    cursor.execute("""INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,request_id)
                      VALUES (%s,%s,%s,%s)""", (tenant,actor,event,str(order)))


def cancel(connection, tenant: UUID, actor: UUID, order: UUID):
    with connection.transaction(), connection.cursor() as c:
        authorize(c, tenant, actor)
        # Only reverse stock for orders created by this checkout path.
        c.execute("""SELECT o.status FROM public.orders o WHERE o.tenant_id=%s AND o.id=%s
                     AND EXISTS (SELECT 1 FROM app_private.order_idempotency i
                                 WHERE i.tenant_id=o.tenant_id AND i.order_id=o.id) FOR UPDATE""", (tenant,order))
        row = c.fetchone()
        if not row:
            raise CommerceRejected("unknown_order")
        if row[0] == "cancelled":
            return
        if row[0] != "pending":
            raise CommerceRejected("not_cancellable")
        c.execute("""SELECT i.product_id,i.quantity FROM public.order_items i JOIN public.products p
                     ON (p.id,p.tenant_id)=(i.product_id,i.tenant_id)
                     WHERE i.tenant_id=%s AND i.order_id=%s ORDER BY p.sku COLLATE "C" """, (tenant,order))
        for product, quantity in c.fetchall():
            c.execute("""UPDATE public.products SET stock_on_hand=stock_on_hand+%s,updated_at=now()
                         WHERE tenant_id=%s AND id=%s""", (quantity,tenant,product))
        c.execute("UPDATE public.orders SET status='cancelled',updated_at=now() WHERE tenant_id=%s AND id=%s",
                  (tenant,order))
        audit(c, tenant, actor, order, "cancel")
