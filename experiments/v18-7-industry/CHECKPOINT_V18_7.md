# TIEN404 AI — V18.7 Implementation Checkpoint
Date: 2026-11-18 JST
Status: CANDIDATE / STAGING / NO PRODUCTION
Draft PR: https://github.com/ngoctien20/demo-git/pull/422
Base branch and SHA: gh-pages / ff2daf970e8209399a28b2d0cade8a33b9fa71c6
QA code commit before checkpoint documentation: 91445d44b40799f78007105cb7935b7366c0dab7
QA evidence: https://github.com/ngoctien20/demo-git/actions/runs/44280145409

## VERIFIED (read-only)
- Messenger n8n Z7FdV7uDvApfbURQ is active, published same as draft when inspected, 32 nodes. No change performed.
- Commerce Core iyfGUiEsZlNTBWOR is active with differing draft/published version IDs. No cutover attempted.
- Supabase staging has public.tenants, tenant_memberships, products, orders, app_private.channel_secrets; no verified canonical public.stores table in inspected schemas.
- GitHub gh-pages baseline unchanged after creating Draft PR.

## IMPLEMENTED (isolated in PR #422)
- Industry Profile Schema V1 (JSON Schema + defensive runtime contract checks).
- Experimental Grocery and Building Materials profiles with strict forbidden tool policy.
- Offline preview engine with fake owner A/B registry, pinned immutable QA preview objects and source-scoped synthetic catalog.
- Synthetic quote preview: integer units, BigInt total_vnd, fail-closed on insufficient stock/unknown units and unauthorized product scope.
- Mobile-friendly stand-alone mock-builder.html. No fetch, persistence, credentials, remote data or provider send.
- GitHub Actions PR-only Node 22 test workflow.

## TESTED
GitHub Actions run 44280145409 at code SHA 91445d44:
- 42 tests executed; 42 passed; 0 failed; 0 skipped.
- Cross-store A/B product reads denied in offline fixtures.
- Profile/override privilege escalation, model-invented pricing, provider sends and order writes denied.
- Forged and cloned mock preview objects denied; local mock preview object immutable.
Evidence is **synthetic-only**. It DOES NOT prove real Supabase Auth/RLS, Meta, Zalo, n8n Core, or live customer isolation.

## OPEN P0/P1 GATES
P0: Canonical Store Authority & store memberships not yet verified as ready for live cross-store operation.
P0: Real auth Owner A/B authorization and actual DB RLS acceptance are not exercised here.
P0: Source price/stock adapter and confidential order ownership remain unconnected; no real read capability.
P1: Connect profile registry and version pinning via an approved server-side read-only adapter; test n8n Published/draft compatibility.
P1: Store Customization Builder has only an isolated offline UI mock; no authenticated persistence or browser E2E QA.
P1: Exact rational precision needed for fractional kg/m2/m3 before real VLXD calculations.
P1: Meta OAuth/Zalo OA permissions, webhook, account linking and channel sends require separate approval and QA.
P1: Release/readiness review has not happened. Production NO_GO.

## Architecture decisions
- Never create one n8n workflow per industry/store by default.
- Separate Industry Profile, Store Overrides, Knowledge and server-enforced Tool Policy. No editable security-critical core policy.
- Server must resolve canonical (tenant_id, store_id) and verified channel install BEFORE loading industry config.
- Prices, inventory, private orders must use authorized structured Commerce data; RAG/FAQ must not override them.
- Version lifecycle EXPERIMENTAL -> CANDIDATE -> APPROVED -> RELEASED, with pinned versions and rollback.
- Keep Messenger Published, Commerce Core, DEMO/Commerce isolation, credentials and all customer data unchanged.

## Change / rollback
Only new isolated PR files. No Supabase schema/table/role/credential writes; no n8n updates; no Meta/Zalo calls; no provider sends or order writes.
Rollback is closing Draft PR or reverting new files; no runtime rollback necessary.

Next: review this PR, verify CI for final branch commit, design canonical store authority migration preview, then implement approved private read-only industry adapter under a separate gate. Do not merge or publish without explicit owner approval.

## V18.7.5 Continuation

Added same-tenant Store A/C simulated isolation, distinct channel mock previews, disabled connection negative checks; PR #420 carries separate disposable PG17 Store Authority candidate. The QA actors are fixtures not Supabase Auth; production integration and real Owner A/B remain BLOCKED. Review CI on final HEAD for exact test evidence.

## V18.7.5 QA evidence
- 18/11/2026 19:03 JST, GitHub Actions run 44281709113 at dc0b1001793d397fdd28a70a8b03c23c6abd2d01: 77/77 synthetic tests PASS, 0 FAIL.
- Follow-up immutable-fixture and CI runtime changes are subject to a new exact-HEAD QA run.
- Live Store Authority, real Owner A/B JWT RLS, real Commerce Core read and real providers are still BLOCKED / NO-GO.
