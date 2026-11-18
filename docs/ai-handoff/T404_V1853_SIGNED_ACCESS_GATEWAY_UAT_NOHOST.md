# TIEN404 AI — V18.5.3 Protected Website Widget × Signed Access Admission

**Date:** 18/11/2026 JST. **Status:** CANDIDATE / NO-HOST SOURCE ONLY / REAL UAT NOT RUN / PRODUCTION NO-GO.

## 1. Scope and source of truth

Continuation of V18.5.2 Draft PR #405 SHA `78df4ed8f8987c1ac82e9619a99bd8c6e630e5cc`, stacked after V18.5/V18.5.1 Draft #404 (and prior PR #97/#94). Only isolated GitHub Draft source+synthetic QA changes. **Do not merge, deploy, publish or alter external account permissions under this task.**

Existing Commerce Core `iyfGUiEsZlNTBWOR` Published `456862c9-e5ee-4bfa-9931-47dbc39ab73d` is **NOT fully read-only**: published Agent has `Create Sandbox Ticket` tool → `jirkuVts1AjIhnPJ` → Data Table row.insert. V18.5.2 permits candidate read-only **child tool contracts only** (`oOOXicKXGkBskKqh` Catalog and `igPOsSbEgd4NgtRA` Cart); none are live admitted. Platform Consultant/approved Merchant Sandbox still separated.

## 2. Independently verified Cloudflare account inventory, read-only

- Existing Worker: `tien404-widget-gateway-v144-staging`, **REUSE, DO NOT CREATE SECOND GATEWAY**.
- Existing deployment: `a9f197fe-68c1-4321-bfb1-bc333d3093c6` with single Worker version `98c8aad5-2dae-47c3-9cb0-8473065213e6` dated 15/11/2026 UTC; source from previous V18.5.1 audit returns 423 (LOCKED) on widget paths.
- Latest Cloudflare GET settings: **zero Worker bindings**. GET worker subdomain: **workers.dev disabled, preview URLs disabled**. Previous V18.5.1 audit confirmed zero candidate custom domains/routes. Do not claim a real reachable protected API.
- Cloudflare account Access GET: **four apps, none a dedicated private V18.5 widget Access app**. No Access policy/credential/Worker change made.
- Real founder/operator identity, exact protected hostname, Access app audience, Access key rotation and Store A/B owner authorization **not approved or verified**.

## 3. New source-only crypto security port

`qa/channel-v1853/access-jwt-verifier.cjs` is a Node.js offline QA verifier, **not hosted or worker-runtime**. It uses generated synthetic RSA signing keys in tests; verifies a complete RS256 JWT signature and exact server-configured issuer, pinned audience, valid iat/exp/nbf, short max token lifetime, approved operator `sub` allowlist. Keys are explicitly passed by **trusted server config**, NOT selected by JWT `jku`/`x5u`. Rejects `none`, `HS256`, `RS512`, secret/private/1024-bit JWK, duplicate kid, malformed/overlong JWT, wrong audience, bad signature, expired/early/future token, unapproved operator.

No HTTP/JWKS fetch or Access login is performed. The source returns a synthetic marker that V18.5.1 **offline** gateway already recognizes; it does not create a real Access policy or identity claim, does not authorize any real customer, Store, private Orders or n8n tool call. Only a deliberately approved, separately reviewed Worker implementation may later adapt this to WebCrypto/jose-compatible runtime; do not copy this Node-specific verifier blindly into production.

**Key rotation:** According to Cloudflare documentation, Access public signing keys are served at the fixed server-owned `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`; Access rotates signing keys periodically. A future hosted verifier must use server-pinned exact issuer/key endpoint and controlled refresh/bounded cache, fail closed on stale/unknown key, never fetch a user-defined `jku`. Do not hardcode/commit actual Access tokens, API secrets, or operator subject details in public GitHub.

Cloudflare documentation:
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/reference-architecture/design-guides/identity-gated-edge/

## 4. Source-only threat model / acceptance layers

```
[NOT DEPLOYED] Access-protected exact same-origin private staging
    ├─ Edge Access app: only approved QA operators, NO bypass
    ├─ V18.5.3 Access RSA-SHA256 JWT signature / issuer / audience / expiry
    │   + server-owned operator allowlist [OFFLINE TESTED, NOT HOSTED]
    ├─ Existing V18.5.1 Protected HTTP Gateway
    │   + strict Origin/route/body [mock]
    ├─ V14.4 trusted installation, domain proof, HMAC guest session
    │   + persistent quota/replay [mock]
    ├─ V18.5.2 exact-Published Catalog/Cart tool admission [mock]
    └─ Existing Commerce Core public Sandbox data only [NO ACTUAL INVOCATION]
```

**No assumption of Store authority:** Cloudflare Access operator authentication is only admission to private QA. A signed operator JWT, browser widget ID, claimed origin/domain, public HMAC session or spoofed client role must **never** be treated as a merchant owner grant or private customer identity. Owner-authorized merchant installation must be separately proven. JWT verification must happen on **each protected request** (both session and message), never only on initial session. Account security policies and direct-origin bypass checks remain mandatory before route activation.

**No safe CORS assumption:** Cloudflare Access can intercept cross-origin preflight and deny OPTIONS. Private QA should prefer hosting UI + API on the exact same Access-protected origin; consider `credentials:'same-origin'` only for the controlled origin, never install broad Access Bypass. `ctx.access` is only available for the authenticated Worker invocation and does not propagate through service bindings.

## 5. Expected QA and hosted-release gates

- Signed crypto synthetic: genuine ephemeral RSA key generation and signatures, tampering and malicious header tests, wrong operator, wrong store claims and expiration.
- Offline integration: genuine signed RSA token → **mocked offline** V18.5.1 protected HTTP session → V18.5 shared core synthetic contract (no actual n8n).
- Inherited synthetic V18.5.2/V18.5.1/V18.5/V14.4/V14.3 regressions run in scoped GitHub Actions.
- Real Worker reachability, signed Cloudflare token, Access App/policy, team JWKS, durable D1, real operator UAT, actual server-side n8n Catalog/Cart, real two-Store JWT/RLS **remain NOT RUN**.
- Before any hosted UAT, require **specific approval** of exact private hostname, explicit operator allowlist, Access policy/app, existing Worker version+rollback, budget/cost cap, real JWT+JWKS strategy, durable ledger, n8n read-only caller credential and public Sandbox data scope. Deny any production sends or writes.
- Test real bypass negatives at every public route, Worker subdomain/preview, direct Render origin, unprotected custom domain, wrong host+path, Access Bypass policies and service bindings. A correct JWT check at one route does not prove the entire site is protected.
- Real customer data, Orders or inventory mutations and Meta/Zalo sends require entirely separate consent and signed gate, **not permitted** in V18.5.3.

## 6. Changed / not changed, rollback

Changed: isolated `qa/channel-v1853/` verifier, synthetic test, release-approval JSON, this handoff and scoped CI on a new stacked Draft PR.

Not changed: public `gh-pages`, website flags, live n8n workflows/versions, Cloudflare Worker/Access/D1/keys, Render/Supabase, customer data, Orders/Products, Messenger/Zalo, production, billing or credentials. No new hosting cost was incurred through this source-only task.

Rollback: close/revert this stacked Draft PR; leave #405 and #404 untouched. If a later independently approved hosting experiment fails, revert the exact Worker deployment, remove/disable the exact isolated route, revoke sessions, restore Access policy backup and confirm unauthenticated 403/423 before proceeding. Never delete customer data as rollback.

**Security decision:** `V1853_RSA_SIGNED_JWT_SOURCE_QA / REAL_ACCESS_APP_ABSENT / GATEWAY_LOCKED / REAL_HOSTED_UAT_0 / FULL_AGENT_WITH_INSERT_NO_GO / PRODUCTION_NO_GO`.
