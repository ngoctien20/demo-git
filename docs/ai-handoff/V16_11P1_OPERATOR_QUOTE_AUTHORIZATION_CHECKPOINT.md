# TIEN404 V16.11P.1 — Real Operator Assignment × Quote-Only Recovery Target Evaluation × Scoped Written Authorization

**Date:** 2026-11-16 JST  
**Status:** SOURCE ONLY / DRAFT / NO SEND / NO HOSTED CHANGE / NO-GO for real backup and JWT-RLS  
**Base:** PR #222 exact HEAD \`beabdc32b450fb7da5fd23fc9979b2ba440e64a1\`. No parent merge or overwrite.

## 1. Verified live baseline (read-only)
- Supabase \`tien404-staging\` \`ifxlvrhyjhbzbrkdsida\`, PostgreSQL 17 in \`ap-southeast-1\`, active.
- No \`public.stores\`, \`public.store_memberships\`, nor \`store_id\` on Products/Orders/Customers. FORCE RLS on inherited tenant tables is NOT adequate for independent Shop A/B in same tenant.
- No Supabase preview/development branch returned by the existing-branches query.
- Supabase Security Advisor: WARN 1 publicly callable SECURITY DEFINER function, 2 authenticated callable SECURITY DEFINER functions, leaked password protection disabled. Existing RPCs \`qa_shop_b_zalo_claim\`, \`qa_owner_pairing\`, \`save_merchant_product\` must have independently reviewed exact callers before any revoke.
- n8n Messenger \`Z7FdV7uDvApfbURQ\` Published version \`d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92\` unchanged; no send or workflow edit.
- PR #222 OPEN DRAFT exact HEAD, CI run #43875143279 SUCCESS: 460 Node, 140 Chromium, disposable PG17 synthetic RLS + local pg_dump/restore. These do NOT establish real Supabase JWT or hosted backup.
- No organization-specific Supabase quote or resource eligibility was obtained and no real human operator was assigned in this phase.

## 2. What was implemented
- \`qa/v1611p1-operator/quote-gate.mjs\`: verified PUBLIC compute price reference only, compare recovery target quote scenarios, strict draft-only request validator, separate in-memory synthetic role nomination/reviewer, irrevocable NO-GO even after mock metadata review.
- \`docs/ai-handoff/V16_11P1_OPERATOR_ASSIGNMENT_QUOTE_ONLY_PACKET.json\`: six real role slots, all unassigned/unverified, three provider options, 18 missing private evidence requirements, no real signatures, quote and action authorization absent.
- \`qa/v1611p1-operator/quote-gate.test.mjs\`: new source-only security / pricing / forged approval / Store A/B access tests.
- \`qa/v1611p1-operator/index.html\`, \`quote-ui.mjs\`, \`quote.css\`, \`browser.test.cjs\`: Vietnamese mobile-first offline scenario UI, no sensitive inputs, no network/persistence and zero live action.
- \`.github/workflows/v169-onboarding-security-nosend.yml\`: only on this child branch, extend existing known CI, including inherited V16.11P 460 Node + 140 Browser + disposable PG17 synthetic recovery.
- \`docs/ai-handoff/V16_11P1_OPERATOR_QUOTE_AUTHORIZATION_CHECKPOINT.md\`: this runbook, scope, independent signoffs and rollback.
- **Independent CI run must succeed at exact new PR HEAD before mark TESTED.**

## 3. Quote-only options — public reference price, NOT actual bill

Official source (as of 2026-11-16): https://supabase.com/docs/guides/platform/manage-your-usage/branching . Preview Branch Micro compute starts from **$0.01344 per hour**. Additional Compute sizing, Storage/object bytes, disk, egress, service usage and subscription eligibility affect the actual charge. Supabase documentation states branching usage **is not protected by Spend Cap** and credits may not apply.

| Option | 8h compute reference | 24h compute reference | 72h compute reference | Decision |
|---|---:|---:|---:|---|
| Existing disposable PG17 on runner/local | Not quoted | Not quoted | Not quoted | Only synthetic; no real customer data |
| Supabase Preview Branch Micro | $0.10752 | $0.32256 | $0.96768 | Quote only; don't create until exact authorization |
| New isolated Supabase Project Micro | $0.10752 | $0.32256 | $0.96768 | Compute reference ONLY; actual project/plan charges unknown |

**Important:** A Preview Branch may be an insufficient isolation boundary for a hosted **real** backup or merchant PII. Neither copying production data nor provisioning a branch constitutes a secure restore without independent compliance and access review.

**Account-specific quote:** NOT OBTAINED. A privileged call to Supabase \`get_cost\` requires organization context and user participation under connector controls; do not conflate public unit pricing with an account-specific quote. **Do not create resources, upgrade plan, start backup/restore or trigger billing.** Require written quote (account/org, region, target plan & compute, expected hours, storage/egress, cancellation/cleanup, taxes/FX, safe disposal) and explicit user acknowledgement before requesting any paid API action.

**Current recommendation:** First use local/synthetic PG17 for zero-real-data preflight and security review. For a future independently approved sensitive hosted restore, investigate a separate isolated project with no live webhooks/providers, data minimization, access controls, billing approval and secure deletion; do NOT automatically choose Branch.

## 4. Real operator assignment (slots, NOT assigned people)

Required independent signers:
1. **Merchant Owner A:** authorizes Shop A data, legal basis, provider Page/OA ownership and private evidence access.
2. **Merchant Owner B:** separately authorizes Shop B; never inherit A's authorization.
3. **TIEN404 Platform Requester:** submits exact staging project and scope, collects cost options; cannot grant self authorization.
4. **Backup/Recovery Operator:** separately appointed, approved to handle only exact authorized copy, encryption keys, restricted destination and restore target.
5. **Independent Security Reviewer:** different human/account from requester and operator, verifies real JWT identity, same-Tenant Store isolation and hash/restore, explicitly signs.
6. **Release Authority:** separate last-stage go/no-go after evidence and approved canary.

No individual is assigned simply by adding a string/name in GitHub. Actual identity proof, real signed approval and private evidence must be in a genuinely authenticated, encrypted, access-controlled system outside GitHub and LLM chat. A reviewer proof issued by in-memory QA is NOT a real credential.

## 5. Scoped written authorization request (DRAFT only)

A future real request should include all of:
- **Action:** one of read-only host inventory, encrypted backup, Storage object backup, isolated restore, nonproduction JWT-RLS QA, RPC-specific revoke or canary — **one action per signed request**. Do not bundle high-risk actions into general permission.
- **Target:** exact project ref, environment, source DB and complete destination/restore target, region, expected tenant/store subset and sensitive data exclusions; no ambiguity.
- **Reason:** legacy Store owner reconciliation and risk reduction; do not invent business ownership or customer consent.
- **Data class:** synthetic, merchant catalog, personal customer data; legal basis, DPA, storage retention and key custody.
- **Security:** actor identities verified privately, two-person independent approval, backup encryption, SHA256 digest, rollback and RTO/RPO objective.
- **Budget:** actual provider quote with currency, max cap, forecast hours, possible plan/egress and tax charges; explicit account owner acknowledgement.
- **Window:** exact start/end and timezone, timeout and automatic cancellation/cleanup plan; any downtime requires separate consent.
- **Evidence:** signed reference in private vault and exact policy/API/SQL/commit SHA, no raw JWT/token/password or PII in GitHub.
- **Validity:** time-limited nontransferable authorization; revoked on scope change; never reused to approve additional action.

**Current receipt:** \`WRITTEN_APPROVAL_DRAFT_UNSIGNED\`. No real operator, quote, budget, maintenance window or signature. Thus every mutation/provisioning call must remain disabled. A PR approval cannot substitute for security and budget approvals.

## 6. Recovery target & data completeness
- Supabase DB backups cover database state, **not Storage object bytes**. See https://supabase.com/docs/guides/platform/backups .
- Duplication/restore to a new project does not by itself copy Storage files, Edge Functions, external Auth settings/keys or all integrations; see https://supabase.com/docs/guides/platform/clone-project .
- For true recovery, record separate authorized DB backup and Storage object bytes/metadata, Auth sessions/custom DB roles, password/secret reset plans, channel credential reconciliation, caller inventory, post-restore consistency, disabled outbound webhook, rollback and destruction of copy.
- JWT-RLS real Owner A/B acceptance is blocked by hosted Store schema; do not fake JWT via \`set_config\` or test using \`service_role\` in place of merchant token.

## 7. Decision, blocked gates and rollback
- **VERIFIED:** hosted metadata, PR parent, n8n and public Supabase rate.
- **IMPLEMENTED:** source-only quote calculator and multi-signer draft.
- **TESTED:** only after independent GitHub CI is green at exact HEAD.
- **BLOCKED:** named real operator and independent reviewer, owner evidence and DPA, account-specific quote, written spending consent, hosted recovery and JWT/RLS, privileged RPC authorization and release.
- **NO-GO:** no actual hosted backup, restore, new project/branch, SQL, paid model/API, credential write, import, send or merge.
- **Rollback:** close this Draft PR; parent #222 and previous PRs preserved; no hosted resources to restore.

## 8. Next approval gate
**V16.11P.2 PROPOSED — Confidential Operator Assignment × Supabase Account-Specific Quote Review × Bounded One-Action Authorization.** Collect identities and signed evidence privately (never in GitHub or chat). The next high-risk action requires a dedicated approval request with exact project, cost, operator, independent reviewer, data scope and rollback. Keep no-go until those are provided.
