# V17.2C.4 — Zalo V2 RPC Compatibility × Private Owner Consent × Canonical Store Migration Read-Only Matrix

Date: 2026-11-18 JST
Parent: GitHub Draft PR #392; previous pinned head `6073f28e8f3e686ad169e30a42e09de17134f84a`.
Supabase staging: `ifxlvrhyjhbzbrkdsida` (ACTIVE_HEALTHY, PostgreSQL 17.11)
State: VERIFIED READ-ONLY / PROPOSED DESIGN / REAL JWT HOSTED NO-GO.

## A. Exact deployed Zalo V2 compatibility proof

Read-only n8n published graph on workflow `OgDZNSAvKEvhnAvn`:
- Name `TIEN404_ZALO_V2_SHADOW_STAGING`, ACTIVE, published version `f00ba506-c52a-4340-9a0c-809fd9c6ea9a`; published and saved graphs same.
- `Recognize Shop B pairing command (staging)` leads into `Submit pending claim for Shop B`, HTTP POST to `/rest/v1/rpc/qa_shop_b_zalo_claim`.
- HTTP request uses generic `httpHeaderAuth` credential binding and separately configured `apikey` header. Credential value and other sensitive request parameters were neither requested nor reproduced.
- RPC (independently read at V17.2C) checks `request.headers ->> 'x-tien404-pairing'` against a Vault secret. **The presence/correctness of this particular header from the credential or a trusted intermediary is not yet proven.** Neither auth success, provider ownership nor call execution history follows from a graph.
- Compatibility lock: retain current function signature, anon EXECUTE, Vault secret name and live credential bindings. Do not run POST against the live function; it may consume or mutate a pending claim.

## B. Private owner consent readiness

Supabase read-only aggregate counts:
- auth.users: 3;
- active owner memberships: 3;
- tenants having >=2 distinct active owners: 1;
- `tien404_r1_qa.tenant_identity_map` rows: 2;
- `tien404_r1_qa.shop_bots` rows: 2;
- `public.stores`: 0;
- `public.store_memberships`: 0;
- Commerce `store_id` columns across products/orders/order_items/customers/conversations/messages: 0.

These facts do NOT establish private owner consent, session provenance, exact same-Store or Store-A/B authority; existing owner accounts must NOT be automatically enrolled. Existing QA `store_key` text is not a canonical authoritative `store_id`.

Consent admission checklist (PRIVATE, not in git):
1. Founder authorizes disposable synthetic QA data and bounded read-only testing on exact staging project.
2. Separate independent security reviewer approves identity and scope; approved Owner A and Owner B attest authority over separate QA Stores belonging to the same QA Tenant (or explicitly limited non-customer-owned synthetic accounts).
3. Both authenticate privately with genuine Supabase Auth; audit confirms session issuer, audience, expiry, revocation and user ID bound to server-side approved membership. No JWT/refresh token, PII or Vault secret in GitHub, n8n logs or chat.
4. Migration and recovery gate, tenant/store grant contract, scoped API resource and rollback evidence are approved before any DDL or JWT negative UAT.
5. Explicit NO-SEND/no-provider/no-order-write assertion and cap on calls. Approval of read-only metadata inventory is NOT approval to create Auth users, migrate schema or edit credentials.

## C. Canonical Store migration READ-ONLY matrix

| Existing structure | Reality | Proposed canonical contract | Preflight gate | Present |
|---|---|---|---|---|
| public.tenants.id | Tenant PK | Tenant remains authoritative namespace | preserve IDs and slug mapping; no multi-tenant conflation | VERIFIED |
| public.tenant_memberships | tenant_id/user_id/role/active | gate global Tenant eligibility only, never infer Store membership | read-only schema, roles and revocation semantics | VERIFIED |
| tien404_r1_qa.tenant_identity_map | text tenant_key/store_key/bot_key + auth_tenant_id | synthetic mapping, NOT authority | verify identity signatures and approved migration map | NO-GO |
| tien404_r1_qa.shop_bots | text Store/bot, synthetic QA flags | trusted provider installation bound to tenant_id/store_id | verified provider/bot ownership, replay, server-issued IDs | NO-GO |
| public.stores | absent | stores(id,tenant_id, status) with unique(tenant_id,id) | independent schema and ownership review | BLOCKED |
| public.store_memberships | absent | (tenant_id,store_id,user_id,role,active) with composite FKs and identity membership | independent signed consent and revocation tests | BLOCKED |
| products | tenant_id only | composite tenant_id/store_id, Store RLS select/write | SKU/stock/price compatibility; owner/manager writer preserved | BLOCKED |
| orders/order_items | Tenant only or relational via order | Store-aware order ownership and composite FK | immutable history, idempotency, totals, no customer data movement | BLOCKED |
| customers | tenant_id only | Store-scoped customer records and/or reviewed shared-customer policy | PII segregation and consent | BLOCKED |
| conversations/messages | tenant_id | server-verified channel installation and Store identity | sender authenticity, replay, cross-channel negative UAT | BLOCKED |
| RPC qa_shop_b_zalo_claim | anon + Vault shared-header | scoped private trusted ingress with replay defense | first migrate Zalo V2 Published caller and validate no-send | BLOCKED |
| RPC qa_owner_pairing | authenticated + active owner | server store-membership and short-lived session proof | real authorized owner JWT negative tests | BLOCKED |
| RPC save_merchant_product | authenticated, privileged writer | Store-aware owner/manager data write contract | no blind SECURITY INVOKER change; product RLS write not present | BLOCKED |

No migration SQL has been executed. Never generate Store ownership mappings by extrapolating existing QA text identifiers or Tenant membership alone.

## D. Acceptance/negative test plan (NOT RUN)

1. Test private genuine Auth sessions for A and B against a dedicated synthetic read-only Store view with known row fixtures, ensuring A->A/B->B allow and A->B/B->A deny/empty.
2. Negative: unauthenticated, expired token, forged JWT, revoked membership, revoked session, cross-Tenant, spoofed store_key, forged channel identity.
3. Test Zalo claim compatibility in a disposable equivalent endpoint or transactionally isolated QA replica, including missing header, incorrect header, replay, exhausted code, disabled bot and untrusted sender. Never send a real Zalo message or invoke the current live POST.
4. Test the product writer only in independently approved disposable fixtures, with regression for owner/manager, non-member, mismatched Tenant/Store, optimistic concurrency, price/stock constraints and rollback.

## E. Outcome

VERIFIED: n8n published caller and request schema (credential values excluded), Supabase aggregate identity counts and Store schema absence.
PROPOSED: Store migration authority matrix and private consent/negative UAT gates.
BLOCKED: header proof, full historical/external caller coverage, private owner consent, real JWT sessions, canonical Store migration and negative runtime QA.
IMPLEMENTED: this docs-only checkpoint. No production/runtime change.
TESTED: read-only connector retrieval; no new HTTP denial/proven JWT test; previous source-only CI is not reused as hosted UAT proof.

GO/NO-GO: **NO-GO** for mutation, grant revoke and hosted Store-level security acceptance.
Rollback: close Draft PR #392/revert docs-only commit. Unchanged Supabase, n8n Published, Cloudflare and customer data.
Next: V17.2C.5 Private owner authority evidence × Zalo pairing header provenance × isolated canonical Store migration admission.
