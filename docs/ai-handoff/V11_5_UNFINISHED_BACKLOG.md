# TIEN404 V11.5 — Outstanding Backlog / Priorities

**Date:** 2026-11-13 · No percentages assigned without complete acceptance criteria. Existing V11 branch/PRs preserved.

| Priority | Workstream | Reality | Exit gate |
|---|---|---|---|
| P0 | Auth + tenant isolation | BLOCKED: hosted signed two-user QA credentials absent | A/B login, positive/negative tenant writes, refresh/reopen/logout, staff/nonmember denial and audit |
| P0 | Merchant RPC & stale conflicts | QA-ONLY; PT409 migration present, Advisor flags `SECURITY DEFINER` | Role review + signed HTTP A/B, no direct write, no unauthorized RPC |
| P0 | Order lifecycle | NOT READY; post-save order event to notification missing | Verified persistent order + readback + atomic outbox in same transaction; no AI hallucinated success |
| P0 | Notification concurrency | PROPOSED SQL candidate only | Unique event/channel, worker atomic claims, two concurrent executions, timeout ambiguity |
| P0 | Financial integrity | Pending orders not paid; real billing not activated | Paid/refund receipt mapping, costs and reconciliation, no fabricated profit |
| P1 | Zalo OA | Policy/code QA only; no app/verified OA/template/recipient or budget approval | Official permission + OAuth, true owner consent, approved template and pricing, isolated live test to consenting owner |
| P1 | Channel Integration UI | NOT IMPLEMENTED as authenticated Dashboard feature | Mobile-first real tenant settings, Zalo first/off, verified test send, selected channels, accessible state |
| P1 | Messenger merchant alerts | Guard 27/27 simulated; owner PSID not verified | Separate owner PSID & Facebook Page permission/interaction; prevent customer data send |
| P1 | Telegram/Gmail routing | V4.5 QA accepted one event; not generalized | Verified merchant/channel map and retries; no hardcoded developer recipient |
| P1 | Super Admin | Hosted identity/MFA unresolved | Authorized staging host, negative role tests, audit |
| P1 | Restore/DevOps | Checkpoint hosted anonymous health and QA | Isolated Supabase restore, data recovery runbook, alert severity and budget thresholds |
| P1 | Render | Workspace available but not selected/confirmed for this session | Owner confirms workspace, then inspect services and staging commits |
| P1 | Legal/Tax | Draft review, no certification | Operator registration/rights, Vietnamese tax & data protection, Japan residence/cross-border, Zalo OA verification |
| P2 | Core Bot / Industry Factory | Existing lab and QA branches, do not promote | Reviewed Core Bot, owner approval, 1→3→5 shops controlled QA |
| P2 | Subscription & Billing | Feature assessment, no money flow activation | Versioned entitlements, expiration, invoice, refund and payment security |

## Safe continuation order

1. Review PR #32 and CI; add authenticated staging UI only after existing tenant endpoints mapped.
2. Resolve signed Auth A/B P0 on the *existing* Work V11 path; do not duplicate #26.
3. Verify two-worker isolated database transaction/unique claims, backup first; owner approves migration.
4. Research/fill Zalo OA prerequisites with authorized owner; implement adapter mock→QA→CANDIDATE.
5. Integrate outbox with Commerce staging after payment/order rollback QA.
6. Only then request production permission; no auto-send from live Messenger before gates.

The separate commercial strategy is Zalo-first, but Zalo cannot be activated in absence of verified and policy-approved provider access. Telegram/Gmail remain working QA channels.
