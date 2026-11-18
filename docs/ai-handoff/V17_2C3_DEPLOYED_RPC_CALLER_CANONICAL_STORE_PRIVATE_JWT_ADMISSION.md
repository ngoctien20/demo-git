# V17.2C.3 — Deployed RPC Caller Closure × Canonical Store Authority × Private JWT Admission

Date: 2026-11-18 JST
Parent: Draft PR #392 (V17.2C / V17.2C.2).
Supabase staging: `ifxlvrhyjhbzbrkdsida` PG17.11.
State: **VERIFIED READ-ONLY + IMPLEMENTED SOURCE DESIGN; REAL JWT AND PRIVILEGE CLOSURE NO-GO.**

## 1. Critical verified deployed caller (corrects former no-match inference)

The Published **ACTIVE** n8n workflow `TIEN404_ZALO_V2_SHADOW_STAGING` ID `OgDZNSAvKEvhnAvn`, active version `f00ba506-c52a-4340-9a0c-809fd9c6ea9a`, contains a connected HTTP Request node `Submit pending claim for Shop B`, method POST, URL target `/rest/v1/rpc/qa_shop_b_zalo_claim`, and a configured `httpHeaderAuth` credential. No credential values were retrieved or exposed. This is definitive configuration dependency, **not evidence of a recent executed or authenticated call**. Existing `anon EXECUTE` must not be revoked until this caller is migrated and tested.

A read-only graph inspection succeeded for all **22/22 active n8n workflows** returned by the connector; no explicit `qa_owner_pairing` or `save_merchant_product` matches in their current Published node graphs; `OgDZNSAvKEvhnAvn` is the one active exact-name target RPC match. 129 inactive workflows still require bounded code graph/draft scans if demonstrating historic caller completeness. Hidden URLs assembled at runtime, external callers, Supabase Edge Functions, third-party clients and separate n8n projects remain out of scope.

Cloudflare account: preceding V17.2C.2 read-only script scan covered 32/32 Worker contents; none had the three exact target RPC names; 13 BIO workers had other RPC paths. Earlier GitHub search of DEFAULT BRANCH yielded no matches but is NOT an all-branch proof. Therefore **deployed caller closure is partial**, not terminal.

## 2. Current canonical authority vs. existing QA fixture

Read-only information_schema confirms `public.tenants`, `public.tenant_memberships(tenant_id,user_id,role,active)`, and `public.products/orders/customers` are keyed at Tenant level. **No `public.stores`, no Store membership table, no `store_id` columns** across six Commerce tables, and no Store-scoped policies. QA table `tien404_r1_qa.tenant_identity_map` carries text `tenant_key,store_key,bot_key` and `auth_tenant_id`; this is NOT an authoritative Store membership system. Existing `public.products` authenticated SELECT policy uses tenant_memberships and has no end-user INSERT/UPDATE policy.

Existing Auth users=3; active owner memberships=3 across 2 tenants, with 1 tenant holding >=2 distinct active owners. These aggregates establish **neither operator consent, real private JWT sessions nor independent Store A/B authorization**. Never reuse an existing Merchant/QA account as consent by inference.

### Canonical Store contract (PROPOSED only, no DDL applied)

1. `tenants(id)` stays the Tenant boundary; `stores(id uuid PK, tenant_id uuid FK NOT NULL, status, created_at)` defines a true Store. Enforce `UNIQUE(tenant_id,id)` and explicit Tenant+Store composite FKs across business entities; never rely solely on caller-supplied store_id.
2. `store_memberships(tenant_id,store_id,user_id,role,active,created_at)` with FK to `stores(tenant_id,id)` and the tenant membership; enforce one active permitted role per user per Store, with an owner/manager permission matrix and revocation checked on each sensitive call.
3. `channel_installations(tenant_id,store_id,channel,provider_account_fingerprint,verified_status,secret_ref,...)` is privately issued by trusted signed integration code. Verify sender/page/OA/bot first, then resolve Store from this binding. Client text, webhook payload or proposed `tenant_id`/`store_id` MUST NOT select authority.
4. `products,orders,customers,order_items,conversations,messages`: define explicit migration compatibility map, backfill from independently proven owner & channel records, forbid guessing Store from a text QA key; add tenant+store composite FK, Store-aware RLS and server guard before granting API access.
5. RLS `TO authenticated` + `auth.uid()` current membership AND matching Store, not just Tenant. Use `WITH CHECK` for mutation policies. Views exposed through Data API must be `security_invoker=true` on PG17. Privileged RPC retains fixed `search_path`, explicit role grants and server-side authorization; default-deny and audited key checks.
6. Existing Tenant-level public API remains unchanged while Store migration is preview-only. No automatic production promotion, no DEMO data movement and no provider send.

## 3. Private real JWT admission (not executed)

Prerequisites: founder approval for **disposable synthetic test identities only**, independent security reviewer, private Auth owner consents, pinned QA baseline/restore proof, isolated QA schema or approved disposable project, allowed Data API schema, two independently owned real short-lived Auth sessions, approved bounded read-only endpoints and signed current tenant/store membership attestation.

READ ONLY HTTP matrix: A->A allow, A->B deny/zero rows, B->B allow, B->A deny/zero rows, unauthenticated deny, unrelated tenant deny, forged store scope deny, expired JWT deny, and revoked owner/membership deny **after** secure revoke/refresh handling. Capture 401/403 or 200/empty as appropriate, but only with known synthetic catalog fixtures. Do not paste JWTs into source, logs, user chat or PR. Test all exposed functions for missing/invalid headers by safe non-writing methods only; `POST` to claim/order/product functions MUST NOT be used in this preflight because side effects are possible.

Authority gates: A valid Supabase Auth JWT is **identity evidence**, not Store authorization by itself. Test via signed JWT/PostgREST with RLS and canonical Store membership. SQL role spoofing or synthetic JWT mock is NOT hosted JWT proof. Never claim Store A/B acceptance absent actual canonical Store tables and trusted store policies.

## 4. Scoped privilege closure

| RPC | Known deployed caller | Current privilege | Decision |
|---|---|---|---|
| `qa_shop_b_zalo_claim` | Active Zalo V2 Shadow node `Submit pending claim for Shop B` | anon EXECUTE | **DO NOT REVOKE** until successor private verified service, replay proof, operator consent, version-pinned migration and rollback have passed |
| `qa_owner_pairing` | No direct match in 22 active n8n graphs; other sources not exhausted | authenticated EXECUTE | Retain; real JWT owner/tenant negative tests and full caller tracing required |
| `save_merchant_product` | No direct match in 22 active n8n graphs; UI/cloud callers possible | authenticated EXECUTE | Retain; products currently SELECT-only RLS. INVOKER conversion risks breaking owner/manager product writes |

Controls during transition: preserve exact RPC signatures, do not change existing grants, no `SECURITY INVOKER` conversion, no webhook rewrite, no Vault key access and no provider/test message sends.

## 5. Evidence / decision / rollback

**VERIFIED:** Supabase metadata, actual Active Zalo V2 RPC caller, 22/22 active n8n current Published graphs, Cloudflare earlier 32/32 script body scan. **IMPLEMENTED:** documentation + candidate canonical security contract. **TESTED:** prior source-only V17.2C.1 GitHub Actions SUCCESS at prior SHA; no real JWT UAT. **BLOCKED:** full historic/inactive/external caller closure and privately approved Auth A/B sessions. **PROPOSED:** new canonical Store schema, authorization gates and phased privilege migration.

No real SQL DDL/DML, Auth creation, deployment, credential, Customer data changes or webhook sends. Rollback: close Draft PR #392 or revert docs-only commits. Hosted security and release remain NO-GO.

Next: V17.2C.4 — Zalo V2 RPC Dependency Compatibility × Private Auth Owner Consent × Canonical Store Migration Read-only Matrix.
