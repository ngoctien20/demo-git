# TIEN404 AI — V15.2 ADV.6B.1 Hosted Metadata Security Review × Independent Owner/Backup/Role Gates

Checkpoint: 2026-11-16 JST. Stage: **EXPERIMENTAL / Draft / NO HOSTED MUTATION / NO SEND / NO REAL CUSTOMER DATA / NOT SALES LITE**.

## 1. Audit facts: current hosted metadata, READ ONLY

Target staging Supabase project \`ifxlvrhyjhbzbrkdsida\`, PostgreSQL **17.11**, query executed under **postgres** metadata role. Such a privileged session is NOT an authenticated end-user request and CANNOT establish JWT/RLS isolation for two independent Owners.

From direct metadata-only checks on 16/11/2026 JST:
- Existing \`public.tenants\`, \`public.tenant_memberships\`, \`public.products\`, \`public.orders\` have RLS enabled. These predicates remain **Tenant scope**, NOT proven Store scope.
- \`public.stores\`, \`public.store_memberships\` and \`tien404_action_private\` are absent. Orders and tenant membership do **not** carry \`store_id\`.
- \`service_role\` has BYPASSRLS; \`anon\` and \`authenticated\` do not. Never use elevated query outputs to claim hosted Owner A/B JWT proof.
- Existing \`app_private.order_idempotency\` is not \`tien404_action_private.action_nonce_claims\`. No claim it is equivalent to a certified atomic one-time ACTION receipt.
- Supabase Security Advisor reports **P0 candidate**: \`public.qa_shop_b_zalo_claim\` is SECURITY DEFINER executable by \`anon\`. Direct read-only metadata confirms the EXECUTE capability. Additionally \`public.qa_owner_pairing\` and \`public.save_merchant_product\` are SECURITY DEFINER and executable by \`authenticated\`.
- No exploit testing, public RPC calls, credential or protected data reads performed. Risk requires examining full function logic and dependencies **privately**; do not falsely assert an exploit.
- Auth leaked-password protection is disabled (security advisor warning; independent configuration change approval needed).
- No actual independent Owner JWT/session and cross-Shop negative HTTP/RLS proof, Controller-approved real export+restored backup evidence, or dedicated nonce runtime role approval was verified in this audit.

**Provenance:** Supabase connected list_tables, metadata-only SELECT on pg_catalog/information_schema/pg_policies, and Supabase Security Advisors on 2026-11-16. No DDL/DML executed.

## 2. Existing work preserved; avoid duplicated branches

- [ADV6B PR #165](https://github.com/ngoctien20/demo-git/pull/165), HEAD \`3c7b64437bfc5f2d004591be395d20effb9cc912\`, OPEN DRAFT, 3/3 exact-head GitHub Actions SUCCESS. Existing \`owner-evidence-gate.cjs\` and \`pg17-durable-replay.integration.test.cjs\` remain unchanged by this child.
- [ADV6A PR #169](https://github.com/ngoctien20/demo-git/pull/169), HEAD \`3089821fc12ada21b8e4ae9791db2acedf9b2f53\`, OPEN DRAFT, 3/3 exact-head Actions SUCCESS. 10/10 disposable **real** Postgres 17 tests included 32-way single nonce claim, 12-way synthetic event+nonce transactional test and rollback. This is **not** hosted Commerce or JWT certification.
- Both PR #165 and #169 are siblings based on [ADV6 PR #163](https://github.com/ngoctien20/demo-git/pull/163), not merged. Do not silently infer #169 changes are included in #165; no mass merge/rebase.
- ADV5 vocabulary [PR #164](https://github.com/ngoctien20/demo-git/pull/164) and Studio [PR #162](https://github.com/ngoctien20/demo-git/pull/162) remain separate Drafts. No attempt to reconcile siblings by overwriting files.

## 3. New ADV6B.1 source-only work

- \`qa/v152-advanced-actions/hosted-metadata-triage.cjs\`: validates a strict, metadata-only, time-bound shape. Rejects extra fields like browser \`verified:true\`, JWT strings or self-asserted operator approval. Returns **BLOCKED** if Store tables/columns missing, executable public SECURITY DEFINER functions require review, dedicated role/schema missing, or source query is privileged.
- Critically the gate **always** says Owner JWT, Store RLS, authorized backup/restore, hosted nonce, actual Commerce write, provider send, privilege change and production release are NOT certified, even if an input object claims all database metadata are clean. It cannot authenticate the metadata source by itself; only a review triage, never a trusted host proof.
- \`hosted-metadata-triage.test.cjs\`: 28 negative/anti-overclaim test cases.
- \`.github/workflows/v152-adv6b1-hosted-security-gate.yml\`: CI: triage contract, inherited #165 Owner evidence/no-go gate, inherited signed/canonical action tests and static no-network/no-hosted-write checks.
- This child does not add any migration, real provider webhook or published workflow.

## 4. P0 controlled RPC review, separate permission approval

1. Privately inventory expected public onboarding/webhook call paths for all affected SECURITY DEFINER RPCs; identify caller role and session origin, request signature, rate-limit and schema constraints. Do NOT make public unauthenticated test calls.
2. Review function body, exact signature, owner role, scoped search_path and data mutations with a Security Reviewer. Confirm role-specific \`EXECUTE\` grants and whether \`anon\` is intentional for pairing.
3. Draft least-privilege changes, comprehensive negative/positive tests, inventory dependent workflows, rollback grants and maintenance window. Treat any privilege change as high-risk even if the advisor warns.
4. Controller/authorized DB operator plus independent reviewer must explicitly approve the exact function-signature changes and rollback **separately** before live GRANT/REVOKE/ALTER.
5. Re-audit privilege with two real non-bypass test accounts; only then may an authorized release operation be considered. No permission changes performed here.

## 5. Independent Owner/Private Backup gates

- **Owner JWT A/B:** independently authenticated and consented Owner A and B on two distinct Store IDs, both fresh sessions verified server-side and same-Tenant cross-Store negative tests. Never exchange bearer JWT in chat, GitHub or public artifacts.
- **Store model:** Store and membership schema + policy migration requires separate owner/controller authorization, prior independent backup/restore and explicit scope. Existing \`tenant_memberships\` RLS alone is not sufficient.
- **Private backup:** request a one-time export authorization and verify privately held encrypted export, SHA-256, isolated restore, custody/reviewer and rollback. A prior checklist with all fields checked is **not** authorization.
- **Private DB role:** require a non-BYPASSRLS least-privilege runtime role (no Data API exposure), dedicated encrypted server connection, restricted INSERT/RETURNING on nonce digest, audited rotation/retention and independent security signoff. Do not create role, credentials, schema, GRANT, RLS policy or migration in hosted yet.
- **Durable replay:** Real GitHub Actions PostgreSQL single-use claims are certified for ephemeral DB only. Hosted testing must cover role-granted RLS, concurrent clients, crash/restart, transaction+Commerce idempotency and independent oversight.
- **Release:** signed live actions, actual Orders and Meta/Zalo provider writes remain hard-disabled.

## 6. Approval / rollback / next

No user approval inferred by calling this stage PROPOSED. All DML, DDL, key change, backup exports, GRANT/REVOKE, n8n Published, provider SEND, paid AI calls and merges remain BLOCKED pending precise authorization.

**Rollback:** close this child Draft PR. No hosted changes or data to restore. Parent #165 and parallel #169/#163/#164/#162 preserved.

Next candidate: **V15.2 ADV.6C — Authorized Private Evidence Intake × Independent Hosted JWT/RLS Proof × One-Time Backup Decision**. No hosting writes without owner/controller, operator, and security reviewer evidence.
