# TIEN404 AI — V15 SALES LITE PILOT CONSOLIDATION CHECKPOINT
Date: 2026-11-16 JST | Release: **NO-GO / DRAFT / NO SEND** | Branch: work/v15-sales-lite-pilot-consolidation-nosend-20261116

## Owner product-scope decision
Commercial goal now: one simple Sales Lite bot for 1–3 small Vietnamese merchant pilots, **not** an Enterprise SaaS feature launch.
Sales Lite minimum scope: basic store profile, one approved messaging channel for pilot, exact catalog/price lookup, order-request DRAFT (not persisted without an approved writer), verified owner notification after an authorized saved Order, pause bot, human handoff, essential subscription status.
**DEFERRED / FUTURE ENTERPRISE**: Unified Operations Dashboard, advanced merchant-editable Bot Studio, merchant premium-model selection, multi-store analytics, multi-agent orchestrations, complex automations. Existing experimental V14.7 code and synthetic UAT stay intact, not deleted.

## Why consolidation was required (direct connector evidence)
- PR #123 current HEAD 09b0db58a6c0b35ce02aca2f20612e4a842f9b56 contains original V15 Agent Core, offline orchestrator, Owner Test Lab and model costing.
- PR #127 HEAD cbbd06377b932b96984139c820a8384a254d4bc1 is AHEAD of PR #123 (six commits), and includes independent synthetic signed QA context and backend-tool policy tests.
- PR #125 HEAD d739b0b1334320a9911c541e8c526bd87fca08dc **DIVERGED** from current #123 (GitHub compare: ahead 9 / behind 18). This branch lacks offline-orchestrator and Owner Test Lab files at its HEAD; not evidence the source was deleted from PR #123.
- PR #126 HEAD 328720b09d27a80530fbc01eaca3d825e62f7109 is based on #125, so inherits the old checkpoint.
- This new branch starts from the current #127 HEAD, and ADDS the seven previously-only #125 files and seven previously-only #126 files. The original source files and PRs were not modified and no merge was performed. PR #124 remains a PARALLEL V14.8 line and is not silently integrated.

## Concurrent upstream preservation (read-only source delta)
During this consolidation, parent #127 moved from cbbd06377 to a6622240 (two additive commits). The NEW branch keeps its original ancestry but copies those two exact additive files: trusted-gate Owner UAT checkpoint and review-only D1 replay draft. GitHub compare can still show behind=2 due to ancestry, although those two files are also present in the candidate. Never imply a Git merge/rebase occurred. Recheck upstream on final PR review.

## Hosted audit (READ ONLY, independently reconfirmed)
- Supabase staging project ifxlvrhyjhbzbrkdsida, public.stores count 0, public.store_memberships count 0; store_id among public Products/Orders/Conversations/Messages/TenantAgentConfig = 0. Hosted authenticated Store A/B isolation is NOT certified.
- Security Advisor 2026-11-16 still warns publicly anon-executable SECURITY DEFINER public.qa_shop_b_zalo_claim; no exploit claimed, but independent security assessment and owner-approved privilege correction needed.
- No Supabase SQL DDL, GRANT, RLS, RPC or data changes occurred in consolidation.
- n8n instance 110 workflows / 19 active at current read-only audit. V14.8 identity lab execution #3887 success, V15 HTTP staging lab execution #3886 success. These remain NO-SEND synthetic or health checks, not live provider/Store proof.
- Messenger end-to-end latest inspected executions #3865–#3868 success (7.163, 5.296, 15.075, 9.873 sec); they are not representative p95.

## What this branch adds
- Copied **exact** additive #125 skill and private-dataset gate files, including offline GitHub Action (7 paths).
- Copied **exact** additive #126 hosted Store ownership decision-model + review-only SQL and Action (7 paths).
- Added `qa/v15-sales-lite-pilot/pilot-release-gate.cjs` and 8 synthetic regression tests to enforce pilot scope exclusion and explicit independent-evidence gates. This source-only evidence index ALWAYS has can_publish=false, can_send=false, can_write_orders=false.
- Added unified CI workflow to run inherited V15/Owner Test Lab, PR125, PR126, PR127 and new pilot scope tests together.

## Requirements before any genuine merchant pilot
1. Independent auth.user → tenant_membership → canonical Store → store_membership evidence (same-Tenant Shop A/B and cross-Tenant Shop C), hosted JWT RLS negative QA.
2. Real provider Page/Bot/OA/Widget identity and consent, webhook replay protection and inbound/outbound permission proof.
3. Store-authoritative SKU, VND price, stock and deterministic validation, safely authorized order-request writer, transaction idempotency.
4. Correct owner notification after successful order save; human handoff and bot pause.
5. Backup, rollback and recovery test; privacy policy and data-processing consent.
6. Per-Store cost budget/rate limits, live latency telemetry and real merchant Owner UAT/signoff.
No future Enterprise functionality required for Lite release.

## Test semantics
Source-only test PASS means TESTED offline; it does **not** certify hosted JWT RLS, native provider HMAC, merchant consent, actual Orders, API send delivery, paid model cost/quality or production readiness.
CI must be green at exact HEAD before checkpoint is promoted to TESTED. Pilot release stays BLOCKED/NO-GO until independent evidence and a separate owner approval.

## Rollback
Close this new Draft PR / revert only its branch. The original #123, #125, #126, #127 and #124 branches and all n8n Published/Cloudflare/Supabase systems are untouched. Never apply the review-only SQL migration, and never auto-backfill legacy Orders or Products.

## Next constrained step
Run combined CI; resolve only offline source integration failures on this branch. Independently plan owner-approved canonical Store/ownership restoration, hosted RLS and safe real pilot tests. Do not send provider messages or write real customer data without separate scope approval.
