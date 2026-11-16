-- TIEN404 RPC.11 — OPERATOR-ONLY read-only four-row metadata inventory.
-- DO NOT RUN IN PUBLIC GITHUB ACTIONS, CHATS OR UNAPPROVED ACCOUNTS.
-- NEVER export the result, row UUIDs, or tenant UUIDs to public GitHub/ChatGPT.
-- Run only as an explicitly authorized private operator, without service_role
-- bypass and with a separate independently authorized reviewer.
-- This SELECT does not prove Store ownership. Source-of-truth must be reviewed
-- separately; at this milestone the hosted public.stores table is absent.
BEGIN TRANSACTION READ ONLY;
SELECT 'products' AS source_table, id AS row_id, tenant_id, updated_at
 FROM public.products
UNION ALL
SELECT 'orders' AS source_table, id AS row_id, tenant_id, updated_at
 FROM public.orders
ORDER BY source_table,tenant_id,row_id;
COMMIT;
-- WARNING: result may include sensitive internal IDs. Keep it PRIVATE.
-- Never infer Store ID from Tenant owner, SKU, order_source or generated QA IDs.
-- A current source digest must be generated under the approved private
-- evidence process, not copied from a fabricated or untrusted JSON packet.
