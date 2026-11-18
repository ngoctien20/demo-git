-- V17.2C.35 ATOMIC ORDER COMMIT CANDIDATE — CI SYNTHETIC ONLY.
-- DO NOT EXECUTE ON SUPABASE, DO NOT COPY INTO production migrations.
-- Must follow V17.2C.32 ephemeral fixture on PostgreSQL 17 localhost.
DO $$
BEGIN
 IF current_database() <> 'postgres'
    OR inet_server_addr() <> inet '127.0.0.1'
    OR to_regclass('tien404_v172c32_preview.orders') IS NULL
 THEN RAISE EXCEPTION 'DENY_NON_EPHEMERAL_V172C35';
 END IF;
END $$;
CREATE SCHEMA tien404_v172c35_atomic_qa;
REVOKE ALL ON SCHEMA tien404_v172c35_atomic_qa FROM PUBLIC,anon,authenticated;

CREATE TABLE tien404_v172c35_atomic_qa.stores(
 tenant_ref text NOT NULL,store_ref text NOT NULL,active boolean NOT NULL,
 PRIMARY KEY(tenant_ref,store_ref)
);
CREATE TABLE tien404_v172c35_atomic_qa.store_owners(
 tenant_ref text NOT NULL,store_ref text NOT NULL,actor_ref text NOT NULL,
 active boolean NOT NULL,owner_verified boolean NOT NULL,
 PRIMARY KEY(tenant_ref,store_ref,actor_ref),
 FOREIGN KEY(tenant_ref,store_ref) REFERENCES tien404_v172c35_atomic_qa.stores
);
CREATE TABLE tien404_v172c35_atomic_qa.installations(
 installation_ref text PRIMARY KEY,
 tenant_ref text NOT NULL,store_ref text NOT NULL,
 channel text NOT NULL CHECK(channel IN ('messenger','zalo')),
 provider_account_ref text NOT NULL,
 active boolean NOT NULL,verified boolean NOT NULL,
 UNIQUE(installation_ref,tenant_ref,store_ref),
 FOREIGN KEY(tenant_ref,store_ref) REFERENCES tien404_v172c35_atomic_qa.stores
);
CREATE TABLE tien404_v172c35_atomic_qa.inventory(
 tenant_ref text NOT NULL,store_ref text NOT NULL,sku text NOT NULL,
 price_vnd bigint NOT NULL CHECK(price_vnd>=0),
 stock_on_hand integer NOT NULL CHECK(stock_on_hand>=0),
 active boolean NOT NULL,
 PRIMARY KEY(tenant_ref,store_ref,sku),
 FOREIGN KEY(tenant_ref,store_ref) REFERENCES tien404_v172c35_atomic_qa.stores
);
-- In real architecture this private registry must be created from VERIFIED
-- provider signature, active actor session, confirmed price and consent.
-- This CI fixture only models these trusted observations as synthetic rows.
CREATE TABLE tien404_v172c35_atomic_qa.private_intents(
 intent_ref text PRIMARY KEY,
 tenant_ref text NOT NULL,store_ref text NOT NULL,actor_ref text NOT NULL,
 installation_ref text NOT NULL,channel text NOT NULL,
 provider_event_ref text NOT NULL,sku text NOT NULL,
 quantity integer NOT NULL,expected_total_vnd bigint NOT NULL,
 source_lane text NOT NULL,origin_workflow_id text NOT NULL,
 session_current boolean NOT NULL,provider_verified boolean NOT NULL,
 confirmation_verified boolean NOT NULL,challenge_consumed boolean NOT NULL,
 valid_until timestamptz NOT NULL,
 FOREIGN KEY(installation_ref,tenant_ref,store_ref)
 REFERENCES tien404_v172c35_atomic_qa.installations(
 installation_ref,tenant_ref,store_ref)
);
CREATE TABLE tien404_v172c35_atomic_qa.orders(
 order_ref text PRIMARY KEY,
 tenant_ref text NOT NULL,store_ref text NOT NULL,
 actor_ref text NOT NULL,channel text NOT NULL,
 provider_event_ref text NOT NULL,
 intent_ref text NOT NULL UNIQUE,
 sku text NOT NULL,quantity integer NOT NULL CHECK(quantity>0),
 unit_price_vnd bigint NOT NULL CHECK(unit_price_vnd>=0),
 total_vnd bigint NOT NULL CHECK(total_vnd>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_ref,store_ref,channel,provider_event_ref),
 UNIQUE(order_ref,tenant_ref,store_ref),
 FOREIGN KEY(tenant_ref,store_ref) REFERENCES tien404_v172c35_atomic_qa.stores
);
CREATE TABLE tien404_v172c35_atomic_qa.order_items(
 order_ref text NOT NULL,tenant_ref text NOT NULL,store_ref text NOT NULL,
 sku text NOT NULL,quantity integer NOT NULL CHECK(quantity>0),
 unit_price_vnd bigint NOT NULL CHECK(unit_price_vnd>=0),
 total_vnd bigint NOT NULL CHECK(total_vnd>=0),
 PRIMARY KEY(order_ref,sku),
 FOREIGN KEY(order_ref,tenant_ref,store_ref)
 REFERENCES tien404_v172c35_atomic_qa.orders(order_ref,tenant_ref,store_ref),
 FOREIGN KEY(tenant_ref,store_ref,sku)
 REFERENCES tien404_v172c35_atomic_qa.inventory(tenant_ref,store_ref,sku)
);
-- Deliberate: only privileged PostgreSQL CI principal can execute. The
-- function is SECURITY INVOKER, with no GRANT to public, anon or auth roles.
CREATE FUNCTION tien404_v172c35_atomic_qa.commit_synthetic_order(
 p_intent_ref text,p_inject_failure text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER
 SET search_path=pg_catalog
AS $function$
DECLARE
 v_intent tien404_v172c35_atomic_qa.private_intents%ROWTYPE;
 v_inventory tien404_v172c35_atomic_qa.inventory%ROWTYPE;
 v_existing tien404_v172c35_atomic_qa.orders%ROWTYPE;
 v_total numeric;
 v_order_ref text;
BEGIN
 IF p_intent_ref IS NULL OR length(p_intent_ref)<3 OR length(p_intent_ref)>160
    OR (p_inject_failure IS NOT NULL AND p_inject_failure NOT IN
       ('after_stock','after_order'))
 THEN RAISE EXCEPTION 'DENY_INVALID_PRIVATE_INTENT'; END IF;

 SELECT * INTO v_intent
 FROM tien404_v172c35_atomic_qa.private_intents
 WHERE intent_ref=p_intent_ref;
 IF NOT FOUND THEN RAISE EXCEPTION 'DENY_NO_PRIVATE_INTENT'; END IF;
 IF v_intent.source_lane<>'commerce_v2_candidate'
    OR v_intent.origin_workflow_id<>'commerce_v2_candidate_no_send'
    OR v_intent.session_current IS DISTINCT FROM true
    OR v_intent.provider_verified IS DISTINCT FROM true
    OR v_intent.confirmation_verified IS DISTINCT FROM true
    OR v_intent.challenge_consumed IS DISTINCT FROM true
    OR v_intent.valid_until<=clock_timestamp()
    OR v_intent.quantity<1 OR v_intent.quantity>999
    OR v_intent.expected_total_vnd<0
 THEN RAISE EXCEPTION 'DENY_UNTRUSTED_PRIVATE_INTENT'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM tien404_v172c35_atomic_qa.stores s
   JOIN tien404_v172c35_atomic_qa.store_owners o
     ON o.tenant_ref=s.tenant_ref AND o.store_ref=s.store_ref
   JOIN tien404_v172c35_atomic_qa.installations inst
     ON inst.tenant_ref=s.tenant_ref AND inst.store_ref=s.store_ref
   WHERE s.tenant_ref=v_intent.tenant_ref
     AND s.store_ref=v_intent.store_ref AND s.active
     AND o.actor_ref=v_intent.actor_ref AND o.active AND o.owner_verified
     AND inst.installation_ref=v_intent.installation_ref
     AND inst.channel=v_intent.channel AND inst.active AND inst.verified
 ) THEN RAISE EXCEPTION 'DENY_STORE_AUTHORITY'; END IF;

 -- Serialize by tenant+Store+channel+provider-event, then rely on a
 -- UNIQUE constraint as the final idempotency enforcement. Advisory hash
 -- collisions only cause extra waits, not false accepts.
 PERFORM pg_advisory_xact_lock(hashtextextended(
    v_intent.tenant_ref||chr(31)||v_intent.store_ref||chr(31)||
    v_intent.channel||chr(31)||v_intent.provider_event_ref,0));
 SELECT * INTO v_existing
 FROM tien404_v172c35_atomic_qa.orders
 WHERE tenant_ref=v_intent.tenant_ref AND store_ref=v_intent.store_ref
   AND channel=v_intent.channel
   AND provider_event_ref=v_intent.provider_event_ref;
 IF FOUND THEN
   IF v_existing.intent_ref=v_intent.intent_ref
   THEN RETURN 'DUPLICATE_SAME_INTENT_NO_WRITE';
   END IF;
   RAISE EXCEPTION 'DENY_EVENT_REUSED_FOR_ANOTHER_INTENT';
 END IF;

 -- This is the critical concurrency lock for distinct events racing for
 -- the same product in the same Store. Stock is scoped by tenant+Store+SKU.
 SELECT * INTO v_inventory
 FROM tien404_v172c35_atomic_qa.inventory
 WHERE tenant_ref=v_intent.tenant_ref AND store_ref=v_intent.store_ref
   AND sku=v_intent.sku FOR UPDATE;
 IF NOT FOUND OR v_inventory.active IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'DENY_PRODUCT_NOT_IN_STORE'; END IF;
 v_total:=v_inventory.price_vnd::numeric*v_intent.quantity::numeric;
 IF v_total>9223372036854775807::numeric
    OR v_total<>v_intent.expected_total_vnd::numeric
 THEN RAISE EXCEPTION 'DENY_PRICE_CHANGED_OR_OVERFLOW'; END IF;
 IF v_inventory.stock_on_hand<v_intent.quantity
 THEN RAISE EXCEPTION 'DENY_STOCK_INSUFFICIENT'; END IF;

 UPDATE tien404_v172c35_atomic_qa.inventory
 SET stock_on_hand=stock_on_hand-v_intent.quantity
 WHERE tenant_ref=v_intent.tenant_ref AND store_ref=v_intent.store_ref
   AND sku=v_intent.sku;
 IF p_inject_failure='after_stock'
 THEN RAISE EXCEPTION 'QA_INJECTED_FAILURE_AFTER_STOCK'; END IF;
 v_order_ref='SYN-'||v_intent.intent_ref;
 INSERT INTO tien404_v172c35_atomic_qa.orders(
 order_ref,tenant_ref,store_ref,actor_ref,channel,provider_event_ref,
 intent_ref,sku,quantity,unit_price_vnd,total_vnd
 ) VALUES(v_order_ref,v_intent.tenant_ref,v_intent.store_ref,
 v_intent.actor_ref,v_intent.channel,v_intent.provider_event_ref,
 v_intent.intent_ref,v_intent.sku,v_intent.quantity,
 v_inventory.price_vnd,v_intent.expected_total_vnd);
 IF p_inject_failure='after_order'
 THEN RAISE EXCEPTION 'QA_INJECTED_FAILURE_AFTER_ORDER'; END IF;
 INSERT INTO tien404_v172c35_atomic_qa.order_items(
 order_ref,tenant_ref,store_ref,sku,quantity,unit_price_vnd,total_vnd)
 VALUES(v_order_ref,v_intent.tenant_ref,v_intent.store_ref,
 v_intent.sku,v_intent.quantity,v_inventory.price_vnd,
 v_intent.expected_total_vnd);
 RETURN 'COMMITTED_SYNTHETIC_CI_ONLY';
END;
$function$;

REVOKE ALL ON FUNCTION
 tien404_v172c35_atomic_qa.commit_synthetic_order(text,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA tien404_v172c35_atomic_qa
 FROM PUBLIC,anon,authenticated;

-- All fixture IDs are synthetic and intentionally free of PII.
INSERT INTO tien404_v172c35_atomic_qa.stores VALUES
 ('tenant-1','store-A',true),('tenant-1','store-B',true),
 ('tenant-2','store-C',true);
INSERT INTO tien404_v172c35_atomic_qa.store_owners VALUES
 ('tenant-1','store-A','actor-A',true,true),
 ('tenant-1','store-B','actor-B',true,true),
 ('tenant-2','store-C','actor-C',true,true);
INSERT INTO tien404_v172c35_atomic_qa.installations VALUES
 ('install-A','tenant-1','store-A','messenger','page-A',true,true),
 ('install-B','tenant-1','store-B','zalo','bot-B',true,true),
 ('install-C','tenant-2','store-C','messenger','page-C',true,true);
INSERT INTO tien404_v172c35_atomic_qa.inventory VALUES
 ('tenant-1','store-A','SYN-SKU',159000,3,true),
 ('tenant-1','store-B','SYN-SKU',259000,2,true),
 ('tenant-2','store-C','SYN-SKU',359000,1,true);
INSERT INTO tien404_v172c35_atomic_qa.private_intents(
 intent_ref,tenant_ref,store_ref,actor_ref,installation_ref,channel,
 provider_event_ref,sku,quantity,expected_total_vnd,source_lane,
 origin_workflow_id,session_current,provider_verified,
 confirmation_verified,challenge_consumed,valid_until)
VALUES
 ('ok-A','tenant-1','store-A','actor-A','install-A','messenger',
  'evt-shared','SYN-SKU',2,318000,'commerce_v2_candidate',
  'commerce_v2_candidate_no_send',true,true,true,true,now()+interval '1 hour'),
 ('ok-B','tenant-1','store-B','actor-B','install-B','zalo',
  'evt-shared','SYN-SKU',1,259000,'commerce_v2_candidate',
  'commerce_v2_candidate_no_send',true,true,true,true,now()+interval '1 hour'),
 ('fault-stock-A','tenant-1','store-A','actor-A','install-A','messenger',
  'evt-fault-stock','SYN-SKU',1,159000,'commerce_v2_candidate',
  'commerce_v2_candidate_no_send',true,true,true,true,now()+interval '1 hour'),
 ('fault-order-A','tenant-1','store-A','actor-A','install-A','messenger',
  'evt-fault-order','SYN-SKU',1,159000,'commerce_v2_candidate',
  'commerce_v2_candidate_no_send',true,true,true,true,now()+interval '1 hour'),
 ('race-A1','tenant-1','store-A','actor-A','install-A','messenger',
  'evt-race-1','SYN-SKU',1,159000,'commerce_v2_candidate',
  'commerce_v2_candidate_no_send',true,true,true,true,now()+interval '1 hour'),
 ('race-A2','tenant-1','store-A','actor-A','install-A','messenger',
  'evt-race-2','SYN-SKU',1,159000,'commerce_v2_candidate',
  'commerce_v2_candidate_no_send',true,true,true,true,now()+interval '1 hour'),
 ('replay-other-intent-A','tenant-1','store-A','actor-A','install-A','messenger',
  'evt-shared','SYN-SKU',1,159000,'commerce_v2_candidate',
  'commerce_v2_candidate_no_send',true,true,true,true,now()+interval '1 hour'),
 ('wrong-price-A','tenant-1','store-A','actor-A','install-A','messenger',
  'evt-price','SYN-SKU',1,159001,'commerce_v2_candidate',
  'commerce_v2_candidate_no_send',true,true,true,true,now()+interval '1 hour'),
 ('oversell-A','tenant-1','store-A','actor-A','install-A','messenger',
  'evt-oversell','SYN-SKU',4,636000,'commerce_v2_candidate',
  'commerce_v2_candidate_no_send',true,true,true,true,now()+interval '1 hour'),
 ('legacy-A','tenant-1','store-A','actor-A','install-A','messenger',
  'evt-legacy','SYN-SKU',1,159000,'AI_SALES_DEMO',
  'KrSn4DNR9ALX5ng4',true,true,true,true,now()+interval '1 hour'),
 ('bad-confirm-A','tenant-1','store-A','actor-A','install-A','messenger',
  'evt-bad-confirm','SYN-SKU',1,159000,'commerce_v2_candidate',
  'commerce_v2_candidate_no_send',true,true,false,true,now()+interval '1 hour'),
 ('bad-challenge-A','tenant-1','store-A','actor-A','install-A','messenger',
  'evt-bad-challenge','SYN-SKU',1,159000,'commerce_v2_candidate',
  'commerce_v2_candidate_no_send',true,true,true,false,now()+interval '1 hour'),
 ('stale-session-A','tenant-1','store-A','actor-A','install-A','messenger',
  'evt-stale-session','SYN-SKU',1,159000,'commerce_v2_candidate',
  'commerce_v2_candidate_no_send',false,true,true,true,now()+interval '1 hour'),
 ('bad-actor-A','tenant-1','store-A','actor-B','install-A','messenger',
  'evt-bad-actor','SYN-SKU',1,159000,'commerce_v2_candidate',
  'commerce_v2_candidate_no_send',true,true,true,true,now()+interval '1 hour'),
 ('bad-sku-A','tenant-1','store-A','actor-A','install-A','messenger',
  'evt-bad-sku','SKU-ONLY-AT-B',1,159000,'commerce_v2_candidate',
  'commerce_v2_candidate_no_send',true,true,true,true,now()+interval '1 hour'),
 ('expired-A','tenant-1','store-A','actor-A','install-A','messenger',
  'evt-expired','SYN-SKU',1,159000,'commerce_v2_candidate',
  'commerce_v2_candidate_no_send',true,true,true,true,now()-interval '1 hour');
