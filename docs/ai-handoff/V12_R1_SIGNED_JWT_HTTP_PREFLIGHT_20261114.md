# TIEN404 AI V12 R1 — Supabase Auth HTTP Preflight (2026-11-14 JST)

**Status:** IMPLEMENTED staging, HTTP negative authentication TESTED (2/2), positive signed JWT Owner E2E BLOCKED.  
**Scope:** Shop-Owned AI Sales Bot + Owner Pairing. No Zalo sends, Messenger changes, real Orders, billing, secrets or paid LLM usage.

## Checkpoint and verified infrastructure

- Existing draft PR: [#34](https://github.com/ngoctien20/demo-git/pull/34), branch `work/v12-r1-shop-owned`. NOT MERGED.
- Supabase project `tien404-staging`, ref `ifxlvrhyjhbzbrkdsida`.
- Existing private schema `tien404_r1_qa` remains inaccessible directly to `anon`, `authenticated` and `service_role`. Owner membership for two distinct synthetic staging tenants is already present.
- No dedicated n8n→Supabase credential available. This phase does not create one.

## Implementation

**Supabase Edge Function**
- Slug: `tien404-r1-owner-preflight`
- ID: `bcc61827-1dfe-4fe1-9a23-42c9c73dd6e5`
- Version: **1**
- Deployment status: **ACTIVE** on the *staging* Supabase project.
- `verify_jwt=true`, enforced by Supabase gateway.
- Source: `qa/shop_owned/supabase/functions/tien404-r1-owner-preflight/index.ts`.
- Endpoint: `POST https://ifxlvrhyjhbzbrkdsida.supabase.co/functions/v1/tien404-r1-owner-preflight`.
- Body (only): `{"shop_slug":"qa-staging-shop-a-20261110"}` or Shop B slug.
- Defense-in-depth: function requires `Authorization: Bearer <signed-user-JWT>`, calls Supabase Auth `getUser(token)` to revalidate session, performs RLS-scoped reads of `public.tenants` and `public.tenant_memberships`, requiring `role=owner` and `active=true`.
- Environment API key is obtained only inside Supabase runtime; no raw key stored in repository. No service-role client. No token/user ID/Chat ID returned, emitted in logs, or persisted.
- No database writes or outbound notification code. No CORS configured. Response sets `Cache-Control: no-store`.

**n8n manual QA**
- Workflow: `TIEN404_R1_SIGNED_JWT_HTTP_NEGATIVE_QA`
- ID: `zaz2jcxrYXQeFHLL`
- Project: personal `WW82YsCCaAxGC9dp`, folder `90_QA - DIAGNOSTICS`.
- Six nodes: manual trigger; HTTP missing JWT; assert 401; generate fake, UNSIGNED JWT; HTTP fake signature; assert 401.
- No real credential attached. The fake JWT is synthetic and never usable for login. No order/Supabase table writes or Zalo sends.
- Workflow remains Inactive and is not Published. Execution payload retention disabled after test.

## Actual HTTP TESTED

n8n execution **3061**, success:

1. Missing JWT → **HTTP 401**. Gateway body: `UNAUTHORIZED_NO_AUTH_HEADER`, `Missing authorization header`.
2. Invalid JWT signature → **HTTP 401**. Gateway body: `UNAUTHORIZED_LEGACY_JWT`, `Invalid JWT`.
3. Assertions: **2/2 PASS**. Results reflect actual Supabase Edge gateway responses, not SQL-only simulations.

The function was deployed with `verify_jwt=true`; the gateway rejects these requests before executing the function. This **does not prove** the function's successful Owner lookup path.

Prior evidence remains: SQL-context simulated Owner auth 8/8, SQL-context simulated pairing 8/8, n8n contract checks 14/14 execution 3060, isolated staging Postgres QA Orders/Outbox HELD.

## Important limitations — mandatory gates

- Positive 200 via a REAL SIGNED Supabase Auth session JWT from Shop A and B has NOT been run. Do not forge a login JWT, extract tokens from users' local browser, or ask for JWTs pasted into chat.
- Need authorized QA test accounts, real HTTP login/verification and negative attempts: wrong tenant, expired/revoked session, tampered signature, non-owner, double pairing, unauthenticated.
- This Edge Function is read-only. It **does not** yet bind incoming Zalo webhook to Owner, issue pairing challenges, or provide an authenticated sandbox order commit API.
- n8n→backend write credential is NOT available and requires separate secure design/approval. Never use Bot Token, generic Header Auth, or publish the `service_role` secret for database writes.
- No actual n8n→PostgreSQL commit has occurred. The n8n contract/test workflow is not an integration implementation.
- D1 TEST 09 idempotency claim is not to be reset; Zalo Outbound Kill Switch stays false.

## Next staged engineering steps

1. In an approved QA browser session, sign in as Owner Shop A/B, call this preflight with the existing user JWT through the web app/API tooling (do not paste token into chat). Verify 200 for own shop, 403 cross-shop, 401 for invalid token.
2. Design and review a dedicated **least-privilege server-side operation credential** to bind n8n webhooks to a trusted backend. This credential is distinct from user JWT and Bot credential. Ask for explicit approval before modifying credentials or live security policies.
3. Introduce a gated backend `commit_order_sandbox` API with validated store+bot identity and idempotency. Do not directly expose `tien404_r1_qa.commit_order_qa` on public Data API. Keep outbox `HELD` and prevent delivery retries before policy approval.
4. Only after signed Auth and integration E2E are verified, propose Owner-facing pairing UX and future notification one-shot approval.

## Rollback / checkpoint

- Draft PR #34 remains unmerged. Edge function can be reverted by redeploying a fail-closed JWT-required read-only version; do not delete or disable without owner confirmation.
- n8n negative QA remains Inactive. No public webhook, no database write node, no session token storage.
- No rollback required in public Commerce, Zalo Webhook or Messenger.
- Release status: **EXPERIMENTAL**, not a production or shop-ready API.
