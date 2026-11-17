-- G0.12 operator queue test ONLY in disposable PG17.
\set ON_ERROR_STOP on
DO $qa$
DECLARE
  t0 timestamptz:='2026-11-17 00:00:00+00';
  a bytea:=decode(repeat('11',32),'hex');
  e_uncertain bytea:=decode(repeat('21',32),'hex');
  e_expired bytea:=decode(repeat('22',32),'hex');
  e_fresh bytea:=decode(repeat('23',32),'hex');
  content_hash bytea:=decode(repeat('31',32),'hex');
  evidence1 bytea:=decode(repeat('41',32),'hex');
  evidence2 bytea:=decode(repeat('42',32),'hex');
  worker1 uuid;worker2 uuid;act text;
  new_count int;eligible int;
  case_uncertain uuid;case_expired uuid;
  op_fence uuid;old_fence uuid;
  n int;
BEGIN
  -- Only synthetic digests, no real Page/PSID/MID/raw payload.
  SELECT disposition,worker_token INTO act,worker1
   FROM t404_g11_disposable_qa.acquire_nosend(
    'MESSENGER',a,e_uncertain,content_hash,t0,45);
  IF act<>'claimed' THEN RAISE EXCEPTION 'G12_UNCERTAIN_SEED_FAILED'; END IF;
  act:=t404_g11_disposable_qa.mark_send_uncertain(
   'MESSENGER',a,e_uncertain,worker1,t0+interval '1 second');
  IF act<>'manual_review' THEN RAISE EXCEPTION 'G12_UNCERTAIN_SEED_NOT_MARKED'; END IF;
  SELECT disposition,worker_token INTO act,worker2
   FROM t404_g11_disposable_qa.acquire_nosend(
    'MESSENGER',a,e_expired,content_hash,t0,45);
  SELECT disposition INTO act FROM t404_g11_disposable_qa.acquire_nosend(
    'MESSENGER',a,e_fresh,content_hash,t0+interval '30 second',45);

  SELECT * INTO new_count,eligible
  FROM t404_g12_disposable_qa.enqueue_timeout_and_uncertain(
    t0+interval '60 second',100);
  IF new_count<>2 OR eligible<>2 THEN
    RAISE EXCEPTION 'G12_SCAN_EXPECT_TWO_QUEUED_GOT_%,%',new_count,eligible;
  END IF;
  SELECT * INTO new_count,eligible
  FROM t404_g12_disposable_qa.enqueue_timeout_and_uncertain(
    t0+interval '60 second',100);
  IF new_count<>0 OR eligible<>2 THEN
    RAISE EXCEPTION 'G12_DUPLICATE_SCAN_NOT_IDEMPOTENT';
  END IF;
  SELECT case_id INTO case_uncertain FROM t404_g12_disposable_qa.review_cases
  WHERE event_digest=e_uncertain;
  SELECT case_id INTO case_expired FROM t404_g12_disposable_qa.review_cases
  WHERE event_digest=e_expired;
  IF case_uncertain IS NULL OR case_expired IS NULL THEN
   RAISE EXCEPTION 'G12_CASE_MISSING';END IF;

  -- Two operator sessions cannot both own the same case. A dead operator
  -- can be replaced only after review-lease expiry; stale fence cannot submit.
  SELECT result,review_fence INTO act,old_fence
   FROM t404_g12_disposable_qa.take_for_review(
    case_uncertain,'qaop_agent_a',t0+interval '65 second',120);
  IF act<>'claimed' OR old_fence IS NULL THEN RAISE EXCEPTION 'G12_FIRST_OPERATOR_FAIL';END IF;
  SELECT result INTO act FROM t404_g12_disposable_qa.take_for_review(
   case_uncertain,'qaop_agent_b',t0+interval '66 second',120);
  IF act<>'busy' THEN RAISE EXCEPTION 'G12_SECOND_OPERATOR_TOOK_ACTIVE_CASE';END IF;
  SELECT result,review_fence INTO act,op_fence
   FROM t404_g12_disposable_qa.take_for_review(
    case_uncertain,'qaop_agent_b',t0+interval '186 second',120);
  IF act<>'claimed' OR op_fence=old_fence THEN
   RAISE EXCEPTION 'G12_OPERATOR_CRASH_LEASE_NOT_REPLACED';END IF;
  act:=t404_g12_disposable_qa.submit_operator_evidence(
    case_uncertain,'qaop_agent_a',old_fence,evidence1,'PROVIDER_RECEIPT',
    t0+interval '187 second');
  IF act<>'fenced_or_expired' THEN RAISE EXCEPTION 'G12_STALE_OPERATOR_ACCEPTED'; END IF;
  act:=t404_g12_disposable_qa.submit_operator_evidence(
    case_uncertain,'qaop_agent_b',op_fence,evidence1,'PROVIDER_RECEIPT',
    t0+interval '187 second');
  IF act<>'waiting_cosign' THEN RAISE EXCEPTION 'G12_EVIDENCE_NOT_QUEUED'; END IF;
  act:=t404_g12_disposable_qa.independent_cosign(
    case_uncertain,'qarev_agent_b',evidence2,'PROVIDER_ACCEPTED_CONFIRMED',
    t0+interval '188 second');
  IF act<>'not_independently_verified' THEN
   RAISE EXCEPTION 'G12_UNMATCHED_DOCUMENT_COSIGN_ALLOWED';END IF;
  act:=t404_g12_disposable_qa.independent_cosign(
    case_uncertain,'qarev_agent_b',evidence1,'NO_SEND_CLOSED',
    t0+interval '188 second');
  IF act<>'uncertain_send_cannot_be_closed_without_provider_receipt' THEN
   RAISE EXCEPTION 'G12_UNCERTAIN_SEND_MISLABELED_NO_SEND';END IF;
  act:=t404_g12_disposable_qa.independent_cosign(
    case_uncertain,'qarev_agent_b',evidence1,'PROVIDER_ACCEPTED_CONFIRMED',
    t0+interval '188 second');
  IF act<>'review_recorded_no_send' THEN
   RAISE EXCEPTION 'G12_INDEPENDENT_REVIEW_NOT_RECORDED';END IF;
  act:=t404_g12_disposable_qa.independent_cosign(
    case_uncertain,'qarev_agent_c',evidence1,'DUPLICATE_CONFIRMED',
    t0+interval '189 second');
  IF act<>'already_resolved' THEN RAISE EXCEPTION 'G12_CASE_REOPENED';END IF;

  -- Even after an operator resolves the case, provider send uncertainty
  -- remains held in the ORIGINAL G11 ledger; no automatic outbound action.
  SELECT state INTO act FROM t404_g11_disposable_qa.event_ledger
    WHERE installation_digest=a AND event_digest=e_uncertain;
  IF act<>'SEND_UNCERTAIN' THEN
    RAISE EXCEPTION 'G12_UNSAFE_SEND_UNCERTAIN_RELEASED'; END IF;
  SELECT disposition INTO act FROM t404_g11_disposable_qa.acquire_nosend(
    'MESSENGER',a,e_uncertain,content_hash,t0+interval '240 minute',45);
  IF act<>'manual_review' THEN
    RAISE EXCEPTION 'G12_REPLAY_AFTER_OPERATOR_COSIGN';END IF;

  -- No-send expired lease review may be closed by two parties with
  -- no-send proof without turning it into a provider response.
  SELECT result,review_fence INTO act,op_fence
   FROM t404_g12_disposable_qa.take_for_review(
    case_expired,'qaop_agent_c',t0+interval '100 second',120);
  IF act<>'claimed' THEN RAISE EXCEPTION 'G12_TIMEOUT_CLAIM_FAIL';END IF;
  act:=t404_g12_disposable_qa.submit_operator_evidence(
    case_expired,'qaop_agent_c',op_fence,evidence2,'NO_SEND_RUNTIME_PROOF',
    t0+interval '101 second');
  IF act<>'waiting_cosign' THEN RAISE EXCEPTION 'G12_TIMEOUT_SUBMIT_FAIL';END IF;
  act:=t404_g12_disposable_qa.independent_cosign(
    case_expired,'qarev_agent_d',evidence2,'NO_SEND_CLOSED',
    t0+interval '102 second');
  IF act<>'review_recorded_no_send' THEN RAISE EXCEPTION 'G12_TIMEOUT_COSIGN_FAIL';END IF;

  SELECT count(*) INTO n FROM t404_g12_disposable_qa.review_cases;
  IF n<>2 THEN RAISE EXCEPTION 'G12_UNEXPECTED_QUEUE_COUNT %',n;END IF;
  SELECT count(*) INTO n FROM t404_g12_disposable_qa.review_cases
   WHERE status='RESOLVED';
  IF n<>2 THEN RAISE EXCEPTION 'G12_NOT_TWO_RESOLVED';END IF;
  SELECT count(*) INTO n FROM t404_g12_disposable_qa.review_history;
  IF n<>9 THEN RAISE EXCEPTION 'G12_AUDIT_LOG_COUNT %',n;END IF;
  RAISE NOTICE 'PASS G12: scan 2/idempotent, operator crash reclaim fenced, independent evidence matched, uncertain-send kept blocked, audit 9';
END $qa$;

DO $qa_neg$
DECLARE
 x text;t timestamptz:='2026-11-17 00:00:00+00';
 cid uuid; d bytea:=decode(repeat('11',32),'hex');
 n integer;
BEGIN
 BEGIN
  PERFORM * FROM t404_g12_disposable_qa.enqueue_timeout_and_uncertain(t,101);
  RAISE EXCEPTION 'G12_LIMIT_TOO_WIDE';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 SELECT case_id INTO cid FROM t404_g12_disposable_qa.review_cases LIMIT 1;
 BEGIN
  PERFORM * FROM t404_g12_disposable_qa.take_for_review(
   cid,'FAKE_REAL_EMPLOYEE',t,120);
  RAISE EXCEPTION 'G12_UNTRUSTED_ACTOR';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 BEGIN
  x:=t404_g12_disposable_qa.independent_cosign(
   cid,'qarev_agent_a',d,'RETRY_AND_SEND',t);
  RAISE EXCEPTION 'G12_UNSAFE_RESOLUTION';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 SELECT count(*) INTO n FROM information_schema.columns
 WHERE table_schema='t404_g12_disposable_qa' AND
   column_name IN ('page_id','psid','mid','phone','message_text',
                   'raw_body','app_secret','access_token','customer_id','order_id');
 IF n<>0 THEN RAISE EXCEPTION 'G12_PII_COLUMN_LEAK';END IF;
 SELECT count(*) INTO n FROM pg_proc
 WHERE pronamespace IN ('t404_g11_disposable_qa'::regnamespace,
                         't404_g12_disposable_qa'::regnamespace) AND prosecdef;
 IF n<>0 THEN RAISE EXCEPTION 'G12_UNSAFE_DEFINER';END IF;
 BEGIN
   UPDATE t404_g12_disposable_qa.review_history
   SET actor_tag='tampered' WHERE audit_id=(
      SELECT min(audit_id) FROM t404_g12_disposable_qa.review_history);
   RAISE EXCEPTION 'G12_AUDIT_UPDATE_UNEXPECTEDLY_ALLOWED';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 BEGIN
   DELETE FROM t404_g12_disposable_qa.review_history
   WHERE audit_id=(SELECT min(audit_id) FROM t404_g12_disposable_qa.review_history);
   RAISE EXCEPTION 'G12_AUDIT_DELETE_UNEXPECTEDLY_ALLOWED';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 RAISE NOTICE 'PASS G12: bounded scan, actor & resolution validation, append-only audit, no PII/SECURITY DEFINER';
END $qa_neg$;

CREATE ROLE g12_unauthorized_no_login NOLOGIN;
DO $qa_roles$
BEGIN
 IF has_schema_privilege('g12_unauthorized_no_login','t404_g12_disposable_qa','USAGE')
 THEN RAISE EXCEPTION 'G12_PUBLIC_SCHEMA_GRANT';END IF;
 IF has_table_privilege('g12_unauthorized_no_login',
    't404_g12_disposable_qa.review_cases','SELECT')
 THEN RAISE EXCEPTION 'G12_QUEUE_PUBLIC_SELECT';END IF;
 IF has_function_privilege('g12_unauthorized_no_login',
    't404_g12_disposable_qa.independent_cosign(uuid,text,bytea,text,timestamptz)',
    'EXECUTE') THEN RAISE EXCEPTION 'G12_PUBLIC_COSIGN';END IF;
 RAISE NOTICE 'PASS G12: unauthenticated role has no schema/queue/function access';
END $qa_roles$;
