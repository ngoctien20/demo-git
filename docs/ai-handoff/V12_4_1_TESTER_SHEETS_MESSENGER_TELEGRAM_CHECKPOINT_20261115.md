# TIEN404 AI — V12.4.1 Tester Google Sheets pilot and channel audit

**Checkpoint:** 2026-11-15 JST. **Environment:** STAGING only. No change to production `gh-pages` or any Published n8n workflows.

## Implemented and verified

- A separate QA-only Google Sheets workbook was copied from the 21-product QA template for **one** approved, confirmed, non-admin Tester with an active Sheets assignment. It has `Products` (21 rows) and `Orders_QA` (header only) with no Customers tab. The copy is NOT `AI_SALES_DEMO`.
- Drive writer share was granted to that one approved Tester. Share acceptance on their Google account still requires human sign-in. **Drive ACL does not automatically expire** when Supabase access expires (currently 2026-11-21 13:00 UTC / 22:00 JST); manual owner revocation is required.
- The existing unpublished, inactive n8n QA agent workflow `8HtaQAJuZWKyNhXu` had all FOUR Google Sheets tools atomically switched from the common QA template to the tester's own copy; readback confirmed 4/4 point to the same independent QA workbook. Model `gpt-5-mini` has NOT been executed; no Gateway credits consumed. The original DEMO/Main/Messenger workflows were untouched.
- The private manual-only n8n `TIEN404_QA_TESTER_PILOT01_SHEET_HEALTH_V12_4` workflow `cflgNO9ezFVgMIWF` uses existing Google Sheets OAuth credentials to read the same tester workbook. Execution **3668** verified 21 products, 21 unique SKUs, price/stock integrity, 0 errors.
- A QA-only read-after-write test temporarily changed `Products!D2` for SKU `A002` **25 → 24 → 25**, modifying no other columns. Execution **3669** captured stock **24**, execution **3670** captured restored stock **25**. Final Google Sheets readback confirms `A002` price 159000, stock 25. The first polling attempt was prematurely evaluated before n8n runData appeared; corrected by reading completed execution.
- Supabase staging migration `tien404_v12_4_1_tester_private_google_sheet_binding` added `tien404_tester_google_sheets`, one `SELECT` RLS policy for current approved tester + Sheets assignment + expiry, no browser writes. Approved actor sees one binding; unauthorized UID sees zero; anon has no select. One valid binding exists.
- Tester Portal V12.4.1 shows **Mở Google Sheets QA của tôi** only after authenticated RLS read, and keeps the 96 random questions. The old Supabase-only product/order editor is retained but collapsed and marked **NOT synced** to Google Sheets.
- Feature PR #55 merged source `70b3ab4dfae0ec4ae884917a1a4567077bbb7399`; Render deploy `dep-dbs9dorl550s73fribrg` LIVE. QA-only PR #56 merged source `98eb43271dc51bc82810b66241bb5f60908da37d`.
- CI `43619905954` SUCCESS: 54 source/security cases, 24 build cases and Chromium Tester Auth mock. Postdeploy CI `43620074295` SUCCESS: 54/54 source, 24/24 preview, 2/2 hosted HTTPS, 20 HTTP200 assets/routes, 7 private files blocked. Public JS has no hardcoded private Sheet ID.
- Final staging DB snapshot shows existing 21 Supabase QA products and 1 Supabase QA order. These **remain separate** from the personal Google Sheet, which has 21 Products and **0** Google Orders_QA rows. No migration of existing Tester order was attempted.

## Channel source-of-truth audit (read-only)

- **Messenger**: Published workflow `Z7FdV7uDvApfbURQ` active; its `Read Products - Messenger Read Only` points to **AI_SALES_DEMO** (`1flbUFHb6ybJVLnnXTf3FQD70YNtd6MneL_xVpPYsscE`). Execution **2238** actually called the Sheet tool; 21 product rows were returned and ALL 21 matched current DEMO SKU, price_clean and stock. Bot declined invalid SKU; Messenger send got provider acceptance. This verifies that one historical lookup, NOT every message. Some later executions (e.g. **2240**) replied with prices without invoking the Sheet tool, so fresh-data guarantee remains unproven; risk of stale cached replies.
- **Telegram**: `spk9Cs62YidlQ1vu` is manual-only/inactive **outbound owner notification dispatcher**, NOT an inbound product-question chatbot. Execution **2686** successfully sent a synthetic QA message with provider acknowledgment and persisted state. No evidence that chatting with Telegram bot invokes AI SALES Products lookup. Do not claim Telegram supports product advice.
- **QA model**: `8HtaQAJuZWKyNhXu` points only to private Tester QA Google Sheet and stays **INACTIVE/CANDIDATE**, not integrated into the public Tester Portal direct chat. The Google Sheet changes are visible to OAuth sheet reader as verified by 3669/3670, but LLM answers/writes remain untested.
- Messenger/Telegram do NOT use the tester QA Sheet. Do not change their production configurations without separate gate.

## Remaining risks and approval gates

1. **P1** Drive writer permission survives Supabase Tester expiry: manually revoke on or before grant expiry. No Drive revoke action is exposed by the current connector.
2. **P1** Messenger sometimes answers with no fresh Sheets tool invocation; create regression tests for price/stock changes before changing Published workflow.
3. **P1** n8n QA model has direct Google Sheets append/update tools with no atomic pricing/stock validation. Keep inactive and do not expose via tester webhook until server-side validation, JWT ownership, rate limits and model-cost cap are tested.
4. **P1** Local Supabase QA CRUD and Google Sheets QA are separate; no automatic 2-way sync. The UI states this explicitly. Consider retiring the secondary editor or adding a signed per-tenant synchronization adapter with audit/idempotency.
5. User acceptance with the actual Google account (Drive invitation + edit one product and verify it) is still pending. Automated Chromium uses Auth mocks, not user credentials.

## Rollback

- Prior website staging checkpoint `checkpoint/v12-4-before-tester-sheets-bridge-20261115` and preceding Render deploy `dep-dbs8r649v7es73c1klr0`.
- Prior n8n QA model version `ed47ce61-b229-4619-b3af-ff226441c02d`; original SDK file `qa/n8n/AI_SALES_QA_SANDBOX_V12_4_CANDIDATE.sdk.ts`; the updated pilot SDK is `qa/n8n/AI_SALES_QA_SANDBOX_V12_4_TESTER_PILOT01.sdk.ts`.
- DB mapping change is additive; do not delete any data without approval. Revoking Google Drive share must be performed by the owner separately if pilot is stopped.
- No real Orders, production tenant data, Messenger/Zalo sends, Telegram automation or published n8n workflow changes.
