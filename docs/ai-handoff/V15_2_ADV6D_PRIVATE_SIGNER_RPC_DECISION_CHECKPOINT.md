# TIEN404 AI V15.2 ADV.6D — Private Signer Authority × Controller/Operator Decision × Hosted RPC Security Gate

Date: 2026-11-16 JST. **DRAFT / EXPERIMENTAL / NO SEND / NO HOSTED MUTATION / NOT SALES LITE DEFAULT.**

## 1. Source checkpoint / actual state verified

- Parent [ADV.6C PR #176](https://github.com/ngoctien20/demo-git/pull/176) OPEN DRAFT at exact verified HEAD \`de28a756abadad6f2549870cd908796a40755958\`, 3/3 workflow SUCCESS. ADV.6C verifies 37/37 offline synthetic multi-role Ed25519 receipt cases. This **does not** certify real people, independent Security Reviewer, Owner JWTs or backup authorization.
- [ADV.6B.1 PR #172](https://github.com/ngoctien20/demo-git/pull/172) includes protected metadata NO-GO triage; [ADV.6B PR #165](https://github.com/ngoctien20/demo-git/pull/165) retains Owner/Backup/Role evidence gates. [ADV.6A PR #169](https://github.com/ngoctien20/demo-git/pull/169) has ephemeral real PostgreSQL 17 atomic nonce and synthetic transactional QA, sibling NOT merged. [PR #171](https://github.com/ngoctien20/demo-git/pull/171) PRE-ADV6C tool boundary work is sibling, NOT merged.
- Private-signing/backup precedent: [PR #135](https://github.com/ngoctien20/demo-git/pull/135) synthetic two-key signatures, [PR #158](https://github.com/ngoctien20/demo-git/pull/158) one-time real export approval **NO-GO**, neither proves the actual Controller/Security Reviewer/operator.
- Hosted Supabase staging PG17.11: canonical \`public.stores\`, \`public.store_memberships\` and \`tien404_action_private\` missing; \`public.orders\` and \`tenant_memberships\` do not have Store ID. Current Tenant-level RLS does NOT establish independent Owner Shop A/B access.
- Direct \`pg_proc\` and Security Advisor read-only audit (2026-11-16): three \`public\` **SECURITY DEFINER** RPCs owned by \`postgres\` and configured with \`search_path=""\`:
  1. \`qa_shop_b_zalo_claim(uuid,text,text,text)\`: callable by \`anon\`. Body-text pattern check indicates Vault and session-setting references, not \`auth.uid()\`; this may reflect intentional unauthenticated webhook pairing. **P0 review candidate**, NOT confirmed exploit.
  2. \`qa_owner_pairing(uuid,text,uuid)\`: callable by \`authenticated\`, body references \`auth.uid()\`; behavior and membership still require independent review.
  3. \`save_merchant_product(uuid,text,text,bigint,boolean,integer,timestamptz)\`: callable by \`authenticated\`, body references \`auth.uid()\`; per-Tenant/Store authorization and confirmation still require review.
- No function was invoked, no body or raw secret exported to GitHub, no source-level privilege fix/GRANT/REVOKE performed.

**Remediation advisory:** https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable ; https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## 2. ADV.6D implementation — source-only

\`qa/v152-advanced-actions/adv6d-private-authority-decision.cjs\` adds a REVIEW-only layer using the inherited ADV.6C signed receipt:

**A. Independent signer enrollment triage**
- An expected project digest, 24-hour max enrollment window, private enrollment and scope references for Controller, independent Security Reviewer and Backup Operator.
- Dedicated independent Registrar metadata with distinct principal SHA digest. Reject same person as signer/Registrar, duplicate signer fingerprint, principal, key ID, revoked signers, forged \`verified:true\`, extra JWT/PII keys, expired/wrong-project entries.
- **Important trust limit:** public-key fingerprint metadata and private references are *not* cryptographically anchored external identity. A fabricated map can satisfy shape validation. \`PENDING_PRIVATE_REGISTRAR_VERIFICATION\` != verified signer authority or permission to export.

**B. Controller / operator per-operation review**
- Four purpose-isolated **review requests**: backup export, Store migration, private nonce role, RPC privilege remediation. No purpose reuse.
- Require a bounded 10-minute review window, exact project/scope digest, explicit one-time intent, zero additional spend, different private references for Controller, Operator and Security Reviewer, vault custody, backup coverage, rollback and hypothetical atomic lease.
- Reuse ADV.6C Ed25519 receipt status and original project/purpose; deny mismatched purpose, invalid scope and missing RPC review. A claimed lease reference is NOT a trusted durable single-use approval lease.
- Outcome is **ALWAYS \`NO_GO_PRIVATE_APPROVAL_REQUIRED\`**: signed synthetic metadata never grants hosted export, restore, SQL, DB role GRANT, RPC ACL change, live action, provider send or production release. Manual private independent authorization is required *outside* this code.

**C. Hosted RPC review**
- Strict three-function name/signature/owner/security context and 24-hour metadata snapshot. Validate typed current \`anon\`/\`authenticated\` grants, source, restricted search path.
- Require references for function-body review, caller dependency inventory, negative & positive authenticated tests, rollback, deployment window, Controller and independent Security Reviewer.
- Known anonymous-callable privileged RPC explicitly triggers \`P0_ANON_EXECUTABLE_SECURITY_DEFINER_REVIEW_REQUIRED\`. Authenticated-callable privileged RPCs separately flagged.
- No automatic revoke. Even hypothetical clean grants still require independent behavior and rollback review.

\`adv6d-private-authority-decision.test.cjs\`: 50 synthetic security & fail-closed tests. New CI runs these with ADV.6C/ADV.6B/ADV.5 inherited contracts and static no-credential/no-mutation checks.

## 3. Independent roles — actual private SOP (NOT completed)

**Platform Controller:** project authority established privately, decides whether a specific risk-bounded staging backup is necessary, exact authorized datasets, encryption, retention, expected cost and scheduled window. Controls the organization-level approval and signs an explicit **operation-specific** request only after understanding the privacy scope. A Store merchant alone cannot authorize full staging project export.

**Security Reviewer:** independent verified person or authorized external security operator, not the controller, backup operator, signing registrar or the AI that wrote the code. Privately examines Vault/HMAC webhook guard and SECURITY DEFINER function bodies/ACL, Supabase Auth/session/Store-RLS, destination backup encryption, least-privilege role and restoration plan. Signs separate review result with scoped authorization. No "AI reviewer" self-attestation is accepted.

**Backup Operator:** separately identified access-eligible authorized person/service under the Controller's operation scope. Implements export only after a real trusted one-time executable authorization/lease, not after a public GitHub comment or checkbox. Stores encrypted output privately; no raw records in chat, logs or public CI. Restore requires separately scoped permission and independent verification.

**Registrar:** independent enrollment authority that establishes each signer's real identity, verifies public signing key origin and custody, captures out-of-band signed enrollment and revocation decisions. Does NOT accept self-registered keys as trusted without external evidence. Registrar must not also serve as Controller/Reviewer/Operator for the same operation.

The AI can prepare code/QA, but cannot be its own Security Reviewer, signer Registrar or human Controller. No actual human approval was gathered or recorded in this Draft.

## 4. RPC P0 remediation plan (DESIGN ONLY, DO NOT APPLY)

**Step 1:** Private function body review, fixed exact function signatures, security definer owner role, search_path, JWT/HMAC/Vault validation, input authentication, idempotency, storage targets and rate limiting. Account for possible intentional anonymous Zalo callback.
**Step 2:** Read-only dependency map of every n8n Published webhook, Website Widget/Owner Dashboard, Meta/Zalo adapter that invokes these RPCs. Identify potential breakage, versioned API contract and baseline success/error executions. No public unauthenticated probes.
**Step 3:** Draft minimal least-privilege changes separately for each function; possibly an authenticated backend-proxy path or security invoker only if equivalent audited RLS exists. **Do not simply remove \`anon\` if a signed webhook depends on it.**
**Step 4:** QA environment: positive real permitted caller, negative unauthorized/expired/other-Store/replay requests, regression for valid pairing and price/stock updates; preserve ability to rollback exact prior ACL or function version.
**Step 5:** Obtain independent Controller + Security Reviewer and DB Operator approval, true encrypted backup + independently restored evidence, prepared rollback and maintenance window. Only then consider explicit hosted changes as a NEW separately authorized milestone.
**Step 6:** Re-run Security Advisor and exact metadata query, verified authenticated Shop A/B JWT-RLS, webhook deliverability and audited release canary before any production promotion.

**No executable SQL remediation is stored here.** A nonexecuted recommended plan is not an applied fix.

## 5. QA evidence / blockers

Call \`TESTED\` only when exact child commit GitHub CI completes, including new 50 tests and inherited 37 ADV6C + 28 ADV6B.1 + nine ADV6B + signed action regressions.

**Never claim actual authority certified from shape checks.** Missing real external signer key custody, independent enrollment, Controller/Operator approval, backup export+restore and durable lease remain BLOCKED even for fully populated synthetic receipts. Hosted Store Owner JWT/RLS and PG nonce transaction remain blocked.

No hosted SQL DDL/DML/RLS/GRANT, no backup, no credential, no signed provider action, no Meta/Zalo sends, no n8n Published updates, no production deploy, no paid model calls and no customer data access.

## 6. Checkpoint/rollback

Parent #176 preserved. Rollback: close child Draft PR only, zero hosted data/role/workflow to restore. Next requires external private role enrollment and separately authenticated approval; this response alone is **not** approval for a one-time real export, role creation or RPC privilege change.
