# TIEN404 AI V12.5 — Messenger Clone QA: staging checkpoint

Date: 2026-11-15 JST. Scope: staging only. Direct model web chat is NOT LIVE.

## Original vs adapted clone
- Original: TIEN404_MESSENGER_TEST / Z7FdV7uDvApfbURQ / activeVersion d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92 / 27 nodes / Published unchanged.
- Adapted QA clone: TIEN404_MESSENGER_CLONE_QA_V12_5_CANDIDATE / 5Sw0ZDFRvrRjEfUZ / 8 nodes / Inactive / private Chat Trigger.
- Retained: gpt-5-mini, 14-turn memory, Vietnamese/English conversational and sales truth policies, confirmation-before-write behavior.
- Replaced: all Meta webhooks/HMAC/reply, DEMO order tools, support/customer identifiers with four Google Sheets tools bound exclusively to private pilot tester QA workbook: read Products, read Orders_QA, append Orders_QA, update Orders_QA.
- This is a business behavior clone, NOT a byte-for-byte reproduction and NOT full Messenger channel regression.

## QA evidence
- n8n workflow readback: Inactive, no active version, 4/4 tools reference the pilot QA workbook. No DEMO, Commerce or Meta sender node.
- n8n pin-only QA execution 3672 SUCCESS. This does not invoke real OpenAI nor Google Sheets and is not a model-response assertion.
- Tester Portal: 96 existing sanitized QA prompts, topics and expectations, copy-to-clipboard, manual response/execution-id collection, self-reported human QA. No browser n8n requests or other live sends.
- Supabase report case SHEET-MESSENGER-CLONE-001 READY. Authorized Tester RLS insert/readback passed inside rollback transaction; unapproved synthetic user visible rows 0; zero persisted real Messenger Clone reports.
- Feature PR #59 merged to work/supabase-auth-staging-v1, commit b14501a0ebf04d991302cb32b5d548a68d6b39bd.
- Render static staging deploy dep-dbsa4fl6e07s7399ab30 LIVE.
- Feature CI 43624046694 SUCCESS: 59/59 source and security, 29/29 build, Chromium Auth-mocked Tester positive report and secret guard.
- Postdeploy QA PR #60 merged, CI 43624469661 SUCCESS: 59 source tests, 29 build, 21 public HTTPS routes/assets HTTP200, 9 private resources HTTP404.
- No real model calls, no Gateway credits consumed, no Published workflows changed.

## Remaining acceptance gates / risks
1. BLOCKED: web Tester direct AI chat; no authenticated Supabase JWT proxy, hard model cost quota, rate/concurrency control, tenant mapping, server-only credentials, and reply QA ledger. Do NOT publish clone or attach a public webhook until these are tested.
2. BLOCKED: direct AI order writes lack atomic Google Sheets stock/price/idempotency guards. Test protocol prompt is not a transaction safety mechanism.
3. Original Messenger fresh-data risk remains: execution 2238 read and matched 21/21 Products, while 2240 answered with prices but did not invoke Sheets in that turn. See GitHub issue #57.
4. Tester Google Drive writer sharing survives Supabase expiry; manually revoke at/before 2026-11-21 22:00 JST. See issue #58.
5. Real user browser UAT of the new manual report and live model behavior not yet performed; do not mark completed end-to-end.

## Rollback
- GitHub checkpoint/v12-5-before-messenger-clone-tester-ui-20261115.
- Render previous deploy dep-dbs9dorl550s73fribrg.
- Clone workflow 5Sw0ZDFRvrRjEfUZ remains Inactive; no changes to existing Messenger Published workflow.
- New Supabase QA case is additive; do not delete records without approval.

## Open entrypoints
- Tester Portal: https://tien404-auth-staging.onrender.com/tester.html
- Internal QA clone: https://ngoctien20.app.n8n.cloud/workflow/5Sw0ZDFRvrRjEfUZ

## Next phase
Create a verified JWT/tenant-gated, rate- and cost-bounded AI proxy with server-side validated QA order mutations and live comparison evidence. No direct-public model access before owner approval of the budget.