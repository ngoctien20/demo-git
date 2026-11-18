# TIEN404 AI — V18.5.1 Protected Widget Gateway Staging — SECURITY PREDEPLOY

**Checkpoint: 18/11/2026 JST. CANDIDATE / SOURCE-ONLY / NO-HOST / NO PRODUCTION.**

This is the continuation of **V18.5 Draft PR #404**, stacked on PR #97 -> PR #94. No new AI Core, no new public website, no Merge/Publish/Deploy. Implementation reads from the existing V18.5 gateway, which reuses V14.4 server installation/session/replay/quota ports, V14.3 renderer and references the **existing** n8n Commerce Core `iyfGUiEsZlNTBWOR` through a **MOCKED server port only**.

## 1. Verified inventory and threat model

- Read-only GitHub review: PR #404 remains OPEN DRAFT, source HEAD pre-change `e7f700ea961fcf5a79f2183145da0117ee4fcf7b`. P0 dependencies #94/#97 remain separate stacked Draft PRs. No widget configuration is enabled in public `gh-pages`. Widget currently loaded only on `index.html` and `demo.html` across 26 root HTML pages.
- Cloudflare Access GET account inventory 2026-11-18: **four** apps; none is an approved dedicated V18.5.1 Widget Gateway Access app. **No Access policy or Worker change made.**
- **EXISTING GATEWAY REUSE REQUIRED:** Cloudflare currently has Worker **`tien404-widget-gateway-v144-staging`**. Its inspected source identifies `V144_WIDGET_GATE_CLOSED`, exposes a source-only `/__v144/health` LOCKED response and denies `/v1/widget/session`, `/v1/widget/message` and related widget paths with **HTTP 423**. Cloudflare GET settings confirms **0 bindings**, Workers.dev **disabled**, preview URLs **disabled**, 1 historical deployment on 15/11/2026; GET account Worker custom domains finds **0 matching**, and GET managed zone routes finds **0 matching**. This is a read-only SOURCE/CONFIG inspection, **not** a successful HTTP health check because routes are disabled. **DO NOT build or deploy a second Gateway**; future implementation, if approved, extends the EXISTING Worker with a versioned V18.5 route without activating its existing V14.4 paths until independent release gates.
- Cloudflare account D1 list currently contains **6 D1 databases**, none verified as a Widget V18.5 ledger. No D1 creation, binding or SQL was performed. Existing non-Widget D1 databases must not be repurposed for real merchant/chat data.
- Render `list_services` could not be rechecked in this run: connector reports **no workspace selected** and requires the user to confirm a workspace. Do not treat previous Render checkpoint as fresh verification. Render was not modified.
- Existing Website JavaScript exposes the **legacy direct n8n Chat webhook**; unchanged on public site. New V18.5 frontend is opt-in staging only. Public `widgetId`, `Origin`, `Referer`, CORS, signed anonymous widget session or Cloudflare Access staff identity **cannot** alone authorize a real customer's private Store or Orders.
- Existing n8n Commerce Core is already the shared target. V18.5 did not call it live; V18.5.1 also **does not** invoke real n8n, real AI, catalog, orders, Zalo or Messenger.

### Protected ingress architecture — target vs implementation

```
[future approved private QA website: exact same-origin Access app]
  -> /widget/v18.5/session or /widget/v18.5/message
     -> pinned Access signature verifier & independent operator permission
     -> reviewed installation registry + domain proof
     -> time-bounded scoped anonymous session
     -> D1 atomic replay + quota, fail-closed, per-widget cap
     -> existing Commerce Core iyfGUiEsZlNTBWOR [approved public-only tools]
     -> V14.3 Website Channel Renderer
     -> safe public-preview response
```

**Only the middle HTTP contract and its synthetic ports are implemented in this PR.** No customer identity, direct Store access or real Order write/read exists. A fail-closed Cloudflare Worker **DENY-ONLY** source fixture is included ONLY for offline negative verification; **it is not a second Gateway to deploy**. The actual Cloudflare V14.4 Widget Gateway already exists, stays LOCKED (423), and must be the sole approved future deployment target.

## 2. Source additions

| Source | What it actually does |
|---|---|
| `qa/channel-v1851/protected-http-gateway.cjs` | Pure Node.js Request/Response adapter for **OFFLINE_SYNTHETIC_QA**. Enforces fixed HTTPS gateway host, exact /session and /message paths, strict Origin allowlist, 4KiB streamed payload cap, 800-char message cap, JSON content-type, bounded execution, rejects extra client tenant/store/role fields, operator Access attestation port and sanitized rendering. **No listener.** |
| `qa/channel-v1851/protected-http-gateway.test.cjs` | Mocked Access and Stores A/B/Platform, test real signature *not* performed. Positive synthetic preview and negative CORS, replay, forged identity, expired/revoked install, wrong Store, timeout, quota, content-type, payload and no sensitive error. |
| `qa/channel-v1851/deny-only-worker.mjs` | Disabled Worker shell. `/session` and `/message` always HTTP 503; other routes 404; no CORS to allow visitors, no n8n or DB operation. This is not a hosted gateway. |
| `qa/channel-v1851/wrangler.example.toml` | **OFFLINE TEMPLATE ONLY; DO NOT DEPLOY AS A SECOND WORKER.** Shows expected non-public route and binding defaults; the actual locked V14.4 Worker remains the eventual target after separate approval. |
| `qa/channel-v1851/d1-private-schema-preview.sql` | Unapplied proposed installation/replay/quota schema using SQLite uniqueness and prepared-statement atomic patterns. **Not a database migration.** |
| `qa/channel-v1851/test_sqlite_schema.py` | Disposable local SQLite tests for same-tenant Store A/B scopes and atomic replay/quota. No Cloudflare D1. |
| `qa/channel-v1851/protected-staging-approval-packet.json` | Exact capabilities and all external permissions still FALSE. |
| `assets/widget-v185-client.js` | Updated staging client to permit `credentials: 'same-origin'` **only if** the reviewed Gateway URL equals the page origin; keeps `credentials: 'omit'` for cross-origin. Flag remains OFF. |

### Important limitations

- `MOCK_TRUSTED_CRYPTOGRAPHICALLY_VERIFIED_QA_ACCESS` is **a synthetic port return marker**, NOT a real Cloudflare Access JWT, production proof or credential. Before any hosted admission a separate implementation must validate Access JWT *signature + issuer + audience + expiry* against server-owned pinned JWKS, protect against direct origin bypass, deny Access Bypass rules and revalidate on each request.
- In browser Private QA behind Cloudflare Access, a **cross-origin** JSON POST may receive Access `403` on the preflight OPTIONS before the Worker sees the request; `credentials:'omit'` cannot supply the cookie. Prefer serving the QA frontend and API on the **same exact protected origin**, with `same-origin` credential mode and verified server-side Access JWT. Cloudflare officially documents the CORS/Access issue: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/cors/ . Do not install a broad Access Bypass for OPTIONS without independent security review.
- Public customer widget integration later differs from a private Access-protected operator QA portal. A future customer guest flow requires separate abuse, domain, subscription, tenant/Store and public-data authorization; Access operator login is never a customer's identity or Store grant.
- D1's atomic single-statement SQL patterns are proposed. SQL file and local SQLite tests are **NOT evidence** of an actual Cloudflare D1 instance, transaction/consistency test or hosted replay durability. See D1 prepared statements: https://developers.cloudflare.com/d1/worker-api/prepared-statements/ .
- `withDeadline` stops waiting, but does **not** cancel any pending remote operation; after an ambiguous timeout, a client must not automatically repeat a message. Existing V18.5 client preserves that behavior. Hosted quotas and replay must remain consistent across all Worker instances.

## 3. Security gates / order of staging changes

**S0 — completed offline:** independently audit PR #94, #97, #404, existing released core version; preserve current website and workflow; create code + synthetic security tests. No cost/deploy.

**S1 — requires explicit user approval:** choose exact **new private QA hostname** and Cloudflare account/zone; confirm supported plan pricing, quota, who is allowed into QA; snapshot current Access apps/policies and rollback plan. Do not reuse a live webhook or public Page.

**S2 — separately approved:** introduce Access app/policy allowing only named QA principals, direct-origin denied and no broad Bypass. Private Pages/staging client and Gateway must be same-origin or a separately proven secure CORS plan. Preserve the **existing `tien404-widget-gateway-v144-staging`** as LOCKED (423) and with `workers.dev`/preview disabled. **Do not deploy a second Worker.** A future reviewed code change and private QA route may be proposed only with explicit approval, backup of the current deployment/version and signed Access verification + direct-origin negative tests. A Worker with no public route is not reachable — intentionally.

**S3 — separately approved:** create **isolated** disposable D1 if and only if new cost is within approved budget and security review authorizes permissions/DDL. Apply reviewed schema only on the isolated QA database after backup/restore plan; test atomic duplicate claims and quota across two Worker isolates, revocation, TTL expiry, provider outages, 429, restart, cross-Store and invalid session. Never mix with Commerce Orders/Products or AI_SALES_DEMO tables.

**S4 — separately approved:** bind only public-only tool allowlist of exact PUBLISHED Commerce AI Core version `iyfGUiEsZlNTBWOR`; protect server-to-server caller, no uncontrolled n8n webhook and no write-capable tools, real customer PII or order management. Verify outbound no-send policy via trace. Keep Merchant Sandbox isolated and owner-authorized.

**S5 — QA before promotion:** test 320/360/390/430/768/1280 px, 100+ prompt and security cases, wrong-origin, unauthorized request, unknown widget, expired signed token, replay, quota, D1 outage, Access/WAF bypass, rate flood, provider error, old widget legacy regression. No real customer data.

**S6 — separate approval for launch:** merge/release only with exact commit, hosted evidence, cost cap, rollback test, canonical Store/RLS and owner consent. Messenger/Zalo/Commerce production remain unchanged until those gates pass.

## 4. Rollback and checkpoint

- Source-only rollback: revert V18.5.1 commits on Draft #404. Nothing deployed or modified so there is no Cloudflare, Render, n8n, Supabase, D1, data or website runtime rollback. Existing V14.4 Gateway remains LOCKED with its original deployment.
- Hosted rollback if authorized later: disable route/Worker, restore saved Access policy, revoke issued sessions, stop server caller, verify anonymous requests fail; reverse D1 usage only after preserving audit evidence. No destructive data cleanup without separate approval.
- QA after final HEAD must be verified in GitHub Actions, distinguishing synthetic 1) HTTP/Access mocking 2) disposable SQLite 3) V14.3/14.4/18.5 regressions 4) real hosted UAT (**NOT RUN**).

**Decision:** `V1851_SOURCE_CANDIDATE / FAIL_CLOSED_DRAFT / REAL_WORKER_NOT_DEPLOYED / REAL_ACCESS_VERIFIER_NOT_BUILT / REAL_D1_NOT_CREATED / REAL_WIDGET_TO_CORE_NOT_RUN / PRODUCTION_NO_GO`.
