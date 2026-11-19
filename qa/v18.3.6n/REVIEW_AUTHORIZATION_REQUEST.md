# V18.3.6N — Explicit Authorization Request to Inspect Privileged Function Bodies

**DOCUMENT STATUS:** PROPOSED TEMPLATE — **NOT APPROVED**. GitHub Draft PR review/merge is not an access grant. No function body has been retrieved.

## Read-only staging inventory already verified

- Supabase staging `ifxlvrhyjhbzbrkdsida` PostgreSQL 17.11.
- Schema `public`: **8** functions, **4** SECURITY DEFINER.
- Effective EXECUTE for `anon` **1**, `authenticated` **2**, `service_role` **1** (overlap possible).
- Function name/signature, source/body, owner, argument values, sensitive constant contents and runtime calls were **not** retrieved. Aggregate grants are not exploit evidence.

## Separate explicit approvals (do not combine)

| Operation | Approval needed | This PR |
|---|---|---|
| A. Inspect a bounded list of staging SECURITY DEFINER function bodies privately | Owner approval stating exact function identities/hashes, independent reviewer, reason, time window, sensitive-redaction rules and operator | **NOT GRANTED** |
| B. Query or validate actual Supabase Auth sessions / invoke signOut API | **Separate**, narrower approval with isolated Auth QA users and dedicated data-retention policy | **NOT GRANTED** |
| C. Change EXECUTE/owner/search_path/RLS/extension or other DB privileges | Separate migration/permission approval + tested rollback + compatibility signoff | **NOT GRANTED** |
| D. Provision production signer/KMS/secret/credential | Separate security and cost approval | **NOT GRANTED** |
| E. Publish production workflows or provider messages | Separate release approval | **NOT GRANTED** |

## Required fields before a human can approve A

- Environment: **STAGING** only, project ref `ifxlvrhyjhbzbrkdsida`.
- Exact identities of **1–4** target functions, their signatures and immutable scope hashes — collected only via approved metadata. Never publish sensitive function bodies or identifiable grants to CI logs.
- Purpose: `PRIVILEGED_FUNCTION_BODY_SECURITY_REVIEW`, read-only.
- Signed **owner consent** and independent reviewer identity, distinct from implementer.
- Authorization start/end within one hour, with explicit expiry.
- Pre-review checkpoint of **effective SQL privileges** and owner, reversible change plan for any future fix (separate approval).
- Private reviewer workspace with access logs, no auth token, key, customer PII, SQL body or secret leakage in GitHub, ChatGPT output, n8n, Slack or public PR.
- Reviewer checklist: `search_path`, dynamic SQL, trusted claims, invoker/definer role, cross-Tenant scope, `auth.uid()`, `auth.jwt()`/user metadata, PostgREST exposure, injected inputs, owner BYPASSRLS.
- Action is read-only inspection; no invocation of privileged functions as test, no Auth session row queries, no GRANT/REVOKE.
- Redacted result should contain function fingerprints, reviewer risk conclusions and remediation proposals, **not executable vulnerable code or credentials**.

`function-review-authorization.mjs` verifies the *shape* of a metadata request but cannot validate the signer's real identity or replace the owner's authorization. Even a fully populated request returns `READY_FOR_EXTERNAL_PRIVATE_APPROVAL_VERIFICATION`, not `APPROVED`.

## What user approval would need to say (for a later conversation only)

Approve **only** task A for the named staging project, bounded specific function hashes, private independent reviewer, explicit read-only redaction rules and expiry, while forbidding real Auth/PII/keys, permission writes and deployment. Do not treat selecting V18.3.6N as this authorization.

**Current action gate:** BLOCKED. Await explicit separate approval with target and reviewer/evidence details.
