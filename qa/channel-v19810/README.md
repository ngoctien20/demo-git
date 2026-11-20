# TIEN404 V19.8.10 — Trusted Bot Installation → Store Authority × Protected Catalog Read

## Status and integration scope

**CANDIDATE, LOCAL DOCKER QA ONLY, NO LIVE PROVIDER SEND.** The trust model tests a **mock signed provider payload**, not an actual Zalo Bot credential or official Zalo webhook signature. Only the real Supabase Auth test JWTs and local PostgREST Store RLS are used as actual security checks.

V19.8.9 successfully tested 30/30 and 48/48 local Auth+JWT+RLS with two same-tenant Stores. V19.8.10 continues **inside that existing verified ephemeral Docker Supabase stack**, without touching the published Zalo webhook, Commerce AI Core, Supabase hosted or any real merchant data.

## Boundary of authority

1. **Simulated provider ingress:** `mock-ingress-catalog-policy.mjs` accepts only a strictly allowlisted fixture event, validates HMAC-SHA256 with an **ephemeral process-only test key**, exact endpoint, event timestamp, event ID, SKU, quantity, epoch, private conversation and non-echo semantics. Unknown/replayed/malformed events must be denied.
2. **Private installation resolver:** SQL `t404_v19810_installations` holds a unique endpoint, Bot reference, server credential reference (not raw secret), credential epoch, owner user ID, tenant/Store, config version, active/revoked state. Owner consent and Store membership must match the same registration. Composite FK rejects cross-Store owner binding.
3. **Atomic mock admission:** a single local PostgreSQL statement joins server-owned installation + consent + Store owner + Tenant owner membership and inserts a unique `(installation_ref,event_ref)` into an installation-scoped local event inbox. Duplicates do not get admitted. SQL lookup does not select catalog data.
4. **Real local Auth verification:** after mapping the exact server-bound owner ID to its independently signed **local** Supabase Auth session, the runner calls `/auth/v1/user` to revalidate the JWT and user identity.
5. **Store-scoped catalog:** read the actual **local PostgREST** `t404_v1989_products` fixture with the signed Owner's bearer token, forcing the database's RLS to return only the authorized Store. Compare exact SKU, VND integer price and stock; return a **local-only preview** with `canSend=false`, `canWrite=false` and `orderCreated=false`.

**Never infer real Zalo provider ownership from an arbitrary HTTP body or client-supplied Bot/Store ID.** The mock HMAC key is not the real Zalo header secret, sender identity or an officially verified Bot installation. Superuser PostgreSQL is used ONLY in disposable CI for synthetic registry operations, not for catalog SELECT. A real backend must use auditable narrowly scoped internal DB privileges, native provider verification and verified owner consent.

## Test matrix

- Bot A → Store A sees SKU F01 at 159000 VND / 5 units; Bot B → Store B sees F01 at 189000 VND / 9 units.
- Real locally signed Owner JWTs prove Store-scoped price/stock read; Owner A cannot retrieve Store B product row.
- Mock HMAC payload cannot inject `storeId`, `tenantId`, `isOwner`, order mutation or credential.
- Cross-Installation signing key, tampered message, repeated installation event, unapproved/expired installation, mismatched epoch, withdrawn owner consent and revoked Store membership fail closed.
- The same event ID on a **different installation** is not incorrectly treated as a duplicate (installation-scoped key).
- Owner A still has a valid signed JWT when active Store membership is revoked, but PostgREST RLS stops returning Store A catalog rows.
- Authenticated roles cannot directly read the private installation registry; anonymous users cannot read catalog.
- Every preview/denial is NO SEND, NO WRITE, NO ORDER, NO LIVE JWT OR BOT GRANT.

## Files

- `local-installation-authority.sql`: additional synthetic private Bot/Owner/Event tables, in existing V19.8.9 Docker database only.
- `mock-ingress-catalog-policy.mjs` and `.test.mjs`: strict HMAC mock ingress and price/stock guard tests.
- `local-installation-catalog-uat.mjs`: end-to-end ephemeral mock provider → internal verified installation+consent → locally issued real Owner Auth JWT → PostgREST Store RLS → preview.
- `.github/workflows/tien404-v1989-local-supabase-auth-rls.yml`: append V19.8.10 after prior proven 30/48-case tests, before local Docker teardown.

## Non-goals / remaining real gates

- **BLOCKED:** official Zalo provider identity attestation and production Bot installation evidence; the test provider HMAC is entirely synthetic.
- **BLOCKED:** real hosted Owner A/B JWT and Store-scoped Commerce schema (Supabase organization on Free, branch creation rejected). No hosted migration.
- **BLOCKED:** actual Bot→Store authority with merchant approval, read-only catalog adapter deployment, provider Send API, order creation, stock reservations, subscription/billing.
- No credential changes, no production n8n workflow edits, no private customer reads or provider messages in this PR.

## Rollback / checkpoint

Revert the V19.8.10 QA-only files and CI steps or close Draft PR #459. Local Docker stack is discarded after CI. No hosted rollback necessary.

Checkpoint: `TIEN404-V19.8.10 — LOCAL_MOCK_INSTALLATION_REAL_JWT_CATALOG_CANDIDATE / ZALO_PROVIDER_PROOF_PENDING / NO_LIVE_CHANGES`.
