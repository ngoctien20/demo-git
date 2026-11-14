# TIEN404 AI — V12 R1 / Owner JWT Gate & n8n Adapter Contract (14/11/2026 JST)

**Classification:** IMPLEMENTED + TESTED on Supabase/n8n staging; NOT RELEASED.  
**Base:** draft PR #34, `work/v12-r1-shop-owned`. Supersedes no existing live work.  
**No live Zalo sends, no Messenger modifications, no real Orders writes or subscription/credential changes.**

## VERIFIED — audit first
- Supabase `tien404-staging` project `ifxlvrhyjhbzbrkdsida`: public tenants `qa-staging-shop-a-20261110` and `qa-staging-shop-b-20261110`, Owner memberships active.
- Private `tien404_r1_qa` schema from prior checkpoint contains synthetic bots/orders/outbox; RLS already on, no `anon`/`authenticated` schema `USAGE` or function `EXECUTE`.
- n8n personal project `WW82YsCCaAxGC9dp` has synthetic registry table `qLf19z9QjEaIHk00` with Shop A/B, previously tested.
- No dedicated Supabase/DB credential present in n8n credential metadata. Do not reuse generic Header Auth or any existing bot credential.
- Draft PR #34 had staged PostgreSQL schema evidence and SQLite QA. No merge was performed.

## IMPLEMENTED — private staging only
1. `tien404_r1_qa.tenant_identity_map` — binds each QA bot/store/tenant triple to the corresponding *existing QA-only* Supabase tenant UUID. No production tenant data changed. RLS enabled; no frontend grants.
2. `tien404_r1_qa.owner_authorized_qa(tenant_key,store_key,bot_key)` — SECURITY INVOKER, checks request JWT role='authenticated', `auth.uid()`, active `public.tenant_memberships` with role `owner`, matching QA tenant/bot mapping and `dry_run` mode. It does not take user ID or Owner role from user payload.
3. `tien404_r1_qa.pair_owner_authorized_qa(...)` — SECURITY INVOKER QA-only wrapper. Requires `owner_authorized_qa`, derives `owner_ref` from matching, unexpired pairing challenge and forwards to single-use hash-checked pairing routine. It does not trust a supplied `owner_ref`.
4. n8n manual-only `TIEN404_R1_SUPABASE_ADAPTER_CONTRACT_QA` workflow ID `JsRXB0B9wGkWByW9`, in `90_QA - DIAGNOSTICS`. Reads existing Registry QA. Has 3 nodes, no auth credentials, HTTP nodes, webhook, order write or Zalo sender. Output explicitly says `AWAIT_SIGNED_JWT_BACKEND_AND_SERVER_CREDENTIAL`. Execution data retention disabled after QA.

**SQL reference only:** `qa/shop_owned/supabase_r1_owner_jwt_gate_candidate.sql` (not automatic migration, no tenant/user UUIDs or secrets in repo).

## TESTED — evidence
**Supabase SQL simulated auth claims:** `owner_authorized_qa` 8/8 PASS.
- No claim rejected.
- Shop A owner passes Shop A, denied Shop B.
- Mixed Bot/store denied.
- Shop B owner passes Shop B, denied Shop A.
- `anon` claim, unknown owner denied.

**Supabase simulated JWT-gated pairing:** 8/8 PASS.
- Missing auth, cross-Shop, cross-Bot, wrong code denied.
- Correct Owner A/B pairing accepted only with matching challenge.
- Used challenges cannot replay.

**PostgreSQL role-based RLS read-only test:**
- `SET LOCAL ROLE authenticated` + synthetic `request.jwt.claim.sub` for Owner A: own QA tenant membership=1, cross-Shop B=0.
- Owner B: own QA tenant membership=1, cross-Shop A=0.
- Nonmember sub: visible membership rows=0.
- `SET LOCAL ROLE anon` SELECT `tenant_memberships` returns permission denied.
- All are **SQL-session simulated claims, not cryptographically signed HTTP JWTs**.

**n8n:** execution `3060` SUCCESS — 14/14 mapping/price/confirmation/stock/isolation contract assertions. Workflow stayed Inactive, has no Supabase network access and performed zero real or sandbox order writes.

**Existing PostgreSQL QA:** 2 QA bots; 2 paired Owners; 3 pre-existing sandbox orders; 3 outbox records HELD, all tagged `SEND_DISABLED`. This phase did not create new orders.

## BLOCKED — do not overclaim
1. **Signed JWT HTTP E2E not yet tested.** The SQL connection can set `request.jwt.claim.*` without cryptographic verification. Do not expose private QA routines to clients based solely on SQL tests.
2. **n8n-to-Supabase real integration not yet connected.** There is no dedicated scoped staging credential or authorized server-side gateway. Never copy `service_role` into frontend, prompt, logs, or unvetted workflow.
3. **No live Owner Pairing UI or verified Zalo webhook exchange.** Client-side Owner authentication must be checked through the real signed JWT session by an approved backend.
4. No automated sender allowed. No real Orders/Products writes. No migration has been merged or auto-applied.
5. Supabase security advisor preexisting warnings: authenticated `SECURITY DEFINER` RPC `public.save_merchant_product` and leaked-password protection feature. Review separately before any auth permission change.

## Next gated tasks (staging only)
- Review backend architecture and deploy a **signed JWT verification boundary** using existing trusted Auth (validate issuer/audience/expiry/signature, then active DB membership). Verify invalid/expired/cross-tenant JWT negative cases through real HTTP with staging QA accounts.
- Establish least-privilege, server-side n8n → backend credential or short-lived scoped exchange. Explicit approval required for actual credential modification; do not use public `service_role` key.
- Connect `Chat → confirmation → signed backend → isolated QA `commit_order_qa` → HELD Outbox` with backend evidence and idempotency; preserve current live Zalo and Messenger.
- Add audit of pairing lifecycle, revocation, concurrency, unknown delivery, expiry; repeat two-shop negative tests before proposing any live send.

## Checkpoint & rollback
- Source draft PR #34 only; branch `work/v12-r1-shop-owned`. No merges/deployments to website or production.
- New SQL artifacts limited to `tien404_r1_qa`; leave data in place while QA. Removing requires a separate explicit approval after dependency review.
- Disable/keep inactive n8n workflow `JsRXB0B9wGkWByW9` for rollback. No production workflow changes required.
- Keep Zalo `ZALO_SEND_ENABLED=false`, no auto-reply integration, and existing D1 TEST 09 claim intact.
