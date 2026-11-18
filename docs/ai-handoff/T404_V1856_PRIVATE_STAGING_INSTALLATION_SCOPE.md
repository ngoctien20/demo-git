# TIEN404 V18.5.6 — Private Owner Staging × Trusted Installation Scope

**Date:** 18/11/2026 JST  
**Status:** SOURCE CANDIDATE ONLY — NOT DEPLOYED / NOT PUBLIC / NO NEW PAID RESOURCES.  
**Purpose:** Continue development after owner deferred the second non-allowlisted Cloudflare identity UAT. Deferral is **not a PASS** and does not approve production.

## 1. Continuity and true system state

This branch is stacked on the V18.5.5 Draft PR #415 (`203ad2c7e8e16c91edef46f43b97a2c6c51d63c6`) and retains the existing V18.5.4 Cloudflare Gateway. No replacement Gateway or second AI Core.

- Existing V14.4 Worker `tien404-widget-gateway-v144-staging`, version `da022974-1832-425f-bf82-afddc558b893`, deployment `b4f501e0-ff37-4ea4-be77-6e3148667b15`; 100% private staging.
- Existing Cloudflare Access exact-host app `1a73d50b-0668-4308-8f56-53aa9711d477`; founder-only biometric MFA.
- Existing n8n ingress `JZL4p8tLb65eU3aB` INACTIVE; internal read-only Adapter `rYwrJfJavcaZcjUI` INACTIVE. Webhook Header Auth metadata is verified; no real HTTP Header Auth positive/negative evidence.
- Existing V18.5.5 Worker source-only candidate accepts a browser-selected `installationId` from a short Sandbox allowlist. That is **not** an acceptable public multi-store authority.
- V18.5.1A anonymous Access probe succeeded on 3/3 routes (302 to login); signed-in non-allowlisted account denial remains unverified. Owner explicitly deferred that check for development only.

## 2. Vulnerability and security boundary

A public customer must never be able to select an arbitrary installation/store simply by including an `installationId`, `tenantId`, `storeId`, or similar field in browser JSON. Requiring a syntactically valid installationId from an allowlist is not the same as proving the caller's authority to that installation.

A correct future multi-store solution needs a trusted domain/installation registry tied to verified merchant ownership and isolation at the database Store RLS layer. **This V18.5.6 source is not that future solution**. It is a deliberately narrower private operator-only staging gateway that binds one approved Sandbox installation through server configuration, not client input.

## 3. IMPLEMENTED SOURCE — private owner-only Gateway wrapper

New file `qa/channel-v1856/private-owner-staging-gateway.mjs`.

- Uses the **existing native `ctx.access` check** and owner allowlist before inspecting request bodies.
- Requires exact HTTPS hostname `tien404-widget-gateway-v144-staging.tienmobi208.workers.dev`.
- Preserves the original V18.5.4 Access Canary, health route, and locked `/v1/widget/*` behavior by delegating to the original Worker module.
- Adds **source-only** private operator route `POST /__v1856/private-commerce/read`.
- Requires trusted server-side `T404_V1856_GATE_MODE=PRIVATE_OWNER_QA_ONLY` and `T404_V1856_QA_INSTALLATION_ID` set to exactly one approved Sandbox installation. **Neither binding is set** on Cloudflare; they must not be enabled without separately authorized deployment and staging preflight.
- Browser payload must contain `operation` and may contain only `query`, `limit`, or `cart`. Client `installationId`, Tenant/Store/Account/Customer/Order/role fields, and all other unrecognized keys fail closed.
- Sanitizes incoming headers, constructs a clean internal JSON request, and attaches the installation ID **only from the trusted environment**.
- Reuses the V18.5.5 read-only engine which independently validates native Access, the exact HTTPS n8n webhook host/path, mandatory Durable Object admission before any outbound fetch, and read-only response shape.
- Limits inbound JSON bytes to 8192, disallows OPTIONS/CORS, URL parameters, unknown host, non-JSON and malformed bodies. Does not expose n8n headers, secret or Store authority.
- Keeps the public customer Widget **locked**; only the existing approved private operator could use the new route after a separately approved private staging deployment.

**Limitation:** one fixed Sandbox installation per private host/environment is not a multitenant deployment. Changing the environment to another installation requires a separate approved configuration change. Future merchant-facing routing must be proven independently.

## 4. QA and expected evidence

New security test file `qa/channel-v1856/private-owner-staging-gateway.test.mjs`.

Cases include preserving the original Canary and locked routes, missing `ctx.access`, synthetic non-owner rejection, missing server mode or installation binding, positive materials Catalog and grocery Cart against **mocked** n8n read-only responses, rejection of forged installation/tenant/store/account/role/order fields, malformed bodies, OPTIONS/CORS/host violations, mandatory DO fail-closed, and absence of upstream secrets/unsafe egress.

These are **offline synthetic tests**. They are not live n8n Header Auth, actual Cloudflare Durable Object runtime, live Cloudflare Edge multi-identity Access UAT, real customer RLS or full Widget-to-Commerce E2E.

Test results will be recorded from the exact GitHub Actions run on the Draft PR head. The latest active V18.5.5 CI reference is 141/141 at HEAD `203ad2c7e8e16c91edef46f43b97a2c6c51d63c6`, from its prior stage; do not copy that status to the new V18.5.6 code before CI succeeds.

## 5. Owner's decision and remaining release gates

**DEFERRED_BY_OWNER_FOR_DEVELOPMENT:** second Cloudflare non-allowlisted signed-in account denial from V18.5.1A. Do not ask the owner to repeat this test to continue source-only work. The actual real denial remains **NOT VERIFIED** and is a separate production security acceptance risk.

Other gates:
- Private Gateway's new environment bindings **NOT CONFIGURED**.
- Cloudflare Durable Object namespace/migration/binding **NOT CREATED**, because potentially metered and not authorized.
- n8n Header Auth real HTTP **NOT TESTED** and inactive.
- n8n Catalog/Cart read-only child calls previously tested on Sandbox; **same-tenant Store A/B RLS NOT VERIFIED**.
- Public merchant installation authority and storefront domain registry **NOT IMPLEMENTED**.
- Production **NO-GO**.

## 6. No-change boundary, rollback, next steps

No Cloudflare API write, second Worker, Access policy/credential change, D1/DO creation, n8n workflow publish, Product/Order/Inventory write, provider send, billing change, public Website change or production deployment.

Rollback: close/revert this Draft PR. The existing V18.5.4 Worker and n8n Published workflows remain untouched.

Recommended next source-only development: trusted merchant-installation registry contract, same-tenant Store A/B isolation truth table, and authenticated RPC credential separation. After explicit resource/deployment approval, run a private disposable-host canary with exact request admission and negative QA.

**Checkpoint:** `V18.5.6_PRIVATE_OWNER_SANDBOX_INSTALLATION_SERVER_BOUND_SOURCE_ONLY / SECOND_IDENTITY_DEFERRED_NOT_VERIFIED / PRODUCTION_NO_GO`.
