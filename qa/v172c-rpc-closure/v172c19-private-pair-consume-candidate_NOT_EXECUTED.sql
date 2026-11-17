-- V17.2C.19 — PRIVATE PAIR CONSUMPTION CANDIDATE. NOT EXECUTED ON SUPABASE.
-- SECURITY INVOKER (default); trusted, privileged private backend ONLY.
-- Signature verification, current real Auth sessions, independent consent,
-- reviewer and approved Store authority MUST be checked before invocation.
-- Call within its own DB transaction. Not an exposed HTTP RPC.
CREATE FUNCTION tien404_v172c18_private.consume_pair(
  p_a text,p_b text,p_project text,p_tenant text,
  p_store_a text,p_store_b text,p_subject_a text,p_subject_b text,p_reviewer text
) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER
SET search_path=''
AS $body$
DECLARE
 r tien404_v172c18_private.consent_receipts%ROWTYPE;
 n integer:=0;
 a_seen boolean:=false;
 b_seen boolean:=false;
BEGIN
 IF p_a IS NULL OR p_b IS NULL OR p_a=p_b
    OR p_store_a IS NULL OR p_store_b IS NULL OR p_store_a=p_store_b
    OR p_subject_a IS NULL OR p_subject_b IS NULL OR p_subject_a=p_subject_b
    OR p_project IS NULL OR p_tenant IS NULL OR p_reviewer IS NULL
 THEN RAISE EXCEPTION 'PAIR_ADMISSION_DENIED'; END IF;
 -- Consistent lock order eliminates A/B inversion deadlocks.
 FOR r IN
  SELECT * FROM tien404_v172c18_private.consent_receipts
  WHERE receipt_id IN (p_a,p_b)
  ORDER BY receipt_id FOR UPDATE
 LOOP
  IF r.state<>'issued' OR r.expires_at<=clock_timestamp()
     OR r.issued_at>clock_timestamp()
     OR r.project_ref<>p_project OR r.tenant_ref<>p_tenant
     OR r.reviewer_ref<>p_reviewer
     OR r.scope<>'synthetic_catalog_readonly_no_send_no_write'
  THEN RAISE EXCEPTION 'PAIR_ADMISSION_DENIED'; END IF;
  IF r.receipt_id=p_a AND r.actor_slot='QA_A'
     AND r.store_ref=p_store_a AND r.subject_ref=p_subject_a
  THEN a_seen:=true;
  ELSIF r.receipt_id=p_b AND r.actor_slot='QA_B'
     AND r.store_ref=p_store_b AND r.subject_ref=p_subject_b
  THEN b_seen:=true;
  ELSE RAISE EXCEPTION 'PAIR_ADMISSION_DENIED'; END IF;
  n:=n+1;
 END LOOP;
 IF n<>2 OR NOT a_seen OR NOT b_seen THEN
  RAISE EXCEPTION 'PAIR_ADMISSION_DENIED';
 END IF;
 UPDATE tien404_v172c18_private.consent_receipts
 SET state='consumed',consumed_at=clock_timestamp()
 WHERE receipt_id IN (p_a,p_b) AND state='issued';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>2 THEN RAISE EXCEPTION 'PAIR_ADMISSION_DENIED'; END IF;
 RETURN n;
END $body$;
REVOKE ALL ON FUNCTION tien404_v172c18_private.consume_pair(
 text,text,text,text,text,text,text,text,text
) FROM PUBLIC,anon,authenticated;
