-- Rollback for 30_store_bot_settings.sql. DROPS bot settings, FAQs and customer stage columns (data lost).
\set ON_ERROR_STOP on
BEGIN;
DROP FUNCTION IF EXISTS public.save_store_bot_settings(uuid,text,text,text,boolean,text[],timestamptz);
DROP FUNCTION IF EXISTS public.save_store_faq(uuid,uuid,text,text,boolean);
DROP FUNCTION IF EXISTS public.delete_store_faq(uuid,uuid);
DROP FUNCTION IF EXISTS public.set_customer_stage(uuid,uuid,text,timestamptz,text);
DROP FUNCTION IF EXISTS public.set_product_stock(uuid,uuid,integer,timestamptz);
DROP FUNCTION IF EXISTS app_private.t404_store_manager_tenant(uuid);
DROP TABLE IF EXISTS public.store_faqs;
DROP TABLE IF EXISTS public.store_bot_settings;
ALTER TABLE public.customers DROP COLUMN IF EXISTS note, DROP COLUMN IF EXISTS follow_up_at, DROP COLUMN IF EXISTS stage;
COMMIT;
