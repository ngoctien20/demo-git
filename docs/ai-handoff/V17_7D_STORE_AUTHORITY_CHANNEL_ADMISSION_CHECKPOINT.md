# TIEN404 AI — V17.7D Trusted Store Authority Remediation × Real QA Channel Admission
**Checkpoint date:** 2026-11-17 JST  
**Status:** IMPLEMENTED SOURCE-ONLY / VERIFIED READ-ONLY HOSTED BASELINE / REAL CHANNEL AND SAME-TENANT JWT RLS **NO-GO**.

## 0. Handoff, scope & ownership (no competing migration)

- Parent Draft PR #326, pinned HEAD \`5d39b356b59785fc22862558849a365ea0673cdd\` (V17.7C). Parent #321 (V17.7B), parent #317 (V17.7A); all still **DRAFT**.
- Reuse existing **canonical six-surface Store migration/recovery gate**: [RPC10 Draft #247](https://github.com/ngoctien20/demo-git/pull/247). It already has disposable PostgreSQL 17 same-Tenant A/B/C checks and atomic cutover simulations. DO NOT create a second migration or rerun operational DDL against hosted.
- Security/definer reviewer: [SECLOAD02 Draft #246](https://github.com/ngoctien20/demo-git/pull/246). Merchant Products / managed recovery and operator scope: [V17.5→V17.9 Draft #251](https://github.com/ngoctien20/demo-git/pull/251).
- Private four original Store row owner attestation G0 and current M0 hosted recovery scope remain pending, per #247. The project owner previously deferred a repeat of local-machine backup: **do not redo it**; deferral is NOT evidence of a verified current comprehensive recovery point.
- This PR only adds evidence contract and caller compatibility gates. **No DB schema/GRANT/REVOKE/DDL/DML, no n8n workflow changes or executions, no OAuth/token handling, no customer row scans, no Meta/Zalo send, no Cloudflare changes, no paid service or merge.**

## 1. VERIFIED direct hosted read-only observations

### Supabase staging

Project: \`ifxlvrhyjhbzbrkdsida\`. The exact read-only SQL in \`qa/v17-7a-oa-independent/v17-7d-store-rpc-published-readonly.sql\` was executed against the staging PostgreSQL catalog, querying metadata and an aggregate from private QA Store mapping ONLY.

| Aggregate | Actual result |
|---|---:|
| Public Commerce tables: products, orders, order_items, customers, conversations, messages | 6 |
| RLS enabled AND FORCE RLS | 6 |
| Has tenant_id | 6 |
| Has store_id | 0 |
| Public Commerce SELECT policies | 6 |
| PERMISSIVE SELECT policies | 6 |
| Explicit Store-scoped predicates in these policy texts | 0 |
| Canonical public stores / store_memberships tables | 0 |
| SECURITY DEFINER RPCs reviewed | 3 |
| RPCs executable by anon | 1 |
| QA Tenant count in private tenant_identity_map | 2 |
| Max unique Store per Tenant | 1 |
| QA Tenant with >=2 Stores | 0 |

The callable anon SECURITY DEFINER function is \`public.qa_shop_b_zalo_claim\`; the other two reviewed functions are \`public.qa_owner_pairing\` and \`public.save_merchant_product\`, both authenticated-executable (metadata). **This is not proof of vulnerability or exploit**, but the product-writing RPC currently relies on legacy Tenant scope and requires an owner/RPC/writer review before Store cutover. Do not revoke or edit privileges unilaterally.

Current tenant-membership SELECT policies are PERMISSIVE. Adding a new PERMISSIVE Store SELECT policy while leaving the Tenant-wide policy enabled could preserve Tenant-wide access under Postgres permissive OR semantics. The canonical #247 atomic M2/M4 cutover must independently prove the old policies are absent and all tested queries actually obey Store scope, not merely that a new Store policy exists.

Supabase official RLS guidance: https://supabase.com/docs/guides/database/postgres/row-level-security
API/security definer guidance: https://supabase.com/docs/guides/api/securing-your-api

### n8n published callers and real Data Table schemas

All IDs and versions below were read directly; no executions triggered.

| Role | Workflow ID | Exact Published Version | Observed Scope |
|---|---|---|---|
| Commerce Tenant Resolver | 5Eeh8hbpsoNhuiVo | a99c7350-7aea-446d-bdc5-4b10f52c3ad1 | Tenant-only |
| Commerce Catalog | oOOXicKXGkBskKqh | e0f1e345-8e6c-40cb-8e6a-d7ad2eb92696 | Tenant-only |
| Commerce Cart | igPOsSbEgd4NgtRA | eff32e20-a6d0-4975-88b8-107eae752b4b | Tenant-only |
| Commerce V3 Business Sandbox | Y0WLykMtNAldbgL0 | 3d8b7f89-2058-4a2a-8919-e5ff92c3c484 | Tenant-only |
| Zalo Bot staging | yIJk8LvJoLF40Z62 | 2d912cb0-007f-452f-9536-b92ba12a03e6 | Provider Bot QA; marker UPSERT |
| Messenger TEST | Z7FdV7uDvApfbURQ | 1064b1b3-d3f1-4a6b-a367-2414ba691522 | Meta HMAC; real HTTP Send node |
| Website Marketing Demo | wgkkmT7q4lm4HyuA | c81929d4-ab55-4c24-8659-795842739e24 | Website demo, not Store customer session |

Core Data Table schemas directly checked: \`TIEN404_COMMERCE_CHANNELS\`, \`TIEN404_COMMERCE_PRODUCTS\`, \`TIEN404_COMMERCE_ORDERS\`, \`TIEN404_COMMERCE_TENANTS\`, \`TIEN404_COMMERCE_V3_STORE_RULES_SANDBOX\`. All have \`tenantId\`, none has \`storeId\`. No Data Table rows, prices, order details or credentials were read.

**Important:** n8n Data Tables and Google Sheets DEMO are not the same system as Supabase public Commerce. Even after an approved Supabase Store RLS change, these *published* n8n callers must be separately versioned and reviewed to avoid silently continuing Tenant-level behavior. Do not use a Sheet store_id filter as a substitute for canonical Store authority.

## 2. IMPLEMENTED in V17.7D (source only)

- \`qa/v17-7a-oa-independent/v17-7d-authority-caller-admission-offline.mjs\`:
  - Exact seven published workflow/version pins; fail on drift, duplicate, extra or disabled workflow.
  - Strict baseline of six Commerce Postgres tables, five n8n Data Tables, three privileged RPCs and anon executable RPC grant. An unexpected change goes to **REVIEW**, not automatic new permissions.
  - Collision-aware #247 / #246 / #251 / #326 dependency handoff: G0 four original source Store rows, M0 recovery proof, G1 existing disposable PG17, M1 expand-only, M3 composite constraints, atomic M2+M4 cutover, G3 independent real same-Tenant Store A/B JWT, definer and legacy caller review.
  - Zalo Bot/Messenger/Website admission per exact version; direct Published Messenger HTTP send and Zalo Bot QA marker-upsert render an arbitrary unapproved live probe unsafe. All self-reported booleans cannot grant release.
  - Every function returns \`HOSTED_RELEASE_NO_GO\` and explicit false for provider/commerce send/write/deploy.
- \`qa/v17-7a-oa-independent/v17-7d-authority-caller-admission-offline.test.mjs\`: negative/adversarial tests, no hosted effects.
- \`qa/v17-7a-oa-independent/v17-7d-store-rpc-published-readonly.sql\`: executed as SELECT-only aggregate against actual staging; no PII.
- \`qa/v17-7a-oa-independent/v17-7d-hosted-caller-store-redacted-evidence.json\`: sanitized snapshot with actual workflow versions, Data Table column presence, hosted policy counts, no secrets or data values.
- \`.github/workflows/v17-7d-store-authority-caller-nosend.yml\`: inherited 7A/7B/7C tests + D negative QA + source-only static guard + evidence pinning.

All results remain **OFFLINE PASS** until exact HEAD GitHub Actions SUCCESS is inspected.

## 3. Remediation & Real Channel UAT sequence — PROPOSED / NOT EXECUTED

1. **G0 private merchant authority:** independently collect four original product/order ownership records through a private authenticated interface with consent and a separate TIEN404 operator, no data in GitHub/chat. Do not infer Store from SKU, tenant, bot name, or source.
2. **M0 recovery gate:** compare #251 and #247, pick actual bounded recovery coverage and independent restore proof. Existing local partial archive is limited; do not claim fully recoverable Auth/Storage.
3. **G1/M1/M3/M2M4 via #247 only:** source-schema drift check; explicit approved staging expand phase; composite FK and writer/price/stock compatibility; short atomic migration/rollback under strict read blackout. No new permissive policy left alongside Tenant-wide SELECT. Stop on any unexpected data source or published caller.
4. **G3 two real Store owner JWTs:** same Tenant, two Stores, real independent Supabase Auth sessions, tests own vs other Shop across all six surfaces, member revocation, stale session, forbidden writes, definer bypass. Private reviewer validates JWT issuer/session, reads real PostgREST result count and DB Audit, no JWT exported to ChatGPT or public CI.
5. **Zalo Bot No-Send pilot:** only after bot owner proves installation; use a *dedicated isolated no-marker-write shadow*, independently verify provider bot header and event, one authorized QA user message, zero outbound, no Commerce. Existing active workflow makes QA marker Upserts and cannot serve as absolute no-write baseline without explicit bounded consent.
6. **Messenger No-Send pilot:** only with QA Meta Page owner and separate operator; use dedicated inert staging Shadow, verify raw-body Meta HMAC, Page→Store installation, correlation and replay. **Do not send through Published Messenger TEST** while its HTTP send node exists.
7. **Website signed session:** verify real isolated Website QA user session and Store membership after G3; prevent app-client claims, cross-Shop spoofing and accidental DEMO/Commerce mixing. No AI model or Order tools by default.
8. **Zalo OA:** remains deferred until legitimate OA Admin OAuth and private signed native webhook; \`openapi.zalo.me\` endpoint knowledge is not proof of a real OA grant.
9. **Later notification:** Telegram/Gmail remains owner-notification lane. No DEMO credential/Products/Orders reuse for Commerce; only separate merchant-managed outbox with consent and independent send QA.

Any real provider send, database migration, Merchant data read, credential change, additional hosted resource or cost requires explicit scope-specific owner authorization and rollback.

## 4. Outcome / rollback

- **VERIFIED:** Current hosted metadata and exact Published workflow versions; five n8n Table schemas; cross-PR ownership.
- **IMPLEMENTED:** The V17.7D source-only admission gates, tests, read-only SQL, sanitized evidence, CI.
- **TESTED:** ONLY after final exact HEAD CI is proven successful.
- **BLOCKED:** Four original owner records, M0 recovery scope, hosted Store/RLS migration, real JWT two Store same Tenant, native channel owner event proof, hosted no-send shadow and real Zalo OA.
- **PROPOSED:** Controlled private operator-owner intake and later bounded hosted Store/Provider UAT.
- **ROLLBACK:** Close new Draft PR; there are no hosted changes to undo. Existing Production workflows, Supabase data and the other Draft PRs remain intact.

**Checkpoint:** \`V17_7D_HOSTED_TENANT_ONLY_CONFIRMED__PUBLISHED_CALLERS_PINNED__STORE_AND_CHANNEL_UAT_NO_GO\`.
