-- G0.11 deterministic crash/reclaim/review QA in disposable PG17.
\set ON_ERROR_STOP on
DO $g11$
DECLARE
  inst_a bytea:=decode(repeat('11',32),'hex');
  inst_b bytea:=decode(repeat('12',32),'hex');
  eid_a bytea:=decode(repeat('22',32),'hex');
  eid_b bytea:=decode(repeat('23',32),'hex');
  pay_a bytea:=decode(repeat('33',32),'hex');
  pay_b bytea:=decode(repeat('34',32),'hex');
  t0 timestamptz:='2026-11-17 00:00:00+00';
  outcome text;
  token1 uuid;token2 uuid;
  tries integer;
  count_rows integer;
BEGIN
  -- Initial claim, a simultaneous duplicate and worker crash.
  SELECT disposition,worker_token,attempt INTO outcome,token1,tries
  FROM t404_g11_disposable_qa.acquire_nosend('MESSENGER',inst_a,eid_a,pay_a,t0,10);
  IF outcome<>'claimed' OR token1 IS NULL OR tries<>1 THEN
    RAISE EXCEPTION 'G11_EXPECT_INITIAL_CLAIM'; END IF;
  SELECT disposition INTO outcome
  FROM t404_g11_disposable_qa.acquire_nosend(
   'MESSENGER',inst_a,eid_a,pay_a,t0+interval '1 second',10);
  IF outcome<>'leased' THEN
    RAISE EXCEPTION 'G11_ACTIVE_LEASE_MUST_BLOCK_DUPLICATE: %',outcome; END IF;

  -- Simulate process termination (no DONE). At lease expiry a different
  -- worker can safely reclaim ONLY a no-send task.
  SELECT disposition,worker_token,attempt INTO outcome,token2,tries
  FROM t404_g11_disposable_qa.acquire_nosend(
    'MESSENGER',inst_a,eid_a,pay_a,t0+interval '11 second',10);
  IF outcome<>'reclaimed' OR token2 IS NULL OR token2=token1 OR tries<>2 THEN
    RAISE EXCEPTION 'G11_EXPIRED_LEASE_WAS_NOT_FENCED'; END IF;

  outcome:=t404_g11_disposable_qa.complete_nosend(
    'MESSENGER',inst_a,eid_a,token1,t0+interval '12 second');
  IF outcome<>'stale_worker' THEN
    RAISE EXCEPTION 'G11_CRASHED_WORKER_COMPLETED_UNSAFELY'; END IF;
  outcome:=t404_g11_disposable_qa.complete_nosend(
    'MESSENGER',inst_a,eid_a,token2,t0+interval '12 second');
  IF outcome<>'completed' THEN
    RAISE EXCEPTION 'G11_NEW_FENCED_WORKER_UNABLE_TO_COMPLETE'; END IF;
  SELECT disposition INTO outcome
  FROM t404_g11_disposable_qa.acquire_nosend(
    'MESSENGER',inst_a,eid_a,pay_a,t0+interval '30 second',10);
  IF outcome<>'done' THEN
    RAISE EXCEPTION 'G11_COMPLETED_EVENT_RETRIED'; END IF;
  SELECT disposition INTO outcome
  FROM t404_g11_disposable_qa.acquire_nosend(
    'MESSENGER',inst_a,eid_a,pay_b,t0+interval '30 second',10);
  IF outcome<>'conflict' THEN
    RAISE EXCEPTION 'G11_MID_PAYLOAD_CONFLICT_NOT_CAUGHT'; END IF;

  -- Uncertain boundary: if provider send MAY have occurred, NEVER retry
  -- automatically after crash/lease expiration, even hours afterward.
  SELECT disposition,worker_token INTO outcome,token1
  FROM t404_g11_disposable_qa.acquire_nosend(
    'MESSENGER',inst_a,eid_b,pay_a,t0,10);
  IF outcome<>'claimed' THEN RAISE EXCEPTION 'G11_B_FAIL_CLAIM'; END IF;
  outcome:=t404_g11_disposable_qa.mark_send_uncertain(
   'MESSENGER',inst_a,eid_b,token1,t0+interval '1 second');
  IF outcome<>'manual_review' THEN
    RAISE EXCEPTION 'G11_SEND_UNCERTAIN_NOT_PERSISTED'; END IF;
  SELECT disposition INTO outcome
  FROM t404_g11_disposable_qa.acquire_nosend(
    'MESSENGER',inst_a,eid_b,pay_a,t0+interval '180 minute',10);
  IF outcome<>'manual_review' THEN
    RAISE EXCEPTION 'G11_UNCERTAIN_SEND_AUTORETRIED'; END IF;
  outcome:=t404_g11_disposable_qa.complete_nosend(
   'MESSENGER',inst_a,eid_b,token1,t0+interval '2 second');
  IF outcome<>'manual_review' THEN
    RAISE EXCEPTION 'G11_UNCERTAIN_SEND_BECAME_FALSE_COMPLETION'; END IF;

  -- Isolation key must include the installation as well as MID.
  SELECT disposition INTO outcome
  FROM t404_g11_disposable_qa.acquire_nosend(
    'MESSENGER',inst_b,eid_a,pay_a,t0,10);
  IF outcome<>'claimed' THEN
    RAISE EXCEPTION 'G11_MID_ACROSS_DIFFERENT_INSTALLATIONS_CONFLATED'; END IF;

  SELECT count(*) INTO count_rows FROM t404_g11_disposable_qa.event_ledger;
  IF count_rows<>3 THEN
    RAISE EXCEPTION 'G11_EVENT_LEDGER_COUNT_WRONG %',count_rows; END IF;
  SELECT count(*) INTO count_rows FROM t404_g11_disposable_qa.event_ledger
    WHERE state='SEND_UNCERTAIN';
  IF count_rows<>1 THEN
    RAISE EXCEPTION 'G11_UNCERTAIN_REVIEW_NOT_VISIBLE'; END IF;
  RAISE NOTICE 'PASS G11: crash before send => reclaimed, stale worker fenced, done deduped, uncertain send held for review, Store installation scoped';
END
$g11$;

DO $g11_bad$
DECLARE
  i bytea:=decode(repeat('41',32),'hex');
  e bytea:=decode(repeat('42',32),'hex');
  p bytea:=decode(repeat('43',32),'hex');
  x text;
  t0 timestamptz:='2026-11-17 00:00:00+00';
BEGIN
  BEGIN
    PERFORM * FROM t404_g11_disposable_qa.acquire_nosend('ZALO_OA',i,e,p,t0,10);
    RAISE EXCEPTION 'G11_ZALO_OA_UNEXPECTEDLY_ALLOWED';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  BEGIN
    PERFORM * FROM t404_g11_disposable_qa.acquire_nosend('MESSENGER',i,e,p,t0,1);
    RAISE EXCEPTION 'G11_INVALID_LEASE_DURATION_ALLOWED';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  BEGIN
    PERFORM * FROM t404_g11_disposable_qa.acquire_nosend('MESSENGER',i,e,decode('00','hex'),t0,10);
    RAISE EXCEPTION 'G11_INVALID_DIGEST_ALLOWED';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  BEGIN
    x:=t404_g11_disposable_qa.complete_nosend('MESSENGER',i,e,NULL,t0);
    RAISE EXCEPTION 'G11_NULL_FENCING_TOKEN_ALLOWED';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  RAISE NOTICE 'PASS G11: reject provider mixup, bad lease, bad digest and missing fencing token';
END
$g11_bad$;

DO $g11_priv$
DECLARE n integer; v_rls boolean; v_definer boolean;
BEGIN
 SELECT count(*) INTO n FROM information_schema.columns
 WHERE table_schema='t404_g11_disposable_qa' AND table_name='event_ledger'
 AND column_name IN ('page_id','psid','mid','phone','message_text','body',
  'raw_body','access_token','app_secret','customer_id','order_id');
 IF n<>0 THEN RAISE EXCEPTION 'G11_PRIVACY_SCHEMA_FAIL'; END IF;
 SELECT relrowsecurity INTO v_rls FROM pg_class
 WHERE oid='t404_g11_disposable_qa.event_ledger'::regclass;
 IF v_rls IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'G11_RLS_DEFENSE_IN_DEPTH_MISSING'; END IF;
 SELECT count(*) INTO n FROM pg_proc
 WHERE pronamespace='t404_g11_disposable_qa'::regnamespace AND prosecdef;
 IF n<>0 THEN RAISE EXCEPTION 'G11_UNSAFE_SECURITY_DEFINER'; END IF;
 RAISE NOTICE 'PASS G11: private/no-PII schema, RLS flag, SECURITY INVOKER only';
END
$g11_priv$;

CREATE ROLE t404_g11_untrusted NOLOGIN;
DO $g11_role$
BEGIN
 IF has_schema_privilege('t404_g11_untrusted','t404_g11_disposable_qa','USAGE')
 THEN RAISE EXCEPTION 'G11_UNTRUSTED_SCHEMA_USAGE'; END IF;
 IF has_table_privilege('t404_g11_untrusted','t404_g11_disposable_qa.event_ledger','SELECT')
 THEN RAISE EXCEPTION 'G11_UNTRUSTED_TABLE_SELECT'; END IF;
 IF has_function_privilege('t404_g11_untrusted',
   't404_g11_disposable_qa.acquire_nosend(text,bytea,bytea,bytea,timestamptz,int)',
   'EXECUTE') THEN RAISE EXCEPTION 'G11_UNTRUSTED_ACQUIRE'; END IF;
 RAISE NOTICE 'PASS G11: untrusted role denied DB access';
END
$g11_role$;
