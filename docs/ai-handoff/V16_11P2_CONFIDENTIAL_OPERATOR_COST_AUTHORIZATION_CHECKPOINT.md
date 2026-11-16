# TIEN404 V16.11P.2 — Confidential Operator Assignment × Account-Specific Quote Review × Bounded One-Action Authorization

**Checkpoint:** 2026-11-16 JST  
**Status:** SOURCE-ONLY / DRAFT / NO REAL EVIDENCE / NO COST QUERY YET / NO PAID RESOURCES / HOSTED NO-GO  
**Parent:** V16.11P.1 Draft PR #225 HEAD \`3788fbdcba92811267dd34578f5c238ceef2838d\`. Do not merge or change parent.

## 1. Direct read-only audit — verified

- GitHub PR #225 remains OPEN DRAFT at the exact HEAD above. V16.11P.1 had GitHub CI **522/522 Node, 212/212 Chromium + disposable PG17** PASS (not hosted evidence).
- Supabase project \`tien404-staging\`, ref \`ifxlvrhyjhbzbrkdsida\`, ACTIVE_HEALTHY, PostgreSQL 17.11, region \`ap-southeast-1\`. A project→organization mapping was found using the Supabase connector, but **the user has not specifically confirmed that organization for billing**.
- The organization ID exists in private connector context. **It is not stored in this public repository**. Supabase \`get_cost\` requires an \`organization_id\` and its connector instructions say to **ask the user** before obtaining cost. Thus \`get_cost\` has **NOT BEEN CALLED** for either \`project\` or \`branch\`. No account-specific quote can be claimed.
- Supabase development branches list is empty; public \`stores\`/\`store_memberships\` and \`store_id\` on products/orders/customers absent. Existing Tenant-level RLS does not prove same-Tenant Store A/B.
- There is no actual independently attested Backup Operator, Security Reviewer, Merchant Owner A/B or Release Authority, and no scoped signed DPA or commercial n8n license permission.

## 2. Public documentation — **NOT** organization quote

Sources rechecked 2026-11-16:
- https://supabase.com/docs/guides/platform/manage-your-usage/branching: Preview branch Micro Compute begins at **$0.01344/hour**, branch charges include disk, Storage and egress usage, **branching not covered by Spend Cap**, Compute Credits don't apply to Branching Compute.
- https://supabase.com/docs/guides/platform/clone-project: Restore to new project available only for paid-plan users with **physical backup** enabled. Creates an independent project with additional monthly cost; **Storage object bytes, Edge Functions, Auth settings/API keys, Realtime settings not cloned**. Binary restore may start **external extension jobs (pg_cron/pg_net/wrappers) immediately**. Restore is not automatically a no-send environment.
- https://supabase.com/docs/guides/platform/backups: physical and logical backups differ; Supabase DB backup includes Storage metadata but not object bytes; custom role passwords must be reestablished.

Reference-only Micro compute at $0.01344/h: 8h $0.10752, 24h $0.32256, 72h $0.96768. **These values are NOT a provider quote for a new restored project or the user's organization**, and they omit subscription, disk, object storage, egress, taxes, retention, backup operator costs, and possible upgrades.

## 3. What this PR actually creates

- \`qa/v1611p2-authority/approval-gate.mjs\`: contract for requesting an **account-specific read-only cost quote** only, requiring organization confirmation separately before any connector call. It never grants that authorization itself. Strict input allowlists, six synthetic role nominations, anti-self-review and cross-Store tests. Functions hard-block hosted SQL, backup, restore, credential access, provider sends, project/branch provision and production.
- \`docs/ai-handoff/V16_11P2_CONFIDENTIAL_QUOTE_ONE_ACTION_PACKET.json\`: current project identity and nonsecret read-only status, **six unverified real persons**, two NOT_QUERIED account-specific quotes, unsigned action packet and all hosted NO-GO. No organization ID, real name, token, JWT, key, proof file or backup bytes.
- \`qa/v1611p2-authority/approval-gate.test.mjs\`: **50** new source-only guard tests. Parent 522 Node, 212 Chromium and disposable PG17 regression retained.
- \`qa/v1611p2-authority/index.html\`, \`operator-ui.mjs\`, \`operator.css\`, \`browser.test.cjs\`: local Vietnamese readiness dashboard with no HTTP fetch/storage/cookies/uploads. Shows two quote targets missing, actor slots missing, one-action unsigned; never collects real evidence.
- The inherited \`.github/workflows/v169-onboarding-security-nosend.yml\` is extended **only on this child branch**. Must pass on exact final PR HEAD before mark TESTED.

## 4. One bounded action proposed — NOT APPROVED

\`REQUEST_ACCOUNT_SPECIFIC_COST_QUOTE_READ_ONLY\`

Proposed independent steps:
1. User explicitly identifies/confirms the Supabase organization associated with \`tien404-staging\`. Do not use a guessed organization, even if an ID was detected.
2. After user confirmation, call Supabase \`get_cost({organization_id:<confirmed>,type:'branch'})\` for branch quote or \`type:'project'\` for a separate project. Quote calls are **read-only** and do not create billable resources. Reconfirm if actual cost scope differs.
3. Report the exact organization-specific provider result, exclusions, whether eligibility is unknown, the region, potential monthly/daily charges and any required upgrade. Do not interpret an estimate as a signed price lock.
4. User separately authorizes an exact **single high-risk operation** only after signed human evidence, budget cap, maintenance window, backup destination and rollback review. Cost-query approval does **not** authorize resource provisioning, backup, restore, schema migration or a paid plan.
5. Actual signatures and identity attestations must be verified using a privately operated system and be independent of the person proposing the change; no PR comment or model-generated form is a valid signature.

### Explicit authorization matrix

| Action | Current status |
|---|---|
| Read-only org/project discovery | VERIFIED |
| Account-specific cost query | AWAITING USER ORGANIZATION CONFIRMATION |
| Actor nomination metadata synthetic | IMPLEMENTED SOURCE-ONLY |
| Real people appointed/attested | MISSING |
| Signature verification | MISSING |
| Paid project/branch creation | NOT AUTHORIZED |
| Real hosted backup/restore | NOT AUTHORIZED |
| Hosted Store/JWT-RLS migration/test | NOT AUTHORIZED / BLOCKED |
| Privileged RPC grant/revoke | NOT AUTHORIZED |
| Customer ingestion / production send | NOT AUTHORIZED |

## 5. Operator separation and confidential evidence

Six roles remain independently unresolved: Merchant Owner A, Merchant Owner B, TIEN404 Platform Requester, Backup Recovery Operator, Independent Security Reviewer and Release Authority. A real, authenticated authorization must bind an **identified person**, bounded scope/target, exact operation, independent reviewer, timestamp, expiry, legal basis and evidence digest/private locator, not merely a typed name.

Keep **real proof outside GitHub, CI, this chat and n8n execution logs**, in an approved access-controlled vault. Source files contain only synthetic IDs and status labels.

## 6. Recovery security and rollback

Before any hosted restoration involving real data, require written permission and isolation guarantees: database + Storage object bytes/metadata + Auth role/session restoration, secret/key custody, backups, versioned reversible migration, RPO/RTO, network egress restrictions, and **explicit handling of restored jobs that may automatically send network requests**. A cloned project is not safe by default.

No high-risk action is authorized by approving or merging this Draft. Close the Draft PR to roll back current changes; no hosted data, credentials, subscriptions, costs or n8n Published were modified.

**Proposed next after CI:** privately confirm the exact Supabase organization for the read-only cost query and obtain its provider quote. Do not proceed to payment, project creation or real hosted backup without a fresh specific approval.
