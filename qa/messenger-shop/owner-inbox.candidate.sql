-- Candidate for isolated staging. Review role grants before installation.
BEGIN;
CREATE FUNCTION public.qa_owner_inbox(p_store uuid)
RETURNS TABLE (order_key text, sku text, quantity integer, total_vnd bigint, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $inbox$
  SELECT o.order_key, o.sku, o.quantity, o.total_vnd, o.created_at
  FROM public.stores s
  JOIN public.store_memberships sm ON sm.store_id=s.id AND sm.tenant_id=s.tenant_id
  JOIN tien404_r1_qa.tenant_identity_map m ON m.auth_tenant_id=s.tenant_id AND m.store_key=s.store_key
  JOIN tien404_r1_qa.shop_bots b ON (b.tenant_key,b.store_key,b.bot_key)=(m.tenant_key,m.store_key,m.bot_key)
  JOIN tien404_r1_qa.owner_bindings p ON (p.tenant_key,p.store_key,p.bot_key)=(b.tenant_key,b.store_key,b.bot_key)
  JOIN tien404_r1_qa.owner_pairing_challenges c
    ON (c.tenant_key,c.store_key,c.bot_key,c.challenge_id)=(p.tenant_key,p.store_key,p.bot_key,p.confirmed_challenge_id)
  JOIN tien404_r1_qa.sandbox_orders o ON (o.tenant_key,o.store_key,o.bot_key)=(p.tenant_key,p.store_key,p.bot_key)
  WHERE s.id=p_store AND sm.user_id=auth.uid() AND sm.active AND sm.role='owner'
    AND b.identity_status='synthetic_qa' AND b.enabled_mode='dry_run'
    AND p.status='paired' AND p.expires_at>now() AND c.requester_user_id=sm.user_id AND c.used_at IS NOT NULL
    AND o.created_at>=p.paired_at AND EXISTS (
      SELECT 1 FROM tien404_r1_qa.owner_outbox x
      WHERE (x.tenant_key,x.store_key,x.bot_key,x.order_key)=(o.tenant_key,o.store_key,o.bot_key,o.order_key)
        AND x.recipient_owner_ref=p.owner_ref AND x.recipient_ref=p.recipient_ref
    )
  ORDER BY o.created_at DESC,o.order_key LIMIT 100
$inbox$;
REVOKE ALL ON FUNCTION public.qa_owner_inbox(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.qa_owner_inbox(uuid) TO authenticated;
COMMIT;
