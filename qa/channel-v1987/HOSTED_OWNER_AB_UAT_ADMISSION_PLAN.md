# TIEN404 V19.8.7 — Real Owner Authority Preflight × Hosted Store A/B UAT Admission

**Checkpoint:** V19.8.7 / **HOSTED UAT NO-GO** / READ-ONLY EVIDENCE / DRAFT PR #459 / NO LIVE CHANGES

This is a staging safety decision, NOT a live authorization service or Supabase migration. All evidence reflects a **read-only audit on 19 Nov 2026 JST**. This document is deliberately public-safe: no raw JWT, passwords, API keys, personally identifiable user IDs, customer records or secret values.

## 1. What was actually VERIFIED

- Supabase **tien404-staging** (`ifxlvrhyjhbzbrkdsida`) is ACTIVE_HEALTHY.
- Existing QA Shop A and Shop B are **different tenants**, not Store A and Store B under one tenant.
- Shop A: **1 active Owner membership**, 1 corresponding Auth account, 1 owner with prior sign-in in past 30 days and an Auth session record.
- Shop B: **2 active Owner memberships**, 2 corresponding Auth accounts, **1** owner with prior sign-in in past 30 days and an Auth session record.
- **0 shared active Owner accounts** across Shop A and Shop B. Distinct test accounts exist, but this does not prove same-tenant two-Store access.
- The six examined public Commerce tables — Products, Customers, Orders, Order Items, Conversations, Messages — currently have **no `store_id`**. No canonical public Stores/Store Memberships schema was detected.
- Commerce SELECT RLS policies are tenant-membership based, not Store scoped.
- The QA Bot registry contains only synthetic/dry_run entries. Real Zalo webhook V19.7I receipt-only success is NOT a real Bot→Store owner attestation.
- Earlier PostgreSQL 17 hosted CI containers proved synthetic policy/FK logic, **not** actual signed Supabase Owner A/B JWT or a Store-scoped hosted Data API.
- Existing `public.qa_owner_pairing` is SECURITY DEFINER; anonymous execution denied, authenticated role execution allowed, internal SQL includes `auth.uid()`, tenant Owner checks and a synthetic QA allowlist. This is NOT sufficient to bind a real Bot to a canonical Store.
- Supabase security advisor reported 1 anonymous SECURITY DEFINER warning, 2 authenticated SECURITY DEFINER warnings, 1 leaked-password-protection warning; 23 informational no-policy notices (many private schemas may intentionally deny all). Security findings are *review required*, not proven exploits.

**Important:** Auth sign-in history and `auth.sessions` metadata are **not proof of a currently valid JWT**, correct logged-in actor, app redirect, or actual RLS allow/deny through Supabase Data API.

## 2. Hosted UAT admission decision

**NO-GO.** Mandatory requirements not satisfied:

| Requirement | Current | Why it blocks |
|---|---|---|
| Approved isolated hosted Supabase UAT target | BLOCKED | Two connected projects are existing staging and personal BIO; no approved disposable same-tenant Store A/B target |
| Canonical Store and Store Membership ownership | BLOCKED | Missing in connected Commerce schema |
| One tenant with two distinct Stores A/B | BLOCKED | Current Shop A/B are different tenants |
| Real signed Owner A & Owner B authenticated Data API sessions | BLOCKED | Prior session records only; actual bearer acceptance has not been exercised |
| Store-scoped RLS across all related Commerce tables | BLOCKED | 6 checked tables lack `store_id`; policies tenant-wide |
| Verified canonical Zalo Bot Installation → Store mapping | BLOCKED | QA registry only synthetic |
| Hosted protected catalog reader | BLOCKED | Only disposable PostgreSQL CI and offline adapter |
| Security advisor WARN triage and explicit acceptance | BLOCKED | Findings observed, not approved |
| Backup+restore evidence, approved isolated migration and rollback | BLOCKED | No authorized migration has been executed |
| Legacy writer compatibility and isolation from published workflows | BLOCKED | No hosted Store writer cutover evidence |

The `hosted-uat-admission-gate.mjs` is intentionally not an authorization mechanism. It evaluates published-safe audit metadata only. Even a hypothetical all-green checklist yields **MANUAL_SECURITY_REVIEW_REQUIRED / NO_GO**, never a live grant.

## 3. Proposed hosted UAT (requires separate explicit permission BEFORE changing DB)

1. **Approve target and cost:** Owner selects a brand-new *disposable* hosted Supabase QA project or provides an already isolated and explicitly approved one. Never repurpose personal BIO project, production or the shared active TIEN404 staging without a migration review.
2. **Snapshot and rollback:** Verify backup/restore procedure for any DB being modified; create a versioned migration commit and complete writer-caller inventory. No customer rows, credential or production traffic.
3. **Create fake Store A/B under exactly one QA tenant** on the disposable target. Create two separately authenticated real QA Owner accounts and explicit Store membership A→A, B→B; one non-member same tenant. Use **only fake products**, including same SKU at different prices to detect store leaks.
4. **Verify Auth using browser/client itself:** two independent login sessions (separate browser profiles). Each obtains a valid, unexpired signed JWT directly from Supabase Auth. Do not copy JWT into ChatGPT, GitHub or CI logs.
5. **Data API allow/deny:** exercise Supabase REST/PostgREST with user-session credentials, not service-role. Owner A can read only Store A; Owner B can read only Store B. Test Products, Orders, Order Items, Conversations, Messages, Customers, invalid/expired session, revoked Store membership, wrong Store, same SKU different prices, and denied unauthorized write.
6. **Audit functions/grants:** verify any SECURITY DEFINER RPC accessible from an exposed schema is explicitly scoped, has immutable search_path and adequate challenge/replay/rate controls. Document advisory resolution or risk acceptance; do not change credentials/roles without separate permission.
7. **Capture evidence:** only test IDs, redacted actor label, env, expected vs observed, sanitized HTTP status, row-count-only scope, migration checksum, JWT signature verification result (boolean), timestamps, Store role and rollback proof. Never persist JWT, personal IDs or customer payloads.
8. **Release authority:** independent QA/Security review; block if any unexpected ALLOW, ambiguous owner relation, missing isolation or price mismatch. After hosted QA, a **separate authorization** is required for real Zalo Bot binding, auto reply, orders or notification.
9. **Rollback:** disable hosted reader flags, revoke test installation, delete only disposable fixture data after explicit authorization. Never revert to tenant-wide RLS as a rollback for multi-Store tenants.

## 4. Evidence matrix and real UAT acceptance

Reuse **24 Owner A/B scenarios** from `qa/channel-v1982/OWNER_AB_RLS_ACCEPTANCE_PLAN.md` as the minimum, and add real-token acceptance for signed issuer/audience/expiry, cross-Store same-tenant and API replay/refresh. A PostgreSQL mock `auth.uid()` is insufficient for real-Owner UAT acceptance.

For each gate use **VERIFIED / IMPLEMENTED / TESTED / PROPOSED / BLOCKED** and cite immutable version/CI evidence. Do not claim hosted real Owner A/B approval until the Data API tests pass with two independent signed sessions.

## 5. Related evidence

- `READONLY_PREFLIGHT_EVIDENCE_20261119.json` — sanitized read-only metadata snapshot. Not cryptographic proof.
- `hosted-uat-admission-gate.mjs` — deny-by-default **metadata-only** preflight result; never grants hosted UAT.
- `hosted-uat-admission-gate.test.mjs` — checks baseline is NO-GO and changing claims never grants access.
- Supabase security advisor remediation: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- Leaked password protection: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Keep V19.7I active receipt-only webhook and previous PR #459 Draft. **No deploy / migration / n8n published edits / customer data changes / provider send.**

## 6. Rollback

All work here is QA/docs on Draft PR #459. Rollback by reverting `qa/channel-v1987/` and the corresponding GitHub Actions workflow, or closing the PR. Real hosted schema/data/credentials have not changed, so no Supabase rollback action is necessary.

**Next protected dependency:** explicit approval of a disposable hosted QA target and test-data schema, then genuine Owner A/B signed-session UAT with a migration/rollback plan. This PR does **not** request permission to apply the real migration.
