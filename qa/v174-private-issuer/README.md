# TIEN404 AI V17.4 — Private Website Session Issuer × Installation Owner Evidence × No-Send Browser UAT

Checkpoint: 2026-11-17 JST. This directory contains a **private loopback-only QA issuer**, NOT a deployed merchant Website API.

## Source of authority
- Reuses V17.3 Website HMAC session and per-Store Bot runtime from ../v173-website-session/website-session-core.mjs.
- Reuses the SYNTHETIC V17.2 seven-row QA installation snapshot stored in ../v173-website-session/inactive-n8n-website-session-qa-snapshot.json. Exactly one Website installation: QA_WEB_WIDGET_A for QA_TENANT_1 / QA_STORE_A / QA_BOT_A. Store B is unbound to Website in the current registry.
- owner-proof-gate.mjs verifies operator-attestation integrity, revocation, binding scope and expiry. A valid signature alone is NOT proof of real Store/domain ownership. Even a valid synthetic operator attestation has allow_real_website_session=false.
- No real domain ownership, Store membership, Supabase JWT-RLS or customer identity is verified. Origin is not merchant identity and is spoofable outside browsers.

## Real private QA HTTPS transport
- local-https-issuer.mjs creates a real HTTPS server bound ONLY to 127.0.0.1 on a dynamic port; TLS key and cert are generated temporarily by CI, never printed or committed.
- HMAC key generated in-memory at startup; 300-second signed sessions with revalidated Store/Bot/Prompt/Knowledge/Policy version, read-only fake catalog.
- GET /qa serves an isolated mobile QA chat UI with separate CSS and JS, strict CSP and no cookies/localStorage. Existing public marketing chat is never modified or used as fallback.
- POST /v1/website/sessions requires same-origin, strict JSON and a synthetic approved Website installation; it issues QA_CATALOG_ONLY token with no customer identity.
- POST /v1/website/messages requires the signed bearer token and an exact read-only request schema. Tool allowlist is catalog_read. Fake Store A product price 159000 VND and stock 5; no model, external send or Commerce writes.
- In-memory duplicate prevention is ONLY suitable for single-process QA. A hosted service must implement durable concurrency-safe event claim, throttling and abuse controls.
- The private self-signed TLS cert is accepted in the isolated Chromium CI via ignoreHTTPSErrors for local testing. This is NOT trusted public TLS nor evidence that any hosted endpoint is deployed.

## Independent QA and browser UAT
GitHub Actions workflow: .github/workflows/v174-private-website-issuer-browser-uat.yml.
1. Private owner / API job: 18 owner-attestation tests and 36 actual loopback TLS API tests, plus static no-network/public-host guard.
2. Browser UAT job: pinned Playwright Chromium on a 390x844 mobile viewport, 23 actual UI/network cases: HTTPS session, multi-turn signed QA chat, Store B rejection, client spoof, replay, write-tool refusal, XSS-resistant text rendering, private token handling and installation revocation. Screenshot artifact contains fake data only and is retained for seven days.
3. Hosted deployment release job is intentionally SKIPPED.

## Gates before any hosted/public service
- Independent Store Owner and Domain ownership proof (DNS or HTTPS challenge tied to control plane) and exact owner-approved Website Installation.
- Dedicated private HTTPS issuer host with approved domain, trusted TLS, secret manager/rotation, private UAT admission, rate limits, audit redaction, distributed atomic replay guard and tested rollback.
- Independently accepted hosted Store/JWT-RLS for real Commerce catalog. No customer Orders, cross-channel lookup, model tools, provider sending or Commerce writes.
- Separate bounded owner approval for exposing host or changing real published apps/workflows.

## Rollback
Close Draft PR #243; CI loopback host disappears automatically after its job. No Cloudflare Worker, Render service, public Website, Messenger/Zalo production webhook, n8n Published workflow, credential, Commerce database or subscription was modified.
