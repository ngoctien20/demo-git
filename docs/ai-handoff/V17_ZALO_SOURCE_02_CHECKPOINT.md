# TIEN404 AI — V17.ZALO-SOURCE-02 PKCE × Store-Bound OA OAuth PRE-FLIGHT

Status: SOURCE-ONLY CANDIDATE. **NO ACTUAL OAUTH**, no endpoint network request, no token exchange, no OA data access, no provider webhook admission, no n8n/DB modification, no Send/Order/Stock changes.

Parent: PR #291, commit `9c1e30805ad7dc7bee22e8d5efc669b3694a5380`.
Related but not duplicated: G0.5 PR #258 QA registry, G0.6 #260 signed QA, G0.7 #263 private authority, PR #290 real Store/RLS authority, PR #248 image/context.

## Deliverable

New `qa/zalo-oa-source-admission/oa-oauth-offline.mjs` (standalone Node offline, no copied code) implements two **preflight** pure workflows:

1. `beginOaConnect()`: require authenticated unrevoked Supabase-style server actor (injected; no real Supabase calls); independently authorize Store Owner for Tenant+Store; fetch server-pinned staging Zalo OA app; generate random 32-byte opaque state and PKCE verifier/challenge S256; store state digest+encrypted-verifier contract in trusted atomic transaction; return state+challenge only with noSend/noWrite/canActivate=false.
2. `admitOaCallback()`: require same active actor+session; consume opaque state once, enforce 5-minute expiry; recheck Store Owner; enforce same App and exact redirect URI; check OA ID globally against all existing Store/Tenant bindings (including disabled), fail closed on conflict; only output PENDING_PROVIDER_GRANT_ATTESTATION. **Never exchange code or return the code/verifier. Never activate installation.**

The in-memory Map is confined to the synthetic QA test adapter. Production requires a secret-managed durable atomic implementation with audit logs that do not contain PII, tokens or state.

## Verified public sources and security carryovers

- Official Zalo OA OpenAPI: https://docs.zaloplatforms.com/docs/OA — OAuth 2.0, PKCE S256, callback code + oa_id; POST v4 OA access_token and OA profile later, **not called in this candidate**.
- Official OA onboarding: https://oa.zalo.me/home/documents/guides/Khoi-tao-ung-dung-va-cap-quyen_117071366476220195 — OA admin/app authorization required.
- Official incoming webhook: https://stc-developers.zdn.vn/docs/v2/official-account/webhook/tin-nhan/su-kien-nguoi-dung-gui-tin-nhan — X-ZEvent-Signature SHA256, not equivalent to Messenger or Zalo Bot headers.
- Open-source references: `zaloplatform` SDK, `bautran1911/n8n-nodes-zalo-oa`, `congdinh2008/n8n-nodes-mochi-zalo-oa`, `openclaw/openclaw/extensions/zalo`. No dependency installed. No upstream code copied.
- Zalo OA messaging rules: https://oa.zalo.me/home/documents/guides/tin-tu-van — 7-day OpenAPI window, 48-hour free period after interaction. Not a permission to send; outgoing policy remains disabled.

## Specific unresolved provider compatibility

The overview Quick Start explicitly documents callback `code` and `oa_id` and PKCE, but does **not** independently confirm how the opaque anti-CSRF `state` value is carried end-to-end or whether OAuth `code` has the strict format enforced here. Therefore **LIVE CALLBACK ADMISSION IS BLOCKED** until exact official provider OAuth authorize/callback schema and signed real QA evidence confirm these assumptions. Do not silently disable `state` as a workaround; require an alternative authenticated one-time transaction binding if provider does not echo it.

## Security and release gates

- Current source-only check **does not verify Zalo OA grant, OA admin or store owner** in the provider: injected identity/store functions are fixtures. OA ID in callback is only a *claim*. Do not trust it for any Store binding.
- A real grant verifier MUST exchange OAuth code+PKCE in a private backend, bind resulting OA profile ID to callback OA ID and admin authority, use independently authenticated merchant consent, store tokens in managed secret storage, and enforce global unique OA ID across all Apps/Tenants/Stores with atomic DB constraints.
- Never store authorization code, access/refresh token, verifier, callback state, OA secret or raw signed webhook in plaintext logs, GH, n8n pin data or client storage. Verify replay and 401/403 failures.
- Real Store A/B same-Tenant RLS is BLOCKED as of PR #290; no change to database or privileged RPC.
- Native OA admin evidence, separately approved QA OA, private independent operator approval, managed credential storage, actual external browser canary, cost bound and inactive Worker gate are all **BLOCKED** pending a distinct owner authorization.
- Do not reuse G0.5 synthetic QA registry as real OA owner proof; no migration to production.
- No automatic token refresh, ZBS, sending, image download, identity linking, catalog/order write, or Cloudflare deployment in this candidate.

## Run QA (Node.js >=20)

`node --test qa/zalo-oa-source-admission/oa-admission.test.mjs qa/zalo-oa-source-admission/oa-oauth-offline.test.mjs`

Parent 20 synthetic cases + 34 new synthetic cases. GitHub Actions on exact PR head is the independent evidence; check CI before claiming TESTED.

## Checkpoint

- Parent commit: `9c1e30805ad7dc7bee22e8d5efc669b3694a5380`
- Parent OA admission stays unchanged.
- New branch: `work/v17-zalo-source02-oauth-pkce-ownership-nosend-20261117`.
- n8n unchanged: Zalo Bot Lab `yIJk8LvJoLF40Z62`, Private Router `sIPs6egzIwOY1GNv`, Messenger `Z7FdV7uDvApfbURQ`.
- Deployment gate: NO-GO. Rollback source code: close child draft; do not alter parent PR.
