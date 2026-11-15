# TIEN404 AI — V14.5Z-LIVE03F — TRIAL-UNTIL-DEADLINE & COMMERCIAL PLAN DECISION
Date: 2026-11-16 JST
Status: BUSINESS DECISION ACKNOWLEDGED / COMMERCIAL PLAN NOT PURCHASED / BACKUP NOT CERTIFIED
Source: user instruction to continue on n8n trial until expiration, reassess near the due date, and select a package matching project and commercialization needs.
Environment: n8n Cloud ngoctien20.app.n8n.cloud
GitHub: Draft PR #103 on work/v145z-live01-limited-uat-gate

## DECISION (OWNER)
1. Keep existing n8n Cloud trial running under its current limits. Do NOT upgrade to Starter/Pro, enable auto top-up, buy credits, change billing, or trigger paid subscription based on this approval.
2. Re-evaluate the subscription near the actual trial deadline and based on verified consumption and TIEN404 commercial readiness/revenue. The trial banner on Nov 16, 2026 shows '7 days left', which suggests around Nov 23, NOT a provider-certified exact cutoff date.
3. Do not imply that TIEN404 already has verified paying merchants/revenue: user wording references commercialization, but no independently checked customer or invoice records were audited this turn. If real paying merchants currently rely on this trial instance, **an uninterrupted service plan must be approved and implemented before expiry**, not after shutdown.
4. The Export workflow and its local verifier are ready for review as a process, but **NO owner-downloaded full-account Export archive was attached in the current conversation or confirmed from Library**. Accordingly BACKUP_FILE_VERIFIED=FALSE, RESTORE_TESTED=FALSE. Do not claim a recovery-grade backup has been accepted.
5. Prefer a fresh private owner export while trial still works, even if plan purchase is deferred. Store offline/encrypted and never commit a raw workflow export to a public GitHub PR.

## AUDITED STATUS (2026-11-16)
- n8n Cloud actual authenticated change-plan page at https://app.n8n.cloud/account/change-plan shows trial banner '7 days left'; 129/1,000 trial execution counter at the time of inspection.
- Read-only n8n inventory: 98 workflows, 19 active; four active workflows have mismatched Draft and Published versions (Manage Order, Revenue Report, Update Order and Create Order). Full account Export has not been evaluated.
- n8n Gateway credit page UI balance $0.59 remaining of $2.00 free credit, last 7 days spend $1.20, ~0.18/day observed. This balance is shared among workflows and may change.
- Zalo outbound Worker remains ZALO_SEND_ENABLED=false. LIVE03C staging budget D1 QA grants 7 STOPPED, zero armed. Published ingress/private router kept unchanged.
- Provider immutable Bot ID and trusted Shop B→Owner QA association still NOT verified; no real provider sends.
- No hosted deployment, credential rotation, billing change, payment, n8n workflow update or production release requested or performed here.

## PLAN OPTIONS — VERIFIED FROM OWNER CONSOLE + OFFICIAL PUBLIC PRICING
| Feature | Starter | Pro |
| --- | --- | --- |
| Owner-account annual-rate equivalent | EUR 20/month billed annually | EUR 50/month billed annually |
| Annual total at stated annual rate, before VAT | EUR 240 | EUR 600 |
| Workflow executions/month | 2,500 | 10,000 |
| Shared projects | 1 | 3 |
| Concurrent executions | 5 per owner's console | Pro owner console displays 20, public site currently displays up to 50; REQUIRE recheck at checkout |
| Admin roles, execution search, wider insights | Limited | More available |
Do NOT claim the annual equivalent can be paid month-to-month at that rate. Monthly billing prices must be verified by selecting Monthly without completing checkout. n8n Gateway model-token costs may be charged in addition to subscription. Assistant credits are not model Gateway credits.

Current published pricing https://n8n.io/pricing/ (2026-11-16). Owner console https://app.n8n.cloud/account/change-plan. If site and console features/limits disagree, use the account's final checkout terms before approval.

## DECISION RULES AT REVIEW
- STARTER candidate: measured 30-day total workflow executions <=2,500, peak simultaneous executions <=5, one shared project is workable, all tenant isolation is implemented at data level, QA and monitoring demonstrably pass, no advanced admin role needed, and the owner's expected merchant revenue and margin cover total service cost.
- PRO candidate: measured/projection executions materially over Starter limit or peak >5, separate shared projects/admin role/insights mandatory for commercial multitenancy, and a confirmed paying customer base supports higher expenses. Do not use 98 total workflow definitions as a Pro purchase trigger.
- DEFER PAID PLAN: if no paying stores or launch remains blocked; but acknowledge the instance stops/deletes after trial if no subscription. Keep the offline backup. **Never defer until after service interruption if customer-facing automation is actually live.**
- SELF-HOSTED alternative requires a separately scoped architecture/cost/credential/migration project; n8n Cloud Gateway credits do not automatically work in self-hosted mode.
- NEED DATA: exact trial end in console, true monthly execution volume by workflow/tenant, concurrency peak, database/API costs, expected paid merchants, accepted service uptime level, monthly vs annual checkout terms, VAT and billing budget approval.

## TRIAL POLICY/RISK
Official n8n Help Center, updated 2026-10-27: standard 14-day trial automatically expires and charges nothing without checkout. After expiry a 3-day grace is followed by instance stop, then another 5 days before instance deletion. Workflow export access may remain for up to 90 days after expiry. These periods are **not** service uptime guarantees.
https://support.n8n.io/article/how-do-i-cancel-my-trial
n8n Cloud full-account workflow backup must be downloaded by owner; official guide:
https://support.n8n.io/article/how-to-export-workflows-from-the-n-8-n-cloud-admin-panel
Restore-grade backup also requires checking Published workflow versions, credentials, data tables and independent import/restore QA.

## RELEASE GATES & ROLLBACK
- VERIFIED: trial status in owner's account, plan pricing, read-only workflow inventory and current safe outbound lock as previously checked.
- PROPOSED: keep trial until due date; prefer Starter for a genuinely low-load commercial MVP, conditionally evaluate Pro when real needs exceed Starter.
- BLOCKED: backup file accepted, actual paying merchant revenue validation, final real Bot/Owner identity, subscription payment approval, real Zalo send.
- CHANGED: source-controlled decision document only; no production changes. Rollback by reverting this Draft PR document change; no operational rollback needed.
- FINAL: NO-GO REAL ZALO SEND, NO AUTO UPGRADE, NO BILLING CHANGE.
