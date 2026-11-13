CREATE TABLE notification_private.order_previews (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,actor_id uuid NOT NULL,sender_hash bytea NOT NULL,
 withdrawn boolean NOT NULL DEFAULT false, lines jsonb NOT NULL,expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',order_id uuid,
 FOREIGN KEY(tenant_id,actor_id) REFERENCES public.tenant_memberships(tenant_id,user_id),
 FOREIGN KEY(tenant_id,order_id) REFERENCES public.orders(tenant_id,id)
);
ALTER TABLE notification_private.order_previews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON notification_private.order_previews FROM PUBLIC,anon,authenticated;
