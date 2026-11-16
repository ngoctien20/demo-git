-- TIEN404 V15.0-09C: asserts a RESTORED disposable Postgres17 database only.
-- NOT real hosted Supabase backup proof and NOT a signed Auth JWT.
\set ON_ERROR_STOP on
DO $assert$ DECLARE n integer; BEGIN
 IF (SELECT count(*) FROM public.tenants)<>2 THEN RAISE EXCEPTION 'tenants restore mismatch'; END IF;
 IF (SELECT count(*) FROM public.stores)<>3 THEN RAISE EXCEPTION 'stores restore mismatch'; END IF;
 IF (SELECT count(*) FROM public.store_memberships)<>4 THEN RAISE EXCEPTION 'store memberships restore mismatch'; END IF;
 IF (SELECT count(*) FROM public.products)<>3 THEN RAISE EXCEPTION 'products restore mismatch'; END IF;
 IF (SELECT count(*) FROM public.orders)<>2 THEN RAISE EXCEPTION 'orders restore mismatch'; END IF;
 IF (SELECT count(*) FROM public.order_items)<>0 THEN RAISE EXCEPTION 'order items restore mismatch'; END IF;
 IF (SELECT count(*) FROM public.products WHERE sku='A002')<>3
 THEN RAISE EXCEPTION 'per Store duplicate SKU missing after restore'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
 WHERE n.nspname='public' AND c.relname='products' AND c.relrowsecurity AND c.relforcerowsecurity)
 THEN RAISE EXCEPTION 'product RLS/FORCE RLS not restored'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies
 WHERE schemaname='public' AND tablename='products'
 AND policyname='products_store_guard' AND permissive='RESTRICTIVE')
 THEN RAISE EXCEPTION 'restrictive store policy not restored'; END IF;
 IF (SELECT count(*) FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
 JOIN pg_namespace n ON n.oid=t.relnamespace
 WHERE n.nspname='public' AND t.relname='order_items' AND c.contype='f')<>2
 THEN RAISE EXCEPTION 'composite cross store FK not restored'; END IF;
 RAISE NOTICE 'PASS SYNTHETIC BACKUP RESTORE 2 tenants/3 stores/4 memberships/3 products/2 orders/0 items + RLS + FK';
END $assert$;
SET ROLE qa_authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',false);
DO $rls$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM public.products;
 IF n<>1 THEN RAISE EXCEPTION 'restored owner A access wrong: %',n; END IF;
 IF EXISTS(SELECT 1 FROM public.products WHERE price_vnd=209000)
 THEN RAISE EXCEPTION 'restored owner A can see B'; END IF;
 RAISE NOTICE 'PASS RESTORED RLS: simulated A sees only A, not B';
END $rls$;
RESET ROLE;
