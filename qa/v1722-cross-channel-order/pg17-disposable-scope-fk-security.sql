-- TIEN404 V17.22C: disposable PostgreSQL 17 only. Never run on hosted Supabase.
-- This script is executed ONLY inside an ephemeral CI PostgreSQL service database.
\set ON_ERROR_STOP on

DO $$
BEGIN
  IF current_database() <> 't404_v1722_ci' OR current_user <> 'postgres'
    OR current_setting('server_version_num')::int < 170000
    OR to_regclass('tien404_v1722_qa.orders') IS NULL THEN
    RAISE EXCEPTION 'DISPOSABLE_PG17_STAGING_GUARD_DENIED';
  END IF;
END $$;

DO $$
DECLARE t text; r text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['orders','link_challenges','channel_links','provider_replay']) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='tien404_v1722_qa' AND c.relname=t
         AND c.relrowsecurity AND c.relforcerowsecurity
    ) THEN RAISE EXCEPTION 'MISSING_FORCED_RLS_%',t; END IF;
    IF EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname='tien404_v1722_qa' AND tablename=t
    ) THEN RAISE EXCEPTION 'UNAPPROVED_POLICY_%',t; END IF;
    FOR r IN SELECT unnest(ARRAY['anon','authenticated','service_role']) LOOP
      IF has_schema_privilege(r,'tien404_v1722_qa','USAGE')
      OR has_table_privilege(r,'tien404_v1722_qa.'||t,'SELECT')
      OR has_table_privilege(r,'tien404_v1722_qa.'||t,'INSERT')
      OR has_table_privilege(r,'tien404_v1722_qa.'||t,'UPDATE')
      OR has_table_privilege(r,'tien404_v1722_qa.'||t,'DELETE') THEN
        RAISE EXCEPTION 'FORBIDDEN_ROLE_ACCESS_%,%',r,t;
      END IF;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'PASS_4_TABLES_FORCE_RLS_ZERO_POLICY_ZERO_PUBLIC_GRANTS';
END $$;

-- No real users, Pages, Bots or orders. This is synthetic, non-sensitive test-only data.
INSERT INTO tien404_v1722_qa.orders
 (order_ref,tenant_key,store_key,messenger_actor_hmac,sku,quantity,unit_price_vnd,total_vnd,expires_at)
VALUES
 ('QA-ORD-00001','QA_TENANT_1','QA_STORE_A',repeat('a',64),'QA_SKU_001',2,159000,318000,now()+interval '1 day'),
 ('QA-ORD-00002','QA_TENANT_1','QA_STORE_B',repeat('b',64),'QA_SKU_001',2,259000,518000,now()+interval '1 day');

DO $$
BEGIN
  BEGIN
    INSERT INTO tien404_v1722_qa.link_challenges
     (link_ref,order_ref,tenant_key,store_key,messenger_actor_hmac,messenger_otp_hmac,expires_at)
    VALUES ('QA-LINK-00001','QA-ORD-00001','QA_TENANT_1','QA_STORE_B',repeat('a',64),repeat('d',64),now()+interval '5 min');
    RAISE EXCEPTION 'UNSCOPED_CROSS_STORE_LINK_CHALLENGE_WAS_ALLOWED';
  EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'PASS_CROSS_STORE_CHALLENGE_DENIED'; END;

  BEGIN
    INSERT INTO tien404_v1722_qa.link_challenges
     (link_ref,order_ref,tenant_key,store_key,messenger_actor_hmac,messenger_otp_hmac,expires_at)
    VALUES ('QA-LINK-00002','QA-ORD-00001','QA_TENANT_2','QA_STORE_A',repeat('a',64),repeat('d',64),now()+interval '5 min');
    RAISE EXCEPTION 'UNSCOPED_CROSS_TENANT_CHALLENGE_WAS_ALLOWED';
  EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'PASS_CROSS_TENANT_CHALLENGE_DENIED'; END;

  BEGIN
    INSERT INTO tien404_v1722_qa.link_challenges
     (link_ref,order_ref,tenant_key,store_key,messenger_actor_hmac,messenger_otp_hmac,expires_at)
    VALUES ('QA-LINK-00003','QA-ORD-00001','QA_TENANT_1','QA_STORE_A',repeat('b',64),repeat('d',64),now()+interval '5 min');
    RAISE EXCEPTION 'MISMATCHED_MESSENGER_ACTOR_CHALLENGE_WAS_ALLOWED';
  EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'PASS_CROSS_ACTOR_CHALLENGE_DENIED'; END;
END $$;

INSERT INTO tien404_v1722_qa.link_challenges
 (link_ref,order_ref,tenant_key,store_key,messenger_actor_hmac,messenger_otp_hmac,
  zalo_actor_hmac,zalo_otp_hmac,expires_at,consumed_at)
VALUES
 ('QA-LINK-00004','QA-ORD-00001','QA_TENANT_1','QA_STORE_A',repeat('a',64),repeat('d',64),
  repeat('e',64),repeat('f',64),now()+interval '5 min',now());

DO $$
BEGIN
  BEGIN
    INSERT INTO tien404_v1722_qa.channel_links
     (tenant_key,store_key,messenger_actor_hmac,zalo_actor_hmac,verified_challenge_ref)
    VALUES ('QA_TENANT_1','QA_STORE_B',repeat('a',64),repeat('e',64),'QA-LINK-00004');
    RAISE EXCEPTION 'CROSS_STORE_CHANNEL_LINK_WAS_ALLOWED';
  EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'PASS_CROSS_STORE_CHANNEL_LINK_DENIED'; END;

  BEGIN
    INSERT INTO tien404_v1722_qa.channel_links
     (tenant_key,store_key,messenger_actor_hmac,zalo_actor_hmac,verified_challenge_ref)
    VALUES ('QA_TENANT_2','QA_STORE_A',repeat('a',64),repeat('e',64),'QA-LINK-00004');
    RAISE EXCEPTION 'CROSS_TENANT_CHANNEL_LINK_WAS_ALLOWED';
  EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'PASS_CROSS_TENANT_CHANNEL_LINK_DENIED'; END;

  BEGIN
    INSERT INTO tien404_v1722_qa.channel_links
     (tenant_key,store_key,messenger_actor_hmac,zalo_actor_hmac,verified_challenge_ref)
    VALUES ('QA_TENANT_1','QA_STORE_A',repeat('b',64),repeat('e',64),'QA-LINK-00004');
    RAISE EXCEPTION 'OTHER_MESSENGER_ACTOR_LINK_WAS_ALLOWED';
  EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'PASS_CROSS_MESSENGER_ACTOR_LINK_DENIED'; END;

  BEGIN
    INSERT INTO tien404_v1722_qa.channel_links
     (tenant_key,store_key,messenger_actor_hmac,zalo_actor_hmac,verified_challenge_ref)
    VALUES ('QA_TENANT_1','QA_STORE_A',repeat('a',64),repeat('9',64),'QA-LINK-00004');
    RAISE EXCEPTION 'OTHER_ZALO_ACTOR_LINK_WAS_ALLOWED';
  EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'PASS_CROSS_ZALO_ACTOR_LINK_DENIED'; END;
END $$;

INSERT INTO tien404_v1722_qa.channel_links
 (tenant_key,store_key,messenger_actor_hmac,zalo_actor_hmac,verified_challenge_ref)
VALUES ('QA_TENANT_1','QA_STORE_A',repeat('a',64),repeat('e',64),'QA-LINK-00004');

INSERT INTO tien404_v1722_qa.provider_replay
 (provider_key_hmac,payload_digest_hmac,expires_at)
VALUES (repeat('1',64),repeat('2',64),now()+interval '5 min');

DO $$
BEGIN
  BEGIN
    INSERT INTO tien404_v1722_qa.provider_replay
     (provider_key_hmac,payload_digest_hmac,expires_at)
    VALUES (repeat('1',64),repeat('2',64),now()+interval '5 min');
    RAISE EXCEPTION 'DUPLICATE_PROVIDER_REPLAY_WAS_ALLOWED';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS_DUPLICATE_REPLAY_DENIED'; END;
  BEGIN
    INSERT INTO tien404_v1722_qa.provider_replay
     (provider_key_hmac,payload_digest_hmac,expires_at)
    VALUES (repeat('1',64),repeat('3',64),now()+interval '5 min');
    RAISE EXCEPTION 'CONFLICTING_PROVIDER_REPLAY_WAS_ALLOWED';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS_CONFLICTING_REPLAY_DENIED'; END;
END $$;

DO $$
DECLARE n_orders int; n_challenges int; n_links int; n_replay int;
BEGIN
 SELECT count(*) INTO n_orders FROM tien404_v1722_qa.orders;
 SELECT count(*) INTO n_challenges FROM tien404_v1722_qa.link_challenges;
 SELECT count(*) INTO n_links FROM tien404_v1722_qa.channel_links;
 SELECT count(*) INTO n_replay FROM tien404_v1722_qa.provider_replay;
 IF (n_orders,n_challenges,n_links,n_replay)<>(2,1,1,1) THEN
   RAISE EXCEPTION 'UNEXPECTED_MUTATIONS_AFTER_NEGATIVE_TESTS';
 END IF;
 RAISE NOTICE 'PASS_EXPECTED_SYNTHETIC_ROWS_ONLY_2_1_1_1';
END $$;
