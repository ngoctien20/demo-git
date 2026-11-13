-- Private, no browser grants. The worker must pass the record/token returned by claim().
BEGIN;
CREATE FUNCTION notification_private.order_alert(p_id uuid,p_token uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('event_id',e.id,'order_id',o.id,'created_at',o.created_at,
   'status',o.status,'total_vnd',o.total_vnd::text,'channel',d.channel,'destination_ref',r.destination_id,
   'items',l.items)
 FROM notification_private.notification_outbox d
 JOIN notification_private.notification_events e ON (e.id,e.tenant_id)=(d.event_id,d.tenant_id)
 JOIN public.orders o ON (o.tenant_id,o.id)=(e.tenant_id,e.order_id)
 JOIN notification_private.routes r ON (r.tenant_id,r.channel,r.destination_id)=(d.tenant_id,d.channel,d.destination_id)
 JOIN public.tenant_memberships m ON (m.tenant_id,m.user_id)=(r.tenant_id,r.merchant_id)
 CROSS JOIN LATERAL (SELECT sum(i.quantity::numeric*i.unit_price_vnd) total,
   jsonb_agg(jsonb_build_object('sku',p.sku,'quantity',i.quantity,'unit_price_vnd',i.unit_price_vnd::text) ORDER BY p.sku) items
   FROM public.order_items i JOIN public.products p ON (p.id,p.tenant_id)=(i.product_id,i.tenant_id)
   WHERE (i.order_id,i.tenant_id)=(o.id,o.tenant_id)) l
 WHERE d.id=p_id AND d.claim_token=p_token AND d.status='sending' AND d.claimed_at>now()-interval '5 minutes'
   AND r.enabled AND r.verified AND r.consent AND m.active AND m.role IN ('owner','manager')
   AND o.status='pending' AND l.total=o.total_vnd AND d.channel IN ('telegram','gmail');
$$;
REVOKE ALL ON FUNCTION notification_private.order_alert(uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE VIEW notification_private.pending_without_event AS
 SELECT o.tenant_id,o.id order_id,o.created_at FROM public.orders o
 WHERE o.order_source='api' AND o.status='pending'
 AND NOT EXISTS(SELECT FROM notification_private.notification_events e WHERE (e.tenant_id,e.order_id)=(o.tenant_id,o.id));
REVOKE ALL ON notification_private.pending_without_event FROM PUBLIC,anon,authenticated;
COMMIT;
