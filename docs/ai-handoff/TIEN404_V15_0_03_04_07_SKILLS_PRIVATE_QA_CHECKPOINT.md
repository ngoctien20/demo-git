# TIEN404 V15.0-03/04/07 — Business Skill Gate × Private QA Data Gate
Date: 2026-11-16 JST | STATUS: SOURCE-ONLY CANDIDATE / NO-SEND

## Parent chain (no merge, no production changes)
- V14.6 canonical reconciliation: Draft PR #114, HEAD afe1b16cb37dbd758399c0c0768e4681bc008fe2.
- V14.7 Custom Bot Studio / Rich UI: Draft PR #118, HEAD 1bdc6f7d74e2e8ea2b2b15651831e50c6b8c980e. Owner synthetic UAT 5/5 (not provider live).
- V14.8 Unified Identity: Draft PR #121, HEAD a25ad0bab04ffe23d7e0c158abb331cd8078e7a6. Signed fixture-only; not verified Meta/Zalo signatures.
- V15.0-01/02 Universal AI Core/Cost Lab: Draft PR #122, HEAD 6b677080572d406078b488e4e07d47eed1dc342b, parent of this branch; 73/73 unit tests in earlier CI run 43764702347.
- V15.0-03→08 A→B→C→D is already implemented in Draft PR #123 (HEAD 5be5625717f65a76e27bf883ad2dc2006772ffe4); this PR is RE-TARGETED as additive security/QA hardening on top of #123. It does not replace #123 Business Skills registry, Smart Model Router or Vietnamese Owner Test Lab.
- Separate parallel V14.8 PR #124 exists. The V15 inheritance path here uses PR #121; do not combine both V14.8 branches without deliberate reconciliation.
- This branch adds isolated source-only policy and local QA ingestion, not an alternative AI core.

## VERIFIED live READ-ONLY audit
- Published n8n Messenger Z7FdV7uDvApfbURQ: active 27 nodes, version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92. Zalo Bot yIJk8LvJoLF40Z62: active 10 nodes; Zalo Private Router sIPs6egzIwOY1GNv: active 6 nodes, not wired to a customer live path. Legacy Main Agent v6PBwcqSapVzACMW: active 8 nodes. No workflow writes.
- Messenger latest four observed executions 3865–3868: 7.163, 5.296, 15.075 and 9.873 seconds. These four are NOT production SLO p95 proof.
- Supabase staging ifxlvrhyjhbzbrkdsida: public.tenants, tenant_memberships, products, orders, conversations with RLS; business records have tenant_id but no store_id. No public.stores/store_memberships. This cannot certify multi-Store same-tenant isolation.
- Supabase Security Advisor on 16/11 warns public.qa_shop_b_zalo_claim(p_challenge,p_code,p_sender,p_event) SECURITY DEFINER callable by anon; additionally qa_owner_pairing and save_merchant_product have SECURITY DEFINER execute exposure to authenticated roles. Review exact function body and intent; do NOT assume exploit or auto-revoke. See https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable .
- G2.3 Zalo Shop B Owner/merchant consent, real ingress trust and full durable replay gates remain BLOCKED.

## IMPLEMENTED (new)
1. qa/v15-agent-core/business-skills-gate.cjs: six source-only capability plans, strict customer/owner/manager/staff/service role scope; independently injected backend attestation, deny on revoke, expired subscription, crossed channel/session, policy drift, backend send/write permission, tool type mismatch. Zero real tool executions even for allowed decisions. Actual read-only backend adapter and confirmed hosted transaction remain separate future gates.
2. qa/v15-agent-core/business-skills-gate.test.cjs: 21 local deterministic tests PASS (positive and negative).
2b. qa/v15-agent-core/business-skills-gate.integration.test.cjs: 8 additional source-only Universal Agent Core → independent Skill Gate integration cases; require exact GitHub CI success before marking TESTED.
3. qa/v15-model-lab/private-dataset-gate.cjs: local-only CSV parser, exact SHA/row/schema/unique ID/turn structure/status check. Outputs counts/checksum ONLY, never raw messages or model scores; private CSVs never committed.
4. qa/v15-model-lab/private-dataset-gate.test.cjs: 12 local deterministic tests PASS with synthesized cases; detect malformed input, duplicate IDs, tamper, pre-existing outputs, invalid dialogue.
5. .github/workflows/v15-business-skills-private-qa.yml: GitHub Actions branch/PR CI, pure Node 22 tests + static no-send check, no credentials/provider APIs. Parent PR #123 itself has successful offline A-B-C-D workflow run #43766891565.

## PRIVATE LOCAL DATASET QA (structure only, no GitHub upload)
- 96 single-turn unique case IDs: structure/SHA PASS, actual_output empty.
- 36 multi-turn unique case IDs across 6 groups: structure/SHA PASS, all NOT_RUN.
- 132 unique cases, model evaluations 0, real model quality score UNKNOWN, price/stock/catalog snapshot still unfrozen.
- Historical AI_SALES_QA_CASES.csv has 97 rows but only 96 unique (QA01 duplicate); never treat as 97 new fresh benchmark cases.

## QA / safety / rollback
- Local NEW tests: 12/12 dataset parser + 21/21 capability policy PASS. GitHub CI must be inspected at final HEAD before marking remote QA success.
- 0 real Meta/Zalo sends, 0 actual Orders/Products writes, 0 new paid LLM requests, 0 hosted migrations, 0 credential reads, 0 billing/model config changes.
- No core agent/provider adapter rewrites, no PR merges, no Cloudflare or Supabase deploy.
- Rollback: close this child Draft PR / revert only this branch; parent PR #122 and all Published workflows remain unchanged.

## P0/P1 release gates (NO-GO)
P0: canonical Store ownership + Hosted JWT/RLS cross-store negative tests; review RPC SECURITY DEFINER exposure; owner G2.3 Zalo proof; provider-signed webhook verification, replay/event store, subscription/revocation enforcement. None certified by pure fixtures.
P1: compare actual model Vietnamese quality/latency with user budget approval and provider permissions; frozen authoritative catalog; >100 safe real hosted samples per simple task if feasible; durable memory privacy; Commerce order confirmation/idempotency/outbox.
P2: Owner UAT private No-Send dashboard and feature selection; operational monitoring and per-Shop model cost telemetry.

## Owner acceptance checklist
- [x] Read-only external audit + exact parent PR branch confirmation.
- [x] Reuse V14.7/V14.8 and V15 AI Core rather than rebuilding.
- [x] Local tool policy QA 21/21 (source-only).
- [x] Local CSV integrity QA 12/12; 96/96 + 36/36 structural checks.
- [ ] This branch's GitHub CI at FINAL exact HEAD success (new integration tests added; previous #43766961524/#43766961536 success at earlier HEAD).
- [x] Parent #123 A→B→C→D offline CI succeeded, but live capability/merchant consent still BLOCKED.
- [ ] Real signed provider events + hosted identity ownership proof.
- [ ] Owner independent UAT and explicit release approval.
- [ ] Multi-model paid quality comparison (requires hard budget approval).
- [ ] Commercial release / Published changes (separate approval).

Label: VERIFIED / IMPLEMENTED / TESTED OFFLINE / PROPOSED / BLOCKED; never confuse SOURCE-ONLY with Production readiness.
