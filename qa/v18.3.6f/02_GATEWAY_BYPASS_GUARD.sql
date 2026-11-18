\set ON_ERROR_STOP on
\echo V18_3_6F_GATEWAY_SCHEMA_START
DO $guard$ BEGIN
 IF current_database()<>'tien404_v1836e_disposable' THEN RAISE EXCEPTION 'NOT_DISPOSABLE'; END IF;
END $guard$;

-- Simulate a privileged executor that BYPASSES RLS but has narrow SQL privileges.
-- The gateway runtime has no table SELECT/DML and cannot mint trusted receipts.
CREATE ROLE tien404_f_gateway NOLOGIN NOBYPASSRLS NOSUPERUSER;
CREATE ROLE tien404_f_executor NOLOGIN BYPASSRLS NOSUPERUSER;
GRANT USAGE ON SCHEMA public,qa_private TO tien404_f_gateway,tien404_f_executor;
CREATE TABLE qa_private.installations(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid NOT NULL,
 provider text NOT NULL,provider_account_ref text NOT NULL,
 status text NOT NULL CHECK(status IN ('verified','pending','revoked')),
 verified_at timestamptz,revoked_at timestamptz,
 allowed_operations text[] NOT NULL,
 UNIQUE(provider,provider_account_ref),
 FOREIGN KEY(tenant_id,store_id) REFERENCES public.stores(tenant_id,id) ON DELETE RESTRICT);
CREATE TABLE qa_private.receipts(
 id uuid PRIMARY KEY,
 installation_id uuid NOT NULL REFERENCES qa_private.installations(id),
 tenant_id uuid NOT NULL,store_id uuid NOT NULL,order_id uuid NOT NULL,
 operation text NOT NULL,audience text NOT NULL,
 nonce text NOT NULL UNIQUE,
 issued_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,
 used_at timestamptz,
 server_verified boolean NOT NULL DEFAULT false,
 owner_consented boolean NOT NULL DEFAULT false
);
REVOKE ALL ON qa_private.installations,qa_private.receipts FROM PUBLIC,tien404_e_actor,tien404_f_gateway;

INSERT INTO qa_private.installations(id,tenant_id,store_id,provider,provider_account_ref,status,verified_at,revoked_at,allowed_operations) VALUES
 ('00000000-0000-0000-0000-000000008001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','messenger','fixture-page-A','verified',now()-interval '1 day',NULL,ARRAY['READ_ORDER','WRITE_CONFIRM']),
 ('00000000-0000-0000-0000-000000008002','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','messenger','fixture-page-B','verified',now()-interval '1 day',NULL,ARRAY['READ_ORDER']),
 ('00000000-0000-0000-0000-000000008003','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','messenger','fixture-revoked-A','revoked',now()-interval '1 day',now(),ARRAY['READ_ORDER']),
 ('00000000-0000-0000-0000-000000008004','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','messenger','fixture-no-read-A','verified',now()-interval '1 day',NULL,ARRAY['WRITE_CONFIRM']),
 ('00000000-0000-0000-0000-000000008005','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000201','zalo','fixture-C','verified',now()-interval '1 day',NULL,ARRAY['READ_ORDER']);

-- All receipts are synthetic and were authored by fixture admin; runtime has no INSERT privilege.
INSERT INTO qa_private.receipts(
 id,installation_id,tenant_id,store_id,order_id,operation,audience,nonce,issued_at,expires_at,used_at,server_verified,owner_consented)
SELECT
 ('00000000-0000-0000-0000-'||lpad((9000+n)::text,12,'0'))::uuid,
 CASE n WHEN 11 THEN '00000000-0000-0000-0000-000000008003'::uuid
        WHEN 12 THEN '00000000-0000-0000-0000-000000008004'::uuid
        WHEN 18 THEN '00000000-0000-0000-0000-000000008002'::uuid
        ELSE '00000000-0000-0000-0000-000000008001'::uuid END,
 '00000000-0000-0000-0000-000000000001'::uuid,
 CASE WHEN n=17 THEN '00000000-0000-0000-0000-000000000102'::uuid
      ELSE '00000000-0000-0000-0000-000000000101'::uuid END,
 CASE WHEN n=16 THEN '00000000-0000-0000-0000-000000004002'::uuid
      ELSE '00000000-0000-0000-0000-000000004001'::uuid END,
 CASE WHEN n IN (2,19) THEN 'WRITE_CONFIRM' ELSE 'READ_ORDER' END,
 CASE WHEN n=14 THEN 'WRONG_AUDIENCE' ELSE 'TIEN404_V1836F_PRIVATE_QA' END,
 'synthetic-nonce-'||n,
 now()-interval '30 seconds',
 CASE WHEN n=13 THEN now()-interval '1 minute' ELSE now()+interval '10 minutes' END,
 CASE WHEN n=10 THEN now()-interval '1 minute' ELSE NULL END,
 n<>15,
 n<>16
FROM generate_series(1,19) n;
-- Receipt 9018 has a mismatched Store-to-installation mapping.
-- Receipt 9017 has a receipt Store B and installation Store A.
-- Synthetic positive proof 9001 and 9002 are Store A READ and WRITE.

GRANT SELECT ON public.orders,public.stores,qa_private.receipts,qa_private.installations TO tien404_f_executor;
GRANT UPDATE(status) ON public.orders TO tien404_f_executor;
GRANT UPDATE(used_at) ON qa_private.receipts TO tien404_f_executor;

CREATE FUNCTION qa_private.gateway_execute(
 p_receipt uuid,p_order uuid,p_claimed_store uuid,p_operation text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE r record; order_status text; affected integer;
BEGIN
 IF p_receipt IS NULL OR p_order IS NULL OR p_claimed_store IS NULL
   OR p_operation NOT IN ('READ_ORDER','WRITE_CONFIRM')
 THEN RETURN 'DENY_BAD_INPUT'; END IF;
 SELECT p.*,i.status AS installation_status,i.verified_at AS installation_verified_at,
   i.revoked_at AS installation_revoked_at,i.allowed_operations AS installation_operations,
   i.tenant_id AS installation_tenant,i.store_id AS installation_store,
   s.status AS store_status
 INTO r
 FROM qa_private.receipts p
 JOIN qa_private.installations i ON i.id=p.installation_id
 JOIN public.stores s ON s.tenant_id=i.tenant_id AND s.id=i.store_id
 WHERE p.id=p_receipt
 FOR UPDATE OF p;
 IF NOT FOUND THEN RETURN 'DENY_RECEIPT_NOT_FOUND'; END IF;
 IF r.used_at IS NOT NULL OR r.expires_at<=clock_timestamp()
   OR r.issued_at>clock_timestamp()
 THEN RETURN 'DENY_REPLAY_OR_EXPIRED'; END IF;
 IF NOT r.server_verified OR NOT r.owner_consented
   OR r.audience<>'TIEN404_V1836F_PRIVATE_QA'
 THEN RETURN 'DENY_ATTESTATION'; END IF;
 IF r.installation_status<>'verified' OR r.installation_revoked_at IS NOT NULL
   OR r.installation_verified_at IS NULL
   OR r.store_status<>'active'
 THEN RETURN 'DENY_INSTALLATION'; END IF;
 IF r.operation<>p_operation OR NOT (p_operation=ANY(r.installation_operations))
 THEN RETURN 'DENY_CAPABILITY'; END IF;
 IF r.tenant_id<>r.installation_tenant
   OR r.store_id<>r.installation_store
   OR r.store_id<>p_claimed_store
   OR r.order_id<>p_order
 THEN RETURN 'DENY_SCOPE'; END IF;
 SELECT status INTO order_status FROM public.orders o
 WHERE o.id=p_order AND o.tenant_id=r.tenant_id AND o.store_id=r.store_id;
 IF NOT FOUND THEN RETURN 'DENY_ORDER_SCOPE'; END IF;
 IF p_operation='READ_ORDER' THEN
   UPDATE qa_private.receipts SET used_at=clock_timestamp() WHERE id=p_receipt;
   RETURN 'ALLOW_READ_'||order_status;
 END IF;
 IF order_status<>'pending' THEN RETURN 'DENY_TRANSITION'; END IF;
 UPDATE public.orders SET status='confirmed'
 WHERE id=p_order AND tenant_id=r.tenant_id AND store_id=r.store_id AND status='pending';
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RETURN 'DENY_CONCURRENT_CHANGE'; END IF;
 UPDATE qa_private.receipts SET used_at=clock_timestamp() WHERE id=p_receipt;
 RETURN 'ALLOW_WRITE_CONFIRMED';
END $fn$;

ALTER FUNCTION qa_private.gateway_execute(uuid,uuid,uuid,text)
OWNER TO tien404_f_executor;
REVOKE ALL ON FUNCTION qa_private.gateway_execute(uuid,uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qa_private.gateway_execute(uuid,uuid,uuid,text) TO tien404_f_gateway;

-- No raw table access and no receipt issuance for the gateway role.
REVOKE ALL ON public.orders,public.stores FROM tien404_f_gateway;
GRANT EXECUTE ON FUNCTION qa_private.try_write(text) TO tien404_f_gateway;
\echo V18_3_6F_GATEWAY_SCHEMA_READY
