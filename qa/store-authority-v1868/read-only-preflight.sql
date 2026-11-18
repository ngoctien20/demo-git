-- V18.6.8: SELECT-ONLY metadata report. Do not turn into DDL or run as a migration.
-- Never log auth tokens, secrets, emails, phone numbers, customer or order records.
SELECT current_setting('server_version') AS pg_version;
SELECT count(*) AS canonical_store_tables
FROM information_schema.tables
WHERE table_schema='public' AND table_name IN ('stores','store_memberships');
SELECT count(*) AS scoped_commerce_tables
FROM information_schema.columns
WHERE table_schema='public' AND column_name='store_id'
 AND table_name IN ('products','customers','orders','order_items','conversations','messages');
SELECT count(*) AS restrictive_rls_policies
FROM pg_policies WHERE schemaname='public' AND permissive='RESTRICTIVE';
SELECT c.relname AS table_name,con.conname AS constraint_name,pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='products' AND con.contype='u'
ORDER BY con.conname;
SELECT p.proname, p.prosecdef AS security_definer,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS auth_can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='save_merchant_product';
SELECT c.relname AS table_name, t.tgname AS trigger_name
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND NOT t.tgisinternal
 AND c.relname IN ('products','customers','orders','order_items','conversations','messages')
ORDER BY c.relname,t.tgname;
