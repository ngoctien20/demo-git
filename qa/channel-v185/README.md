# TIEN404 AI — V18.5 Website Widget × Shared Commerce AI Core

**Status: CANDIDATE — OFFLINE SOURCE QA / NOT CONNECTED TO HOSTED GATEWAY / NO PRODUCTION.**
Date: 2026-11-18 JST. Stacked on PR #97 (which is stacked on PR #94).

## 1. Audit evidence

- Current `gh-pages` website `assets/ai-consultant.js` uses `@n8n/chat` via jsDelivr and **embeds a browser-visible n8n chat webhook URL**. It is a public Platform Consultant, **not** a verified Store conversation. The existing external composer has an Android contrast workaround and relies on simulated native input + button click. Session and chat history are managed by `@n8n/chat` internal logic; no trusted visitor or tenant authority can be inferred from it.
- The floating launcher and chat panel exist in `index.html` and `demo.html`; other examined pages including `pricing.html`, `solutions.html`, `contact.html`, `dashboard.html` do not load it. Other pages must be audited before claiming full-site coverage.
- `assets/app.js` has a **separate local-only simulator** for demo scenarios; never confuse it with Commerce AI live.
- n8n Commerce Core ID `iyfGUiEsZlNTBWOR` is ACTIVE, **DRAFT version `c96422e0-170b-46a3-8d75-3a2695e645e7` differs from PUBLISHED `456862c9-e5ee-4bfa-9931-47dbc39ab73d`**. Commerce tenant/catalog/cart/rules workflows `5Eeh8hbpsoNhuiVo`, `oOOXicKXGkBskKqh`, `igPOsSbEgd4NgtRA`, `Y0WLykMtNAldbgL0` are ACTIVE. Website Marketing AI `wgkkmT7q4lm4HyuA` ACTIVE; Zalo/Website Shared Core Shadow `4ycmVzaNzVRulBjQ` ACTIVE but explicitly **NO SEND**. Active != live Shop customer authorization.
- PR #94 V14.3 already implements `qa/channel-v143/widget-gateway.cjs` + `channel-core.cjs` + `renderers.cjs` (NO SEND source only), and QA embeddable iframe. PR #97 V14.4 already implements `qa/channel-v144/secure-widget-preview.cjs` with server-install registry/domain proof, session, quota, durable ledger port, public catalog and reviewed theme contracts. Those are **mocked ports in source tests, NOT hosted security controls**.

## 2. V18.5 changes, preserving everything already operating

- **Do not build another AI Agent.** `qa/channel-v185/shared-core-bridge.cjs` wraps and REUSES V14.4 gateway, V14.3 Widget Renderer and an injected server-only `invokeExistingCommerceCore` port **hard bound to existing workflow `iyfGUiEsZlNTBWOR`**. The port is MOCKED for synthetic CI: no actual n8n execution or model cost. No request body from a browser may set tenantId/storeId; mode is separately server-configured.
- Backward-compatible extension to V14.4 `preview({...,message})`: optional bounded message forwarded to the existing readSalesIntent port **only after** private registry/domain/session/quota/replay gates. Existing V14.4 previews without message remain valid.
- `assets/widget-v185-client.js` is a **dormant staged transport** which POSTs only to a configured verified HTTPS Gateway `/widget/v18.5/session` and `/widget/v18.5/message` (API contract proposed, NOT hosted). No direct browser->n8n, direct Store/Orders API, stored API keys or localStorage/sessionStorage state. Current session is memory-only; network errors do not auto retry ambiguous sends. Renderer uses DOM `textContent`, bounded image https allowlist, limited product cards and action labels that only prefill the composer.
- `assets/widget-v185.css` adds mobile/accessible isolated style and persistent **STAGING / NO ORDER** notice.
- `assets/ai-consultant.js` keeps **legacy behavior as the DEFAULT**. Only `window.TIEN404_CONFIG.widgetV185.enabled===true` AND `staging===true` imports V18.5 module. No published site configuration enables this flag. A failing V18.5 does NOT fallback to the old public webhook.
- `qa/channel-v185/host.html` is a no-network synthetic UI fixture that intercepts `fetch` to serve clearly labeled examples, not real Commerce Core results.
- `qa/channel-v185/shared-core-bridge.test.cjs` tests cross-Store A/B, mode policy, replay, malicious or invalid message, wrong Core ID, order/write/send denial, revoked installation and no PII from output.

## 3. Architecture and trace

```
Website (legacy @n8n/chat retained by default)
  └─ Opt-in V18.5 staging UI [NO PRIVATE AUTHORITY]
      └─ Future HTTPS Widget Gateway [NOT HOSTED]
          ├─ Trusted registry + domain ownership [MOCKED in source QA]
          ├─ Signed short-lived anonymous session [SOURCE ONLY]
          ├─ Durable atomic replay + quota [MOCKED in source QA]
          ├─ Server-selected PLATFORM_CONSULTANT / MERCHANT_SANDBOX
          └─ Existing Commerce AI Core iyfGUiEsZlNTBWOR
             ├─ Tenant Resolver 5Eeh8hbpsoNhuiVo
             ├─ Catalog oOOXicKXGkBskKqh
             ├─ Cart Preview igPOsSbEgd4NgtRA
             └─ Business Rules Y0WLykMtNAldbgL0
                └─ V14.3 Website Renderer [NO SEND / NO WRITE]
```

### Suggested frontend read-only contract — NOT YET DEPLOYED

`POST /widget/v18.5/session`: `{widgetId,origin}`; Gateway independently resolves registered installation, verifies approved origin/domain proof, enforces quota and issues an anonymous session. Success: `{session,anonymous:true,previewOnly:true,privateOrderAccess:false,providerSends:0,orderWrites:0,mode:'PLATFORM_CONSULTANT'|'MERCHANT_SANDBOX'}`. Browser `origin` is NOT trusted as authentication or domain ownership proof.

`POST /widget/v18.5/message`: `{widgetId,origin,session,eventId,message}` (<=800 chars) and a separate server-held installation + replay proof. Success: `{status:'PREVIEW_ONLY',mode,publicPreview:{type,text,products,actions},providerSends:0,orderWrites:0,privateOrderAccess:false,canRelease:false}`. The Browser does not receive internal tenant/store auth, JWT signing credentials or raw model outputs.

CORS and Origin are **defense in depth only**, not identity. The approved future hosted Gateway must implement server configuration with fixed allowed issuer/domain, HTTPS TLS, strict content types, body size, expiration, durable rate limits/replay, canonical Store owner authority, paid entitlement and signed owner controls. Only the server may decide tenant/store/mode or grant any privileges.

## 4. Hard gates before real website-to-n8n UAT

1. **Do not reconfigure/publish** currently active website, Messenger or Commerce workflows merely to run this test. Review and freeze the exact Published Core version. No V18.5 can silently consume a newer Draft.
2. Independently approved hosted Gateway service for **exact staging endpoint**, deny by default; verify Origin/installation against private registry, anti-SSRF, CSP, abuse, CORS, exact path/host and direct-origin negative tests.
3. Approved server-side signed session implementation, encrypted/limited session transport, persistent replay/quota with atomic acceptance across workers, independent domain ownership validation/revocation. All MOCKED now.
4. Whitelist exact provider-safe read-only Core invocation, disable write-capable tools at the execution boundary (not just prompt), no real customers, mock or authorized public Sandbox catalog, enforce server-side readback/mode policy, no data shared with AI_SALES_DEMO Orders/Products.
5. Restore drill and canonical Store/RLS same-tenant negative QA before any Merchant data connection; independently approved owner consent and private order authorization for private lookups.
6. Browser end-to-end **hosted** UAT on desktop/mobile, accessibility, long message, 429/timeout/replay, safe image domain, invalid signature/origin, anonymous Store A/B isolation. Recorded evidence without JWT, PII, token or secret.
7. No purchase, order write, notification, provider send, production website change, PR merge or extra hosting cost without separate approval.

## 5. QA, checkpoint, rollback

`node --test qa/channel-v143/channel-core.test.cjs qa/channel-v144/secure-widget-preview.test.cjs qa/channel-v185/shared-core-bridge.test.cjs`

`node --check assets/widget-v185-client.js`

`qa/channel-v185/host.html` can be served by a local static HTTP server. It intercepts calls and **does not call the real AI Core**.

- **VERIFIED** prior state: website legacy direct n8n endpoint; active n8n workflows; Draft vs Published Core difference; PR #94/#97 source-only inheritance.
- **IMPLEMENTED** source-only staged integration adapter and responsive UI client, backward-compatible messaging support, isolated QA host and regression tests.
- **TESTED**: GitHub CI outcome must be reviewed at the exact final SHA.
- **PROPOSED**: real hosted Gateway and authenticated sandbox no-send UAT; not implemented.
- **BLOCKED**: real website->shared n8n Core conversation, Store RLS, owner consent, Gateway hosting security, private Orders.
- **Changed hosted**: NOTHING (no website Pages deployment, n8n publish, Cloudflare/Render/Supabase policy, JWT, customer data or message send).
- **Rollback**: close/revert Draft V18.5 PR; existing `gh-pages` widget unchanged.

**Status decision:** `V18_5_SOURCE_CANDIDATE / SHARED_CORE_PORT_MOCKED / WEBSITE_LEGACY_UNTOUCHED / REAL_CHAT_UAT_NOT_RUN / NO_PRODUCTION`.
