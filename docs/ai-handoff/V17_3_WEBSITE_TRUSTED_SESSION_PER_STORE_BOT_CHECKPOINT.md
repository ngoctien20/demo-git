# TIEN404 AI V17.3 — Trusted Website Session × Per-Store Bot Runtime

Checkpoint: 2026-11-17 JST. SOURCE-ONLY CONTRACT + REAL n8n MANUAL SYNTHETIC QA TESTED; no public Website deployment and no real hosted Store/RLS.

## VERIFIED platform baseline (READ ONLY)
- Public Website marketing bot is already ACTIVE in n8n workflow wgkkmT7q4lm4HyuA, using an unauthenticated public Chat Trigger and gpt-5-mini, loaded by assets/ai-consultant.js. It is an AI marketing adviser, NOT a verified Store-commerce customer bot and has no trusted Store/Order permission. It is left entirely unchanged.
- The public assets/site-config.js still has apiBase empty. No actual Website Commerce issuer service exists in this tracked branch or was deployed during this work.
- V17.2 persisted QA-only Data Table AAlsUnaAxbp0BscT has seven channel/Store/Bot rows and ONE Website installation: QA_WEB_WIDGET_A → QA_TENANT_1 → QA_STORE_A → QA_BOT_A. It has NO Website Store B row; attempts to assume one must be denied.
- Supabase hosted staging ifxlvrhyjhbzbrkdsida: public.stores and public.store_memberships absent; no store_id columns in primary Commerce products/orders/customers. No permission to expose live Catalog/Orders until independent Store ownership JWT-RLS is accepted.
- Messenger Published, Zalo active staging, n8n V17.1 shadow workflows and source PR #243 remain unchanged.

## IMPLEMENTED in GitHub Draft PR #243
Server-side contract: qa/v173-website-session/website-session-core.mjs.
- issueWebsiteSession requires an independent SERVER-side installation registry resolver and separate HMAC signing keyring (never client config), exact HTTPS allowed origin, active subscription, shop not paused, approved read-only Bot version, and 32+ byte key. Creates a 300-second v1 signed token with a random SID. The token has no name, phone or real customer claim.
- verifyWebsiteSession performs constant-time HMAC comparison, issuer/audience/nbf/expiry, exact origin/installation binding, and re-reads server binding for revoked installation, paused subscription or changed Store/Bot/Prompt/Knowledge/Policy versions. Client-provided Store/Bot flags cannot grant authority.
- processWebsiteMessage permits catalog_read ONLY, bounded text, server-issued session and injected atomic claimMessage plus scoped QA catalog reader; rejects untrusted Store/Bot/Tenant fields and verifies returned catalog Store/Tenant. No real model or Commerce writer.
- qaMode=true requires synthetic-only owner_authority_verified=false + QA_APPROVED + read_only=true. qaMode=false requires explicit owner-approved binding, but processWebsiteMessage remains denied until hosted Store and durable claim acceptance. No production secret or session issuer has been deployed.

Browser QA adapter: qa/v173-website-session/website-client-qa-adapter.mjs.
- POST /v1/website/sessions and /v1/website/messages with HTTPS-only explicit API base, QA installation ref, session bearer token only in memory, cookies/localStorage omitted, no Store/Bot assertions, only catalog_read. Requires QA-only MOCK_ONLY_NOT_SENT responses. Does not auto-use existing public marketing chatbot when backend unavailable.
- This is test source, not injected into existing public Website. Origin/CORS does not independently authenticate merchant/customer.

## ACTUAL n8n execution
New workflow: TIEN404_V173_WEBSITE_SIGNED_SESSION_STORE_BOT_QA_NO_SEND, ID lN6rKmmu11oIDVFO, version 7e6c988f-8b22-4d5d-85ab-4c9a39d6a425.
Project Personal, folder 90_QA - DIAGNOSTICS. Five nodes, INACTIVE, NO active version, no webhooks, credentials, HTTP requests, LLM or Commerce tools.
Pipeline: Manual Trigger → read existing central V17.2 Data Table (7 QA rows) → mint fake server-shaped QA HMAC session (300 seconds) from unique Website installation → verify signature, scope, origin, replay and Store/Bot config for 38 synthetic messages → fail-closed no-send acceptance.
Actual manual execution #4363 SUCCESS: 38/38 expected; 3 ALLOW (three distinct text turns in SAME QA session), 34 DENY, 1 DUPLICATE. Denials include wrong HMAC, expiry, future nbf, wrong origin/installation, Website B unbound, cross-Store/Bot/prompt/knowledge, order read/write tools, client authority spoof, empty ID/text, overlong text and replay conflict. All outputs provider_sends=0, model_calls=0, commerce_writes=0; NO real website session, no real customer profile or live model response. Anti-replay in this manual workflow is local in-memory only.

## CI/test evidence
- 75 server HMAC session and Store Bot runtime Node cases, 36 browser QA adapter Node cases.
- 48 independent Python tests against actual n8n snapshot data, version and execution result.
- Source snapshot at qa/v173-website-session/inactive-n8n-website-session-qa-snapshot.json contains only fake QA data and code, metadata-only 38-case outcomes, no real bearer tokens.
- Workflow .github/workflows/v173-website-session-store-bot-no-send.yml runs the test suites and no-network/no-secret guard with live release job intentionally SKIPPED.
- At PR finalization confirm exact HEAD and CI SUCCESS; do not cite an older HEAD.

## Real deployment gates (NO GO)
1. Independently approved staging Website Shop domain and issuer host, without modifying marketing widget.
2. Private signer keyring and rotation in secret manager; real server-side Origin/Host validation, anti-CSRF, abuse controls and rate limits. Public widget ID and Origin alone are not authority.
3. Merchant owner-verified Website installation bound to exactly one Tenant/Store/Bot with revoke control; no real customer identity inference from anonymous session.
4. Durable atomic per-session message replay claim across workers and privacy-safe audit; no in-memory-only proof.
5. Hosted same-Tenant Store A/B RLS verified through independent Store/RPC security PR #237 before any real catalog/order access; Customer challenge for cross-channel order lookup.
6. Actual browser HTTPS → server issuer → scoped Bot runtime → no-send execution IDs, negative tests, rollback. No actual model API, provider send or Commerce writes until separately approved.

Rollback: Close OPEN DRAFT PR #243; leave V17.3 QA workflow inactive and existing V17.2 Data Table unchanged. Do not archive/delete resources without explicit approval. Existing public website, live Messenger, Zalo, credentials, customer Orders and subscription billing untouched.

VERIFIED: existing public marketing widget and Store authority blockers.
IMPLEMENTED/TESTED: independent source QA and manual n8n QA session processing #4363.
NOT VERIFIED/BLOCKED: real hosted Website session issuance, actual customer authentication, Store RLS, live bot/model/channel replies.
