-- Rollback of 20_channel_menu_read.sql (drops the anon-readable menu function only).
\set ON_ERROR_STOP on
BEGIN;
DROP FUNCTION public.get_channel_menu(text,text);
SELECT 'T404_CC20_ROLLBACK_OK' AS marker;
COMMIT;
