-- Rollback for 10_leads.sql. Drops the RPC and the leads table (export leads first if any exist).
\set ON_ERROR_STOP on
BEGIN;
DROP FUNCTION IF EXISTS public.submit_lead(text,text,text,text,text,text,text,text);
DROP TABLE IF EXISTS app_private.web_leads;
COMMIT;
