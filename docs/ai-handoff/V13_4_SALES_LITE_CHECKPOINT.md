# TIEN404 AI — V13.4 Sales Lite V1.4 Commercial Alignment Checkpoint

**Date:** 2026-11-15 JST  
**Stage:** EXPERIMENTAL, **NOT CANDIDATE**  
**Draft PR:** #70, `work/v134-sales-lite-multichannel-contracts-staging` targeting #69 branch `work/v133-sales-lite-secure-integration-staging`.  
**Parent HEAD at creation:** `56d002b029eedd19e11c1971531b0fc2200dcbe7`.  
**CI evidence:** GitHub Actions run `43677376093` — SUCCESS.

## 1. VERIFIED

- PR #41, #52, #67, #68, #69 all OPEN DRAFT. No merges.
- n8n Zalo Ingress `yIJk8LvJoLF40Z62`, Customer Router `sIPs6egzIwOY1GNv`, Owner Shadow `OgDZNSAvKEvhnAvn` are active. AI Intent Draft `uGesZLvNkhY4ZO6l` inactive.
- Messenger `Z7FdV7uDvApfbURQ` Published `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`; its legacy tools are **not proven shared Commerce multi-tenant**.
- Supabase `tien404-staging` (`ifxlvrhyjhbzbrkdsida`) ACTIVE_HEALTHY, PostgreSQL 17; public `tenants`, `tenant_memberships`, `products`, `orders` RLS enabled.
- Security risk confirmed read-only: `public.qa_shop_b_zalo_claim` SECURITY DEFINER has anon EXECUTE. `qa_owner_pairing` and `save_merchant_product` SECURITY DEFINER executable by authenticated. No exploit proven; **do not revoke without caller/rollback audit**.
- Previous V13.3 Cloudflare Preview deployed successfully and Staff Access configured; hosted signed-session merchant A/B QA and API `GET /api/sales-lite/me` **not proven**.
- Historic Render architecture documents describe Auth/Data staging and Merchant components; V13.4 did not choose a Render workspace or verify current deployed service SHA. Do not mistake historical work for present live integration.

## 2. IMPLEMENTED — isolated staging code

- `qa/sales-lite/v134/channel-core-bridge.cjs`: independent adapters share one customer preview port, verified server inbound/binding, scoped read of subscription and catalog; no sends, order writes or outbox.
- `qa/sales-lite/v134/order-request-contract.cjs`: request and owner transition **proposals only**, integer VND, deterministic idempotency hash, verified payment-only revenue sum.
- `qa/sales-lite/v134/product-readiness.cjs`: hypothesis-only Lite 199,000 VND / Plus 349,000 VND; evidence-based release gates and reusable Merchant Portal capability map.
- `qa/sales-lite/v134/v134-contracts.test.cjs`: synthetic positive and negative tests.
- `.github/workflows/v134-sales-lite-contract-qa.yml`: isolated source-only QA.
- `docs/ai-handoff/V13_4_SALES_LITE_PRODUCT_ALIGNMENT.md`: architecture, P0/P1/P2 roadmap, trust boundaries, rollback.
- No existing published workflow, original Commerce Tool, Cloudflare production app, Supabase SQL/ACL, authentication, credential, real order, Meta/Zalo recipient, or billing resource modified.

## 3. TESTED — exact CI evidence

GitHub Actions: https://github.com/ngoctien20/demo-git/actions/runs/43677376093

| Suite | Pass | Fail | Scope |
|---|---:|---:|---|
| V13.4 no-send multi-channel/order/package | 44/44 | 0 | Synthetic port & negative QA |
| V13.3 contracts/security regression | 53/53 | 0 | Offline source contracts |
| V13.2 UI source regression | 19/19 | 0 | Source/static |
| V13.1 menu/business regression | 116/116 | 0 | Offline contracts |
| Total | **232/232** | **0** | **NOT provider E2E** |

No V13.4 UI surface was changed, so no fresh V13.4 browser QA was run; earlier V13.3 10 browser viewport runs remain **historical** evidence, not this build's live end-to-end proof.

**Not tested:** real signed JWT Shop A/B / revoked user, staff denied Cloudflare Access browser test, production Zalo/Messenger sends, live shared AI, transactional order commit/duplicate handling, Owner outbox, real subscription and paid revenue from verified backend.

## 4. BLOCKED / APPROVAL REQUIRED

1. **P0 Auth and Merchant Dashboard:** approve scope for existing Render Auth/Data workspace read-only inspection; map real owner sessions, shop selection, Supabase JWT and portal API; no new passwords.
2. **P0 Hosted RLS:** use authorized QA Shop A/B identities to exercise cross-shop, role and session revocation tests via real protected HTTP, no customer data changes.
3. **P0 Supabase RPC:** inspect current callers and transaction rollback for public SECURITY DEFINER `qa_shop_b_zalo_claim`; request separate approval before changing EXECUTE, definer or policies.
4. **P0 one channel E2E:** propose Website Chat as initial isolated pilot; actual order writes and notification sends require a *new explicit approval* and dedicated QA fixtures. Do not route old Messenger DEMO into Commerce by default.
5. **P0 billing and costs:** find authoritative subscription source; confirm AI quotas/channel provider fees and support cost; prices 199k/349k are not commercial commitments.
6. **P1** Channel Integration Center, owner notification transport, support; **P2** native menus/Agent Factory.

## 5. Checkpoint and rollback

- Start branch is immutable parent commit `56d002b029eedd19e11c1971531b0fc2200dcbe7`.
- New PR is a stacked Draft on V13.3, not gh-pages.
- Rollback: close/revert PR #70; older PRs and production remain unchanged; no DB restore or live webhook rollback needed.
- Keep `EXPERIMENTAL` until owner reviews real test evidence and approves Candidate explicitly.

**Next work recommendation:** prioritize existing Render Auth/Data audit + hosted Shop A/B RLS; only then connect Merchant Dashboard read-only and build first Website Chat sales-loop pilot. Do not increase Studio functionality meanwhile.
