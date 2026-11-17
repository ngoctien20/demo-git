# TIEN404 — V17.7H.4T Zalo Customer Ingress × Trusted Installation Join Audit

2026-11-18 JST · VERIFIED n8n READ-ONLY · SOURCE-ONLY FIXTURE QA · REAL COMMERCE NO-GO

## 1. Start from real customer UAT, not a rebuilt Bot
- Existing Zalo Bot Creator "Bot TIEN404 AI" continues on published n8n LAB `yIJk8LvJoLF40Z62`, protected webhook configured with header-auth. No webhook/token changed.
- Customer sent `TIEN404 EXT 03` to the existing bot. n8n QA marker updated at 2026-11-17T15:59:59.554Z = 2026-11-18 00:59:59 JST: `v123_ext03_ingress=SEEN_AUTHENTICATED_WEBHOOK`, `v123_ext03_customer=CUSTOMER_ROUTE_ELIGIBLE`, `v123_ext03_route=CUSTOMER_ROUTE_ELIGIBLE`.
- `owner_gate=denied` at 2026-11-17T16:00:00.060Z and `v1_ingress_any=ACCEPTED` at 16:00:00.457Z; **QA marker writes happened**. Do not assert the entire ingress pipeline had zero writes.
- Internal Shared Core Shadow #5098 → Commerce Sandbox #5099 → Commerce Tenant Resolver #5100 succeeded as **executions**, with `denied=1`, `provider_sends=0`, `commerce_writes=0`, `stock_writes=0`, `model_calls=0`, and `unknown_or_duplicate_channel`/`unregistered_or_disabled_channel`. Success does not mean an authorized store was resolved.
- Real webhook parent body #5089 is not retrievable through connected tools; original sender identity and message content cannot be independently asserted from these child runs. Do not store chat IDs, phone, order numbers or tokens.

## 2. Root cause found in published workflow code
- **NOT a spontaneous bug:** `4ycmVzaNzVRulBjQ` published Code node `Strip All Customer Fields and Require NO STORE` intentionally maps incoming `zalo_bot` to `zalo_oa`, sets accountId `__V1715_NO_REAL_STORE_BINDING__`, erases PII and asks the actual Commerce Resolver to reject.
- This node is a **technical negative-control shadow**, not a real `zalo_bot` adapter. Do not "fix" it by bypassing No-Send or changing its fallback to a real Store. Preserve it as regression safety.
- `TIEN404_COMMERCE_CHANNELS` n8n table has six rows and **zero `channelType=zalo_bot`**; the only `zalo_oa` record for the main demo is disabled/not_connected. The current registered Messenger/Website sandbox records do not authorize a Bot.
- `TIEN404_G05_QA_TRUSTED_INSTALLATION_REGISTRY_NO_SEND` has seven rows, all `qa_only=true`, `approval_scope=QA_SYNTHETIC_NO_REAL_OWNER` — an active synthetic `ZALO_BOT` install ref `QA_BOT_ROUTE_A` is not the actual Bot Creator owner's attestation.
- `TIEN404_V172_QA_BOT_PROFILES` contains a synthetic `zalo_bot` profile ref `QA_ZALO_BOT_A`, which does not equal the G05 QA install ref `QA_BOT_ROUTE_A`. Different ID namespaces and Tenant/Store representations cannot be silently joined.
- `TIEN404_R1_SHOP_BOT_REGISTRY_QA` has only two `zalo_bot_fixture` dry-run mappings. LAB `Bind Trusted Staging Bot Identity V12.3` hard-codes synthetic `b/route-b`; this is QA identity, not an authoritative real Bot ID.
- `TIEN404_V171C_QA_INSTALLATION_BOT_BINDINGS_NO_SEND` contains Messenger-only synthetic rows and `owner_authority_verified=false`. No real Store authority can be inferred.
- **No real cross-channel customer identity link** and no same-Tenant Store A/B RLS JWT acceptance. Existing PR #383 has the same hosted Store/Customer NO-GO decision.

## 3. What this source-only child implements
- New `v17-7h4t-zalo-customer-boundary-readonly.mjs`: interprets sanitized customer marker + Shadow telemetry, confirms the intentionally coerced technical channel is *not a live route*, then separately checks exact `zalo_bot` (never OA) QA channel/install/profile joins, revocation, expiration, Store/Tenant/version match and synthetic-only constraints. Missing or duplicate channel is NO-GO; even a perfectly matching synthetic fixture returns no real permission.
- New negative tests for owner escalation, extra PII claims, cross-Store profile, wrong Tenant, paused Store, revoked install, fake owner, Bot/OA conflation and no-send regressions.
- GitHub Actions runs this source-only suite plus **inherited PR #383 source QA**; no workflow/node edit or real event replay.
- All tests use synthetic values; source never contacts Bot Creator, Supabase, n8n or Messenger.

## 4. Real unblockers — exact order
1. **Identity / ingress:** reuse existing authorized private Bot `getMe`/webhook metadata inspection from parent PR #381 and historical evidence in #373. Confirm current Bot identity and n8n header-auth mapping in a trusted private verifier; do not put Bot Token/Secret or chat IDs in ChatGPT/GitHub. Verify replay/dedup and input parsing.
2. **Trusted installation:** server-owned real Bot installation with independent Owner proof, exact bot provider ID → canonical Tenant + Store + Bot Profile mapping; version and expiry. NOT inferred from QA string IDs, Zalo QR, sender phone or `zalo_oa`.
3. **Store authority:** approved canonical Store schema and RLS / actual JWT A/B negative acceptance. Existing public commerce `store_id` missing; no real order/customer reads until fixed and verified.
4. **Customer authorization:** separate identity proof of Messenger PSID and Zalo user ID through short-lived one-time customer consent, not matching phone, order code or name. Store+Customer ownership proven before a real order status query.
5. **Customer reply:** explicitly approve bounded outbound Zalo Bot sends after independently verified provider-native ingress, real Store RLS, one-event no-send canary and guarded delivery test; do not open output from the existing Shadow.
6. **Pricing / stock:** current `F01` snapshot is stale (2026-11-14T12:41:35Z vs 3-hour TTL); do not use it for a product quote or real order.

## 5. Source CI verified and exact evidence
- Draft PR **#389**, child of existing PR #383, remains OPEN/DRAFT, NO MERGE or hosted deployment.
- GitHub Actions run [#44122184485](https://github.com/ngoctien20/demo-git/actions/runs/44122184485) at source HEAD `71c6c0053028fe44cd4d1119dcd6cd6c61ea10dc`: **91/91 Node tests PASS (33 new + 58 inherited), 0 FAIL**; offline source-only, not a live Bot/Store registration or JWT authentication.
- Test gate asserts Shadow technical denial, no provider sends, no order reads and no channel registry shortcut. Existing n8n published workflows, QA marker logs, token and Cloudflare untouched.
- The unrelated RPC10 CI issue and Supabase Free staging backup/restore gate remain independent.

## 6. Permission and rollback
No Supabase schema migration, n8n Data Table insert/update, existing workflow draft/publish, Cloudflare route, Access Allow, R2, credentials or Bot token change, Messenger/Zalo sends, real order reads/writes, billing or paid resource. QA marker records from customer's earlier test are preserved. Existing RPC17.8E backup gating remains independent.

Rollback: close Draft PR; all connected runtime remains as it was.

VERIFIED: current published code/QA registry/execution and customer marker metadata (without customer PII).
IMPLEMENTED: source-only boundary gate and negative QA.
BLOCKED: real Bot installation owner, exact Store mapping, RLS JWT A/B, real customer identity, real order status, reply.
NEXT: operator-approved private Bot identity/installation evidence then canonical Store UAT. No repeated customer test needed until one of those changes.

Checkpoint: V17_7H4T_CUSTOMER_MARKER_CONFIRMED__INTENTIONAL_OA_SHADOW_DENIAL__ZALO_BOT_REGISTER_MISSING__REAL_COMMERCE_NO_GO.

## V17.7H.4U — Follow-up resolving Bot Creator numeric ID blocker
- Owner had confirmed the current Zalo Bot Creator did not display a numeric Bot ID, so PR #381's pre-pinned ID prerequisite blocked private operator use.
- Added **new** read-only **one-method** private `getMe` identity discovery in `qa/v17-7a-oa-independent/v17-7h4u-private-bot-id-discovery.mjs` and masked-token Windows launcher `scripts/v177h4u-private-bot-id-discovery.ps1`. Reuses the PR #381 exact-host HTTPS transport; no new provider adapter or webhook changes.
- Local private operator may view numeric Bot ID returned by Zalo; must not paste it, token, raw transcript or webhook URL in ChatGPT/GitHub. Source-only tests cannot verify a real Bot Creator owner, Store authority or provider identity.
- See `docs/ai-handoff/V17_7H4U_WINDOWS_PRIVATE_BOT_ID_DISCOVERY_NOHOST.md` for Windows usage, consent, privacy, caveats and rollback.
- **Additional hard NO-GO**: getMe token access != human Bot ownership, Store JWT/RLS, customer consent or permission to send/issue orders. No live getMe invoked in CI.
