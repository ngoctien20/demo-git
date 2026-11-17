-- G0.10 disposable PG17 QA negative/positive assertions.
-- MUST be invoked on throwaway CI postgres:17, never hosted Supabase.
\set ON_ERROR_STOP on
DO $g10$
DECLARE
  installation_a bytea := decode(repeat('11',32),'hex');
  installation_b bytea := decode(repeat('12',32),'hex');
  event_a bytea := decode(repeat('22',32),'hex');
  event_b bytea := decode(repeat('23',32),'hex');
  payload_a bytea := decode(repeat('33',32),'hex');
  payload_b bytea := decode(repeat('34',32),'hex');
  verdict text;
  n bigint;
BEGIN
  verdict := t404_g10_disposable_qa.claim_once(
    'MESSENGER',installation_a,event_a,payload_a);
  IF verdict IS DISTINCT FROM 'claimed' THEN
    RAISE EXCEPTION 'G10 expected first claim, got %',verdict;
  END IF;
  verdict := t404_g10_disposable_qa.claim_once(
    'MESSENGER',installation_a,event_a,payload_a);
  IF verdict IS DISTINCT FROM 'duplicate' THEN
    RAISE EXCEPTION 'G10 expected duplicate, got %',verdict;
  END IF;
  verdict := t404_g10_disposable_qa.claim_once(
    'MESSENGER',installation_a,event_a,payload_b);
  IF verdict IS DISTINCT FROM 'conflict' THEN
    RAISE EXCEPTION 'G10 expected MID same but payload changed, got %',verdict;
  END IF;
  verdict := t404_g10_disposable_qa.claim_once(
    'MESSENGER',installation_a,event_b,payload_a);
  IF verdict IS DISTINCT FROM 'claimed' THEN
    RAISE EXCEPTION 'G10 expected other event claim';
  END IF;
  verdict := t404_g10_disposable_qa.claim_once(
    'MESSENGER',installation_b,event_a,payload_a);
  IF verdict IS DISTINCT FROM 'claimed' THEN
    RAISE EXCEPTION 'G10 expected other installation separate scope';
  END IF;

  SELECT count(*) INTO n FROM t404_g10_disposable_qa.event_claims;
  IF n <> 3 THEN RAISE EXCEPTION 'G10 duplicate created rows: %',n; END IF;

  BEGIN
    PERFORM t404_g10_disposable_qa.claim_once(
      'ZALO_OA',installation_a,event_a,payload_a);
    RAISE EXCEPTION 'G10 unsupported provider accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;
  BEGIN
    PERFORM t404_g10_disposable_qa.claim_once(
      'MESSENGER',installation_a,event_a,decode('01','hex'));
    RAISE EXCEPTION 'G10 invalid 1-byte payload digest accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;
  BEGIN
    PERFORM t404_g10_disposable_qa.claim_once(
      'MESSENGER',NULL,event_a,payload_a);
    RAISE EXCEPTION 'G10 null installation accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;
  RAISE NOTICE 'G10 PG17: claimed, duplicate, conflict, scopes and invalid digests PASS';
END
$g10$;

DO $g10_priv$
DECLARE
  bad_column_count int;
  is_rls boolean;
  is_definer boolean;
BEGIN
  SELECT count(*) INTO bad_column_count
  FROM information_schema.columns
  WHERE table_schema='t404_g10_disposable_qa' AND table_name='event_claims'
    AND column_name IN (
      'page_id','psid','message_id','mid','sender_id','phone',
      'access_token','app_secret','payload','raw_body','customer_name'
    );
  IF bad_column_count<>0 THEN RAISE EXCEPTION 'G10 PII/raw credentials schema leak'; END IF;
  SELECT relrowsecurity INTO is_rls FROM pg_class
  WHERE oid='t404_g10_disposable_qa.event_claims'::regclass;
  IF is_rls IS DISTINCT FROM true THEN RAISE EXCEPTION 'G10 row security disabled'; END IF;
  SELECT prosecdef INTO is_definer
  FROM pg_proc WHERE oid='t404_g10_disposable_qa.claim_once(text,bytea,bytea,bytea)'::regprocedure;
  IF is_definer IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'G10 dangerous SECURITY DEFINER';
  END IF;
  RAISE NOTICE 'G10 PG17: no PII columns, private schema, invoker function, RLS enabled';
END
$g10_priv$;

CREATE ROLE t404_g10_untrusted_qa NOLOGIN;
DO $g10_role$
BEGIN
  IF has_schema_privilege('t404_g10_untrusted_qa','t404_g10_disposable_qa','USAGE')
  THEN RAISE EXCEPTION 'G10 untrusted role got schema usage'; END IF;
  IF has_function_privilege('t404_g10_untrusted_qa',
     't404_g10_disposable_qa.claim_once(text,bytea,bytea,bytea)','EXECUTE')
  THEN RAISE EXCEPTION 'G10 untrusted role got function execute'; END IF;
  RAISE NOTICE 'G10 PG17: untrusted role refused';
END
$g10_role$;
