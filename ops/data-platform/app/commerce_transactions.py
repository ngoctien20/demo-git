"""PostgreSQL merchant transactions. Actor must come from verified server identity."""
import hashlib
import json
from uuid import UUID


MAX_ORDER_VND = 10**15  # public.orders.total_vnd CHECK constraint
MAX_STOCK = 2**31 - 1  # public.products.stock_on_hand is an integer


class CommerceRejected(ValueError):
    pass


def reserve_request(cursor, tenant, key, digest):
    if not isinstance(key, str) or not 8 <= len(key) <= 128:
        raise CommerceRejected("invalid_request")
    cursor.execute("""INSERT INTO app_private.order_idempotency (tenant_id,request_key,request_sha256)
                      VALUES (%s,%s,%s) ON CONFLICT (tenant_id,request_key) DO NOTHING""", (tenant,key,digest))
    cursor.execute("""SELECT request_sha256,order_id FROM app_private.order_idempotency
                      WHERE tenant_id=%s AND request_key=%s FOR UPDATE""", (tenant,key))
    prior_digest, order = cursor.fetchone()
    if prior_digest != digest:
        raise CommerceRejected("key_conflict")
    return order


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
        order = reserve_request(c, tenant, key, digest)
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
            if total > MAX_ORDER_VND:
                raise CommerceRejected("order_total_limit")
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
        status = lock_managed_order(c, tenant, order)
        if status == "cancelled":
            return
        if status not in ("pending", "confirmed"):
            raise CommerceRejected("not_cancellable")
        c.execute("""SELECT i.product_id,i.quantity FROM public.order_items i JOIN public.products p
                     ON (p.id,p.tenant_id)=(i.product_id,i.tenant_id)
                     WHERE i.tenant_id=%s AND i.order_id=%s ORDER BY p.sku COLLATE "C" """, (tenant,order))
        for product, quantity in c.fetchall():
            c.execute("""UPDATE public.products SET stock_on_hand=stock_on_hand+%s,updated_at=now()
                         WHERE tenant_id=%s AND id=%s AND stock_on_hand <= %s""",
                      (quantity,tenant,product,MAX_STOCK-quantity))
            if c.rowcount != 1:
                raise CommerceRejected("stock_limit")
        c.execute("UPDATE public.orders SET status='cancelled',updated_at=now() WHERE tenant_id=%s AND id=%s",
                  (tenant,order))
        audit(c, tenant, actor, order, "cancel")


def lock_managed_order(cursor, tenant, order):
    cursor.execute("""SELECT status FROM public.orders o WHERE tenant_id=%s AND id=%s
                      AND EXISTS (SELECT 1 FROM app_private.order_idempotency i
                                  WHERE i.tenant_id=o.tenant_id AND i.order_id=o.id) FOR UPDATE""",
                   (tenant, order))
    row = cursor.fetchone()
    if not row:
        raise CommerceRejected("unknown_order")
    return row[0]


def update_order(connection, tenant, actor, order, key, *, sku=None, quantity=None, confirm=False):
    """Set an existing line's quantity or confirm the order. Preserve its original unit price."""
    if confirm:
        if sku is not None or quantity is not None:
            raise CommerceRejected("invalid_request")
    elif not isinstance(sku, str) or not sku.strip() or len(sku) > 80 or type(quantity) is not int or not 1 <= quantity <= 10000:
        raise CommerceRejected("invalid_request")
    payload = ["merchant_change_v1", str(order), sku, quantity, confirm]
    digest = hashlib.sha256(json.dumps(payload, separators=(",", ":")).encode()).hexdigest()
    with connection.transaction(), connection.cursor() as cursor:
        authorize(cursor, tenant, actor)
        prior = reserve_request(cursor, tenant, key, digest)
        if prior:
            return prior
        if lock_managed_order(cursor, tenant, order) != "pending":
            raise CommerceRejected("not_pending")
        if confirm:
            cursor.execute("UPDATE public.orders SET status='confirmed',updated_at=clock_timestamp() WHERE tenant_id=%s AND id=%s",
                           (tenant, order))
        else:
            cursor.execute("""SELECT i.id,i.product_id,i.quantity,i.unit_price_vnd
                              FROM public.order_items i JOIN public.products p
                                ON (i.tenant_id,i.product_id)=(p.tenant_id,p.id)
                              WHERE i.tenant_id=%s AND i.order_id=%s AND p.sku=%s""", (tenant,order,sku))
            row = cursor.fetchone()
            if not row:
                raise CommerceRejected("unknown_line")
            item, product, old_quantity, price = row
            delta = quantity - old_quantity
            if delta < 0:
                cursor.execute("SELECT stock_on_hand FROM public.products WHERE tenant_id=%s AND id=%s FOR UPDATE",
                               (tenant, product))
                if cursor.fetchone()[0] > MAX_STOCK + delta:
                    raise CommerceRejected("stock_limit")
            cursor.execute("""UPDATE public.products SET stock_on_hand=stock_on_hand-%s, updated_at=clock_timestamp()
                              WHERE tenant_id=%s AND id=%s AND (%s <= 0 OR (is_active AND stock_on_hand >= %s))""",
                           (delta, tenant, product, delta, delta))
            if cursor.rowcount != 1:
                raise CommerceRejected("unavailable")
            cursor.execute("UPDATE public.order_items SET quantity=%s WHERE tenant_id=%s AND id=%s", (quantity,tenant,item))
            cursor.execute("""UPDATE public.orders SET total_vnd=total_vnd+%s,updated_at=clock_timestamp()
                              WHERE tenant_id=%s AND id=%s AND total_vnd <= %s""",
                           (delta*price,tenant,order,MAX_ORDER_VND-delta*price))
            if cursor.rowcount != 1:
                raise CommerceRejected("order_total_limit")
        cursor.execute("UPDATE app_private.order_idempotency SET order_id=%s WHERE tenant_id=%s AND request_key=%s",
                       (order, tenant, key))
        cursor.execute("""INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,request_id,metadata)
                          VALUES (%s,%s,%s,%s,%s::jsonb)""",
                       (tenant, actor, "confirm" if confirm else "quantity_change", str(order),
                        json.dumps({"key":key} if confirm else {"key":key,"sku":sku,"before":old_quantity,"after":quantity})))
        return order
