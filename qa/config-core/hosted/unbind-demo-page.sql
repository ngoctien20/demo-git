-- Undo bind-demo-page.sql: disable the demo Page connection (assistant + version history are kept,
-- published versions are immutable by design). get_channel_menu then returns NULL -> bridge = legacy.
\set ON_ERROR_STOP on
BEGIN;
UPDATE public.channel_connections SET status='disabled', updated_at=now()
 WHERE channel='messenger' AND external_account_id='2379295362359912';
SELECT 'T404_CC20_DEMO_UNBOUND' AS marker;
COMMIT;
