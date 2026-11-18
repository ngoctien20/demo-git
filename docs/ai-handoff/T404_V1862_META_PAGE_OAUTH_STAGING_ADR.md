# TIEN404 V18.6.2 — Meta Page OAuth onboarding (ADR / STAGING CANDIDATE)
Date: 2026-11-18 JST · Owner approval: NOT GRANTED for real Meta · Status: CANDIDATE

## Decision and verified baseline
Decision: extend Channel Integration Center with one common `ChannelConnection` lifecycle, provider adapters and a provider-specific verified webhook gateway. DO NOT clone Store/Auth/Commerce Core per channel. Begin with offline mock only; no Cloudflare deployment, n8n workflow change, Supabase DDL, customer data, or Meta API call.
GitHub reference HEAD: `work/v1855-protected-readonly-commerce-adapter-20261118` at `32b7bc6fecb0600f6ba2a490339b105754131ea1` (PR #415; draft). Production gh-pages `ff2daf970e8209399a28b2d0cade8a33b9fa71c6` (do not change).
n8n Messenger Published `Z7FdV7uDvApfbURQ`, active, still uses AI_SALES_DEMO order tools; shared sandbox Core `iyfGUiEsZlNTBWOR`, active, draft and published versions differ. Never cut over in place.
Supabase staging `ifxlvrhyjhbzbrkdsida` public Orders/Products/Conversations scoped by `tenant_id`, not `store_id`; existing RLS therefore **does NOT prove same-tenant Store A/B isolation**. Do not run proposed migration until trusted Store Authority exists.
V18.5.5 internal adapter/QA: PR description initial status may be stale; latest handoff reports dedicated Header Auth credential `TIEN404_V1855_READONLY_ADAPTER_AUTH_STAGING` and inactive ingress implemented, but real HTTP/hosted not verified. Keep separated.
Cloudflare Pages project `tien404-ai-git-staging` production branch `gh-pages`. Do not push to it.

## External research boundaries
Haravan Help describes Facebook login, selecting Pages, checking assigned Page permissions and managing connected channels. This is product-flow precedent, NOT source code or permission approval for TIEN404.
Meta official references: Tech Provider verification and Advanced Access/App Review are separate gates; Facebook Page messaging uses `pages_messaging`, `pages_manage_metadata`, often `pages_read_engagement` by feature, and `pages_show_list` for Page discovery. Exact scopes/tasks must be rechecked against app type/use case and latest Graph API before requesting permissions. Do not request every possible scope by default.
Source links:
- https://help.haravan.com/docs/social/integration/huong-dan-ket-noi-fanpage-facebook-vao-harasocial/
- https://help.haravan.com/docs/social/integration/quan-ly-kenh-ket-noi-tren-haravan-social/
- https://developers.facebook.com/docs/development/release/tech-providers/
- https://developers.facebook.com/docs/graph-api/reference/user/accounts/
- https://developers.facebook.com/docs/graph-api/reference/page/conversations/
- https://developers.facebook.com/docs/graph-api/webhooks/getting-started/

## Architecture
Browser (existing Supabase session) -> Customer Dashboard / Channel Integration Center -> authenticated OAuth BFF in Cloudflare Worker -> Meta OAuth adapter -> server-side Page permission check -> private channel connection registry -> trusted canonical tenant/store authority -> separate Meta webhook gateway -> verified no-send shadow adapter -> Shared Commerce AI Core after signed release gate.

**Authorization**: never trust tenant/store IDs, Page ownership, permissions, roles, external Page IDs, billing or AI configuration from browser. Resolve session server-side; require store owner/manager rights from canonical memberships + verified Store Authority. Before exposing real OAuth, resolve a real same-tenant Store A/B test and strict role authorization, as current DB lacks store-scoped columns.

**OAuth lifecycle**: create server-side CSPRNG state with 5-minute TTL, store only its hash, bind to authenticated session ID, actor, store, strict callback URI, one-time use; verify callback, expected issuer/response, code exchange server side, permission/granular Page task checks, consent scope, Page ownership, unique live Page mapping, then commit a connection in transaction. PKCE where supported by the Meta flow; verify current Meta product setup. Never put Page token in URL, logs, browser, GitHub, Google Sheets, prompt or n8n executions. Backend-only encrypted reference. One Page cannot be connected to competing stores simultaneously absent separately approved sharing model.

**Connection health**: `pending` -> `connected` -> `reauthorization_required` / `paused` / `disconnected` / `error`; expiry/revocation health check through explicit provider adapter. Persistent event audit; updates idempotent and append-only. Customer UI offers reconnect, short actionable errors, status, AI pause, human handoff.

**Webhook**: distinct gateway, GET challenge with server-side verify token, POST raw bytes HMAC SHA-256 `X-Hub-Signature-256`, constant-time compare, strict body limits, verified Page ID, canonical store mapping, quota and durable dedup transaction before queue. Do not claim a timestamp alone solves replay for Meta's event format; dedup by provider event key where available, or safe content-derived key bound to Page and event fields, plus persistence and expiry. Ignore browser tenant/store input. Never respond to or forward unsigned payloads. Respect messaging windows/policies; no automatic send in this candidate.

**Token security**: evaluate private Supabase Vault vs existing Cloudflare secrets infrastructure (per-connection rotation, grant minimization, separation of metadata vs secret material, audit, protected read path). Avoid putting dynamic merchant tokens into deploy-time environment bindings at scale; pick a backend-only encrypted store with key rotation and access controls.

## API contract preview (no implementation)
- `POST /v1/channel-connections/meta/oauth/start` — authenticated session, server-derived store selection, returns browser authorization URL or mock state in offline tests; anti-CSRF and rate limits.
- `GET /v1/channel-connections/meta/oauth/callback` — server-side state/session verification, code exchange, one-time transaction; redirect to safe first-party route only.
- `GET /v1/channel-connections/meta/pages` — server-verified Page listing, no raw token or cross-store metadata.
- `POST /v1/channel-connections/meta/commit` — selected Page identifier checked against server-side grant; idempotency, store uniqueness, subscription slots and reauthorization.
- `GET /v1/channel-connections` — returns connected channels for resolved selected store only.
- `POST /v1/channel-connections/{connectionId}/reauthorize` and `/disconnect` — owner/manager authorization; clear status and token mapping.
- `GET|POST /v1/providers/meta/webhook` — dedicated Meta signature verification, never open to Commerce before verification.
All errors are `{code, message_vi, request_id}` with fixed error codes; no secrets. Mutating API endpoints have CSRF protection and audit. Real routes MUST NOT be enabled by mock QA source.

## Permission matrix (plan; verify in Meta App dashboard before live)
| Function | Candidate permission | Actual gate |
|---|---|---|
| List Pages | `pages_show_list` | User task/assigned Page access; official Meta review |
| Subscribe/unsubscribe Page webhooks | `pages_manage_metadata` | Page task and app subscription eligibility |
| Read Page conversation | `pages_read_engagement`, `pages_messaging`, `pages_manage_metadata` as required by endpoint | App Review, Advanced Access, specific Page tasks |
| Send Page Messenger messages | `pages_messaging` | Messaging tasks, approved access, 24h policy and exceptions |
| Business app across customer assets | Tech Provider/Business verification when applicable | Separate review before non-role customer onboarding |
Do NOT request `business_management` or `pages_manage_posts` by default without specific approved feature justification.

## Legacy decision matrix
| Item | Decision | Reason / gate |
|---|---|---|
| Published Messenger workflow | KEEP | Production-linked, no live cutover |
| Messenger DEMO order tools | DEPRECATE later | only after shadow parity and Store RLS |
| Shared Commerce Core | KEEP | reuse verified read-only children; full tool graph has writer |
| Manual Page token form | REFACTOR | replaced by OAuth after real approval; existing usage must be audited |
| Hard-coded Page IDs | REFACTOR | replace with private registry; preserve old routing until cutover |
| Shared Meta credentials | BLOCKED | first audit references, secret rotation requires approval |
| Duplicate chatbot setup | PROPOSED consolidation | basic/advanced mode with one bot config per store |
| Old login/session logic | BLOCKED | do not bypass current real Supabase Auth |
| Channel-specific gateways | KEEP | provider signature and message policies are distinct |
| Existing Demo tables, QA artifacts, released workflows | KEEP | do not delete or share with Commerce |

## Rollback & release gates
Rollback: close branch/PR, delete isolated preview files only after review; no deployed resources, credential, DB schema or workflow changes to undo. No real Facebook connection, Meta Graph calls, order writes, AI inference, notification sends, merges or production deploys.
CANDIDATE QA is **offline synthetic logic only**. Real integration requires canonical Store A/B RLS, owner-verified auth, app-mode/review checks, HTTPS cookie session tests, token storage design approval, durable replay + quota, security review, real negative provider tests, and owner approval.

## Checkpoint
`V18.6.2 | MOCK_SOURCE_ONLY | SYNTHETIC_QA | NO_META | NO_SEND | NO_ORDER_WRITE | NO_STORE_RLS_PROOF | PRODUCTION_NO_GO`.
