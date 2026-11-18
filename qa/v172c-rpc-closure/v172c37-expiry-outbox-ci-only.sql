-- V17.2C.37 / GITHUB EPHEMERAL PG17 ONLY — not a Supabase migration.
-- Requires V17.2C.36 synthetic fixture already present. No network,
-- real webhook, message sender, dispatcher, scheduler, or customer IDs.
DO $guard$
BEGIN
 IF current_database()<>'postgres'
 OR to_regclass('tien404_v172c36_multiline_qa.orders') IS NULL
 OR to_regclass('tien404_v172c35_atomic_qa.orders') IS NULL
 THEN RAISE EXCEPTION 'DENY_NON_EPHEMERAL_V172C37';END IF;
END
$guard$;

CREATE SCHEMA tien404_v172c37_outbox_qa;
REVOKE ALL ON SCHEMA tien404_v172c37_outbox_qa FROM PUBLIC,anon,authenticated;

CREATE TABLE tien404_v172c37_outbox_qa.outbox_gate(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 allow_event_recording boolean NOT NULL DEFAULT true,
 no_send boolean NOT NULL DEFAULT true,
 synthetic_only boolean NOT NULL DEFAULT true,
 CHECK (no_send AND synthetic_only)
);
INSERT INTO tien404_v172c37_outbox_qa.outbox_gate(singleton) VALUES(true);

CREATE TABLE tien404_v172c37_outbox_qa.notification_outbox(
 event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_ref text NOT NULL,store_ref text NOT NULL,
 order_ref text NOT NULL,
 event_type text NOT NULL CHECK (event_type IN
 ('order.reserved','order.confirmed','order.cancelled','order.expired')),
 dispatch_state text NOT NULL DEFAULT 'HELD_NO_SEND'
  CHECK(dispatch_state='HELD_NO_SEND'),
 can_send boolean NOT NULL DEFAULT false CHECK(can_send=false),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_ref,store_ref,order_ref,event_type),
 FOREIGN KEY(order_ref,tenant_ref,store_ref)
 REFERENCES tien404_v172c36_multiline_qa.orders(order_ref,tenant_ref,store_ref)
);
-- Outbox has no recipient data, API key, transport, send status or
-- external dispatch adapter. Rows are transactionally committed records
-- ONLY. Production delivery is outside scope and remains NO-GO.

CREATE FUNCTION tien404_v172c37_outbox_qa.record_order_event_no_send()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog
AS $fn$
DECLARE v_type text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM tien404_v172c37_outbox_qa.outbox_gate
   WHERE singleton=true AND no_send AND synthetic_only AND allow_event_recording)
 THEN RAISE EXCEPTION 'DENY_OUTBOX_GATE';END IF;
 IF TG_OP='INSERT' THEN
   IF NEW.status<>'reserved'
   THEN RAISE EXCEPTION 'DENY_NEW_ORDER_STATE';END IF;
   v_type:='order.reserved';
 ELSIF TG_OP='UPDATE' THEN
   IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW;END IF;
   IF OLD.status<>'reserved' OR
      NEW.status NOT IN ('confirmed','cancelled','expired')
   THEN RAISE EXCEPTION 'DENY_INVALID_ORDER_TRANSITION';END IF;
   v_type:='order.'||NEW.status;
 ELSE
   RAISE EXCEPTION 'DENY_UNSUPPORTED_ORDER_EVENT';
 END IF;

 INSERT INTO tien404_v172c37_outbox_qa.notification_outbox(
 tenant_ref,store_ref,order_ref,event_type)
 VALUES(NEW.tenant_ref,NEW.store_ref,NEW.order_ref,v_type);
 RETURN NEW;
END
$fn$;

CREATE TRIGGER v172c37_new_reservation_outbox
 AFTER INSERT ON tien404_v172c36_multiline_qa.orders
 FOR EACH ROW EXECUTE FUNCTION
 tien404_v172c37_outbox_qa.record_order_event_no_send();

CREATE TRIGGER v172c37_terminal_outbox
 AFTER UPDATE OF status ON tien404_v172c36_multiline_qa.orders
 FOR EACH ROW EXECUTE FUNCTION
 tien404_v172c37_outbox_qa.record_order_event_no_send();

CREATE TABLE tien404_v172c37_outbox_qa.expiry_worker_gate(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT true,
 synthetic_only boolean NOT NULL DEFAULT true,
 no_send boolean NOT NULL DEFAULT true,
 hosted_enabled boolean NOT NULL DEFAULT false,
 CHECK(synthetic_only AND no_send AND NOT hosted_enabled)
);
INSERT INTO tien404_v172c37_outbox_qa.expiry_worker_gate(singleton)
 VALUES(true);

-- Read-only aggregate preview, no raw Order IDs or customer fields.
CREATE FUNCTION tien404_v172c37_outbox_qa.preview_due_count()
RETURNS bigint LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog
AS $sql$
SELECT count(*) FROM tien404_v172c36_multiline_qa.orders
WHERE status='reserved'
AND reservation_expires_at<=clock_timestamp();
$sql$;

CREATE FUNCTION tien404_v172c37_outbox_qa.expire_due_batch_no_send(
 p_limit integer,p_fault text DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER
 SET search_path=pg_catalog
AS $fn$
DECLARE
 v_order record;v_item record;v_stock record;
 v_line_count integer;v_processed integer:=0;
BEGIN
 IF p_limit IS NULL OR p_limit<1 OR p_limit>10 OR
   (p_fault IS NOT NULL AND p_fault NOT IN
    ('after_first_release','after_status_outbox'))
 THEN RAISE EXCEPTION 'DENY_WORKER_ARGUMENT';END IF;
 IF NOT EXISTS(SELECT 1 FROM tien404_v172c37_outbox_qa.expiry_worker_gate
 WHERE singleton=true AND enabled AND synthetic_only
 AND no_send AND NOT hosted_enabled)
 THEN RAISE EXCEPTION 'DENY_EXPIRY_WORKER_GATE';END IF;

 -- SKIP LOCKED serializes concurrent worker batches without waiting
 -- on order rows held by confirm/cancel transitions.
 FOR v_order IN
  SELECT order_ref,tenant_ref,store_ref
  FROM tien404_v172c36_multiline_qa.orders
  WHERE status='reserved'
  AND reservation_expires_at<=clock_timestamp()
  ORDER BY reservation_expires_at,order_ref
  LIMIT p_limit FOR UPDATE SKIP LOCKED
 LOOP
  v_line_count:=0;
  -- Stable SKU locking order is consistent with V36 reserve/transition.
  FOR v_item IN
    SELECT sku,quantity
    FROM tien404_v172c36_multiline_qa.order_items
    WHERE order_ref=v_order.order_ref ORDER BY sku
  LOOP
    SELECT on_hand,reserved INTO v_stock
    FROM tien404_v172c36_multiline_qa.inventory
    WHERE tenant_ref=v_order.tenant_ref AND store_ref=v_order.store_ref
      AND sku=v_item.sku FOR UPDATE;
    IF NOT FOUND OR v_stock.reserved<v_item.quantity
    THEN RAISE EXCEPTION 'DENY_EXPIRY_STOCK_INVARIANT';END IF;
    UPDATE tien404_v172c36_multiline_qa.inventory
    SET reserved=reserved-v_item.quantity
    WHERE tenant_ref=v_order.tenant_ref
    AND store_ref=v_order.store_ref AND sku=v_item.sku;
    v_line_count:=v_line_count+1;
    IF p_fault='after_first_release'
    THEN RAISE EXCEPTION 'QA_FAULT_EXPIRY_AFTER_FIRST_RELEASE';END IF;
  END LOOP;
  IF v_line_count<2 THEN RAISE EXCEPTION 'DENY_INCOMPLETE_EXPIRY_ITEMS';END IF;
  -- This UPDATE fires the no-send outbox trigger in the same txn.
  UPDATE tien404_v172c36_multiline_qa.orders
  SET status='expired'
  WHERE order_ref=v_order.order_ref AND status='reserved';
  IF NOT FOUND THEN RAISE EXCEPTION 'DENY_EXPIRY_RACE';END IF;
  IF p_fault='after_status_outbox'
  THEN RAISE EXCEPTION 'QA_FAULT_EXPIRY_AFTER_OUTBOX';END IF;
  v_processed:=v_processed+1;
 END LOOP;
 RETURN v_processed;
END
$fn$;

REVOKE ALL ON ALL TABLES IN SCHEMA tien404_v172c37_outbox_qa
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA tien404_v172c37_outbox_qa
 FROM PUBLIC,anon,authenticated;
-- No role can send. Even the CI superuser cannot change dispatch_state
-- to SENT without violating a CHECK constraint in this synthetic schema.
