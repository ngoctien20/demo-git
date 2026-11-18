-- V17.2C.36 — EPHEMERAL POSTGRESQL 17 ONLY, NOT A PRODUCTION MIGRATION.
-- Only runs after V17.2C.35 CI fixture; no connection to Supabase.
DO $$
BEGIN
 IF current_database()<>'postgres'
 OR to_regclass('tien404_v172c35_atomic_qa.orders') IS NULL
 THEN RAISE EXCEPTION 'DENY_NON_EPHEMERAL_V172C36'; END IF;
END $$;
CREATE SCHEMA tien404_v172c36_multiline_qa;
REVOKE ALL ON SCHEMA tien404_v172c36_multiline_qa FROM PUBLIC,anon,authenticated;

CREATE TABLE tien404_v172c36_multiline_qa.stores (
 tenant_ref text NOT NULL,store_ref text NOT NULL,active boolean NOT NULL,
 PRIMARY KEY(tenant_ref,store_ref)
);
CREATE TABLE tien404_v172c36_multiline_qa.actors (
 tenant_ref text NOT NULL,store_ref text NOT NULL,actor_ref text NOT NULL,
 active boolean NOT NULL,verified boolean NOT NULL,
 PRIMARY KEY(tenant_ref,store_ref,actor_ref),
 FOREIGN KEY(tenant_ref,store_ref) REFERENCES tien404_v172c36_multiline_qa.stores
);
CREATE TABLE tien404_v172c36_multiline_qa.installations (
 installation_ref text PRIMARY KEY,
 tenant_ref text NOT NULL,store_ref text NOT NULL,channel text NOT NULL,
 active boolean NOT NULL,verified boolean NOT NULL,
 UNIQUE(installation_ref,tenant_ref,store_ref),
 FOREIGN KEY(tenant_ref,store_ref) REFERENCES tien404_v172c36_multiline_qa.stores,
 CHECK(channel IN ('messenger','zalo'))
);
CREATE TABLE tien404_v172c36_multiline_qa.inventory (
 tenant_ref text NOT NULL,store_ref text NOT NULL,sku text NOT NULL,
 price_vnd bigint NOT NULL CHECK(price_vnd>=0),
 on_hand integer NOT NULL CHECK(on_hand>=0),
 reserved integer NOT NULL DEFAULT 0 CHECK(reserved>=0 AND reserved<=on_hand),
 active boolean NOT NULL,
 PRIMARY KEY(tenant_ref,store_ref,sku),
 FOREIGN KEY(tenant_ref,store_ref) REFERENCES tien404_v172c36_multiline_qa.stores
);
CREATE TABLE tien404_v172c36_multiline_qa.private_intents (
 intent_ref text PRIMARY KEY,tenant_ref text NOT NULL,store_ref text NOT NULL,
 actor_ref text NOT NULL,installation_ref text NOT NULL,
 channel text NOT NULL,provider_event_ref text NOT NULL,
 source_lane text NOT NULL,origin_workflow_id text NOT NULL,
 expected_total_vnd bigint NOT NULL CHECK(expected_total_vnd>=0),
 provider_verified boolean NOT NULL,session_current boolean NOT NULL,
 confirmation_verified boolean NOT NULL,challenge_consumed boolean NOT NULL,
 valid_until timestamptz NOT NULL,
 FOREIGN KEY(installation_ref,tenant_ref,store_ref)
 REFERENCES tien404_v172c36_multiline_qa.installations(installation_ref,tenant_ref,store_ref)
);
CREATE TABLE tien404_v172c36_multiline_qa.intent_lines (
 intent_ref text NOT NULL REFERENCES tien404_v172c36_multiline_qa.private_intents,
 sku text NOT NULL,quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 999),
 expected_unit_vnd bigint NOT NULL CHECK(expected_unit_vnd>=0),
 PRIMARY KEY(intent_ref,sku)
);
CREATE TABLE tien404_v172c36_multiline_qa.orders (
 order_ref text PRIMARY KEY,tenant_ref text NOT NULL,store_ref text NOT NULL,
 actor_ref text NOT NULL,channel text NOT NULL,
 provider_event_ref text NOT NULL,intent_ref text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'reserved'
 CHECK(status IN ('reserved','confirmed','cancelled','expired')),
 total_vnd bigint NOT NULL CHECK(total_vnd>=0),
 reservation_expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_ref,store_ref,channel,provider_event_ref),
 UNIQUE(order_ref,tenant_ref,store_ref),
 FOREIGN KEY(tenant_ref,store_ref) REFERENCES tien404_v172c36_multiline_qa.stores
);
CREATE TABLE tien404_v172c36_multiline_qa.order_items (
 order_ref text NOT NULL,tenant_ref text NOT NULL,store_ref text NOT NULL,
 sku text NOT NULL,quantity integer NOT NULL CHECK(quantity>0),
 unit_price_vnd bigint NOT NULL CHECK(unit_price_vnd>=0),
 total_vnd bigint NOT NULL CHECK(total_vnd>=0),
 PRIMARY KEY(order_ref,sku),
 FOREIGN KEY(order_ref,tenant_ref,store_ref)
 REFERENCES tien404_v172c36_multiline_qa.orders(order_ref,tenant_ref,store_ref),
 FOREIGN KEY(tenant_ref,store_ref,sku)
 REFERENCES tien404_v172c36_multiline_qa.inventory(tenant_ref,store_ref,sku)
);
CREATE TABLE tien404_v172c36_multiline_qa.private_transitions (
 action_ref text PRIMARY KEY,order_ref text NOT NULL,
 tenant_ref text NOT NULL,store_ref text NOT NULL,actor_ref text NOT NULL,
 action_type text NOT NULL CHECK(action_type IN ('confirm','cancel','expire')),
 authorized boolean NOT NULL,provider_verified boolean NOT NULL,
 session_current boolean NOT NULL,challenge_consumed boolean NOT NULL,
 valid_until timestamptz NOT NULL
);
CREATE TABLE tien404_v172c36_multiline_qa.transition_receipts (
 action_ref text PRIMARY KEY,order_ref text NOT NULL UNIQUE,
 tenant_ref text NOT NULL,store_ref text NOT NULL,
 action_type text NOT NULL,completed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(order_ref,tenant_ref,store_ref)
 REFERENCES tien404_v172c36_multiline_qa.orders(order_ref,tenant_ref,store_ref)
);

CREATE FUNCTION tien404_v172c36_multiline_qa.reserve_synthetic_multiline(
 p_intent_ref text,p_fault text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog
AS $fn$
DECLARE
 v_intent tien404_v172c36_multiline_qa.private_intents%ROWTYPE;
 v_existing tien404_v172c36_multiline_qa.orders%ROWTYPE;
 v_line record;
 v_inventory tien404_v172c36_multiline_qa.inventory%ROWTYPE;
 v_total numeric:=0;v_count integer:=0;v_order_ref text;
BEGIN
 IF p_intent_ref IS NULL OR length(p_intent_ref)<3 OR length(p_intent_ref)>160
 OR (p_fault IS NOT NULL AND p_fault NOT IN
 ('after_first_reserve','after_header','after_first_item'))
 THEN RAISE EXCEPTION 'DENY_INVALID_INTENT';END IF;
 SELECT * INTO v_intent FROM tien404_v172c36_multiline_qa.private_intents
 WHERE intent_ref=p_intent_ref FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DENY_NO_PRIVATE_INTENT'; END IF;
 IF v_intent.source_lane<>'commerce_v2_candidate'
 OR v_intent.origin_workflow_id<>'commerce_v2_candidate_no_send'
 OR v_intent.provider_verified IS DISTINCT FROM true
 OR v_intent.session_current IS DISTINCT FROM true
 OR v_intent.confirmation_verified IS DISTINCT FROM true
 OR v_intent.challenge_consumed IS DISTINCT FROM true
 OR v_intent.valid_until<=clock_timestamp()
 THEN RAISE EXCEPTION 'DENY_PRIVATE_INTENT_AUTH';END IF;
 IF NOT EXISTS (
 SELECT 1 FROM tien404_v172c36_multiline_qa.stores s
 JOIN tien404_v172c36_multiline_qa.actors a
 ON s.tenant_ref=a.tenant_ref AND s.store_ref=a.store_ref
 JOIN tien404_v172c36_multiline_qa.installations ins
 ON ins.tenant_ref=s.tenant_ref AND ins.store_ref=s.store_ref
 WHERE s.tenant_ref=v_intent.tenant_ref AND s.store_ref=v_intent.store_ref AND s.active
 AND a.actor_ref=v_intent.actor_ref AND a.active AND a.verified
 AND ins.installation_ref=v_intent.installation_ref
 AND ins.channel=v_intent.channel AND ins.active AND ins.verified
 ) THEN RAISE EXCEPTION 'DENY_STORE_AUTHORITY';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(
 v_intent.tenant_ref||chr(31)||v_intent.store_ref||chr(31)||
 v_intent.channel||chr(31)||v_intent.provider_event_ref,0));
 SELECT * INTO v_existing FROM tien404_v172c36_multiline_qa.orders
 WHERE tenant_ref=v_intent.tenant_ref AND store_ref=v_intent.store_ref
 AND channel=v_intent.channel AND provider_event_ref=v_intent.provider_event_ref;
 IF FOUND THEN
 IF v_existing.intent_ref=v_intent.intent_ref
 THEN RETURN 'DUPLICATE_RESERVATION_NO_WRITE';END IF;
 RAISE EXCEPTION 'DENY_PROVIDER_EVENT_REUSED';END IF;
 SELECT count(*) INTO v_count FROM tien404_v172c36_multiline_qa.intent_lines
 WHERE intent_ref=v_intent.intent_ref;
 IF v_count<2 OR v_count>20 THEN RAISE EXCEPTION 'DENY_LINE_COUNT';END IF;
 v_count:=0;
 -- Deterministic SKU lock order avoids deadlocks in reversed multi-item carts.
 FOR v_line IN SELECT sku,quantity,expected_unit_vnd
 FROM tien404_v172c36_multiline_qa.intent_lines
 WHERE intent_ref=v_intent.intent_ref ORDER BY sku LOOP
  SELECT * INTO v_inventory FROM tien404_v172c36_multiline_qa.inventory
  WHERE tenant_ref=v_intent.tenant_ref AND store_ref=v_intent.store_ref
  AND sku=v_line.sku FOR UPDATE;
  IF NOT FOUND OR v_inventory.active IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'DENY_MISSING_STORE_SKU';END IF;
  IF v_inventory.price_vnd<>v_line.expected_unit_vnd
  THEN RAISE EXCEPTION 'DENY_PRICE_CHANGED';END IF;
  IF v_inventory.on_hand-v_inventory.reserved<v_line.quantity
  THEN RAISE EXCEPTION 'DENY_INSUFFICIENT_AVAILABLE_STOCK';END IF;
  v_total:=v_total+v_inventory.price_vnd::numeric*v_line.quantity::numeric;
  IF v_total>9223372036854775807::numeric
  THEN RAISE EXCEPTION 'DENY_TOTAL_OVERFLOW';END IF;
  UPDATE tien404_v172c36_multiline_qa.inventory
  SET reserved=reserved+v_line.quantity
  WHERE tenant_ref=v_intent.tenant_ref AND store_ref=v_intent.store_ref
  AND sku=v_line.sku;
  v_count:=v_count+1;
  IF p_fault='after_first_reserve' AND v_count=1
  THEN RAISE EXCEPTION 'QA_FAULT_FIRST_RESERVE';END IF;
 END LOOP;
 IF v_total<>v_intent.expected_total_vnd::numeric
 THEN RAISE EXCEPTION 'DENY_TOTAL_MISMATCH';END IF;
 v_order_ref:='SYN36-'||v_intent.intent_ref;
 INSERT INTO tien404_v172c36_multiline_qa.orders(
 order_ref,tenant_ref,store_ref,actor_ref,channel,provider_event_ref,
 intent_ref,status,total_vnd,reservation_expires_at)
 VALUES(v_order_ref,v_intent.tenant_ref,v_intent.store_ref,v_intent.actor_ref,
 v_intent.channel,v_intent.provider_event_ref,v_intent.intent_ref,
 'reserved',v_total::bigint,clock_timestamp()+interval '30 minutes');
 IF p_fault='after_header'
 THEN RAISE EXCEPTION 'QA_FAULT_AFTER_HEADER';END IF;
 v_count:=0;
 FOR v_line IN SELECT sku,quantity,expected_unit_vnd
 FROM tien404_v172c36_multiline_qa.intent_lines
 WHERE intent_ref=v_intent.intent_ref ORDER BY sku LOOP
  INSERT INTO tien404_v172c36_multiline_qa.order_items(
  order_ref,tenant_ref,store_ref,sku,quantity,unit_price_vnd,total_vnd)
  VALUES(v_order_ref,v_intent.tenant_ref,v_intent.store_ref,
  v_line.sku,v_line.quantity,v_line.expected_unit_vnd,
  (v_line.expected_unit_vnd::numeric*v_line.quantity)::bigint);
  v_count:=v_count+1;
  IF p_fault='after_first_item' AND v_count=1
  THEN RAISE EXCEPTION 'QA_FAULT_AFTER_FIRST_ITEM';END IF;
 END LOOP;
 RETURN 'RESERVED_SYNTHETIC_CI_ONLY';
END
$fn$;

CREATE FUNCTION tien404_v172c36_multiline_qa.transition_synthetic_order(
 p_action_ref text,p_fault text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog
AS $fn$
DECLARE
 v_action tien404_v172c36_multiline_qa.private_transitions%ROWTYPE;
 v_order tien404_v172c36_multiline_qa.orders%ROWTYPE;
 v_receipt tien404_v172c36_multiline_qa.transition_receipts%ROWTYPE;
 v_item record;v_stock tien404_v172c36_multiline_qa.inventory%ROWTYPE;
 v_count integer:=0;v_new_status text;
BEGIN
 IF p_action_ref IS NULL OR length(p_action_ref)<3 OR length(p_action_ref)>160
 OR (p_fault IS NOT NULL AND p_fault NOT IN ('after_first_stock','after_status'))
 THEN RAISE EXCEPTION 'DENY_INVALID_ACTION';END IF;
 SELECT * INTO v_action FROM tien404_v172c36_multiline_qa.private_transitions
 WHERE action_ref=p_action_ref FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DENY_UNKNOWN_ACTION';END IF;
 IF v_action.authorized IS DISTINCT FROM true
 OR v_action.provider_verified IS DISTINCT FROM true
 OR v_action.session_current IS DISTINCT FROM true
 OR v_action.challenge_consumed IS DISTINCT FROM true
 OR v_action.valid_until<=clock_timestamp()
 THEN RAISE EXCEPTION 'DENY_ACTION_AUTH';END IF;
 IF NOT EXISTS(SELECT 1 FROM tien404_v172c36_multiline_qa.stores s
 JOIN tien404_v172c36_multiline_qa.actors a
 ON a.tenant_ref=s.tenant_ref AND a.store_ref=s.store_ref
 WHERE s.tenant_ref=v_action.tenant_ref AND s.store_ref=v_action.store_ref
 AND s.active AND a.actor_ref=v_action.actor_ref AND a.active AND a.verified)
 THEN RAISE EXCEPTION 'DENY_ACTION_STORE_AUTHORITY';END IF;
 SELECT * INTO v_order FROM tien404_v172c36_multiline_qa.orders
 WHERE order_ref=v_action.order_ref FOR UPDATE;
 IF NOT FOUND OR v_order.tenant_ref<>v_action.tenant_ref
 OR v_order.store_ref<>v_action.store_ref OR v_order.actor_ref<>v_action.actor_ref
 THEN RAISE EXCEPTION 'DENY_ORDER_SCOPE';END IF;
 SELECT * INTO v_receipt FROM tien404_v172c36_multiline_qa.transition_receipts
 WHERE action_ref=p_action_ref;
 IF FOUND THEN
 IF v_receipt.order_ref=v_order.order_ref
 AND v_receipt.action_type=v_action.action_type
 THEN RETURN 'DUPLICATE_TRANSITION_NO_WRITE';END IF;
 RAISE EXCEPTION 'DENY_ACTION_REUSE';END IF;
 IF v_order.status<>'reserved'
 THEN RAISE EXCEPTION 'DENY_ORDER_NOT_RESERVED';END IF;
 IF v_action.action_type='confirm'
 AND v_order.reservation_expires_at<=clock_timestamp()
 THEN RAISE EXCEPTION 'DENY_RESERVATION_EXPIRED';END IF;
 IF v_action.action_type='expire'
 AND v_order.reservation_expires_at>clock_timestamp()
 THEN RAISE EXCEPTION 'DENY_NOT_EXPIRED';END IF;
 v_new_status:=CASE v_action.action_type
 WHEN 'confirm' THEN 'confirmed'
 WHEN 'cancel' THEN 'cancelled' ELSE 'expired' END;
 -- Same SKU ordering for release/confirm, regardless of original cart order.
 FOR v_item IN SELECT sku,quantity FROM tien404_v172c36_multiline_qa.order_items
 WHERE order_ref=v_order.order_ref ORDER BY sku LOOP
  SELECT * INTO v_stock FROM tien404_v172c36_multiline_qa.inventory
  WHERE tenant_ref=v_order.tenant_ref AND store_ref=v_order.store_ref
  AND sku=v_item.sku FOR UPDATE;
  IF NOT FOUND OR v_stock.reserved<v_item.quantity
  OR (v_action.action_type='confirm' AND v_stock.on_hand<v_item.quantity)
  THEN RAISE EXCEPTION 'DENY_INVENTORY_INVARIANT';END IF;
  UPDATE tien404_v172c36_multiline_qa.inventory
  SET reserved=reserved-v_item.quantity,
      on_hand=on_hand-CASE WHEN v_action.action_type='confirm'
                            THEN v_item.quantity ELSE 0 END
  WHERE tenant_ref=v_order.tenant_ref AND store_ref=v_order.store_ref
  AND sku=v_item.sku;
  v_count:=v_count+1;
  IF p_fault='after_first_stock' AND v_count=1
  THEN RAISE EXCEPTION 'QA_FAULT_TRANSITION_STOCK';END IF;
 END LOOP;
 IF v_count<2 THEN RAISE EXCEPTION 'DENY_INCOMPLETE_ORDER_ITEMS';END IF;
 UPDATE tien404_v172c36_multiline_qa.orders SET status=v_new_status
 WHERE order_ref=v_order.order_ref;
 IF p_fault='after_status'
 THEN RAISE EXCEPTION 'QA_FAULT_TRANSITION_STATUS';END IF;
 INSERT INTO tien404_v172c36_multiline_qa.transition_receipts(
 action_ref,order_ref,tenant_ref,store_ref,action_type)
 VALUES(p_action_ref,v_order.order_ref,v_order.tenant_ref,
 v_order.store_ref,v_action.action_type);
 RETURN 'TRANSITIONED_SYNTHETIC_CI_ONLY';
END
$fn$;

REVOKE ALL ON FUNCTION
 tien404_v172c36_multiline_qa.reserve_synthetic_multiline(text,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION
 tien404_v172c36_multiline_qa.transition_synthetic_order(text,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA tien404_v172c36_multiline_qa
 FROM PUBLIC,anon,authenticated;
INSERT INTO tien404_v172c36_multiline_qa.stores VALUES
 ('tenant-1','store-A',true),('tenant-1','store-B',true),
 ('tenant-2','store-C',true);
INSERT INTO tien404_v172c36_multiline_qa.actors VALUES
 ('tenant-1','store-A','actor-A',true,true),
 ('tenant-1','store-B','actor-B',true,true),
 ('tenant-2','store-C','actor-C',true,true);
INSERT INTO tien404_v172c36_multiline_qa.installations VALUES
 ('inst-A','tenant-1','store-A','messenger',true,true),
 ('inst-B','tenant-1','store-B','zalo',true,true),
 ('inst-C','tenant-2','store-C','messenger',true,true);
INSERT INTO tien404_v172c36_multiline_qa.inventory
 (tenant_ref,store_ref,sku,price_vnd,on_hand,reserved,active) VALUES
 ('tenant-1','store-A','SKU-A',159000,6,0,true),
 ('tenant-1','store-A','SKU-B',99000,7,0,true),
 ('tenant-1','store-A','SKU-RACE',1000,1,0,true),
 ('tenant-1','store-B','SKU-A',259000,5,0,true),
 ('tenant-1','store-B','SKU-B',49000,5,0,true),
 ('tenant-2','store-C','SKU-A',359000,2,0,true),
 ('tenant-2','store-C','SKU-B',69000,2,0,true);
