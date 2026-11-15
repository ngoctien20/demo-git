# TIEN404 AI V14.4.2 — Controlled Store RLS Migration & Hosted Acceptance Runbook

**Owner:** TIEN404 AI security/integration + independent QA
**Stage:** EXPERIMENTAL / REVIEW ONLY / DO NOT APPLY MIGRATION
**Supabase project:** tien404-staging \`ifxlvrhyjhbzbrkdsida\`, PostgreSQL 17.11
**Source branch:** stacked on V14.4.1 Draft PR #101; V14.2 proposal resides in independent Draft PR #86
**Critical rule:** hosted migration is NOT approved; backup archive has not passed an isolated restore drill. Never silently reinterpret "hoãn restore" as approval to mutate RLS.

## 1. What exists now, from READ-ONLY Supabase inspection

- Tables \`public.products\` and \`public.orders\`: 2 rows each; \`customers\`, \`order_items\`, \`conversations\`, \`messages\` each have 0.
- All six Commerce tables have RLS enabled and FORCE RLS enabled, but **no \`store_id\`** and one **PERMISSIVE SELECT** policy each. Each still selects by tenant, not store.
- \`public.stores\`, \`public.store_memberships\`, \`app_private.shop_knowledge_releases\` are absent. Never assume fixtures from the independent \`tien404_r1_qa\` schema are approved store records.
- \`public.products\` has \`UNIQUE(tenant_id,sku)\`. It must be adapted carefully to \`UNIQUE(tenant_id,store_id,sku)\` after ownership and legacy writers have been audited.
- \`order_items\` foreign keys currently include (tenant_id,order_id) and (tenant_id,product_id); \`orders\` has tenant+customer FK. After migration composite FKs must keep every relationship in the same tenant AND store, including Messages/Conversations.
- The SECURITY DEFINER functions \`save_merchant_product\`, \`qa_owner_pairing\`, \`qa_shop_b_zalo_claim\` still lack explicit \`store_id\` references; inspect the full function logic, privileges and every caller before changing.
- A numeric metadata inventory is in \`qa/hosted-readiness-v1442/PREFLIGHT_READ_ONLY_CATALOG.sql\`; it performs SELECTs only, contains no personal data values and has no powers to migrate.

## 2. Six controlled phases; do not skip a gate

**M0 — Recovery proof (BLOCKED):** User's local \`TIEN404_V142_PRE_RLS.backup\` was created via pgAdmin successfully (212 KB in Explorer); \`pg_restore --list\` exited 0, policies and table-data entries visible and SHA256 calculated by the operator. Still must (a) restore actual archive in a truly isolated PostgreSQL 17 with compatible extensions/roles, (b) verify row counts/schemas/RLS/constraints and recovery log, (c) retain encrypted private backup and (d) approve RTO/RPO and post-commit rollback strategy. No migration before the owner accepts these checks.

**M1 — Expand only (PROPOSED):** Obtain separate approval of canonical \`stores\` and \`store_memberships\`, private Knowledge schema with revision, owner/manager permissions and lifecycle. Use a clean versioned migration after review, not a copy of the intentionally guarded \`PROPOSAL_ONLY_STORE_RLS_DO_NOT_RUN.sql\`. Add **nullable** \`store_id\` to all six existing tables without automatically assigning any store. Verify existing readers/writers still function on staging and that private schema grants are minimal; production remains unchanged. Capture migration SHA and SQL review signoff.

**M2 — Owner-attributed legacy rows (BLOCKED):** Four separate private ledger entries: Products #1, Products #2, Orders #1 and Orders #2. Each entry requires stable row ID, original tenant UUID, independently confirmed canonical Store UUID, authenticated merchant source evidence, independent reviewer and approval timestamp. Never display IDs, phone numbers or raw customer info in a public PR. Missing/ambiguous owner evidence => quarantine, STOP. No default tenant-to-store mapping. Verify Orders/Products links before backfill. Backfill only 4 approved records in a transaction with before/after checks and a reviewed reversal script.

**M3 — Constraints & SKU transition (BLOCKED):** Validate same-store tenant+store foreign keys for Products, Orders, Customers, Order Items, Messages and Conversations. Then consider NOT NULL only after no unmapped rows remain. Before dropping existing \`UNIQUE(tenant_id,sku)\`, audit every active product catalog writer, API query, n8n tool and idempotency key. Demonstrate two Stores in SAME tenant can use same SKU with different price/stock, and that SKU lookup without Store is rejected. Any draft fixture claiming isolation is not evidence of real staging integrity.

**M4 — Atomic policy replacement (BLOCKED):** PostgreSQL **PERMISSIVE** SELECT policies combine with OR. Simply adding a store policy while leaving a tenant-wide policy leaks a Store B row to Shop A within the same tenant. Review all six policy replacements and \`SECURITY INVOKER\` views as applicable. Implement SELECT/INSERT/UPDATE/DELETE privilege matrix separately; UPDATE requires both \`USING\` and \`WITH CHECK\`. Review \`SECURITY DEFINER\` functions, external grants and RPC callers. Replace policies atomically, ideally with a transaction and query-gated assertions on policies, and have a separately tested *post-commit* rollback strategy. Production and credentials remain out of scope.

**M5 — Hosted JWT acceptance (BLOCKED until M0–M4):** Operator obtains four **distinct**, authorized Supabase Auth sessions: Shop A and Shop B inside the **same tenant** but independent stores, Shop C in a different tenant, and one valid-auth staff user with no active assignment to any target store. Associate 3 owner-approved QA Products AND 3 QA Orders (one per Store) with non-sensitive, non-customer fixtures. Never reuse the current 2 Products / 2 Orders for fixtures until their real ownership is independently confirmed. Do not create accounts, records or staff assignments without separately approved scopes.

## 3. Hosted GET-only acceptance harness — run later from operator-approved secure machine

New source: \`qa/hosted-readiness-v1442/hosted-jwt-acceptance.cjs\` and 24 mocked security cases.
- **Default:** cannot run; requires exact explicit staging GET-only approval and completed restore/migration gate; no fallback to service_role.
- The machine supplies a **Supabase publishable key** and four real signed-in QA access tokens via ephemeral environment settings. NEVER commit, screen-capture, paste or log them.
- Calls \`GET /auth/v1/user\` for each bearer and requires four distinct non-anonymous user IDs.
- Reads \`store_memberships\` only for the three scoped QA stores, verifying Shop A/B same tenant, Shop C different tenant, independent active membership and unassigned staff.
- Makes **24 GET-only product/order checks:** six positive own-store fixture reads, twelve forbidden foreign-store reads, six forbidden revoked-staff reads. Only stable IDs, tenant_id, store_id and SKU are selected; no phone/customer/order details. A non-200 response is FAIL, never treated as no rows.
- Return is a redacted count/boolean summary. The harness never logs JWT, publishable key, user IDs, tenant IDs or row IDs; no HTTP POST/PATCH/DELETE, SQL, n8n or Meta calls.
- This **cannot** prove authenticated WRITE policies, other four Commerce tables, RLS on RPC/view paths, actual Meta permissions or Widget hosted replay. Those require separate acceptance.

The earlier V14.2 GET-only QA runner in PR #86 remains unmodified; V14.4.2 adds four-actor / cross-tenant / revoked staff / Orders coverage for later controlled integration.

## 4. Preflight GO / NO-GO checklist

- [ ] M0: User explicitly accepts RTO/RPO, isolated restore PASS, private backup retention and versioned rollback.
- [ ] M1: Canonical Store/Knowledge schema reviewed including GRANT/REVOKE, owner/manager permission matrix.
- [ ] M2: Four existing records each mapped from private owner evidence and independently signed off.
- [ ] M3: Same-store composite FK, SKU contract and all legacy n8n/tool writers tested on staging.
- [ ] M4: All six SELECT policies replaced without permissive tenant bypass; full security definer review and rollback after COMMIT rehearsed.
- [ ] M5: Four separate QA Auth accounts and authorized synthetic fixtures; hosted GET-only acceptance plus separately audited write-path and RPC negative tests.
- [ ] Release: Two-person QA signoff, Change ID, migration SHA, before/after hashed counts, rollback owner, signed approval. NO real Meta/Zalo sends.

**As of this checkpoint, every box remains UNCHECKED.** Claimed evidence objects are for review only and NEVER authorize an automated migration. \`migration-preflight.cjs\` returns false for every write/migrate/alter flag.

## 5. Safety, rollback, evidence policy

- If any gate fails, stop and preserve logs/metadata. Do NOT "fix" by disabling RLS or using \`service_role\` as a surrogate QA user.
- Never restore the local backup to \`tien404-staging\`. The previously successful \`pg_restore --list\` is a TOC test, not a recovery rehearsal.
- Current PR is source/CI only. Rollback this PR by closing/reverting the Draft branch. It requires **no database rollback** because no hosted change is applied.
- Phase-by-phase real migration requires its own reviewed and tested rollback for both uncommitted and committed changes, plus a private four-row before-image ledger. Never use a rollback that deletes unrelated customer data.
- Use separate QA roles/sessions with least privilege, not staff session assumptions. Never publish tokens, secret values, or raw customer fixtures in GitHub Actions logs.
- Canonical Postgres RLS documentation: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Functions security: https://supabase.com/docs/guides/database/functions
- Supabase Auth JWT validation: https://supabase.com/docs/guides/auth/jwts

**Release decision:** PREPARED FOR INDEPENDENT REVIEW; HOSTED MIGRATION and all real credential/session operations remain BLOCKED.
