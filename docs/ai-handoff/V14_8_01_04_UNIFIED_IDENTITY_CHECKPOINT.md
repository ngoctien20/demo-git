# TIEN404 V14.8-01→04 — Unified Identity No-Send Checkpoint

Date: 16/11/2026 JST
Identity Contract: v14.8.0-candidate.1
Lifecycle: EXPERIMENTAL / Draft / Synthetic QA only
GitHub PR: #121, stacked on V14.7 PR #118.
Status: 01 DESIGN VERIFIED; 02 RESOLVER TESTED SYNTHETIC; 03 LOCAL BENCHMARK TESTED; 04 ADAPTER + OWNER UI SOURCE TESTED; 05 OWNER UAT PENDING.

## 1. Executive Summary

Unified internal Tenant, Store, Channel Binding, Bot Profile, Customer and Conversation IDs are feasible and useful to share an AI Sales Core across Messenger, Zalo Bot, Zalo OA and Website Widget. External provider IDs must remain scoped to account, bot, channel and environment. Identical phone/name/user aliases on separate channels do not certify common ownership. The candidate does not send any provider message, write a real order or call a real AI provider.

## 2. Current System Audit — VERIFIED (read-only)

GitHub:
- V14.6 canonical PR #114 OPEN DRAFT, HEAD afe1b16cb37dbd758399c0c0768e4681bc008fe2.
- V14.7 Rich UI/Studio PR #118 OPEN DRAFT, HEAD 1bdc6f7d74e2e8ea2b2b15651831e50c6b8c980e. Existing V14.7-03 owner-reported 5/5 synthetic UAT preserved.
- Messenger LIVE03C PR #119 OPEN DRAFT, HEAD 66b1fa3c3be33e94e1ccfb7cc23495ee20ad3093, independent.
- V14.8 PR #121 remains OPEN DRAFT; no merge.

n8n Published versions are unchanged:
- Messenger workflow Z7FdV7uDvApfbURQ Active, 27 nodes, Published d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92.
- Zalo Bot Ingress yIJk8LvJoLF40Z62 Active, 10 nodes, Published 8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e.
- Zalo Private Router sIPs6egzIwOY1GNv Active, 6 nodes, Published 8d91d23c-cd87-462f-a112-9cca2340bec8.
- DEMO Main Agent v6PBwcqSapVzACMW Active, 8 nodes, Published c0f04eb1-9e2b-4b42-bf70-0ce12d5b0c30.
- Existing Messenger Create Order Tool can append Orders to legacy AI_SALES_DEMO. No real order confirmation trial authorized.

Supabase staging ifxlvrhyjhbzbrkdsida: ACTIVE_HEALTHY PostgreSQL 17.11. Canonical public.tenants, tenant_memberships, products, orders and conversations exist with tenant-scoped policies and FORCE RLS on main Commerce tables, but no public.stores/public.store_memberships; hosted Store A/B isolation is NOT verified. Existing app_private.channel_secrets and tien404_r1_qa.shop_bots/tenant_identity_map must be reconciled before any migration.

Supabase Security Advisor flags SECURITY DEFINER RPCs callable by broad roles: public.qa_shop_b_zalo_claim (anon), public.qa_owner_pairing and public.save_merchant_product (authenticated). Requires read-only function body/permission audit before a change. No GRANT/RLS modifications have been made.

Cloudflare inventory read-only: existing V14.7 studio synthetic Worker, G2.2 no-send Worker, widget gateway, Zalo outbound staging Worker and two existing TIEN404 Pages projects. No new Worker or Pages deployed. Cloudflare KV eventual consistency makes it unsuitable as sole revocation authority.

## 3. Implemented Changes

1. qa/v148-unified-identity/identity-core.cjs — private 12-binding synthetic registry across 3 shops x 4 channels, store-derived IDs, HMAC test fixture, replay, Shop suspension/subscription, in-memory Bot Profile cache (15-second TTL), GREETING/CATALOG/QUOTE Fast Path, disabled AI path, hard NO-WRITE transaction path.
2. qa/v148-unified-identity/provider-adapters.cjs — Messenger/Zalo Bot/Zalo OA/Website distinct synthetic message envelope adapters. Test-only per-channel HMAC. NOT actual provider protocol verification.
3. qa/v148-unified-identity/owner-uat.js and owner-uat.html — Vietnamese mobile-oriented preview using existing V14.7 Studio; 3 stores x 4 channels x 5 scenarios, safe JSON export. NOT publicly deployed; not a real auth control.
4. qa/v148-unified-identity/identity-core.test.cjs — 68 security/contract cases.
5. qa/v148-unified-identity/provider-adapters.test.cjs — 43 adapter/isolation cases.
6. qa/v148-unified-identity/owner-uat.test.cjs — 12 UI source/logic cases; no browser Playwright run yet.
7. qa/v148-unified-identity/benchmark.cjs — 1,200 warm + 120 cold in-memory synthetic samples.
8. .github/workflows/v148-unified-identity-qa.yml — CI and retained Studio regressions.
9. docs/ai-handoff/V14_8_01_UNIFIED_IDENTITY_ADR.md — ADR, canonical Store reconciliation and change/rollback dependencies.
10. docs/ai-handoff/V14_8_01_03_EVIDENCE_SUMMARY.json — redacted QA/latency/checkpoint export.

## 4. Performance Report (NEVER MIX LIVE AND SYNTHETIC METRICS)

Actual prior n8n Messenger webhook executions:
- #3865: 7163 ms total, Signature Timing-Safe node 1686 ms, Agent 3976 ms, Meta Send 1261 ms.
- #3866: 5296 ms total, Signature node 1635 ms, Agent 2927 ms, Meta Send 524 ms.
- #3867: 15075 ms total, Signature node 1805 ms, Agent 7744 ms, nested Products tool 1916 ms, Meta Send 538 ms.
- #3868: 9873 ms total, Signature node 1701 ms, Agent 4087 ms, nested Products tool 636 ms, Meta Send 457 ms.

Do not double count nested AI tools. Total execution does not prove actual customer screen receipt timing. The Signature Code node uses Node crypto require; preceding Crypto node took only 1–5 ms. Suspected runtime initialization versus crypto cost remains UNVERIFIED. Never omit HMAC to improve timing.

Offline GitHub Action benchmark https://github.com/ngoctien20/demo-git/actions/runs/43763851730:
- Warm normalized synthetic signed events: 1200 samples, p50 0.0274 ms, p95 0.1071 ms, p99 0.194 ms.
- Cold including JS constructor: 120 samples, p50 0.0300 ms, p95 0.0433 ms.
- Profile cache local: 1188 hits / 12 misses for 12 synthetic bindings.
- These are in-process Node.js timings, NO network, live provider signature, DB, AI model or Meta Send. Different CI runs vary. No valid claim of 30/50/70% end-to-end improvement or real SLO achievement.
- Targets Identity Resolve p95<200ms, Config Lookup p95<150ms, Simple Reply p50<4s/p95<8s remain NOT VERIFIED on real staging.

Architecture: preserve A (existing n8n first) until controlled real baseline proves the added complexity of B (Worker + Supabase + n8n) or C (hybrid gateway + n8n Core) is justified. No estimated provider unit costs are treated as facts.

## 5. Security and Multi-tenant QA — TESTED SYNTHETIC

- 68/68 Identity tests PASS (HMAC fixture, namespaces, Store A/B same tenant, Store C different tenant, revocation, subscription expiry, Shop suspension, cache, replay, scope injection, no-write).
- 43/43 provider adapter tests PASS (four distinct signed synthetic fixture formats; not provider-certified).
- 12/12 owner preview tests PASS, including the 60-combination synthetic matrix in source.
- 36/36 inherited Custom Bot Studio and 28/28 inherited Experience Lab tests PASS.
- Total CI 187/187 tests PASS, zero failed (source-run evidence at linked CI).
- Candidate has ZERO model calls, provider sends, hosted writes and real Orders writes by design. Real multi-instance atomic replay/JWT Store RLS remain UNTESTED.

## 6. Remaining Blockers

P0: hosted canonical Store ownership and four-row mapping; proven backup/restore; real JWT/RLS in same-Tenant Store A/B; provider-specific Meta/Zalo owner/signature/channel claims; live revoked-token handling; atomic replay across workers; current published Messenger writer path; unresolved RPC SECURITY DEFINER reviews.

P1: real AI inference/shared Core, actual provider acknowledgment/delivery, customer-visible latency telemetry, real per-message costs, owner browser QA and approved staging UI hosting.

## 7. Owner Approval Gates

Separate authorization required BEFORE: Meta/Zalo real sends or webhook changes; publishing/modifying any active workflow; Cloudflare public QA deployment if it changes exposure/cost; hosted migrations, grants, JWT/RLS, credential/token changes; customer data or real Orders/Stock changes; merging PRs or upgrading billing. n8n trial continues until planned reassessment.

## 8. Checkpoint / Rollback

Branch work/v14801-unified-identity-candidate-nosend-20261116.
GitHub Draft PR #121, based on the existing V14.7 PR #118 HEAD, no merge.
Contract version v14.8.0-candidate.1.
GitHub CI at last verified source HEAD: https://github.com/ngoctien20/demo-git/actions/runs/43763851730 (187/187 PASS; synthetic benchmark success).
No new n8n workflow, no n8n Published version change, no Supabase revision, no Cloudflare deployment.
Rollback: close Draft PR #121 or revert V14.8-only files; no hosted data rollback necessary.

## 9. Next Roadmap (PROPOSED)

V14.8-03b: Profile n8n Signature Code runtime initialization versus true crypto execution on a disposable QA workflow.
V14.8-04b: real provider-specific proof/tenant-binding adapter on an approved non-sending ingress only; no live Page repoint.
V14.8-05: visually inspect source Owner UAT UI, test mobile/responsive browser behavior, approve optional separate synthetic staging hosting, then owner receipt.
Later: Cloudflare Hybrid gateway ONLY with controlled real end-to-end latency/cost evidence. Hosted Store canonical migration only after full recovery/owner evidence.

## 10. Owner UAT Checklist (NOT YET OWNER ACCEPTED)

- [ ] View synthetic preview in Vietnamese on desktop/mobile; visual test NOT yet verified by Playwright.
- [ ] Switch Shop A/B/C, verify Bot names, SKU A001 and prices 159k/209k/259k are independent synthetic data.
- [ ] Switch Messenger, Zalo Bot, Zalo OA, Website Widget: no cross-shop or channel config changes.
- [ ] Try greeting, catalog, quotation, advanced AI disabled, Order Request blocked.
- [ ] Run 60 local synthetic previews and verify all 60 status PASS (only fixture scope/no-send assertions).
- [ ] Export JSON, confirm no tokens, PSID, real customer PII.
- [ ] Confirm owner UI states no actual HMAC, real model inference or production permission.
- [ ] Provide owner sign-off for synthetic UI ONLY if satisfactory.

## 11. Suggested Improvements (PROPOSED)

- Channel Connection Center: HIGH value, MEDIUM effort, entitlement/binding correctness risk.
- Per-channel latency dashboard: HIGH value, MEDIUM effort, low direct cost but telemetry governance required.
- Wrong Shop / revoked binding alerts: HIGH value, MEDIUM effort, authorization/privacy risk if sent to wrong owner.
- Store permission monitor: HIGH value, HIGH effort, depends on canonical hosted Store ownership and RLS.
- Channel Bot Profile selector: MEDIUM value, LOW-MEDIUM effort; reuse existing V14.7 UI, do not fork.
- Per-Store AI budget and token quotas: HIGH value, MEDIUM effort; cannot estimate costs from synthetic benchmark.

Conclusion: V14.8-01 through 04 are IMPLEMENTED/TESTED at source and synthetic QA level. V14.8-05 owner UAT is PREPARED but NOT ACCEPTED. Production and real multi-provider commerce remain NO-GO.
