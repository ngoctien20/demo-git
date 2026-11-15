# TIEN404 AI V14.8 — AUDIT + 01/02/03/04 SAFE NO-SEND CHECKPOINT

**Date:** 16 Nov 2026 JST.
**Stage:** V14.8-01 Identity Architecture ADR IMPLEMENTED, V14.8-02 Resolver Candidate IMPLEMENTED/TESTED, V14.8-03 Synthetic CPU Benchmark TESTED, V14.8-04 Offline Multi-channel QA Lab TESTED, V14.8-05 Owner UAT PREPARED / PENDING.
**Release:** EXPERIMENTAL only; NOT CANDIDATE APPROVED / RELEASED.
**GitHub:** Draft PR #124 based on existing V14.7 PR #118 HEAD 1bdc6f7d74e2e8ea2b2b15651831e50c6b8c980e. No merge or production deployment.

## 1. Executive Summary

Unified Identity & Fast Multi-Channel Routing is feasible **as an offline adapter contract**. Correct Provider/Channel/Account/Bot namespace and Store ownership are enforced by a private synthetic server registry, not client-supplied store_id. A unified Sales Core remains a future integration, not a real live multi-channel deployment. Historic Custom Bot Studio V14.7 features are preserved unchanged.

## 2. Current System Audit — VERIFIED CONNECTORS

GitHub:
- V14.6 PR #114 OPEN DRAFT HEAD afe1b16cb37dbd758399c0c0768e4681bc008fe2; canonical reconciliation L2 no-send; do not rebuild or merge.
- V14.7 PR #118 OPEN DRAFT HEAD 1bdc6f7d74e2e8ea2b2b15651831e50c6b8c980e; synthetic Custom Bot Studio, Rich Messenger and Zalo Experiences retained.
- Messenger no-write V14.5 PR #119 OPEN DRAFT HEAD 66b1fa3c3be33e94e1ccfb7cc23495ee20ad3093; independent security candidate, not incorporated into live Published.

n8n published:
- Messenger Z7FdV7uDvApfbURQ Active 27 nodes, version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92. Has legacy toolWorkflow create_order, manage_order and actual Meta HTTP Send.
- Zalo ingress yIJk8LvJoLF40Z62 Active 10 nodes, version 8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e.
- Private Zalo router sIPs6egzIwOY1GNv Active 6 nodes, version 8d91d23c-cd87-462f-a112-9cca2340bec8.
- AI SALES Main Agent v6PBwcqSapVzACMW Active 8 nodes, version c0f04eb1-9e2b-4b42-bf70-0ce12d5b0c30.

Supabase staging ifxlvrhyjhbzbrkdsida ACTIVE_HEALTHY, PostgreSQL 17.11:
- public.tenants 2, public.tenant_memberships 3, public.products 2, public.orders 2 (read-only aggregate counts at audit).
- Core public tenant-scoped tables have RLS enabled, most FORCE RLS; existing membership SELECT policies.
- No canonical public.stores/store_memberships and no core Store IDs verified; tenant-wide policy != Store isolation.
- QA-only tien404_r1_qa.tenant_identity_map/shop_bots/owner_bindings/catalog exist. Do NOT treat as production Store UUID.
- Supabase advisors warn public.qa_shop_b_zalo_claim(p_challenge,p_code,p_sender,p_event) is anon-executable SECURITY DEFINER; public.qa_owner_pairing and save_merchant_product authenticated-executable SECURITY DEFINER. Must independently review BEFORE release. Reference https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable.
- No SQL DDL/DML, GRANT, RLS or migration applied.

Cloudflare account read-only inspection found Workers tien404-v147-custom-studio-synthetic-nosend-staging, tien404-g22-shop-b-map-nosend-staging, tien404-widget-gateway-v144-staging and existing Zalo staging Workers. Pages include tien404-ai-git-staging and tien404-ai-staging. No Cloudflare Worker config secrets or real ZALO_SEND_ENABLED runtime value read. No deploy.

## 3. Implemented Changes

- docs/ai-handoff/V14_8_01_IDENTITY_ADR_CANONICAL_AUDIT.md: audit, ADR A/B/C, conditional hybrid candidate and rollback.
- docs/ai-handoff/V14_8_01_SCHEMA_REVIEW_NOT_APPLIED.sql: fully commented draft; NOT an executable migration or hosted change.
- qa/v148/identity-resolve-v1.schema.json: strict normalized event contract, rejects tenant/store claims; schema validates shape only, NOT provider authenticity.
- qa/v148/unified-identity-resolver.cjs: synthetic exact-byte adapter HMAC, private binding to tenant/store/bot profile, 4 channels, Page namespace and external identity isolation, replay, immediate policy revocation even with cache, safe fast-path.
- qa/v148/unified-identity-resolver.test.cjs: 52 tests.
- qa/v148/v147-studio-identity-compat.test.cjs: 10 tests reusing actual V14.7 Studio 3 Shops × 4 channel fixtures, names/greetings/prices/permissions.
- qa/v148/benchmark-offline.cjs: 1100 request CPU-only benchmark, warm/cold.
- qa/v148/n8n-manual-qa-stages.json + .test.cjs: exact source of new Inactive n8n manual QA workflow, 13 source regression tests.
- .github/workflows/v148-unified-identity-offline.yml: CI tests, safety static guard, benchmark JSON and V14.7 inheritance.

New Inactive n8n manual QA workflow:
- https://ngoctien20.app.n8n.cloud/workflow/nyDslS3mswATPTNH
- ID nyDslS3mswATPTNH, version f47419dd-76ca-4bcb-9509-6aef734b0aef.
- Personal project, folder 90_QA - DIAGNOSTICS. 5 nodes: Manual Trigger → Set ALL → Synthetic Fixtures → Mock Identity Resolver → PASS/FAIL Verdict.
- NO real HMAC verification, Meta/Zalo/Webhook, LLM, DB, Supabase, AI Agent, HTTP or credential. Its syntheticAuthenticated flag is test fixture ONLY. Real fixture HMAC is tested separately in Node.js.
- First exec 3885 36/36 but a wrong-SKU fixture used WEBSITE_WIDGET (unsupported) and could pass for the wrong reason. Fixed to WEB_WIDGET, strengthened expected SKU rejection reason and reran **#3887 36/36 PASS**; it reports SKU_NOT_IN_THIS_SHOP correctly. Re-test version f47419dd-76ca-4bcb-9509-6aef734b0aef, Inactive, no Published.

## 4. Performance Report — CPU-only synthetic, NOT production

Reproducible Node.js GitHub Actions on ubuntu-24.04 runner, Node 22. 1100 samples, 0 errors.
Bench excludes fixture signing prep, network, hosted DB, cold start of n8n, AI model and provider send, therefore these numbers MUST NOT be compared directly with real Messenger end-to-end elapsed times.

| Case | N | p50 ms | p95 ms | p99 ms |
|---|---:|---:|---:|---:|
| Greeting warm | 100 | 0.0185 | 0.0602 | 0.4631 |
| Catalog warm | 100 | 0.0170 | 0.0393 | 0.2522 |
| Quote warm | 100 | 0.0167 | 0.0262 | 0.1768 |
| Multi-channel warm | 500 | 0.0164 | 0.0334 | 0.0914 |
| Greeting new-instance cold | 100 | 0.0230 | 0.0399 | 0.0690 |
| Catalog new-instance cold | 100 | 0.0239 | 0.0507 | 0.1900 |
| Quote new-instance cold | 100 | 0.0263 | 0.0485 | 0.0627 |

Benchmark CI run: https://github.com/ngoctien20/demo-git/actions/runs/43767809007
Raw JSON artifact from CI: v148-identity-synthetic-cpu-benchmark.

Previous real n8n Messenger baselines from owner provided checkpoint: executions #3865 7.163s, #3866 5.296s, #3867 15.075s, #3868 9.873s. No comparable after-V14.8 real n8n inbound-to-client telemetry has been collected. Targets resolver p95 under 200ms, config lookup p95 under 150ms, simple reply p50 under 4s and p95 under 8s remain **UNVERIFIED in deployed path**. No supported cost-savings percentages or real 1k/10k price comparisons.

## 5. Security & Multi-Tenant QA

- GitHub run 43767809007: 52 core resolver tests + 10 actual V14.7 Studio compatibility tests + 13 exact-source n8n stage replay tests + 28 V14.7 Experience and 8 Messenger inherited tests = **111 Node tests PASS**, no failures.
- Direct n8n execution #3887: 36/36 synthetic cases PASS (Shop A/B/C × Messenger/Zalo Bot/Zalo OA/Widget across quote and greeting; 12 negative/secondary cases).
- Private map strictly binds synthetic channel/provider/account/bot to correct Store and bot profile, never client-supplied tenant/store.
- Same external user or phone string in multiple channels is NOT auto-linked to the same customer.
- HMAC invalid, tampered raw body, event replay, channel mismatch, disabled/suspended Store, expired subscription, fake Store/tenant and out-of-scope SKU are denied.
- No real write or send; current module uses in-memory replay cache only. No claim of hosted permission/identity certification.

## 6. Remaining Blockers

- P0 Store-level hosted schema, RLS/JWT and independent four-row owner mapping & backup restore NOT approved/tested.
- P0 3 SECURITY DEFINER advisor warnings need rights/ownership review (no exploit confirmation).
- P0 Legacy Messenger Published still exposes write-capable DEMO create_order; never test LIVE03 real order with no-write conditions.
- True Meta/Zalo Bot/Zalo OA and Widget provider signature/entitlement proof not integrated into unified resolver.
- No actual AI Agent tool calls or real multi-channel sends in V14.8.
- Durable replay across instances / reliable Webhook identity / controlled revocation consistency not yet implemented.
- n8n trial used as previously approved until expiry review; no new billing/plan change.

## 7. Owner Approval Gates

Require separate, explicit written owner approval before:
- changing Published Messenger/Zalo/Website webhook or real provider Send;
- any hosted migration, GRANT/RLS, backfill to public.stores or credential changes;
- enabling a real AI provider/paid model with additional cost;
- merging PR into production, enabling Worker Gateway, or deploying to customers.

## 8. Checkpoint

- GitHub PR #124 OPEN DRAFT (not merged).
- n8n QA workflow nyDslS3mswATPTNH Inactive, version f47419dd-76ca-4bcb-9509-6aef734b0aef; execution #3887 36/36 PASS.
- Identity contract v1.0.0; synthetic resolver QA suite 52 tests.
- Benchmark 1100 synthetic CPU requests; user receipt latency not measured.
- No production or hosted data changes by V14.8.
- Rollback: close Draft PR #124, keep manual QA workflow Inactive; no database rollback necessary.

## 9. Next Roadmap

V14.8-05 Owner synthetic UAT with checklist + JSON export (No-Send), then V14.8-06 Trusted Hosted Identity Evidence and Multi-channel Adapter Candidate.
Only consider Cloudflare gateway after operational baseline, fail-closed proof and scope approvals. No automatic release.

## 10. Owner UAT Checklist — NOT YET OWNER CERTIFIED

- [ ] Shop A/B/C đúng lời chào và giá theo từng kênh
- [ ] Messenger / Zalo Bot / Zalo OA / Website chuyển đổi độc lập
- [ ] Không có tin Meta/Zalo thật hoặc đơn thật
- [ ] Unknown Page + store spoof + subscription expired are DENIED
- [ ] Thử case ORDER luôn BLOCKED khi chưa có approval
- [ ] Export JSON không PII/token
- [ ] Owner xem báo cáo benchmark CPU và đồng ý chưa phải số đo sản phẩm thực

## 11. Proposed Improvements (NOT IMPLEMENTED)

- Channel Connection Center chung: tăng minh bạch kênh/entitlement; độ khó vừa; phải có provider permission proof.
- Latency dashboard theo channel/Store: hữu ích cho p95 thực tế; độ khó vừa; cần consented anonymous telemetry.
- Misconfiguration/revocation alert: giảm risk sai Store; độ khó vừa; phải tránh alert PII.
- Bot Profile switch by channel: đã có synthetic V14.7, cần approval+versioning để dùng Hosted; rủi ro scope cross-tenant.
- AI budget by Store: cần metered inference data/limits before feature; không dự báo tiết kiệm không có số liệu.

**Final status: V14.8-01, 02, 03 and 04 IMPLEMENTED/TESTED OFFLINE; V14.8-05 OWNER UAT PENDING; hosted/live/production NO-GO.**
