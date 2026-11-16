-- TIEN404 V15 cross-channel CONTINUITY — DISPOSABLE POSTGRES17 ONLY.
-- Run AFTER qa/v15-sales-lite-p0/pg17-store-rls-isolation.sql in a throwaway CI DB.
-- Synthetic private backend only; NO hosted JWT, real provider or production writes.
\set ON_ERROR_STOP on
CREATE SCHEMA qa_cross;
REVOKE ALL ON SCHEMA qa_cross FROM PUBLIC;

-- Synthetic canonical customer is opaque and scoped by Tenant + Store.
-- There is deliberately no customer phone, address or provider token here.
CREATE TABLE qa_cross.order_customers(
  tenant_id uuid NOT NULL, store_id uuid NOT NULL, order_id uuid NOT NULL,
  order_code text NOT NULL, customer_key text NOT NULL, status text NOT NULL,
  PRIMARY KEY(tenant_id,store_id,order_code),
  FOREIGN KEY(tenant_id,store_id,order_id)
    REFERENCES qa_p0.orders(tenant_id,store_id,id)
);
CREATE TABLE qa_cross.channel_links(
  tenant_id uuid NOT NULL,store_id uuid NOT NULL,channel text NOT NULL,
  provider_subject_hash text NOT NULL,customer_key text NOT NULL,
  verified boolean NOT NULL,consented boolean NOT NULL,revoked boolean NOT NULL DEFAULT false,
  PRIMARY KEY(tenant_id,store_id,channel,provider_subject_hash),
  FOREIGN KEY(tenant_id,store_id) REFERENCES qa_p0.stores(tenant_id,id)
);
CREATE TABLE qa_cross.consumed_events(
  tenant_id uuid NOT NULL,store_id uuid NOT NULL,event_digest text NOT NULL,
  order_id uuid NOT NULL,
  PRIMARY KEY(tenant_id,store_id,event_digest),
  FOREIGN KEY(tenant_id,store_id,order_id)
    REFERENCES qa_p0.orders(tenant_id,store_id,id)
);

ALTER TABLE qa_cross.order_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_cross.channel_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_cross.consumed_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_cross.order_customers FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_cross.channel_links FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_cross.consumed_events FORCE ROW LEVEL SECURITY;
-- No grants or policies to authenticated, anon or PUBLIC. Access private backend only.

INSERT INTO qa_cross.order_customers VALUES
 ('00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000009',
  'TEST-00000009','CUSTOMER_QA_A_OPAQUE','pending');
INSERT INTO qa_cross.channel_links VALUES
 ('00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'MESSENGER','SYNTHETIC_MESSENGER_SUBJECT_HASH_A',
  'CUSTOMER_QA_A_OPAQUE',true,true,false);
INSERT INTO qa_cross.consumed_events VALUES
 ('00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'SYNTHETIC_MESSENGER_EVENT_09',
  '40000000-0000-0000-0000-000000000009');
INSERT INTO qa_cross.consumed_events VALUES
 ('00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'SYNTHETIC_MESSENGER_EVENT_09',
  '40000000-0000-0000-0000-000000000009') ON CONFLICT DO NOTHING;

-- The backend must resolve tenant/store/channel/subject from verified ingress,
-- NEVER take these fields from arbitrary user messages. This procedure does
-- NOT establish that proof; it only tests authorized database join semantics.
CREATE FUNCTION qa_cross.synthetic_lookup(
 p_tenant uuid,p_store uuid,p_channel text,p_provider_hash text,p_code text
) RETURNS TABLE(order_code text, total_vnd bigint,order_status text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT oc.order_code,o.total_vnd,oc.status
 FROM qa_cross.order_customers oc
 JOIN qa_p0.orders o ON o.tenant_id=oc.tenant_id
  AND o.store_id=oc.store_id AND o.id=oc.order_id
 JOIN qa_cross.channel_links l ON l.tenant_id=oc.tenant_id
  AND l.store_id=oc.store_id AND l.customer_key=oc.customer_key
 WHERE oc.tenant_id=p_tenant AND oc.store_id=p_store
  AND oc.order_code=p_code AND l.channel=p_channel
  AND l.provider_subject_hash=p_provider_hash
  AND l.verified AND l.consented AND NOT l.revoked;
$$;
REVOKE ALL ON FUNCTION qa_cross.synthetic_lookup(uuid,uuid,text,text,text) FROM PUBLIC;

DO $tests$ DECLARE c integer; total bigint; BEGIN
 SELECT count(*),max(total_vnd) INTO c,total FROM qa_cross.synthetic_lookup(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'MESSENGER','SYNTHETIC_MESSENGER_SUBJECT_HASH_A','TEST-00000009');
 IF c<>1 OR total<>318000 THEN RAISE EXCEPTION 'SIGNED_QA_MESSENGER_ORDER_LOOKUP_FAILED'; END IF;
 SELECT count(*) INTO c FROM qa_cross.synthetic_lookup(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'ZALO_BOT','SYNTHETIC_ZALO_SUBJECT_HASH_A','TEST-00000009');
 IF c<>0 THEN RAISE EXCEPTION 'UNLINKED_ZALO_DATA_LEAK'; END IF;
END $tests$;

-- Only after synthetic verification AND consent: attach Zalo to same customer.
INSERT INTO qa_cross.channel_links VALUES
 ('00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'ZALO_BOT','SYNTHETIC_ZALO_SUBJECT_HASH_A',
  'CUSTOMER_QA_A_OPAQUE',true,true,false);
DO $tests$ DECLARE c integer; total bigint; BEGIN
 SELECT count(*),max(total_vnd) INTO c,total FROM qa_cross.synthetic_lookup(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'ZALO_BOT','SYNTHETIC_ZALO_SUBJECT_HASH_A','TEST-00000009');
 IF c<>1 OR total<>318000 THEN RAISE EXCEPTION 'LINKED_ZALO_SAME_ORDER_LOOKUP_FAILED'; END IF;
 SELECT count(*) INTO c FROM qa_cross.synthetic_lookup(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  'ZALO_BOT','SYNTHETIC_ZALO_SUBJECT_HASH_A','TEST-00000009');
 IF c<>0 THEN RAISE EXCEPTION 'SAME_TENANT_SHOP_B_CROSS_READ'; END IF;
 SELECT count(*) INTO c FROM qa_cross.synthetic_lookup(
  '00000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  'ZALO_BOT','SYNTHETIC_ZALO_SUBJECT_HASH_A','TEST-00000009');
 IF c<>0 THEN RAISE EXCEPTION 'CROSS_TENANT_SHOP_C_READ'; END IF;
 SELECT count(*) INTO c FROM qa_cross.synthetic_lookup(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'ZALO_BOT','SOMEONE_ELSE_SAME_NAME','TEST-00000009');
 IF c<>0 THEN RAISE EXCEPTION 'SAME_NAME_IDENTITY_TAKEOVER'; END IF;
 IF (SELECT count(*) FROM qa_cross.consumed_events
  WHERE event_digest='SYNTHETIC_MESSENGER_EVENT_09')<>1
 THEN RAISE EXCEPTION 'DUPLICATE_EVENT_NOT_IDEMPOTENT'; END IF;
END $tests$;

-- Revocation must immediately block the Zalo read. No cached permission.
UPDATE qa_cross.channel_links SET revoked=true
 WHERE channel='ZALO_BOT' AND provider_subject_hash='SYNTHETIC_ZALO_SUBJECT_HASH_A';
DO $tests$ BEGIN
 IF EXISTS(SELECT 1 FROM qa_cross.synthetic_lookup(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'ZALO_BOT','SYNTHETIC_ZALO_SUBJECT_HASH_A','TEST-00000009'))
 THEN RAISE EXCEPTION 'REVOKED_LINK_STILL_READS_ORDER'; END IF;
END $tests$;

-- Public API clients (even 'authenticated') never get direct private QA access.
SET ROLE authenticated;
DO $tests$ DECLARE denied boolean:=false; BEGIN
 BEGIN
  PERFORM * FROM qa_cross.synthetic_lookup(
   '00000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001',
   'ZALO_BOT','SYNTHETIC_ZALO_SUBJECT_HASH_A','TEST-00000009');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'EXPOSED_PRIVATE_LOOKUP_FUNCTION'; END IF;
END $tests$;
RESET ROLE;

SELECT 'PASS_DISPOSABLE_CROSS_CHANNEL_DB_NO_HOSTED_JWT' AS qa_result;