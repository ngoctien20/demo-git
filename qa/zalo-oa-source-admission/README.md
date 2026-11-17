# TIEN404 V17.ZALO-SOURCE-01 — OA inbound admission (OFFLINE / NO SEND)

Status: **CANDIDATE SOURCE ONLY**. This directory is not connected to any hosted Worker, n8n workflow, database, Zalo webhook URL, or production service.

## Implemented scope

This is an additive, clean-room JavaScript prototype based on public OA webhook documentation and a security review of community n8n nodes. It implements:

- Preservation of exact request body bytes for OA MAC verification.
- One strict documented SHA256(appId + rawBody + timestamp + OA secret) MAC candidate, constant-time comparison, and fail-closed absence of signature; no HMAC fallback.
- Server-trusted installation resolution (App ID + recipient OA -> installation, Tenant, Store).
- Bounded raw body size, allowlisted inbound event types, and five-minute time window.
- Mandatory injected durable/atomic replay reservation contract. Local Set in tests is fixture-only; not production replay storage.
- Image/link are not fetched or forwarded. No uploaded media is executed or trusted.
- Normalized result always has noSend true and noOrderWrite true; customer identity and order authorization remain unverified.

Not implemented: OAuth, provider sending, ZBS, live media fetch, real SQL/RLS, live catalog read, cross-channel identity proof, or hosted ingress.

## Run tests

Node.js 20+: node --test qa/zalo-oa-source-admission/oa-admission.test.mjs

Tests are synthetic. Test-only secrets and OA IDs are fixture placeholders.

## Integration design (NOT CONNECTED)

1. Cloudflare protected staging gateway captures raw bytes and verifies against privately stored, server-issued OA installation binding.
2. Independently confirm the provider's real MAC/body/timestamp semantics before enabling real OA admission. No community HMAC fallback.
3. Atomic durable replay service reserves (installation, event type, provider message ID); no in-memory replay in production.
4. Internal authenticated canonical event can then feed the existing Zalo Private Customer Router staging, then Commerce read-only and Bot policy engine.
5. Store-level Auth/RLS and separately verified cross-channel identity are mandatory before order read/write.
6. Vision relies on merchant-authorized media intake; URL/redirect/IP/DNS/TLS/bytes/type safeguards in isolated media pipeline. AI proposes SKU; customer confirms before an order draft.

## Provenance and compatibility

- Official developer docs: https://developers.zalo.me/docs/
- Reviewed community references (do not install unreviewed packages in Cloud n8n):
  https://github.com/bautran1911/n8n-nodes-zalo-oa
  https://github.com/congdinh2008/n8n-nodes-mochi-zalo-oa
- Zalo Bot API in openclaw/openclaw/extensions/zalo is a distinct protocol; never conflate it with OA OpenAPI.
- This is a clean-room implementation: no upstream source files copied.
- Recheck actual OA provider requirements and licensing before deployment.

## Security admission and rollback

GO: isolated GitHub Draft PR and synthetic local tests.

NO-GO: app-secret onboarding, live OA webhook, public Worker, n8n sending, Commerce writes, Store-level RLS changes or production merge.

Hosted admission requires private independently authenticated owner/operator approval; dedicated QA OA; isolated inactive Worker; redacted real signed no-send event; durable replay; same-Tenant Store A/B RLS denial; cost bound; no-send/kill switch; provider ACK; exact commit/workflow versions; rollback proof.

Rollback is closing Draft PR and archiving/deleting the isolated branch after review. No secrets or real customer data should enter GitHub.
