# TIEN404 AI — V17.2C.34 Protected Order Writer Authorization Contract × Legacy Demo Isolation × Cross-Channel Identity Proof QA

Date: 2026-11-18 JST. Parent Draft PR #392. Depends on V17.2C.31–33 and P1 tracking #402/#403.
User explicitly chose **Option A: isolated source/ephemeral PostgreSQL QA, no Supabase Pro upgrade, branch creation, hosted UAT, customer data writes or added Supabase branch fees**.

## 1. VERIFIED starting evidence (read-only sources, no live executions)
- V17.2C.33 audited actual n8n Published/Draft graphs:
  - Active Messenger `Z7FdV7uDvApfbURQ` contains legacy Google Sheets workflows: Create `KrSn4DNR9ALX5ng4`, Manage `fDB9dvs1qPPVt9Sp`, Update Address `BkAi6TVUKAjCnI7v`, Status `4DFFCk60exrzaIl6`.
  - Three order writers have **distinct Draft vs Published** version IDs; none of the published trigger contracts include a trusted canonical tenant_id/store_id. Phone/order_id/expected_total do not establish independent Store or cross-platform identity.
  - Current Commerce Tenant Resolver `5Eeh8hbpsoNhuiVo` is tenant-only, Zalo private QA router `sIPs6egzIwOY1GNv` is store-aware in synthetic read-only scope, and the signed channel installation G06 is inactive. There is NO proven production order writer with a trusted Store binding.
- Supabase staging metadata: `public.orders`/`order_items`/`products`/`customers` are tenant-scoped with no store_id. No canonical store membership or Store-scoped order RLS in public Commerce yet. Direct authenticated writes to Orders are denied; privileged server writers must still implement their own authorization.
- The V17.2C.32 Postgres 17 preview is a **synthetic** new schema, not a remote migration. V17.2C.33 signed provider-to-Store binding contract explicitly outputs `INTERNAL_READONLY_BINDING_NO_ORDER_AUTH` and `canWriteOrder:false`; it CANNOT be upgraded by a caller simply presenting a receipt.
- Current Supabase guidance: service_role/secret keys bypass RLS. Privileged writers must check trusted Store and actor authority inside the transaction and must never expose server keys to clients. https://supabase.com/docs/guides/database/postgres/row-level-security

## 2. IMPLEMENTED SOURCE ONLY — Draft PR #392
### A. `v172c34-cross-channel-identity-proof-gate.cjs`
- Private `getPrivateProof` / `verifySignedLinkProof` adapters, not live provider or Supabase connections.
- Requires independently verified consent **from the original Messenger identity and the destination Zalo identity**, authenticated provider-account ownership for each, active non-revoked consent receipt, verified one-time challenge/atomic replay flags, current expiry and trusted cryptographic signature binding exact `tenantRef`, `storeRef`, `orderRef`, origin/destination actors and channels.
- Only a `read_order_status_only` proof scope can pass. Phone/order ID matching alone is never accepted. No data returned, no write rights, no send rights. A proof's validity must be rechecked at real request time, including revocation.
- Node tests cover valid two-party link, swapped actor/store/order/channel, missing consent, revoked/expired proof, stale challenge, signature mismatch and phone-only claims.

### B. `v172c34-protected-order-writer-preflight.cjs`
- A source-only protected preflight constructor. **No database, inventory, n8n, HTTP, payment, customer data or order mutation adapters are implemented or called.**
- Public-shaped input accepts **exactly one opaque `intentRef`**; all tenant/store/provider/actor/order/quote/confirmation details must come from injected private server adapters. Rejects caller-supplied Store, tenant, actor, SKU, quantity, role, order ID or permission flags.
- Release gate requires `syntheticOnly=true`, `noSend=true`, `noOrderWrites=true`, `allowHostedUat=false` and `legacyDemoSeparated=true`.
- Only `sourceLane=commerce_v2_candidate` with `originWorkflowId=commerce_v2_candidate_no_send` may pass. Every known published legacy Google Sheets workflow ID is excluded.
- Requires current verified provider actor/session, trusted channel/installation and matching authenticated subject/Store authority; rejects expired, inactive or mismatched claims.
- `create_order` and `change_lines`: require signed server-side quote, exact VND total, quantity, available stock, active product, independent bound confirmation and an idempotency read check. `change_lines` additionally requires pending order ownership in the same Store AND same verified channel/actor (cross-channel order mutations always DENIED).
- `preview_order_status`: checks exact Store-scoped order ownership. On the original channel the verified provider actor must match; cross-channel only with a separate read-only dual-consent proof. **No Order row/status is returned**, even on preflight success.
- On every passing path the result is `SECURITY_PREFLIGHT_ONLY_NO_ORDER_WRITE`, with `canWriteOrder:false`, `canSend:false`. A future real writer must reverify and atomically reserve idempotency, recalculate exact price/stock and commit in one protected transaction; this source code cannot grant execution rights.

### C. Tests and CI
- `v172c34-cross-channel-identity-proof-gate.test.cjs`
- `v172c34-protected-order-writer-preflight.test.cjs`
- Existing `.github/workflows/v172c21-protected-consent-qa.yml` extended with both files; includes integration between the actual source-only dual-consent proof gate and writer status preflight for a synthetic Messenger→Zalo identity link.
- Negative matrix: different Store/tenant/actor, legacy lane tool IDs, price/tax/stock mismatch, invalid VND/quantity, missing confirmation, replay/idempotency uncertainty, forbidden writes, proof revocation and forged caller-provided privileged fields. No external services invoked.

## 3. CI evidence — source commit `172ded54374e02fde4622b39423cc25e4811ab91`
- Protected source, identity link and order preflight: [run 44239382608](https://github.com/ngoctien20/demo-git/actions/runs/44239382608) — **SUCCESS**.
- Source privilege contract: [run 44239382707](https://github.com/ngoctien20/demo-git/actions/runs/44239382707) — **SUCCESS**.
- Ephemeral PostgreSQL RLS and Store migration regression: [run 44239382624](https://github.com/ngoctien20/demo-git/actions/runs/44239382624) — outcome must be reconfirmed if not yet completed at checkpoint time.

## 4. Major remaining P1 blockers / independent review
1. Actual Store IDs, canonical tenant/store memberships and Store-scoped Orders RLS are **not deployed**. Store resolver and server-side provider verification from Messenger/Zalo are not integrated with Commerce writer.
2. Existing legacy DEMO Google Sheets writer paths are active but NOT Store-aware; do not silently expose those tools to a new multi-Store Core Bot. Proposed separation is a candidate only; no live behavior changed.
3. Real cross-channel customer identity linking requires protected independently authenticated sessions and two separate consents plus one-time challenge and tested signed proof revocation/anti-replay. Mocked flags do not prove these.
4. True order create/update requires actual transactional adapter with Store-scoped ownership, unchanged VND quote/price tier, atomic stock/order/order_item/idempotency in one DB transaction, support for retries and compensation/rollback, independent reviewer and backup.
5. Same-tenant owner A/B negative real Auth and cross-platform identity UAT remains **BLOCKED** under no-cost Option A until approved protected isolated hosting and reviewer.
6. Existing anonymous and authenticated SECURITY DEFINER RPC security advisories require separate privilege audit before any expanded write capability.
7. Only the tested source contract and narrow synthetic gating passed. Do NOT claim live sale success, Order/Stock changes or end-to-end Messenger→Zalo integration.

## 5. Release status
| Gate | Status |
|---|---|
| Legacy DEMO published workflow isolation in source candidate | IMPLEMENTED / TESTED mock |
| Protected Store + actor order-preflight contract | IMPLEMENTED / TESTED mock |
| Cross-channel signed dual-consent identity proof contract | IMPLEMENTED / TESTED mock |
| Integrated Messenger order→Zalo status preflight (synthetic) | TESTED only |
| Ephemeral Postgres tenant/Store RLS regression | TESTED in CI |
| Real provider HMAC/JWT verification, signed proof and replay storage | BLOCKED |
| Real protected order writer, stock/order atomicity, Store-scoped schema | NOT DEPLOYED |
| Hosted A/B owner consent, independent reviewer, backup/restore | NO-GO |
| Production multi-Store, real order write and cross-channel order lookup | NO-GO |

## 6. Checkpoint and rollback
Only source/tests/workflow YAML/checkpoint docs added to **Draft PR #392**. No n8n workflow version was saved, updated, published or executed; no live webhook or message send; no Supabase migration, write, branch, plan upgrade, credential change or customer data access. Roll back via reverting V17.2C.34 Draft commits or closing PR; no hosted rollback required.

Next gate: isolated **atomic Commerce Writer DB Transaction Candidate × Store-Scoped Order Idempotency × Cross-Channel Identity Revocation Drill**, without production writes. Keep P1 #402/#403 OPEN until actual authorization and release checks pass.
