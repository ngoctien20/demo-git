-- Candidate extension of V11.5. Install after the base candidate in a fresh isolated DB.
BEGIN;
CREATE TABLE notification_private.routes (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  channel text NOT NULL CHECK (channel IN ('telegram','gmail','dashboard')),
  merchant_id uuid NOT NULL,
  destination_id uuid NOT NULL DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT false,
  verified boolean NOT NULL DEFAULT false,
  consent boolean NOT NULL DEFAULT false,
  PRIMARY KEY (tenant_id,channel),
  FOREIGN KEY (tenant_id,merchant_id) REFERENCES public.tenant_memberships(tenant_id,user_id)
);
ALTER TABLE notification_private.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_private.notification_events ADD FOREIGN KEY (tenant_id,order_id)
  REFERENCES public.orders(tenant_id,id), ADD UNIQUE (tenant_id,order_id,event_type);
ALTER TABLE notification_private.notification_outbox ADD COLUMN destination_id uuid;
-- A destination ID references a verified route version, never a raw chat ID or email.
-- Each approved shop currently corresponds to one store (tenant_id).
CREATE FUNCTION notification_private.on_saved_order() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE ev uuid; saved uuid;
BEGIN
  IF NEW.event_type <> 'checkout' THEN RETURN NEW; END IF;
  SELECT o.id INTO STRICT saved FROM public.orders o
    JOIN public.tenant_memberships m ON m.tenant_id=o.tenant_id AND m.user_id=NEW.actor_id
    WHERE o.tenant_id=NEW.tenant_id AND o.id::text=NEW.request_id AND o.status='pending'
      AND o.order_source='api' AND m.active AND m.role IN ('owner','manager')
      AND EXISTS (SELECT FROM app_private.order_idempotency i WHERE i.tenant_id=o.tenant_id AND i.order_id=o.id)
      AND o.total_vnd=(SELECT sum(i.quantity::numeric*i.unit_price_vnd) FROM public.order_items i
                       WHERE i.tenant_id=o.tenant_id AND i.order_id=o.id);
  INSERT INTO notification_private.notification_events
    (tenant_id,store_id,merchant_id,source_system,source_receipt_ref,order_id,
     order_version,event_type,event_id,saved_order_verified)
  VALUES (NEW.tenant_id,NEW.tenant_id,NEW.actor_id,'commerce',NEW.id::text,saved,
          1,'order_created',saved::text || ':created:1',true)
  ON CONFLICT (tenant_id,order_id,event_type) DO NOTHING RETURNING id INTO ev;
  IF ev IS NULL THEN RETURN NEW; END IF;
  INSERT INTO notification_private.notification_outbox
    (tenant_id,event_id,channel,recipient_verified,destination_id)
  SELECT NEW.tenant_id,ev,r.channel,true,r.destination_id
  FROM notification_private.routes r JOIN public.tenant_memberships m
    ON (r.tenant_id,r.merchant_id)=(m.tenant_id,m.user_id)
  WHERE r.tenant_id=NEW.tenant_id AND m.active AND m.role IN ('owner','manager')
    AND r.enabled AND r.verified AND r.consent;
  RETURN NEW;
END $$;
CREATE TRIGGER notification_saved AFTER INSERT ON app_private.audit_events
FOR EACH ROW EXECUTE FUNCTION notification_private.on_saved_order();

CREATE FUNCTION notification_private.claim(p_channel text)
RETURNS SETOF notification_private.notification_outbox LANGUAGE sql SET search_path='' AS $$
  WITH picked AS (
    SELECT o.id FROM notification_private.notification_outbox o
    JOIN notification_private.routes r ON (r.tenant_id,r.channel,r.destination_id)=(o.tenant_id,o.channel,o.destination_id)
    JOIN public.tenant_memberships m ON (m.tenant_id,m.user_id)=(r.tenant_id,r.merchant_id)
    WHERE o.channel=p_channel AND o.status='queued' AND o.attempts<o.max_attempts
      AND coalesce(o.next_retry_at,now())<=now() AND r.enabled AND r.verified AND r.consent
      AND m.active AND m.role IN ('owner','manager')
    ORDER BY o.created_at,o.id LIMIT 1 FOR UPDATE OF o SKIP LOCKED
  )
  UPDATE notification_private.notification_outbox o SET status='sending',attempts=attempts+1,
    claim_token=gen_random_uuid(),claimed_at=clock_timestamp(),updated_at=clock_timestamp()
  FROM picked WHERE o.id=picked.id RETURNING o.*;
$$;
CREATE FUNCTION notification_private.finish(p_id uuid,p_token uuid,p_outcome text,p_receipt text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('accepted','not_dispatched','ambiguous')
    OR (p_outcome='accepted' AND coalesce(length(trim(p_receipt)),0) NOT BETWEEN 1 AND 256) THEN
    RAISE EXCEPTION 'invalid outcome' USING ERRCODE='22023'; END IF;
  UPDATE notification_private.notification_outbox SET
    status=CASE WHEN p_outcome='accepted' THEN 'accepted' WHEN p_outcome='ambiguous' THEN 'needs_review'
                WHEN attempts>=max_attempts THEN 'failed' ELSE 'queued' END,
    next_retry_at=CASE WHEN p_outcome='not_dispatched' AND attempts<max_attempts THEN now()+attempts*interval '30 seconds' END,
    accepted_at=CASE WHEN p_outcome='accepted' THEN now() END,
    provider_message_id=CASE WHEN p_outcome='accepted' THEN p_receipt END,
    last_error_code=CASE WHEN p_outcome<>'accepted' THEN p_outcome END,
    claim_token=NULL, updated_at=now()
  WHERE id=p_id AND claim_token=p_token AND status='sending';
  RETURN FOUND;
END $$;
CREATE FUNCTION notification_private.expire_claims() RETURNS bigint LANGUAGE sql SET search_path='' AS $$
  WITH expired AS (UPDATE notification_private.notification_outbox SET status='needs_review',
    last_error_code='lease_expired',claim_token=NULL,updated_at=now()
    WHERE status='sending' AND claimed_at<now()-interval '5 minutes' RETURNING id)
  SELECT count(*) FROM expired;
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA notification_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA notification_private FROM PUBLIC,anon,authenticated;
COMMIT;
