# TIEN404 AI — V17.ZALO-SOURCE-03 Security Checkpoint
## Verified OA Authority × Managed Token Custody × Atomic Installation Registry × No-Send

Status: **IMPLEMENTED SOURCE-ONLY / OFFLINE FIXTURES**. Absolutely **NOT REAL PROVIDER VERIFIED**.

Parent: Draft PR #292, HEAD `f01f8982d91237955c672ceaede67fd041510de9`.
Inherits PR #291 (raw-byte OA webhook MAC candidate) and PR #292 (PKCE + Store Owner callback preflight); neither is merged.

### Existing systems protected
- n8n Zalo Bot Lab `yIJk8LvJoLF40Z62`, Private Router `sIPs6egzIwOY1GNv`, Messenger `Z7FdV7uDvApfbURQ`: read-only snapshots; no updates, executions or publishes.
- Commerce DEMO Google Sheets not linked to multi-tenant Commerce. No Supabase mutation.
- No external API/token exchange, Cloudflare deployment, model calls, Zalo sends, order creation, stock updates, customer data or production merges.

### Public docs verified
- Zalo OAuth v4 PKCE, 10-minute one-use auth code, 25-hour access token and 3-month single-use refresh token; refreshing invalidates the previous access token. Source: https://stc-developers.zdn.vn/docs/v2/official-account/bat-dau/xac-thuc-va-uy-quyen-cho-ung-dung-new
- Official POST https://oauth.zaloapp.com/v4/oa/access_token with `secret_key` header, authorization_code/code_verifier; retrieve OA identity through GET https://openapi.zalo.me/v2.0/oa/getoa with `access_token` header (NOT called): https://docs.zaloplatforms.com/docs/OA
- Zalo provider documentation says preserve PKCE association via state/custom redirect URI; example callback only shows code + oa_id. Real state echo MUST be proven before PR #292 callback code is used.
- Supabase RLS must be verified with real same-Tenant Store A/B owner sessions, not fake user metadata.
- Cloudflare Worker secrets must not be put in plaintext vars or public repositories.

### Implemented, clean room modules

`oa-grant-registry-offline.mjs`:
- ONLY accepts privately issued, one-use grant handle through injected private attestor.
- Requires immutable App/OA ID, verified profile readback, same authenticated Owner+Session, independent Store ownership and separate Operator proof for **NO-SEND**.
- Checks sealed token-vault receipt (metadata only). Never reads/returns provider access or refresh tokens.
- Uses injected `reserveGlobal` adapter, required atomic unique key (provider, verified OA ID) across tenants/stores/apps/disabled rows.
- Reserves ONLY `PENDING_REVIEW`, `sendEnabled=false`, `catalogReadEnabled=false`, `canReceiveRealTraffic=false`.
- `executionMode` MUST be `OFFLINE_FIXTURE_ONLY` and `liveEnabled=false`. CI never supplies hosted dependencies.

`oa-vault-offline.mjs`:
- Synthetic fixture token bundle encrypted with AES-256-GCM; fresh random 96-bit IV, authenticated associated data binds environment, app, OA, tenant, store, key version and token generation.
- Example key is generated/supplied only by isolated offline tests, NOT a real managed secret. Not a production Vault or KMS.
- `rotateSyntheticOaTokenReference` models atomic compare-and-swap *after* a token version is created; denies stale generation. It does NOT implement provider token refresh or acquire lease before one-use refresh. **A per-OA pre-refresh lock/lease, outage recovery and idempotent token custody are mandatory before hosted refresh.**

### Security negatives
Unauthorized Store claim, self-approved independent Operator, forged app/provider issuer, unverified OA profile, wrong claimed OA ID, same-Tenant Store A/B collision, different Tenant Store collision, revoked token, tampered vault binding, stale refresh version and concurrent global OA reservation are all tested with fixtures.
Fixture-created grant and approval records are NOT signatures issued by the provider. Positive QA means the gate accepts a synthetic verified-shaped record, not true Zalo authority.

### Non-applied atomic persistence design

Intended target: private, non-exposed PostgreSQL schema or a single strongly-consistent coordinator scoped by OA ID, using a unique index `UNIQUE(provider, oa_id)` **without tenantId** and without excluding revoked rows. The trusted backend must own reservation transactions; never implement find-then-insert in app code.

Proposed persistent fields: `installation_id`, `provider`, `oa_id`, `app_id`, `tenant_id`, `store_id`, `owner_id`, `status=PENDING_REVIEW`, `vault_ref`, `token_generation`, `grant_id`, `approved_by`, `created_at`, `send_enabled=false`.

No DDL, migration, RPC, RLS, grant or hosted storage has been deployed. An independent Store Ownership/RLS proposal (#290) remains the source of truth for DB tenancy; do not create a second authoritative Store model.

### Real Provider No-Send Acceptance — HARD NO-GO

**Required independently verified private evidence before any real OAuth, provider callback or token exchange:**

1. True Merchant OA Admin consent for exact OA, Zalo App, callback domain, requested scopes and intended Store; explicitly allow only QA no-send.
2. Independent approved operator and strict time/cost budget; private evidence package (not in GitHub or n8n pins).
3. Verified Supabase Auth owners from two Stores *within the same Tenant*, real JWT/RLS negative readback, canonical Store ownership and independent recovery plan.
4. Pinned Zalo callback/PKCE semantics with real provider signed or OAuth read-only QA evidence; exact OA ID from /getoa equals callback OA ID.
5. Managed secrets/token encryption with least-privilege vault actor, key versions, pre-refresh atomic lease and recovery after uncertain provider response.
6. Dedicated isolated access-protected inactive QA Worker; durable replay and throttling; kill-switch `SEND_ENABLED=false`, deny read/write Order/Stock.
7. Independent browser canary: successful authorized OA event and signed invalid/replay negatives, Shop A/B denial, provider ACK and redacted trace, with **zero customer sends**.

No 'real signed' OA ingress claim is made. Zalo Bot API ≠ Zalo OA OpenAPI ≠ Meta Messenger API. Runtime code uses Node crypto; compatibility with Cloudflare Workers must be proved separately (do not assume).

### Source QA and rollback
Run Node 20+:
`node --test qa/zalo-oa-source-admission/*.test.mjs`
CI on exact PR head must pass before marking TESTED.

Risk: P0 Store/Auth/RLS unverified; P1 provider OAuth state semantics, token-refresh lease/recovery, actual OA ownership and managed secrets absent.
Rollback: close the child Draft PR; no hosted resource or existing workflow to revert. Never silently merge or promote to live.
