-- Isolated candidate. Call with the merchant's signed JWT. No recipient data leaves this schema.
BEGIN;
CREATE TABLE notification_private.inbox_views (
  event_id uuid NOT NULL REFERENCES notification_private.notification_events(id),
  user_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(event_id,user_id)
);
ALTER TABLE notification_private.inbox_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON notification_private.inbox_views FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.merchant_notification_inbox(p_shop uuid)
RETURNS TABLE(event_id uuid, order_id uuid, created_at timestamptz, viewed_at timestamptz, deliveries jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT e.id,e.order_id,e.created_at,v.viewed_at, coalesce((
    SELECT jsonb_agg(jsonb_build_object('channel',o.channel,'status',o.status,'attempts',o.attempts,
      'last_error_code',o.last_error_code,'updated_at',o.updated_at) ORDER BY o.channel)
    FROM notification_private.notification_outbox o WHERE o.tenant_id=e.tenant_id AND o.event_id=e.id
  ),'[]'::jsonb)
  FROM notification_private.notification_events e
  JOIN public.tenant_memberships m ON m.tenant_id=e.tenant_id AND m.user_id=(SELECT auth.uid())
  LEFT JOIN notification_private.inbox_views v ON v.event_id=e.id AND v.user_id=m.user_id
  WHERE e.tenant_id=p_shop AND m.active AND m.role IN ('owner','manager')
  ORDER BY e.created_at DESC,e.id DESC LIMIT 100;
$$;
CREATE FUNCTION public.mark_merchant_notification_viewed(p_shop uuid,p_event uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  WITH allowed AS (
    SELECT e.id,m.user_id FROM notification_private.notification_events e
    JOIN public.tenant_memberships m ON m.tenant_id=e.tenant_id
    WHERE e.id=p_event AND e.tenant_id=p_shop AND m.user_id=(SELECT auth.uid())
      AND m.active AND m.role IN ('owner','manager')
  ), marked AS (
    INSERT INTO notification_private.inbox_views(event_id,user_id) SELECT * FROM allowed
    ON CONFLICT DO NOTHING
  ) SELECT EXISTS(SELECT FROM allowed);
$$;
REVOKE ALL ON FUNCTION public.merchant_notification_inbox(uuid),public.mark_merchant_notification_viewed(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.merchant_notification_inbox(uuid),public.mark_merchant_notification_viewed(uuid,uuid) TO authenticated;
COMMIT;
