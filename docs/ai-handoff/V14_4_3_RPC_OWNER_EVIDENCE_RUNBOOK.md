# TIEN404 AI V14.4.3 — SECURITY DEFINER RPC Audit × Four-Row Owner Evidence Runbook

**Scope:** tien404-staging, Supabase ref \`ifxlvrhyjhbzbrkdsida\`
**State:** EXPERIMENTAL / DRAFT / READ-ONLY CATALOG QA / NO DDL / NO DATA MUTATION
**Dependency:** V14.4.2 PR #104; Store/Knowledge PR #86 remains a separate Draft branch
**Backup gate:** local pgAdmin backup readable via pg_restore TOC; independent restore drill NOT RUN; not waived
**Owner decision:** continue source and QA, NOT authorize migration, credentials, Meta/Zalo sends or production.

## 1. LIVE audit: real function bodies inspected read-only

All three public RPCs are **SECURITY DEFINER owned by postgres**, with locked-empty \`search_path\`; none grants EXECUTE to \`PUBLIC\`. Exact permissions from \`pg_proc\` / \`proacl\` / \`has_function_privilege\`:

| Function | Effective EXECUTE | Observed guard and write path | Store readiness | Action |
|---|---|---|---|---|
| \`public.save_merchant_product\` | \`authenticated\`, not \`anon\` | \`auth.uid()\`; active \`tenant_memberships\` role owner/manager, restricted to two QA tenant slug/IDs; validates price/name/SKU; inserts or updates \`public.products\` by \`tenant_id, sku\`; optimistic \`updated_at\`; audit event write | **BLOCKED P0:** no \`store_id\` or canonical Store Membership, thus unsafe for same-tenant two-store SKU/price | Draft Store-aware contract and independently approve SQL after backup restore |
| \`public.qa_owner_pairing\` | \`authenticated\`, not \`anon\` | \`auth.uid()\` + owner in \`tenant_memberships\`, two \`tien404_r1_qa\` identity/bot fixtures with \`dry_run\` and \`synthetic_qa\`; issues/status/confirms challenge | **QA ONLY:** not a reusable merchant Store authority mechanism | Keep synthetic; do not promote into Commerce Core |
| \`public.qa_shop_b_zalo_claim\` | \`anon\`, not \`authenticated\` | Reads a private Vault-stored header gate, checks SHA-256 equivalence, uses HMAC to pseudonymize recipient and event references, calls Shop B synthetic pairing helper | **BLOCKED P0 FOR LIVE USE:** static secret header is not independent proof of Meta/Zalo webhook origin, and hosted replay/rotation remains unverified | Keep QA-only, audit end-to-end ingress, harden/restrict under separate approval |

**Do not overclaim**: these are actual code/privilege observations, NOT proof that any RPC can currently be exploited. In particular, a role lacking a matching grant cannot directly call the RPC via the ordinary PostgreSQL privilege path; however, \`SECURITY DEFINER\` executes the function with its owner's privileges, potentially bypassing table RLS for an authorized caller. This makes a *missing Store check inside the function* critical for future migration.

All three subsidiary functions called by QA owner pairing:
- \`tien404_r1_qa.issue_owner_challenge\`
- \`tien404_r1_qa.confirm_owner_pairing_v3_qa\`
- \`tien404_r1_qa.claim_owner_pairing_v3_synthetic\`

are \`SECURITY INVOKER\` owned by \`postgres\`, with no effective EXECUTE for \`anon\` or \`authenticated\` when called directly; privilege through the main SECURITY DEFINER entrypoint requires review of the entire call chain. Their locked row/expiry/ON CONFLICT metadata is not proof of safe hosted concurrency. No function definitions, Vault values, access tokens, customer data or QA secret fingerprints are to be copied into public GitHub.

## 2. LIVE audit: Products and Orders, with privacy

\`OWNER_COVERAGE_READ_ONLY.sql\` was run against staging and returned **NO record UUIDs or tenant UUIDs**:
- 2 Products, 2 Orders, 2 tenant groups, each group has exactly 1 Product + 1 Order.
- One anonymized group: **2 active tenant memberships, 2 active owners**.
- Other anonymized group: **1 active membership, 1 active owner**.
- \`public.stores\` and canonical Store Membership are still absent. Tenant membership is **not** proof of individual Store ownership.
- These are aggregated counts only, not the four private owner/record attestations.

**No per-row record or customer data was downloaded into GitHub.** The operator must independently resolve P01/P02/O01/O02 using private readback and merchant evidence. The fact that a group has only one owner does NOT authorize assigning that group automatically to one Store.

## 3. Private four-row evidence pack — OPERATOR ONLY

Store the filled evidence pack in an encrypted/private local folder with restricted access, not GitHub, not ChatGPT messages, not CI logs or public issue comments.

| Private slot | Source table | Record ownership evidence | Separate reviewer |
|---|---|---|---|
| P01 | products | Merchant catalog source + signed merchant Store assignment | Independent QA |
| P02 | products | Merchant catalog source + signed merchant Store assignment | Independent QA |
| O01 | orders | Order-origin evidence + signed merchant Store assignment | Independent QA |
| O02 | orders | Order-origin evidence + signed merchant Store assignment | Independent QA |

Each PRIVATE row object:
- \`table\`: \`products\` or \`orders\`.
- \`rowId\`, \`tenantId\`, \`candidateStoreId\`: exact UUIDs from independently authorized DB readback; **no tenant-only inference**.
- \`snapshotSha256\`: 64-character digest of a reviewed row snapshot bound to database identity/version and recorded privately. A digest is not a signature and does not prove ownership by itself.
- \`sourceUpdatedAt\`: UTC ISO updated_at, freshly read; fail on stale/different snapshot before backfill.
- \`merchantActorId\`, \`reviewerActorId\`: DISTINCT authorized actors in the private audit log.
- \`evidence\`: EXACTLY 3 items: one source class (\`PRODUCT_CATALOG_SOURCE\` or \`ORDER_ORIGIN_SOURCE\`), \`MERCHANT_STORE_ATTESTATION\` and \`INDEPENDENT_QA_REVIEW\`.
- Each evidence item has an opaque \`EVD-XXXXXXXXXXXX\` reference plus matching record UUID, tenant UUID, Store UUID, row snapshot digest, signer actor UUID, timestamp.
- Reviewer must examine the actual private primary evidence, source system and merchant consent; not just a \`reviewed=true\` flag.

**Do not put the real ledger in the repository.** The code \`qa/security-definer-v1443/four-row-owner-evidence.cjs\` is an offline linter only and returns *counts plus generic issue codes*, not real UUIDs. Even if all synthetic/formal conditions pass, it reports **READY_FOR_MANUAL_PRIVATE_EVIDENCE_INSPECTION**, with \`independentlyVerifiedOwners=0\`, \`canBackfill=false\` and \`recordsWritten=0\`.

### Required independent acceptance and evidence

1. Operator and merchant agree on canonical Store A/B scope **separately from** tenant ID or bot key.
2. Independent reviewer cross-checks actual record UUID and immutable/optimistic version from the live snapshot and merchant's source evidence, using a private two-person workflow.
3. Verify original owner/tenant membership, actual store ownership, channel source and consent; investigate ambiguities. No guessing.
4. For Products and Orders, store a **before-image** privately for a transaction rollback. Do not store customer phone/address in GitHub.
5. A separately approved, reviewable SQL plan includes a precise \`WHERE id = ... AND tenant_id = ... AND updated_at = ...\` guard for each of the 4 authorized rows (plus Store UUID under the new schema). Verify affected count for each row, abort the entire transaction if mismatch; no broad update.
6. Re-check row count baseline and all six table relationships immediately before and after staging migration. An atomic migration is followed by independently tested **post-commit rollback**.
7. A real Supabase Auth Shop A/B same-tenant negative/positive JWT acceptance is required; \`service_role\`, synthetic GUCs or anonymous headers cannot substitute.

## 4. Technical QA and artifact scope

- \`RPC_AUDIT_READ_ONLY.sql\`: read-only \`pg_proc\`, EXECUTE grant and boolean source-feature inventory; **does not return function bodies or Vault values**; executed on staging.
- \`OWNER_COVERAGE_READ_ONLY.sql\`: privacy-preserving count per anonymous tenant group, no row IDs; executed on staging.
- \`rpc-security-review.cjs\`: fail-closed metadata drift checker; detects owner/role/search_path/SECURITY DEFINER/grant drift, QA guard loss and Store write missing; cannot REVOKE/GRANT/replace.
- \`four-row-owner-evidence.cjs\`: in-memory private linter, no DB/network, no actual owner verification; 4 rows, 2+2 table split, 2 tenant pair coverage and three per-row bound attestations; output always redacted and mutation disabled.
- \`EPHEMERAL_PG17_ONLY.sql\` with \`ci-definer-pg17.sh\`: disposable PostgreSQL 17 demonstration of Security Definer privilege behavior, **not** Supabase hosted exploit test.
- GitHub CI runs only **synthetic fixtures**, never user-supplied private rows, passwords or actual Supabase tokens.

## 5. STOP/GO, risk and rollback

| Gate | Evidence | Status |
|---|---|---|
| S0 | Backup archive created, listable and hashed | VERIFIED BY OPERATOR SCREENSHOTS |
| S1 | Actual isolated full restore and owner-reviewed rollback | BLOCKED / DEFERRED |
| S2 | Four independent per-row owner provenance records | BLOCKED |
| S3 | Canonical Stores and RLS grant migration reviewed/approved | BLOCKED |
| S4 | \`save_merchant_product\` rewritten under Store-bound contract with optimistic version, guard and regression | PROPOSED ONLY |
| S5 | QA pairing and anon-claim permissions/call chains reviewed; verified trusted webhook signature/replay | PROPOSED / HOSTED UNVERIFIED |
| S6 | Auth JWT Shop A/B same-tenant, Shop C cross-tenant and revoked staff hosted acceptance | BLOCKED |
| S7 | CI source and disposable PostgreSQL 17 fixture regression | TESTED once CI green |

**Rollback for this PR:** close/revert source-only V14.4.3 Draft PR. No database/grant/credential/workflow rollback required because none was changed. Actual RPC migration/REVOKE in a later phase would need its own reviewed transaction and rollback, and explicit owner approval.

**Release verdict:** PRIVATE EVIDENCE PROCESS PREPARED, PUBLIC RPC SECURITY DESIGN REVIEW REQUIRED, HOSTED MIGRATION/RLS/BACKFILL/PROVIDER SEND REMAIN BLOCKED.
