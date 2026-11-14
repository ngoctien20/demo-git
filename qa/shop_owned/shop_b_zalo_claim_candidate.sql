-- Staging receiver for the verified Shop B bot only. Provision a separate
-- random 256-bit key in Vault and the n8n Header Auth credential before rollout.
CREATE FUNCTION public.qa_shop_b_zalo_claim(p_challenge uuid, p_code text, p_sender text, p_event text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  gate text;
  supplied text := current_setting('request.headers',true)::jsonb ->> 'x-tien404-pairing';
BEGIN
  SELECT decrypted_secret INTO gate FROM vault.decrypted_secrets WHERE name='qa_shop_b_zalo_claim_key';
  IF gate IS NULL OR length(gate) < 43 OR supplied IS NULL OR length(supplied)>256 OR
    extensions.digest(supplied,'sha256') <> extensions.digest(gate,'sha256') THEN
    RAISE insufficient_privilege;
  END IF;
  IF p_challenge IS NULL OR p_code IS NULL OR p_code !~ '^[0-9a-f]{32}$'
     OR p_sender IS NULL OR length(p_sender) NOT BETWEEN 1 AND 128
     OR p_event IS NULL OR length(p_event) NOT BETWEEN 1 AND 128 THEN RETURN false; END IF;
  RETURN tien404_r1_qa.claim_owner_pairing_v3_synthetic('qa-tenant-b','qa-store-b','qa-bot-b',
    p_challenge,p_code,
    'qa-recipient-' || encode(extensions.hmac('recipient:'||p_sender,gate,'sha256'),'hex'),
    'qa-event-' || encode(extensions.hmac('event:'||p_event,gate,'sha256'),'hex'));
END $$;
REVOKE ALL ON FUNCTION public.qa_shop_b_zalo_claim(uuid,text,text,text) FROM PUBLIC, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.qa_shop_b_zalo_claim(uuid,text,text,text) TO anon;
