# TIEN404 AI V14.4 — Secure Multi-Shop & Unified Channel Checkpoint

Date: 15 November 2026 JST
Lifecycle: EXPERIMENTAL / OPEN DRAFT / OFFLINE STAGING CANDIDATE / NO SEND
Repo: https://github.com/ngoctien20/demo-git
New PR: #97, branch work/v144-secure-gateway-release-preflight-20261115
Base: work/v143-unified-channel-widget-staging-20261115 (PR #94 HEAD 02c480d6925234631a94c9ad1c5b705b07c4128d)
Do NOT merge, deploy, send, alter RLS, backfill or change credentials.

## 1. ACTUAL STATUS / VERIFIED LIVE AUDIT

GitHub OPEN DRAFT dependency graph:
- Knowledge lineage: #85 HEAD cf7974b14deb5870560db5019d9c4b06663ebe34 → #86 HEAD 635e1d8e634556887eb35fd318b892c740177a9e.
- Messenger lineage: #87 → #88 → #89 → #90 → #91 → #92 HEAD 9aa08520525d746121194143e521a89393cd3988.
- Widget/Unified Channel: #94 HEAD 02c480d6925234631a94c9ad1c5b705b07c4128d based on #92.
- Replay hardening: #93 HEAD b3636e0da5baf617331c49fdd31d647ab1432fba → #95 HEAD ad35baec097a7e8289518ec66ff74b1a19f1b3d3, separate from #94.
- New #97 is stacked ONLY on #94; does NOT inherit #86 hosted RLS/Knowledge or #95 replay fixes. No branch was merged.

Supabase tien404-staging ref ifxlvrhyjhbzbrkdsida ACTIVE_HEALTHY PostgreSQL 17.11:
- public.products 2 rows; public.orders 2 rows.
- public.stores, public.store_memberships, app_private.shop_knowledge_releases, private Messenger Page/Event tables and private Widget installations/domain/quota tables do not exist.
- SIX Commerce tables lack store_id: products, customers, orders, order_items, conversations, messages.
- Existing six public SELECT policies are PERMISSIVE and tenant-only. Do NOT append a Store policy while old permissive tenant policy remains.
- products has UNIQUE(tenant_id,sku), not store-scoped unique; needs source-ledger-safe redesign after approval.
- Security Advisor and read-only pg_proc findings: qa_shop_b_zalo_claim SECURITY DEFINER anon EXECUTE; qa_owner_pairing and save_merchant_product SECURITY DEFINER authenticated EXECUTE; all three search_path empty, all three lack store_id in function bodies. Flags for review, not proven exploits. 18 no-policy INFO findings mainly private QA schemas require exposure/grants review.

n8n read-only verified:
- Published Messenger Z7FdV7uDvApfbURQ ACTIVE version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92.
- Staging Zalo yIJk8LvJoLF40Z62 ACTIVE version 8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e.
- Private customer router sIPs6egzIwOY1GNv ACTIVE version 8d91d23c-cd87-462f-a112-9cca2340bec8.
- V14.2 QA FIE7nl2vgLXQI7mT INACTIVE version b24c7a86-66bf-45a2-b48b-a81c54e375bb; execution 3833 SUCCESS (16/16 synthetic reported in prior QA).
- V14.3 QA KjcnFcdg3lDQcZyW INACTIVE version 6bc45697-9541-4894-bac8-577b4e5fd499; execution 3839 SUCCESS (13/13 synthetic reported in prior QA).
- Messenger Rich UI Candidate X0MwwQ7LRUqfOVjM INACTIVE version 280a9c50-f9db-4442-a793-940e824be5f9; 3835 SUCCESS, 3834 earlier ERROR.
- No n8n Published workflow changed, and no real provider send ran in this V14.4 work.

Operator-local backup evidence (NOT binary files inspected by assistant):
- E:\pgadmin\tien404_backup\TIEN404_V142_PRE_RLS.backup 212 KB Explorer size, pgAdmin pg_dump success, pg_restore --list exit code 0, TOC shows project schemas, public products/orders TABLE DATA and public RLS policies.
- Operator calculated SHA256 via Windows PowerShell; no independent inspection of archive bytes by assistant.
- User requested isolated restore drill be deferred; it is NOT waived. V14.4 brief correctly keeps this P0 gate, but file is only on Windows and unavailable to GitHub/Supabase connectors.
- Neither TOC inspection nor PR #95 ephemeral PostgreSQL fixture replay test proves real backup recovery. No hosted migration/backfill/RLS change executed.

External references reviewed: Supabase RLS https://supabase.com/docs/guides/database/postgres/row-level-security ; Functions https://supabase.com/docs/guides/database/functions ; Meta Webhooks https://developers.facebook.com/docs/graph-api/webhooks/ . Official guidance is NOT evidence this project's Meta permission is approved.

## 2. IMPLEMENTED V14.4 — REUSE, DO NOT REBUILD

- qa/channel-v144/secure-widget-preview.cjs: reuses V14.3 widget-gateway, channel-core and renderers. Strict mode OFFLINE_SYNTHETIC_QA. Requires server-owned installation lookup, independently staff-verified domain proof, exact allowed HTTPS origin, signed anonymous session, private quota receipt, replay claim port, independently fresh versioned price+stock snapshot, same-store approved theme and published public Knowledge. Explicitly denies order/write intent, unauthorized store, revoked install, malformed/expired session, wrong-store theme, stale price, unapproved Knowledge. No HTTP listener, DB connector, model call or provider send.
- qa/channel-v144/secure-widget-preview.test.cjs: synthetic same-tenant two-store + cross-tenant scope, domain spoof/revoke, quota and replay, session tamper, private-order deny, published Knowledge and current catalog checks. Mock shared Set is NOT durable hosted PostgreSQL.
- .github/workflows/v144-secure-gateway-qa.yml: executes new tests, inherited V14.3 and V13.6M messenger regressions, static anti-send checks and 6 responsive browser scenarios.
- This checkpoint: audited dependency map, grounded blocked release gates, evidence matrix and rollback.

## 3. 15-GROUP QA MATRIX

All local synthetic tests have 0 real sends, 0 hosted database writes.

| ID | Requirement | Expected | Actual & environment | Status |
|---|---|---|---|---|
| V144-01 | Tenant isolation | Foreign tenant cannot read Store A | Synthetic negative in Node | TESTED offline |
| V144-02 | Same-tenant Store isolation | Shop B cannot read Shop A | Synthetic negative in Node | TESTED offline |
| V144-03 | Staff permissions | Unassigned staff denied | No real Store Membership schema | BLOCKED hosted |
| V144-04 | User JWT RLS | Real Auth A/B signed sessions + denied foreign store | No hosted same-tenant JWT evidence | BLOCKED hosted |
| V144-05 | Store SKU/price/stock | Server-scoped integer VND + fresh price/stock version | Synthetic accepted and stale denied | TESTED offline |
| V144-06 | Orders | Customer confirmation + idempotent pending request | No hosted write path tested; new Widget denies order write | BLOCKED hosted |
| V144-07 | Knowledge | Public verified merchant-approved release only | Draft and cross-store negative synthetic | TESTED offline |
| V144-08 | Meta HMAC / Page | Valid Page grants + real raw-body signature | Historical offline Messenger tests only | BLOCKED hosted |
| V144-09 | Durable replay | Atomic across workers/crashes and HMAC rotation | Synthetic shared ledger + PR #95 isolated PostgreSQL replay fixture, not hosted | BLOCKED hosted |
| V144-10 | Widget domain ownership | Verified DNS/HTTP proof stored privately | Mock staff-reviewed proof only | BLOCKED hosted |
| V144-11 | Widget session | Scoped HMAC, revoke, expiration | Synthetic tests | TESTED offline |
| V144-12 | Injection/abuse | XSS, CSRF, CSP, quota and throttling enforced | Offline code/browser only; no actual gateway | BLOCKED hosted |
| V144-13 | Entitlement | Paused or revoked install denied | Synthetic negative | TESTED offline |
| V144-14 | Regression | No loss of Messenger/Widget features | CI evidence recorded after finishing | TESTED CI when green |
| V144-15 | Backup/rollback | Isolated restore from operator archive + integrity | Not executed; TOC only | BLOCKED |

## 4. P0 SECURITY AND RELEASE GATES

G0: Independent restore drill of the operator's actual V14.2 archive and explicit owner acceptance of rollback; no SQL/RLS without it.
G1: Canonical Store/Membership/Knowledge schema; per-row owner evidence for 2 Products/2 Orders; approve phased migration and atomic removal of old permissive tenant policies; audit SECURITY DEFINER write RPC paths.
G2: Two real Supabase JWTs for TWO STORES WITHIN SAME TENANT plus separate cross-tenant tests; no service_role as evidence; staff revoke/expired JWT.
G3: Private Page→Store registry, Meta Page consent/app permissions, Messenger HMAC raw-body and real durable replay as reviewed separately in PR #95. No real provider send.
G4: Hosted Widget installation and domain ownership registry, validated session, private rate limiting and replay, origin/CSP/CSRF/XSS enforcement, server-side kill switch, observability with no customer PII leakage.
G5: One Shared Sales Core reading Store-scoped SKU/price/stock and approved Knowledge; untrusted model/client data never supplies authorization; order request requires explicit customer confirmation.
G6: Measure Lite/Plus/Enterprise onboarding, Messenger setup, Widget install, actual AI cost per conversation, infrastructure cost and support minutes. No price changes or extra expense approved.

The V14.4 offline bridge is NOT a hosted service and may not be used to claim these gates passed.

## 5. ROLLBACK, APPROVALS, NEXT STEPS

Rollback V14.4: close/revert Draft PR #97 only. No Supabase, n8n, Render, Cloudflare, Meta, payment, credential or customer-data rollback is needed since none changed. Preserve #85/#86/#94/#95 independently.

Pending separate owner approvals: real Supabase RLS/schema/backfill after verified restore; real Meta sends/Page Profile publishing; hosted Widget install on customer websites; new credentials or paid cost; production merge/deploy.

Next: verify latest V14.4 CI, independently reconcile #86/#94/#95 change overlap and prerequisites, schedule operator isolated restore when available; only then start staged RLS hosted migration and user JWT acceptance.
