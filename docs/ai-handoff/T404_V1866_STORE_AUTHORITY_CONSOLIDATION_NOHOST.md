# TIEN404 AI — V18.6.6 Canonical Store Authority Consolidation × Existing Protected Host × NO-GO Gate

**As of:** 2026-11-18 (JST)  
**Status:** `IMPLEMENTED_SOURCE_ONLY / VERIFIED_METADATA / LOCAL_GATE_TESTED / HOSTED_REAL_OWNER_UAT_BLOCKED / NO_PRODUCTION`  
**Parent:** V18.6.5 Draft PR #427, commit `af8ba95f6e78a1b54edb6545cbc481771b5102ee`  
**Scope:** readonly inspection, architectural reconciliation, snapshot/CI contract. This PR does **not** create another Store model, Auth system, OAuth flow, database migration or Worker deployment.

## 1. Verified reality — do not replace with fixture assertions

Fresh read-only Supabase SQL: in staging project `ifxlvrhyjhbzbrkdsida`, `public.stores` and `public.store_memberships` are both **absent (0/2)**; across `products`, `customers`, `orders`, `order_items`, `conversations`, `messages`, **0 of 6** have a `store_id` column; **0 restrictive public RLS policies** exist. Existing public Commerce rows are bounded by `tenant_id`; this is not a same-tenant Store A/B isolation proof. No SQL writes or customer row reads were executed.

Fresh read-only Cloudflare account inspection: existing Worker **`tien404-widget-gateway-v144-staging`** and Cloudflare Access self-hosted application **`TIEN404 V18.5.4 Private Widget Canary — V14.4`** exist. The Access application protects `tien404-widget-gateway-v144-staging.tienmobi208.workers.dev`, has **one policy** and one configured IdP, with a 30-minute Access session. Worker metadata shows only `T404_ACCESS_AUD` (plain_text) and `T404_QA_OPERATOR_EMAIL` (secret_text) binding names. **No Supabase Auth binding or live verified Owner A/B bridge is present in the inspected settings.** Never infer true identity verification or endpoint security solely from configuration metadata. Do not reveal binding values.

Existing staging Auth is separately documented on Render; project V13.4 public login is a **Draft redirect** and does not prove production or authenticated E2E browser acceptance. No real Supabase JWT, refresh token, Access credential, customer record, live Meta page or private owner identity was read during V18.6.6.

## 2. Remove duplication: which existing work is authoritative for design?

| Component | Existing candidate | V18.6.6 disposition | Admission caveat |
|---|---|---|---|
| Store schema, membership roles, channel installation, six Commerce tables and legacy migration | **Draft PR #417** (V18.3.6D) | **PROPOSED CANONICAL DESIGN BASELINE**, reuse; don't create third schema | Design only, not yet owner-approved or applied |
| RLS, full DML and FK in PostgreSQL 17 | **Draft PR #421** (V18.3.6E) | **REUSE AS PRIMARY PG17 QA BASELINE** | 61/61 in isolated pgTAP; not live Supabase JWT |
| Alternate PG17 Store scope design | Draft PR #416 (V17.25R) | **REFERENCE ONLY** for cross-check/negative tests | Do not merge competing policy algebra automatically |
| V18.6.3 Store A/B fixture | Draft PR #420 | **SECONDARY QA REGRESSION**, retain until consolidated | Synthetic `owner` role differs from canonical `store_owner` |
| V18.6.4/5 owner admission and RPC audit | Draft PRs #424/#427 | **SECONDARY NOHOST REGRESSION**, preserve evidence | Synthetic, no real login/hosted proof, RPC callers partial |
| Meta mock OAuth | Draft PR #418 | **ISOLATED MOCK**, no live consent or send | Cannot be promoted before true store authority |
| Existing Cloudflare Worker | V14.4/V18.5.5 staging candidate | **REUSE EXISTING PRIVATE HOST**, no new host | Access metadata only; no Supabase Auth verifier adapter verified |

Keep Draft branches separate until an independent reviewer approves a concrete merge/retirement plan. No force-push, branch deletion, schema creation, premature migration, or publication.

## 3. Contract differences that MUST be resolved before adapter cutover

1. **Store role naming:** #417 defines `store_owner` (Store scope) distinctly from tenant `owner`; #420 synthetic schema uses `owner`. Do not auto-map either to the other or inherit tenant owner as universal Store owner. Future runtime adapter uses the approved canonical enum only.
2. **SKU uniqueness:** Existing production-like staging constraint `UNIQUE(tenant_id,sku)` differs from proposed independent Store-local SKU in #417; decision **D-02 is OPEN**. Do not change uniqueness without explicit business approval and compatibility audit.
3. **Legacy NULL `store_id`:** Mapping must rely on owner-approved, independently reviewed manifest, not infer Store from tenant, phone, Page, SKU, channel, bot or conversation. Legacy rows are blocked from Store access until mapped.
4. **Privileged writer:** `public.save_merchant_product` is a real staging `SECURITY DEFINER` writer that validates tenant membership, **not Store**. Before any Store NOT VALID check/policy cutover, identify its live callers and replace it with Store-aware, scoped RPC. `qa_shop_b_zalo_claim` has an `anon` EXECUTE grant plus Vault-backed custom-header guard, and `qa_owner_pairing` is `authenticated`-executable and checks tenant owner; neither implies actual webhook authenticity or all-callers inventory. Do not revoke/modify until dependency and impact review.
5. **RLS policy algebra:** Current tenant-wide permissive SELECT policies cannot be narrowed by adding another permissive Store policy. A restrictive Store boundary must be paired with verified command-specific permissive grants and protected from service-role bypass. #421 covers synthetic table policies; no hosted policies are updated.
6. **Browser authentication:** Cloudflare Access operator proof alone authenticates the QA operator, not the merchant owner; Supabase Auth session proof must be verified server-side and joined to an exact canonical Store membership, without trusting browser `store_id`.

## 4. V18.6.6 admission decision — current state

The machine-readable 
`qa/store-authority-v1866/evidence.snapshot.json` is **public, non-sensitive, static read-only metadata**. It is not a signed attestation and cannot become one by editing boolean values. 
`qa/store-authority-v1866/readiness-gate.cjs` computes blockers and **unconditionally refuses real Auth A/B UAT, Meta OAuth, migrations and production** based on this evidence source classification. It is a publication/progress guard, *not* a security boundary or runtime access check. No new API, database, Worker or Supabase function is deployed.

Current blockers include missing Store schema, missing `store_id` columns, missing restrictive RLS, unverified real Owner A/B sessions, lack of a verified Supabase Auth connection to the private Worker, tenant-only product writer, incomplete privileged RPC caller inventory, unapproved legacy data manifest and backup/restore evidence, unresolved role/SKU decisions, and unapproved real Meta OAuth.

## 5. Required real UAT preparation — after approvals only

1. Owner/design review chooses #417 as canonical model and resolves role translation and SKU policy (D-02). Align #421 tests and all API contracts; do not merge parallel alternative schema by default.
2. Independently inspect/approve fresh backup/PITR and tested rollback. Inventory all read/write paths: hosted Render endpoints, Supabase RPCs, n8n draft **and published**, Messenger Google Sheets DEMO, Zalo, Worker bindings; identify migration-incompatible writers.
3. In an approved **isolated staging change window**, create canonical Store registry/memberships and additive Commerce columns with narrowly scoped migration; no customer record changes without explicit consent. Recheck all six tables, FK indexes, RLS roles, service-role routes and privileged function grants.
4. Integrate the existing **Access-protected Worker** with an actual trusted Supabase Auth verification method. Do not place service role keys, merchant JWTs or cookies into chat, GitHub, logs, n8n executions or frontend source. Authenticate operator with Cloudflare Access and merchant with actual server-verified Auth; require independent Store membership.
5. Owner A in browser 1 and Owner B in independent browser 2 each perform private **allow own Store / deny other same-tenant Store** checks, plus revoked/expired/staff negatives. Output only PASS/DENY, bounded error code, synthetic QA run nonce and non-sensitive test version; never return emails, IDs, sessions, tokens or customer records. Verify actual authenticated RLS and separate privileged service-role path, not merely the nohost gate.
6. Only after Security and Owner approve protected staging UAT may Meta Page onboarding be evaluated. Production cutover, OAuth App Review, credentials, provider sends, inventory/order writes and billing require separate approvals.

### Low-complexity business option — *PROPOSED only*

For an early, single-shop-per-tenant customer pilot, consider retaining Tenant-level isolation and explicitly **forbidding multi-Store selection** until the canonical migration is complete. This can reduce first-customer rollout complexity, but it is **not an approval to enable live Meta**, and still requires real Auth, channel permission review, writer safety, and staged security acceptance. Do not silently market that mode as multi-Store SaaS.

## 6. Risks / rollback / checkpoint

Risks: duplicated Store authority between PRs, role confusion, tenant-wide data leakage, service-role bypass, `save_merchant_product` null Store writes, silent legacy migration, uncontrolled Provider Page reassignment and false-positive QA from synthetic JWT. 

Rollback for this change: close the new Draft PR; no real infrastructure changes. Never rollback a future restrictive Store RLS policy to broad tenant-wide access merely to recover availability; use safe maintenance mode with security review.

**Verification:** Read-only Supabase metadata / Cloudflare Worker & Access application inventory / prior PR & 61/61 pgTAP CI / V18.6.3–5 CI 166/166 / V18.6.6 Node tests. 
**Classification:** `V18.6.6 | DESIGN_BASELINE_PR417_PROPOSED | PGTAP_PR421_61_PASS | PREVIOUS_QA_166_PASS | METADATA_SNAPSHOT_VERIFIED | REAL_AUTH_AB_BLOCKED | STORE_SCHEMA_ABSENT | NO_META | NO_SEND | NO_WRITE | PRODUCTION_NO_GO`.
