# TIEN404 AI — RPC17.8A Staging Disposable Store QA Approval and Recovery Runbook

**2026-11-17 JST — PROPOSED. No Supabase DDL authorized or executed.**

## 1. Current facts verified read-only
- Parent: RPC17.8 Draft PR #353 exact head `1d4cf92edc9482000481d5954033cdd373446ad9`, CI 470/470 PASS (mocked).
- Supabase `ifxlvrhyjhbzbrkdsida`: ACTIVE_HEALTHY, PostgreSQL 17; no development branches.
- No `rpc178_qa`, no canonical `public.stores`, no `public.store_memberships`, no `store_id` columns on public Products/Orders.
- Existing staging has `public`, `tien404_dialogue_private`, `tien404_r1_qa` and `tien404_v175_qa` schemas. Do not change these.
- Count only: 3 users, 2 users with session rows, NOT real Store A/B JWT evidence.

## 2. Concrete DDL candidate (NOT authorized)
- File `qa/v152-rpc178a/sql/private-schema-candidate.sql`; exact checksum required for signed approval.
- Scope strictly `rpc178_qa`, four test tables (`tenants`, `stores`, `memberships`, `products`), FK enforcing tenant+store, authority version, FORCE RLS, no policies and zero grants to `anon`, `authenticated`, `service_role` or PUBLIC. Database superusers/owners inherently have privileged access; do not claim cryptographic isolation against them.
- No test users/fixtures seeded in the candidate migration; no columns added to Commerce or modification of `auth` or `public`. Candidate blocks if `rpc178_qa` already exists.
- Candidate is **not yet usable via PostgREST**: without schema exposure, grants and explicit RLS policies, all requests must fail closed. Never expose this schema to the Data API or grant access merely to make the runner green.
- File uses psql scripting syntax and is only executed by CI in disposable PostgreSQL 17. An actual Supabase migration must be separately adapted/versioned/reviewed with real backup and restore evidence.

## 3. Independent approval gates (all currently BLOCKED)
A. Owner proves Store A/B control through private authenticated intake, not a chat message or an unverified uploaded document.
B. Private operator and independent reviewer verify fresh MFA, real Auth subjects, canonical Store ownership and scope.
C. Exact DDL SHA + project and schema scope + no-cost evidence + grant impact approved by owner and Security Reviewer; the project is solo-founded but authorization cannot be inferred from a phrase containing the word Approved.
D. Backup baseline, prechange schema inventory and **demonstrated restore drill** independently verified; do not assume Supabase backup exists or restores successfully.
E. Migration must be scoped, additive, executed only after approval, with execution log, before/after privilege diffs and independently authorized rollback. Do not auto-DROP schemas.
F. Later separate approval required to implement live scoped access (trusted private runner, access to QA schema), to grant auth or change Data API exposure.
G. Real JWT A/B UAT must use two verified distinct sessions; validate signature, issuer, expiry and active/revoked session privately. PostgREST real RLS A/B negative proof only after true Store membership and row-scope policy. Do not accept a synthetic owner signature or fabricated jwt.

## 4. Safe disposable PostgreSQL CI acceptance
- GitHub Actions uses isolated `postgres:17` service, disposable per-job; synthetic NOLOGIN PostgreSQL roles only.
- Apply candidate DDL there; verify four tables force RLS, no policies, no public/authenticated/anon/service_role usage or table access; verify private SELECT denied.
- Insert fake rows in the disposable CI test only; verify FK boundaries and duplicate schema collision refusal. This is a **schema safety rehearsal**, not real Supabase Auth or customer data UAT.
- Parent RPC17.6 independently verified 36/36 negative RLS conditions when separately configured with mocked auth.uid; RPC17.8A private schema has no access policies and is intentionally not an Auth-enabled Store Commerce schema.

## 5. Live rollout and rollback limits
- NO automatic deploy, Supabase migration, Auth user creation, Access Allow policy, R2 write, scanner, Messenger/Zalo send, cloud costs, production merge, or owner evidence handling.
- Source rollback: close Draft PR, no cloud rollback. If live migration someday authorized, first back up specific schema and check restore, then approved rollback with matching inventory and audit trail.
- Never place JWT, customer information or raw owner documents into GitHub Actions logs or ChatGPT.

**Decision: SUPABASE QA SCHEMA HOSTED NO-GO / REAL JWT A/B NO-GO / MERCHANT INTAKE NO-GO.**
