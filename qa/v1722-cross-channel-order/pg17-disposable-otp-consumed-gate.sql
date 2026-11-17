-- TIEN404 V17.22D — DISPOSABLE PostgreSQL 17 ONLY, synthetic OTP consumption proof.
-- This script MUST NEVER run on actual Supabase or handle real user identities.
\set ON_ERROR_STOP on
DO $$
BEGIN
 IF current_database()<>'t404_v1722_ci' OR current_user<>'postgres'
 OR current_setting('server_version_num')::int<170000
 OR to_regclass('tien404_v1722_qa.orders') IS NULL
 THEN RAISE EXCEPTION 'DISPOSABLE_PG17_ONLY'; END IF;
END $$;

-- A valid-looking scoped OTP challenge still MUST NOT unlock Zalo order lookup
-- until DB's generated is_consumed becomes true.
INSERT INTO tien404_v1722_qa.link_challenges
 (link_ref,order_ref,tenant_key,store_key,messenger_actor_hmac,messenger_otp_hmac,
  zalo_actor_hmac,zalo_otp_hmac,expires_at)
VALUES ('QA-LINK-00008','QA-ORD-00001','QA_TENANT_1','QA_STORE_A',
 repeat('a',64),repeat('d',64),repeat('8',64),repeat('f',64),now()+interval '5 minutes');

DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM tien404_v1722_qa.link_challenges
 WHERE link_ref='QA-LINK-00008' AND is_consumed=false AND consumed_at IS NULL;
 IF n<>1 THEN RAISE EXCEPTION 'PENDING_CHALLENGE_MUST_BE_GENERATED_FALSE'; END IF;
 BEGIN
  INSERT INTO tien404_v1722_qa.channel_links
   (tenant_key,store_key,messenger_actor_hmac,zalo_actor_hmac,verified_challenge_ref)
  VALUES ('QA_TENANT_1','QA_STORE_A',repeat('a',64),repeat('8',64),'QA-LINK-00008');
  RAISE EXCEPTION 'PENDING_CHALLENGE_CREATED_UNAUTHORIZED_LINK';
 EXCEPTION WHEN foreign_key_violation THEN
  RAISE NOTICE 'PASS_PENDING_CHALLENGE_CANNOT_CREATE_ACCOUNT_LINK';
 END;

 BEGIN
  INSERT INTO tien404_v1722_qa.channel_links
   (tenant_key,store_key,messenger_actor_hmac,zalo_actor_hmac,verified_challenge_ref,require_consumed)
  VALUES ('QA_TENANT_1','QA_STORE_A',repeat('a',64),repeat('8',64),'QA-LINK-00008',false);
  RAISE EXCEPTION 'CONSUMED_BOOLEAN_OVERRIDE_BYPASSED';
 EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS_CHILD_CANNOT_OVERRIDE_REQUIRED_CONSUMPTION';
 END;
END $$;

-- Simulated server-trusted precondition: a future dedicated private writer MUST
-- validate BOTH provider identities and both OTP proofs independently before
-- issuing this conditional UPDATE. Do not expose this SQL as an API endpoint.
DO $$
DECLARE n integer;
BEGIN
 UPDATE tien404_v1722_qa.link_challenges
 SET consumed_at=clock_timestamp()
 WHERE link_ref='QA-LINK-00008'
  AND tenant_key='QA_TENANT_1' AND store_key='QA_STORE_A'
  AND messenger_actor_hmac=repeat('a',64) AND zalo_actor_hmac=repeat('8',64)
  AND zalo_otp_hmac=repeat('f',64)
  AND consumed_at IS NULL AND attempts<3 AND expires_at>clock_timestamp();
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'FIRST_ATOMIC_CONSUME_EXPECTED_1_GOT_%',n; END IF;
 RAISE NOTICE 'PASS_FIRST_CONDITIONAL_CONSUMPTION_WON';

 UPDATE tien404_v1722_qa.link_challenges
 SET consumed_at=clock_timestamp()
 WHERE link_ref='QA-LINK-00008' AND consumed_at IS NULL
  AND expires_at>clock_timestamp();
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'OTP_REPLAY_CONSUMPTION_WAS_ALLOWED'; END IF;
 RAISE NOTICE 'PASS_SECOND_CONSUMPTION_ATTEMPT_ZERO_ROWS';

 SELECT count(*) INTO n FROM tien404_v1722_qa.link_challenges
 WHERE link_ref='QA-LINK-00008' AND is_consumed=true;
 IF n<>1 THEN RAISE EXCEPTION 'PERSISTED_GENERATED_CONSUMPTION_NOT_TRUE'; END IF;
END $$;

INSERT INTO tien404_v1722_qa.channel_links
 (tenant_key,store_key,messenger_actor_hmac,zalo_actor_hmac,verified_challenge_ref)
VALUES ('QA_TENANT_1','QA_STORE_A',repeat('a',64),repeat('8',64),'QA-LINK-00008');

DO $$
BEGIN
 BEGIN
  UPDATE tien404_v1722_qa.link_challenges
  SET consumed_at=NULL WHERE link_ref='QA-LINK-00008';
  RAISE EXCEPTION 'CONSUMED_CHALLENGE_REOPENED_WHILE_LINK_ACTIVE';
 EXCEPTION WHEN foreign_key_violation THEN
  RAISE NOTICE 'PASS_ACTIVE_LINK_PREVENTS_REOPENING_CONSUMPTION';
 END;
END $$;

-- Future challenge timeout check: an expired but well-formed row cannot be
-- atomically consumed by a correctly scoped private writer.
INSERT INTO tien404_v1722_qa.link_challenges
 (link_ref,order_ref,tenant_key,store_key,messenger_actor_hmac,messenger_otp_hmac,
  zalo_actor_hmac,zalo_otp_hmac,created_at,expires_at)
VALUES ('QA-LINK-00009','QA-ORD-00001','QA_TENANT_1','QA_STORE_A',
 repeat('a',64),repeat('d',64),repeat('9',64),repeat('f',64),
 now()-interval '2 minutes',now()-interval '1 minute');

DO $$
DECLARE n integer;
BEGIN
 UPDATE tien404_v1722_qa.link_challenges
 SET consumed_at=clock_timestamp()
 WHERE link_ref='QA-LINK-00009' AND consumed_at IS NULL
 AND expires_at>clock_timestamp();
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'EXPIRED_CHALLENGE_CONSUMED'; END IF;
 BEGIN
  INSERT INTO tien404_v1722_qa.channel_links
   (tenant_key,store_key,messenger_actor_hmac,zalo_actor_hmac,verified_challenge_ref)
  VALUES ('QA_TENANT_1','QA_STORE_A',repeat('a',64),repeat('9',64),'QA-LINK-00009');
  RAISE EXCEPTION 'EXPIRED_PENDING_CHALLENGE_CREATED_LINK';
 EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'PASS_EXPIRED_CHALLENGE_DENIED'; END;
END $$;

-- Cleanup occurs only inside the disposable service; no external file or DB touched.
DELETE FROM tien404_v1722_qa.channel_links WHERE zalo_actor_hmac=repeat('8',64);
DELETE FROM tien404_v1722_qa.link_challenges WHERE link_ref IN ('QA-LINK-00008','QA-LINK-00009');
DO $$
DECLARE counts int[];
BEGIN
 SELECT ARRAY[
  (SELECT count(*) FROM tien404_v1722_qa.orders),
  (SELECT count(*) FROM tien404_v1722_qa.link_challenges),
  (SELECT count(*) FROM tien404_v1722_qa.channel_links),
  (SELECT count(*) FROM tien404_v1722_qa.provider_replay)] INTO counts;
 IF counts<>ARRAY[2,1,1,1] THEN RAISE EXCEPTION 'DISPOSABLE_QA_CLEANUP_COUNTS_MISMATCH'; END IF;
 RAISE NOTICE 'PASS_ONLY_PARENT_SYNTHETIC_FIXTURE_REMAINS';
END $$;
