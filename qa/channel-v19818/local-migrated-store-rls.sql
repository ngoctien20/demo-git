-- TIEN404 V19.8.18 — LOCAL DISPOSABLE SUPABASE ONLY (AFTER V19.8.17).
-- Implements policies against the *actual migrated six-table fixture*.
-- No hosted migration; all merchant/Store IDs and prices are synthetic.
\set ON_ERROR_STOP on
BEGIN;
REVOKE ALL ON SCHEMA t404_v19817 FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA t404_v19817 TO authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA t404_v19817 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON t404_v19817.stores,t404_v19817.store_memberships,
 t404_v19817.products,t404_v19817.customers,t404_v19817.orders,
 t404_v19817.order_items,t404_v19817.conversations,t404_v19817.messages
 TO authenticated;
-- Authoritative authorization comes from DB membership, NOT JWT metadata.
CREATE POLICY v19818_member_self ON t404_v19817.store_memberships
 FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()) AND active=true);
CREATE POLICY v19818_active_store ON t404_v19817.stores
 FOR SELECT TO authenticated
 USING (active AND EXISTS (
 SELECT 1 FROM t404_v19817.store_memberships sm
 WHERE sm.tenant_id=stores.tenant_id AND sm.store_id=stores.id
 AND sm.user_id=(SELECT auth.uid()) AND sm.active=true
 ));
DO $policy$
DECLARE relation_name text;
BEGIN
 FOREACH relation_name IN ARRAY ARRAY[
  'products','customers','orders','order_items','conversations','messages'
 ] LOOP
  EXECUTE format(
  'CREATE POLICY v19818_store_read ON t404_v19817.%I FOR SELECT TO authenticated
     USING (EXISTS (
       SELECT 1 FROM t404_v19817.store_memberships m
       JOIN t404_v19817.stores s ON s.tenant_id=m.tenant_id AND s.id=m.store_id
       WHERE m.tenant_id=%I.tenant_id AND m.store_id=%I.store_id
       AND m.user_id=(SELECT auth.uid()) AND m.active=true AND s.active=true
     ))',relation_name,relation_name,relation_name);
 END LOOP;
END $policy$;
-- A person may be member of Tenant yet have no Store rights.
-- Fixture table is server-only, and intentionally NOT used by any Store RLS policy.
CREATE TABLE t404_v19817.qa_tenant_memberships(
 tenant_id uuid NOT NULL REFERENCES t404_v19817.tenants(id),
 user_id uuid NOT NULL, active boolean NOT NULL,
 PRIMARY KEY(tenant_id,user_id)
);
ALTER TABLE t404_v19817.qa_tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE t404_v19817.qa_tenant_memberships FORCE ROW LEVEL SECURITY;
REVOKE ALL ON t404_v19817.qa_tenant_memberships FROM PUBLIC,anon,authenticated;
-- The only Data API entry point for this UAT is SECURITY INVOKER, no write.
CREATE FUNCTION public.t404_v19818_read_store(
 p_store_id uuid,p_kind text
) RETURNS TABLE(resource_kind text,store_id uuid,resource_id uuid,probe text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog
AS $func$
 SELECT 'products'::text,p.store_id,p.id,p.price_vnd::text
 FROM t404_v19817.products p WHERE p_kind='products' AND p.store_id=p_store_id
 UNION ALL
 SELECT 'customers'::text,c.store_id,c.id,'customer'::text
 FROM t404_v19817.customers c WHERE p_kind='customers' AND c.store_id=p_store_id
 UNION ALL
 SELECT 'orders'::text,o.store_id,o.id,'order'::text
 FROM t404_v19817.orders o WHERE p_kind='orders' AND o.store_id=p_store_id
 UNION ALL
 SELECT 'order_items'::text,i.store_id,i.id,'item'::text
 FROM t404_v19817.order_items i WHERE p_kind='order_items' AND i.store_id=p_store_id
 UNION ALL
 SELECT 'conversations'::text,c.store_id,c.id,'conversation'::text
 FROM t404_v19817.conversations c WHERE p_kind='conversations' AND c.store_id=p_store_id
 UNION ALL
 SELECT 'messages'::text,m.store_id,m.id,'message'::text
 FROM t404_v19817.messages m WHERE p_kind='messages' AND m.store_id=p_store_id
$func$;
REVOKE ALL ON FUNCTION public.t404_v19818_read_store(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.t404_v19818_read_store(uuid,text) TO authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';
