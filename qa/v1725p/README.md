# TIEN404 V17.25P — Exact Deployed Source Replay × Trusted Provider Port Admission × M0

**Classification:** SOURCE-ONLY / BYTE-EXACT FIXTURE / SYNTHETIC HTTPX TRANSPORT / NO HOSTED UAT / M0 NO-GO.

## 1. Exact source provenance

The fixture copies the exact files from Render deployment:

- Service: `tien404-data-staging`
- Deployment: `dep-dbqj9plg1s2s73egr30g` (LIVE at audit)
- Commit: `ab940a95dae8afdff426bc6ac71693833d5348ce`
- `ops/data-platform/app/main.py` blob: `a7a11abeffb378b3f9952005ffdd489c54df1c13`
- `ops/data-platform/app/signed_n8n.py` blob: `9f74b6b3e617acd20aa1bfd8fd50b4b12938907e`
- Render build command installs `ops/data-platform/requirements-test.txt`; CI pins the same FastAPI/httpx/pytest versions from that file.
- Render start command is `cd ops/data-platform && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}`. No source code or runtime setting was changed.

CI verifies Git blob SHA-1 with `git hash-object` before importing the fixtures. The exact deployed `main.py` and `signed_n8n.py` are replayed with an `httpx.MockTransport`; every outbound Supabase request is intercepted locally. No live Supabase host is contacted and no real bearer token is used.

## 2. VERIFIED legacy Orders behavior — compatibility finding, not breach evidence

The deployed `GET /api/v1/tenants/{tenant_id}/orders`:

1. Calls `/auth/v1/user` using the presented user bearer token.
2. Looks up active `tenant_memberships` for actor + tenant.
3. Allows `owner` or `manager`.
4. Queries `/rest/v1/orders` with `tenant_id=eq.<tenant>`, order and limit only.
5. Does **not** accept or apply a `store_id` filter. Unknown `?store_id=` is ignored.
6. Does not return the `store_id` field in the response.

A synthetic tenant with one fake order for Store A and one for Store B therefore returns both records to either synthetic Owner A or Owner B if both are tenant owners. This proves the deployed route contract is **tenant-scoped, not Store-scoped**. It is not evidence of an exploited access path: the real schema currently has no canonical Store membership or Store columns.

The replay also protects existing contracts: auth missing/invalid, no membership, staff role, malformed/cross-tenant provider responses, provider 401/429/5xx, query bounds, output sanitization, security headers, health semantics and no write method.

## 3. Trusted real-provider port admission — DESIGN ONLY

### Separate proof domains

A valid provider webhook signature proves the event came through the provider's signing mechanism; it does **not** prove the sender is a merchant Owner, does not authenticate a website dashboard user, and does not authorize access to Orders.

- **Merchant dashboard actor:** independently verified Supabase Auth session/JWT, followed by exact active `tenant × store × user` membership on the server and matching Store-scoped RLS.
- **Inbound channel installation:** provider signature/session → provider-specific installation ID → server-owned active installation registry → canonical `tenant_id + store_id`. Never derive a Store from message text, customer sender ID, phone/email guesses, URL query or caller-controlled headers.
- **Customer identity:** remains channel-specific unless an explicit, consented and separately verified account-linking process is approved. A Messenger sender ID must not silently become a Zalo or Website customer identity.

### Provider adapters (no verifier implemented or enabled here)

| Channel | Officially documented signal | Required isolated verifier design |
|---|---|---|
| Meta Messenger / Page | Meta Webhooks documents `X-Hub-Signature-256: sha256=...`, SHA-256 HMAC over the raw notification payload using the Meta App Secret. | Verify exact raw bytes before JSON parsing, constant-time compare, separate GET challenge verification, map the verified Page ID to one active Page installation, record provider event/message idempotency. Never log the App Secret or raw token. |
| Zalo Official Account | Zalo OA event documentation describes `X-ZEvent-Signature` as `mac=sha256(appId + data + timeStamp + OAsecretKey)` for the documented event family. | Preserve the exact documented input representation; verify event-family-specific contract, app_id and oa_id, timestamp/replay and installation binding. Do not assume one formula covers every OA event, ZNS/ZBS product or Zalo Bot. |
| Zalo Bot | Official Zalo Platform docs confirm Bot Token, `getUpdates` long polling and `setWebhook` webhook mode. The official pages inspected here do not establish the same OA `X-ZEvent-Signature` formula for Bot. | **BLOCKED** until the Bot-specific webhook authentication contract is confirmed from the exact official Bot API reference / live registration contract. Do not assume OA HMAC applies; do not rely on third-party `X-Bot-Api-Secret-Token` claims as official proof. Keep Bot Token separate from any webhook secret and never log either. |
| Website widget | No third-party webhook signature. | Server-verified user/session or scoped widget session, exact Origin/Host and CSRF controls, expiry/replay, rate limit, and server-side widget-installation → Store registry. A browser-supplied Store ID is only a selection hint. |

Official references:
- Meta Webhooks: https://developers.facebook.com/docs/graph-api/webhooks/getting-started/
- Zalo OA user-message event: https://stc-developers.zdn.vn/docs/v2/official-account/webhook/tin-nhan/su-kien-nguoi-dung-gui-tin-nhan?lang=vi
- Zalo Bot create/setup and Bot Token + polling/webhook overview: https://docs.zaloplatforms.com/docs/BOT/create_bot
- Zalo Bot overview: https://docs.zaloplatforms.com/zalo-bot

### Minimum real-port admission evidence (future, separately approved)

1. Pin the official provider product, event type, docs/version, exact signature canonicalization and current credentials owner.
2. Positive signature test on provider-issued synthetic fixture; negative wrong secret, modified byte, malformed header and unsupported event tests.
3. Replay/duplicate event test backed by an atomic durable idempotency key, not a process-local cache.
4. Verify Page/OA/widget installation id maps to exactly one active canonical Store; revoked, paused, unknown, cross-tenant and ambiguous mappings fail closed.
5. Prove signature validation occurs on raw body before parsing; no provider secret, bearer token, cookie or personal data in logs.
6. Independent reviewer verifies installation owner provenance and a private redacted receipt. Provider signature is not Store ownership proof.
7. No customer identity merge, order read/write, or send permission is implied by successful ingress verification.

## 4. M0 evidence ownership — reuse the existing private process

Reuse the existing private RPC12 evidence intake and V18.0-P0D source-only reviewer in [Draft PR #398](https://github.com/ngoctien20/demo-git/pull/398). Do not create a competing registry or export private source rows to GitHub.

The owner deferred the real local backup on 17 Nov 2026. Historical H11R application-only archive was accepted with limitations (5/5 application table data; 0/3 Auth and 0/2 Storage) and must not be represented as a current independent restore. Current M0 scope is undecided and independent current restore/readback is not verified. The connected Supabase organization is Free; do not assume paid-tier managed daily backups or create a billable branch.

**V17.25P performs no backup, export, restore, local Docker operation, Supabase branch creation or paid-resource action.** A future M0 step requires the owner to re-open the scope and separately approve the exact target, data coverage, cost cap, expiry, operator and restore reviewer. Independent reviewer must verify checksums and actual restored readback, including the chosen Auth/Storage scope, in an isolated target.

## 5. Release / rollback gates

- `EXACT_DEPLOYED_SOURCE_REPLAY`: CI hash must match both deployed blobs.
- `LEGACY_TENANT_ONLY_ROUTE`: VERIFIED source behavior; do not expose in multi-Store production.
- `REAL_PROVIDER_PORTS`: DESIGN ONLY / all disabled.
- `M0`: NO-GO / owner-deferred / no current restore receipt.
- `REAL_OWNER_JWT_A_B`: 0/31 NOT RUN.
- `HOSTED_STORE_READ_WRITE`: NO-GO.
- `PRODUCTION`: NO-GO.

Rollback is closing/reverting this source-only Draft PR. No runtime rollback is needed because Render, Cloudflare, Supabase, n8n, credentials, customers, orders and providers are not changed.
