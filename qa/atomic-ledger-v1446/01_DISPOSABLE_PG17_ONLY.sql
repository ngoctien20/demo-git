-- TIEN404 AI V14.4.6 — ISOLATED POSTGRESQL 17 QA ONLY
-- NEVER run in Supabase, n8n, production, a restored backup, or any DB
-- other than the exact disposable GitHub CI database below.
-- DESIGN DECISION FOR FIXTURE ONLY (NOT COMMERCIAL POLICY):
--   REQUEST -> no reserve; MERCHANT ACCEPT -> reserve; FULFIL -> deduct;
--   CANCEL before fulfil -> release; REFUND/RETURN -> BLOCKED.
-- Every transaction function also rechecks the isolated database guard.
DO $guard$
BEGIN
  IF current_database() <> 'tien404_v1446_ci'
    OR current_user <> 'postgres'
    OR current_setting('tien404.v1446_ephemeral',true) <> 'YES'
    OR current_setting('server_version_num')::integer < 170000
    OR current_setting('server_version_num')::integer >= 180000
  THEN RAISE EXCEPTION 'V1446_HARD_STOP_NOT_ISOLATED_POSTGRES17';
  END IF;
END $guard$;

CREATE SCHEMA qa_v1446;
REVOKE ALL ON SCHEMA qa_v1446 FROM PUBLIC;

CREATE TABLE qa_v1446.products (
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  sku text NOT NULL CHECK (sku ~ '^[A-Z0-9][A-Z0-9_-]{1,39}$'),
  price_vnd bigint NOT NULL CHECK(price_vnd BETWEEN 0 AND 1000000000000),
  on_hand integer NOT NULL CHECK (on_hand >= 0),
  reserved integer NOT NULL DEFAULT 0 CHECK(reserved >= 0 AND reserved <= on_hand),
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (tenant_id,store_id,sku)
);
CREATE TABLE qa_v1446.memberships (
  actor_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('buyer','owner')),
  active boolean NOT NULL,
  PRIMARY KEY(actor_id,tenant_id,store_id)
);
-- Membership belongs to canonical Store, not individual product; there
-- is no Stores table in this disposable fixture. Hosted FK is blocked.
CREATE TABLE qa_v1446.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  request_id text NOT NULL CHECK (request_id ~ '^[A-Za-z0-9_-]{12,80}$'),
  sku text NOT NULL,
  quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 10000),
  unit_price_vnd bigint NOT NULL CHECK(unit_price_vnd BETWEEN 0 AND 1000000000000),
  total_vnd bigint NOT NULL CHECK(total_vnd BETWEEN 0 AND 1000000000000000),
  status text NOT NULL DEFAULT 'requested'
      CHECK(status IN ('requested','confirmed','fulfilled','cancelled')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(tenant_id,store_id,request_id),
  UNIQUE(id,tenant_id,store_id),
  FOREIGN KEY(tenant_id,store_id,sku)
    REFERENCES qa_v1446.products(tenant_id,store_id,sku) ON DELETE RESTRICT,
  CHECK (total_vnd = unit_price_vnd * quantity)
);
CREATE TABLE qa_v1446.inventory_ledger(
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  sku text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('RESERVE','RELEASE','FULFIL')),
  delta_on_hand integer NOT NULL,
  delta_reserved integer NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (order_id,tenant_id,store_id)
    REFERENCES qa_v1446.orders(id,tenant_id,store_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id,store_id,sku)
    REFERENCES qa_v1446.products(tenant_id,store_id,sku) ON DELETE RESTRICT,
  UNIQUE(order_id,kind),
  CHECK (
   (kind='RESERVE' AND delta_on_hand=0 AND delta_reserved>0)
   OR (kind='RELEASE' AND delta_on_hand=0 AND delta_reserved<0)
   OR (kind='FULFIL' AND delta_on_hand<0 AND delta_reserved<0
       AND delta_on_hand=delta_reserved)
  )
);
CREATE FUNCTION qa_v1446.ledger_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 RAISE EXCEPTION 'IMMUTABLE_LEDGER_NO_UPDATE_OR_DELETE';
END $$;
CREATE TRIGGER ledger_immutable BEFORE UPDATE OR DELETE ON qa_v1446.inventory_ledger
FOR EACH ROW EXECUTE FUNCTION qa_v1446.ledger_immutable();

CREATE FUNCTION qa_v1446.assert_ci() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF current_database()<>'tien404_v1446_ci'
 OR current_user<>'postgres'
 OR current_setting('tien404.v1446_ephemeral',true)<>'YES'
 THEN RAISE EXCEPTION 'V1446_HARD_STOP_NOT_ISOLATED_POSTGRES17';
 END IF;
END $$;

CREATE FUNCTION qa_v1446.actor() RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v text;
BEGIN
 PERFORM qa_v1446.assert_ci();
 v:=current_setting('tien404.v1446_actor',true);
 IF v IS NULL OR v='' OR v !~* '^[0-9a-f-]{36}$'
 THEN RAISE EXCEPTION 'SIMULATED_ACTOR_REQUIRED';
 END IF;
 RETURN v::uuid;
END $$;

CREATE FUNCTION qa_v1446.require_role(t uuid,s uuid,op text) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a uuid;
BEGIN
 a:=qa_v1446.actor();
 IF NOT EXISTS(
   SELECT 1 FROM qa_v1446.memberships m
   WHERE m.actor_id=a AND m.tenant_id=t AND m.store_id=s
     AND m.active=true AND
       (CASE WHEN op='request' THEN m.role IN ('buyer','owner')
        WHEN op='merchant' THEN m.role='owner'
        ELSE false END)
 ) THEN RAISE EXCEPTION 'STORE_MEMBERSHIP_DENIED'; END IF;
 RETURN a;
END $$;

CREATE FUNCTION qa_v1446.request_order(
 t uuid,s uuid,req text,item_sku text,qty integer,expected_total bigint
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 a uuid; p qa_v1446.products%ROWTYPE; v qa_v1446.orders%ROWTYPE;
 calc bigint; was_inserted boolean;
BEGIN
 PERFORM qa_v1446.assert_ci();
 a:=qa_v1446.require_role(t,s,'request');
 IF req IS NULL OR req !~ '^[A-Za-z0-9_-]{12,80}$'
    OR item_sku IS NULL OR item_sku !~ '^[A-Z0-9][A-Z0-9_-]{1,39}$'
    OR qty IS NULL OR qty<1 OR qty>10000 OR expected_total IS NULL
    OR expected_total<0 OR expected_total>1000000000000000
 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;

 -- Lock order idempotency by tenant/store/key. A second process with the
 -- same key waits until the first transaction commits and cannot duplicate.
 PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(t::text||':'||s::text||':'||req, 1446));
 SELECT * INTO v FROM qa_v1446.orders
   WHERE tenant_id=t AND store_id=s AND request_id=req FOR UPDATE;
 IF FOUND THEN
   IF v.actor_id<>a OR v.sku<>item_sku OR v.quantity<>qty
      OR v.total_vnd<>expected_total
   THEN RAISE EXCEPTION 'IDEMPOTENCY_PAYLOAD_CONFLICT'; END IF;
   RETURN pg_catalog.jsonb_build_object('order_id',v.id,'status',v.status,
     'replayed',true,'total_vnd',v.total_vnd);
 END IF;

 SELECT * INTO p FROM qa_v1446.products
    WHERE tenant_id=t AND store_id=s AND sku=item_sku AND active
    FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND_IN_STORE'; END IF;
 IF p.on_hand - p.reserved < qty
 THEN RAISE EXCEPTION 'REQUEST_PREVIEW_STOCK_INSUFFICIENT'; END IF;
 calc := p.price_vnd * qty;
 IF calc > 1000000000000000 OR calc <> expected_total
 THEN RAISE EXCEPTION 'PRICE_TOTAL_MISMATCH'; END IF;
 INSERT INTO qa_v1446.orders(tenant_id,store_id,actor_id,request_id,
      sku,quantity,unit_price_vnd,total_vnd)
 VALUES(t,s,a,req,item_sku,qty,p.price_vnd,calc) RETURNING * INTO v;
 RETURN pg_catalog.jsonb_build_object('order_id',v.id,'status',v.status,
   'replayed',false,'total_vnd',v.total_vnd);
END $$;

CREATE FUNCTION qa_v1446.accept_order(t uuid,s uuid,oid uuid) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v qa_v1446.orders%ROWTYPE; n integer;
BEGIN
 PERFORM qa_v1446.require_role(t,s,'merchant');
 SELECT * INTO v FROM qa_v1446.orders WHERE id=oid AND tenant_id=t
   AND store_id=s FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND_IN_STORE'; END IF;
 IF v.status='confirmed' THEN RETURN 'confirmed_replay'; END IF;
 IF v.status<>'requested' THEN RAISE EXCEPTION 'ORDER_NOT_ACCEPTABLE'; END IF;
 -- A single atomic conditional UPDATE serializes concurrent acceptance of
 -- different orders for the same store+SKU (READ COMMITTED).
 UPDATE qa_v1446.products
 SET reserved=reserved+v.quantity
 WHERE tenant_id=t AND store_id=s AND sku=v.sku AND active
   AND on_hand-reserved>=v.quantity;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'INSUFFICIENT_AVAILABLE_STOCK_AT_ACCEPT'; END IF;
 INSERT INTO qa_v1446.inventory_ledger(order_id,tenant_id,store_id,sku,
    kind,delta_on_hand,delta_reserved)
 VALUES(v.id,t,s,v.sku,'RESERVE',0,v.quantity);
 UPDATE qa_v1446.orders SET status='confirmed' WHERE id=oid;
 RETURN 'confirmed';
END $$;

CREATE FUNCTION qa_v1446.fulfil_order(t uuid,s uuid,oid uuid) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v qa_v1446.orders%ROWTYPE; n integer;
BEGIN
 PERFORM qa_v1446.require_role(t,s,'merchant');
 SELECT * INTO v FROM qa_v1446.orders WHERE id=oid AND tenant_id=t
 AND store_id=s FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND_IN_STORE'; END IF;
 IF v.status='fulfilled' THEN RETURN 'fulfilled_replay'; END IF;
 IF v.status<>'confirmed' THEN RAISE EXCEPTION 'ORDER_NOT_FULFILLABLE'; END IF;
 UPDATE qa_v1446.products SET on_hand=on_hand-v.quantity,
   reserved=reserved-v.quantity
 WHERE tenant_id=t AND store_id=s AND sku=v.sku
 AND reserved>=v.quantity AND on_hand>=v.quantity;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'RESERVATION_INVARIANT_BROKEN'; END IF;
 INSERT INTO qa_v1446.inventory_ledger(order_id,tenant_id,store_id,sku,
 kind,delta_on_hand,delta_reserved)
 VALUES(v.id,t,s,v.sku,'FULFIL',-v.quantity,-v.quantity);
 UPDATE qa_v1446.orders SET status='fulfilled' WHERE id=oid;
 RETURN 'fulfilled';
END $$;

CREATE FUNCTION qa_v1446.cancel_order(t uuid,s uuid,oid uuid) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v qa_v1446.orders%ROWTYPE;a uuid; role text;n integer;
BEGIN
 PERFORM qa_v1446.assert_ci();
 a:=qa_v1446.actor();
 SELECT m.role INTO role FROM qa_v1446.memberships m
 WHERE m.actor_id=a AND m.tenant_id=t AND m.store_id=s AND m.active;
 IF NOT FOUND THEN RAISE EXCEPTION 'STORE_MEMBERSHIP_DENIED'; END IF;
 SELECT * INTO v FROM qa_v1446.orders WHERE id=oid AND tenant_id=t
 AND store_id=s FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND_IN_STORE'; END IF;
 IF role <> 'owner' AND NOT (role='buyer' AND v.actor_id=a AND v.status='requested')
 THEN RAISE EXCEPTION 'CANCEL_ROLE_OR_STATUS_DENIED'; END IF;
 IF v.status='cancelled' THEN RETURN 'cancelled_replay'; END IF;
 IF v.status='fulfilled' THEN RAISE EXCEPTION 'FULFILLED_REFUND_REQUIRES_SEPARATE_POLICY'; END IF;
 IF v.status='confirmed' THEN
   UPDATE qa_v1446.products SET reserved=reserved-v.quantity
   WHERE tenant_id=t AND store_id=s AND sku=v.sku AND reserved>=v.quantity;
   GET DIAGNOSTICS n=ROW_COUNT;
   IF n<>1 THEN RAISE EXCEPTION 'RESERVATION_INVARIANT_BROKEN'; END IF;
   INSERT INTO qa_v1446.inventory_ledger(order_id,tenant_id,store_id,sku,
    kind,delta_on_hand,delta_reserved)
   VALUES(v.id,t,s,v.sku,'RELEASE',0,-v.quantity);
 END IF;
 UPDATE qa_v1446.orders SET status='cancelled' WHERE id=oid;
 RETURN 'cancelled';
END $$;

-- All fixture actors and shop identities are invented and isolated.
INSERT INTO qa_v1446.products(tenant_id,store_id,sku,price_vnd,on_hand)
VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SKU-SAME',159000,3),
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','SKU-SAME',209000,7),
 ('22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc','SKU-SAME',259000,2);
INSERT INTO qa_v1446.memberships(actor_id,tenant_id,store_id,role,active) VALUES
 ('11111111-aaaa-4aaa-8aaa-111111111111','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','buyer',true),
 ('11111111-bbbb-4bbb-8bbb-111111111111','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner',true),
 ('22222222-aaaa-4aaa-8aaa-222222222222','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','buyer',true),
 ('22222222-bbbb-4bbb-8bbb-222222222222','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','owner',true),
 ('33333333-aaaa-4aaa-8aaa-333333333333','22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc','buyer',true),
 ('33333333-bbbb-4bbb-8bbb-333333333333','22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc','owner',true);
