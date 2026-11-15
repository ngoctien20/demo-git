-- SALES LITE V1.0. Review only. No hosted migration/grant. Apply solely to a disposable PostgreSQL database.
BEGIN;
CREATE SCHEMA sales_lite_qa;
REVOKE ALL ON SCHEMA sales_lite_qa FROM PUBLIC;
-- Resolve an active Owner through the completed R1 challenge, the exact recipient and current membership.
-- The pairing code may have expired after it was consumed; the current binding has its own expiry.
CREATE VIEW sales_lite_qa.verified_owners WITH (security_invoker=true,security_barrier=true) AS
SELECT b.tenant_key AS tenant,b.store_key AS store,b.bot_key AS bot,b.owner_ref,b.recipient_ref,
       b.confirmed_challenge_id AS binding_id,c.requester_user_id AS owner_user_id
FROM tien404_r1_qa.owner_bindings b
JOIN tien404_r1_qa.tenant_identity_map m USING(tenant_key,store_key,bot_key)
JOIN tien404_r1_qa.owner_pairing_challenges c ON (c.tenant_key,c.store_key,c.bot_key,c.challenge_id,c.owner_ref)
    =(b.tenant_key,b.store_key,b.bot_key,b.confirmed_challenge_id,b.owner_ref)
JOIN tien404_r1_qa.owner_pairing_claims_v3 p ON (p.tenant_key,p.store_key,p.bot_key,p.challenge_id,p.recipient_ref)
    =(b.tenant_key,b.store_key,b.bot_key,b.confirmed_challenge_id,b.recipient_ref)
JOIN public.tenant_memberships t ON t.tenant_id=m.auth_tenant_id AND t.user_id=c.requester_user_id
WHERE b.status='paired' AND b.expires_at>clock_timestamp() AND c.used_at IS NOT NULL AND p.status='CONFIRMED'
  AND p.claimed_at<=c.expires_at AND p.confirmed_at>=p.claimed_at AND t.active AND t.role::text='owner';
CREATE TABLE sales_lite_qa.shop_access (
  tenant text NOT NULL, store text NOT NULL, bot text NOT NULL, enabled boolean NOT NULL,
  access_until timestamptz NOT NULL, alerts boolean NOT NULL DEFAULT false,
  PRIMARY KEY(tenant,store,bot),
  FOREIGN KEY(tenant,store,bot) REFERENCES tien404_r1_qa.shop_bots(tenant_key,store_key,bot_key)
);
CREATE TABLE sales_lite_qa.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK(code ~ '^T404-[0-9A-F]{16}$') DEFAULT ('T404-' || upper(left(replace(gen_random_uuid()::text,'-',''),16))),
  tenant text NOT NULL, store text NOT NULL, bot text NOT NULL,
  source text NOT NULL CHECK(source='qa_inbound'), actor_hash text NOT NULL CHECK(actor_hash ~ '^[a-f0-9]{64}$'),
  event_hash text NOT NULL CHECK(event_hash ~ '^[a-f0-9]{64}$'), quote_event text NOT NULL CHECK(quote_event ~ '^[a-f0-9]{64}$'),
  sku text NOT NULL, product_label text NOT NULL, quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 9999),
  unit_vnd bigint NOT NULL CHECK(unit_vnd BETWEEN 1 AND 9007199254740991),
  total_vnd bigint GENERATED ALWAYS AS (quantity::bigint*unit_vnd) STORED CHECK(total_vnd BETWEEN 1 AND 9007199254740991),
  status text NOT NULL DEFAULT 'NEW_PENDING_OWNER' CHECK(status IN ('NEW_PENDING_OWNER','OWNER_CONFIRMED','CANCELLED','PAID')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), revision integer NOT NULL DEFAULT 1,
  UNIQUE(tenant,store,bot,id), UNIQUE(tenant,store,bot,source,event_hash), UNIQUE(tenant,store,bot,source,quote_event),
  FOREIGN KEY(tenant,store,bot) REFERENCES sales_lite_qa.shop_access
);
CREATE INDEX requests_by_shop_date ON sales_lite_qa.requests(tenant,store,bot,created_at DESC,id);
CREATE INDEX requests_by_stock ON sales_lite_qa.requests(tenant,store,bot,sku) WHERE status IN ('OWNER_CONFIRMED','PAID');
CREATE TABLE sales_lite_qa.owner_alerts (
  tenant text NOT NULL, store text NOT NULL, bot text NOT NULL, request_id uuid NOT NULL,
  event_kind text NOT NULL DEFAULT 'request_saved' CHECK(event_kind='request_saved'), recipient_ref text, owner_ref text,
  channel text NOT NULL DEFAULT 'zalo_bot' CHECK(channel='zalo_bot'),
  state text NOT NULL DEFAULT 'HELD' CHECK(state IN ('HELD','SIM_ACCEPTED','SIM_UNKNOWN','SIM_RETRYABLE','SIM_REJECTED')),
  attempt_count int NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 3), last_outcome text,
  retry_after timestamptz, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(tenant,store,bot,request_id,event_kind),
  binding_id uuid,
  CHECK ((owner_ref IS NULL)=(recipient_ref IS NULL) AND (owner_ref IS NULL)=(binding_id IS NULL)),
  FOREIGN KEY(tenant,store,bot,request_id) REFERENCES sales_lite_qa.requests(tenant,store,bot,id)
);
CREATE TABLE sales_lite_qa.alert_attempts (
  tenant text NOT NULL, store text NOT NULL, bot text NOT NULL, request_id uuid NOT NULL,
  event_hash text NOT NULL, attempt_no integer NOT NULL CHECK(attempt_no BETWEEN 1 AND 3),
  outcome text NOT NULL CHECK(outcome IN ('API_ACCEPTED','TIMEOUT','NOT_ACCEPTED_RETRYABLE','REJECTED')),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(tenant,store,bot,event_hash), UNIQUE(tenant,store,bot,request_id,attempt_no),
  FOREIGN KEY(tenant,store,bot,request_id) REFERENCES sales_lite_qa.requests(tenant,store,bot,id)
);
ALTER TABLE sales_lite_qa.alert_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_lite_qa.alert_attempts FORCE ROW LEVEL SECURITY;
CREATE TABLE sales_lite_qa.decisions (
  tenant text NOT NULL, store text NOT NULL, bot text NOT NULL, request_id uuid NOT NULL,
  decision text NOT NULL CHECK(decision IN ('confirm','cancel')), owner_hash text NOT NULL, event_hash text NOT NULL,
  was text NOT NULL, became text NOT NULL, decided_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(tenant,store,bot,event_hash), UNIQUE(tenant,store,bot,request_id,decision),
  FOREIGN KEY(tenant,store,bot,request_id) REFERENCES sales_lite_qa.requests(tenant,store,bot,id)
);
-- Only the latest quote/decision facts for a QA actor; the signed proof never goes into this table.
CREATE TABLE sales_lite_qa.chat_sessions (
  tenant text NOT NULL, store text NOT NULL, bot text NOT NULL, actor_hash text NOT NULL,
  lane text NOT NULL CHECK(lane IN ('customer','owner')), last_ms bigint NOT NULL,
  pending jsonb, until_at bigint, last_code text, PRIMARY KEY(tenant,store,bot,actor_hash,lane),
  FOREIGN KEY(tenant,store,bot) REFERENCES sales_lite_qa.shop_access
);
CREATE TABLE sales_lite_qa.channel_receipts (
  tenant text NOT NULL, store text NOT NULL, bot text NOT NULL, event_hash text NOT NULL, actor_hash text NOT NULL,
  payload_hash text NOT NULL, lane text NOT NULL, code text, recorded_at timestamptz DEFAULT clock_timestamp() NOT NULL,
  PRIMARY KEY(tenant,store,bot,event_hash), FOREIGN KEY(tenant,store,bot) REFERENCES sales_lite_qa.shop_access
);
ALTER TABLE sales_lite_qa.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_lite_qa.chat_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_lite_qa.channel_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_lite_qa.channel_receipts FORCE ROW LEVEL SECURITY;
-- Only an independently verified payment source could supply this evidence in a later release.
CREATE TABLE sales_lite_qa.payment_evidence (
  tenant text NOT NULL, store text NOT NULL, bot text NOT NULL, request_id uuid NOT NULL, payment_ref text NOT NULL,
  amount_vnd bigint NOT NULL CHECK(amount_vnd>0), paid_at timestamptz NOT NULL CHECK(isfinite(paid_at)),
  verified boolean NOT NULL, PRIMARY KEY(tenant,store,bot,request_id), UNIQUE(tenant,store,bot,payment_ref),
  FOREIGN KEY(tenant,store,bot,request_id) REFERENCES sales_lite_qa.requests(tenant,store,bot,id)
);
-- A service role may only advance a request with matching evidence in the same scoped ledger.
CREATE FUNCTION sales_lite_qa.check_transition() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog AS $$
BEGIN
  IF NEW.status IN ('OWNER_CONFIRMED','CANCELLED') AND OLD.status='NEW_PENDING_OWNER'
     AND NEW.revision=OLD.revision+1 AND EXISTS (
       SELECT 1 FROM sales_lite_qa.decisions d
       WHERE (d.tenant,d.store,d.bot,d.request_id,d.was,d.became)=(OLD.tenant,OLD.store,OLD.bot,OLD.id,OLD.status,NEW.status)
     ) THEN RETURN NEW; END IF;
  IF NEW.status='PAID' AND OLD.status='OWNER_CONFIRMED' AND NEW.revision=OLD.revision+1 AND EXISTS (
       SELECT 1 FROM sales_lite_qa.payment_evidence p
       WHERE (p.tenant,p.store,p.bot,p.request_id)=(OLD.tenant,OLD.store,OLD.bot,OLD.id)
         AND p.verified AND p.amount_vnd=OLD.total_vnd AND p.paid_at BETWEEN OLD.created_at AND clock_timestamp()
         AND length(btrim(p.payment_ref))>0
     ) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Decision or payment evidence required' USING ERRCODE='23514';
END;
$$;
REVOKE ALL ON FUNCTION sales_lite_qa.check_transition() FROM PUBLIC;
CREATE TRIGGER enforce_request_transition BEFORE UPDATE OF status,revision ON sales_lite_qa.requests
FOR EACH ROW EXECUTE FUNCTION sales_lite_qa.check_transition();
-- For the future trusted evidence importer only. The merchant application has no EXECUTE grant.
CREATE FUNCTION sales_lite_qa.record_verified_receipt(
  p_tenant text,p_store text,p_bot text,p_code text,p_ref text,p_amount bigint,p_paid_at timestamptz
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE
  request sales_lite_qa.requests%ROWTYPE;
  prior sales_lite_qa.payment_evidence%ROWTYPE;
BEGIN
  SELECT * INTO STRICT request FROM sales_lite_qa.requests
    WHERE (tenant,store,bot,code)=(p_tenant,p_store,p_bot,p_code) FOR UPDATE;
  IF p_ref IS NULL OR length(btrim(p_ref)) NOT BETWEEN 1 AND 128 OR p_amount IS DISTINCT FROM request.total_vnd
     OR p_paid_at IS NULL OR NOT isfinite(p_paid_at) OR p_paid_at NOT BETWEEN request.created_at AND clock_timestamp()
    THEN RAISE EXCEPTION 'Incomplete evidence' USING ERRCODE='23514'; END IF;
  SELECT * INTO prior FROM sales_lite_qa.payment_evidence
    WHERE (tenant,store,bot,request_id)=(p_tenant,p_store,p_bot,request.id);
  IF FOUND THEN
    IF prior.payment_ref=p_ref AND prior.amount_vnd=p_amount AND prior.paid_at=p_paid_at
       AND prior.verified AND request.status='PAID' THEN RETURN 'ALREADY_RECORDED'; END IF;
    RAISE EXCEPTION 'Conflicting evidence' USING ERRCODE='23514';
  END IF;
  IF request.status<>'OWNER_CONFIRMED' THEN RAISE EXCEPTION 'Confirmation required' USING ERRCODE='23514'; END IF;
  INSERT INTO sales_lite_qa.payment_evidence(tenant,store,bot,request_id,payment_ref,amount_vnd,paid_at,verified)
    VALUES(p_tenant,p_store,p_bot,request.id,p_ref,p_amount,p_paid_at,true);
  UPDATE sales_lite_qa.requests SET status='PAID',revision=revision+1 WHERE id=request.id;
  RETURN 'RECORDED';
END;
$$;
REVOKE ALL ON FUNCTION sales_lite_qa.record_verified_receipt(text,text,text,text,text,bigint,timestamptz) FROM PUBLIC;
CREATE INDEX payments_by_shop_date ON sales_lite_qa.payment_evidence(tenant,store,bot,paid_at);
CREATE TABLE sales_lite_qa.settings_audit (
  tenant text NOT NULL, store text NOT NULL, bot text NOT NULL, event_hash text NOT NULL, owner_hash text NOT NULL,
  alerts boolean NOT NULL, changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(tenant,store,bot,event_hash), FOREIGN KEY(tenant,store,bot) REFERENCES sales_lite_qa.shop_access
);
ALTER TABLE sales_lite_qa.settings_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_lite_qa.settings_audit FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_lite_qa.shop_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_lite_qa.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_lite_qa.owner_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_lite_qa.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_lite_qa.payment_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_lite_qa.shop_access FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_lite_qa.requests FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_lite_qa.owner_alerts FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_lite_qa.decisions FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_lite_qa.payment_evidence FORCE ROW LEVEL SECURITY;
COMMIT;
