# V17.2C.8 — Independent A/B Consent Receipt × Disposable Store Schema Review × Real JWT Negative UAT Authorization

Date: 2026-11-18 JST
Repo: ngoctien20/demo-git; Draft PR #392, prior HEAD `f1e852a5c2b8189641dfa5a907f654d262e6575a`
Staging Supabase: `ifxlvrhyjhbzbrkdsida` (read-only inspection only)
**STATUS: VERIFIED SOURCE CI; DESIGNED PRIVATE CONSENT + DISPOSABLE STORE SCHEMA; REAL JWT HOSTED NO-GO.**

## 1. Independent verified evidence
- GitHub Actions run [44147890055](https://github.com/ngoctien20/demo-git/actions/runs/44147890055), job `no-send-source-contract` id `134267888577`, completed SUCCESS, including source-only Node test step. This **does not** verify real auth/JWT or RLS.
- Supabase read-only SQL: 3 Auth users, 1 tenant with >=2 active owner members, 0 QA tenants with 2 distinct store keys, 0 canonical Store tables, 0 Store columns in existing Commerce tables. Existing protected records: 2 products, 2 orders.
- V17.2C.6A: operator-visible screenshot confirmed credential Header Auth **Name** `x-tien404-pairing` and bounded Supabase staging domain. Value masked, Vault match and execution success not attested.
- V17.2C.3: deployed Zalo V2 caller `OgDZNSAvKEvhnAvn`, Published version `f00ba506-c52a-4340-9a0c-809fd9c6ea9a` uses `qa_shop_b_zalo_claim`. Do NOT revoke `anon EXECUTE` before audited replacement.

## 2. Independent private consent receipt contract (PROPOSED ONLY)

Each of **Actor A** and **Actor B** must independently assent in a protected, authenticated channel before any account is used for the same-Tenant Store A/B UAT. Founder authorization alone cannot substitute for the second actor's consent. Do not generate consent receipts on their behalf or treat two existing owners in one tenant as proof.

A private receipt has:
- `receipt_ref`: opaque random ID, stored only privately (a hash/fingerprint may be included in audit where non-correlating);
- `actor_slot`: QA_A or QA_B; `verified_auth_subject_ref`: opaque identity record checked server-side, never full JWT;
- `staging_project_ref`, `synthetic_tenant_ref`, `synthetic_store_ref`, `role`, `scope` (read-only catalogue + negative cross-Store RLS);
- `consent_recorded_at`, `expires_at`, `withdrawn_at`, `auth_method_proof_ref`, `independent_reviewer_ref`, `decision`;
- `no_send=true`, `no_order_write=true`, `no_customer_data=true`, `max_request_count` (approved bound), `budget_cap` and `rollback_ref`.

Receipt validity gate: approved by each actual account owner; user identity authenticated and verified; same synthetic tenant with **distinct** Store IDs; reviewed by separate security reviewer; unexpired and not withdrawn; matches exact test project and scope; no secret or PII published. Default DENY on any missing element.

Absolutely never commit or paste JWT, refresh token, email, phone, secret, credential ID, private receipt contents or customer data to GitHub or a public QA report. The repository stores this **contract only**, not actual signed consent.

## 3. Disposable canonical Store schema review — design, NOT migration

Required future isolated tables (no existing business-data reclassification):
1. `qa_stores(id UUID PRIMARY KEY, tenant_id UUID NOT NULL, status TEXT, created_at TIMESTAMPTZ, UNIQUE(tenant_id,id))`.
2. `qa_store_memberships(tenant_id UUID NOT NULL, store_id UUID NOT NULL, user_id UUID NOT NULL, role TEXT, active BOOLEAN, ...)`; composite FK `(tenant_id,store_id)` to `qa_stores`, verifiable current identity and tenant membership. Avoid weak tenant-only joins and update reassignments.
3. `qa_catalog(tenant_id,store_id,sku,price_vnd,stock_on_hand,...)`, using **only synthetic fixtures** and composite FK. Store-restricted `TO authenticated` RLS SELECT through current validated Store membership + `auth.uid()`. If mutation policies are later needed, require both USING and WITH CHECK. Views must be security_invoker on PostgreSQL 17.
4. `qa_channel_installations` (optional in first read-only stage): privately verified provider installation / Store binding; never trust inbound `store_id` or `store_key` from message.
5. Constrain grants to test-only schema and named roles. Prefer an isolated disposable project or approved non-exposed QA schema with dedicated server-side read-only endpoint; no extension to current public Commerce until independently approved.
6. Existing public products/orders (2/2 rows) are strictly excluded from fixture generation, migration backfill, new FK constraints and JWT Store tests.

**Risks requiring independent review**: Service-role bypass of RLS, exposed RPC SECURITY DEFINER, owner auth metadata freshness, foreign key cross-Tenant bypass, accidental data API exposure, bad JWT claims, revoke-after-token-issued behavior, channel cross-Store BOLA, replay, and incomplete rollback.

**Rollback plan before DDL**: approval-bound schema-only migration and exact reversal; restore/recovery evidence, acceptance row-count baseline, dependencies and reviewer signoff. No DROP/DELETE of business tables. No migration automatically triggered by this document.

## 4. Real JWT A/B no-send UAT: authorization prerequisites

Before sending any HTTP request, prove ALL:
- A and B private receipts independently VERIFIED and in scope;
- isolated schema/project approved with cost bound and restore evidence;
- two dedicated known synthetic read-only store fixtures, pre-counted;
- genuine short-lived signed Supabase Auth sessions for each actor, secret material kept private;
- server-trusted mapping tenant_id, store_id, user_id, role established, revoke path tested and audit retention approved;
- read-only request limits and sanitized logs; no Zalo/Messenger callback, no order write.

Expected negative matrix:
| Actor | Store A read | Store B read |
|---|---|---|
| Auth A (A only) | ALLOW | DENY/zero synthetic rows |
| Auth B (B only) | DENY/zero synthetic rows | ALLOW |
| anonymous | DENY | DENY |
| unaffiliated Auth C | DENY | DENY |
| revoked A or expired A JWT | DENY | DENY |
| forged store input/invalid signature | DENY | DENY |

HTTP 200 with zero records may represent legitimate RLS rejection, **but only** if known synthetic fixtures exist in the target Store. Proof includes request time, test run ID, trusted actor slot, hashed subject/ref, policy version, commit SHA, status, and fixture count, never a JWT.

## 5. Explicit current decision

- **SOURCE QA: TESTED PASS** at run 44147890055.
- **HEADER NAME: VERIFIED** from operator screenshot only. Secret equality not proven.
- **REAL A/B CONSENT: BLOCKED** (no two independently verified, signed private receipts).
- **STORE STRUCTURAL ADMISSION: NO-GO** (same-Tenant QA Store A/B absent; canonical tables and policies absent).
- **REAL JWT NEGATIVE UAT: NOT AUTHORIZED and NOT RUN**.
- **PRODUCTION / RPC GRANT CHANGE: NO-GO**.

No Supabase DDL/DML, user provisioning, Zalo sends, workflow changes, credential, Vault or payments touched. Source-only checkpoint created on Draft PR #392. Rollback: close Draft PR or revert this document.

Next actionable gate: obtain protected independent consent from Actor A and Actor B, assign an independent reviewer, approve disposable-only no-send scope and rollback, then stage schema design in a separate non-production review. Only after that consider a reversible QA migration and real JWT test.
