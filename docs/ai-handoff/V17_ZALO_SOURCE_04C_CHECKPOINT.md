# TIEN404 AI — V17.ZALO-SOURCE-04C checkpoint
## Verified OA Admin Consent × Dedicated Cloudflare Access Admission × Real No-Send Canary
Date: 2026-11-17 JST
Status: IMPLEMENTED SOURCE-ONLY; REAL OA / HOSTED ADMISSION **BLOCKED**.

Parent: Draft PR #299 HEAD `03207bf9be33fefd4e35eb1f7344761b20586cff`, not merged.
Child: `work/v17-zalo-source04c-private-attestation-access-nosend-20261117`.

### Verified read-only infrastructure evidence

- GitHub PR #299 OPEN DRAFT, SOURCE-04B 183/183 synthetic tests at previous pinned HEAD.
- Cloudflare account read-only: 28 Worker scripts; 1 Access application named `tien404-ai-git-staging - Cloudflare Pages` for Pages staging; 0 reusable Access policies returned. No dedicated OA QA Operator Access application is proven. Existing Zalo workers are NOT evidence of trusted OA ownership.
- Supabase staging `ifxlvrhyjhbzbrkdsida` ACTIVE_HEALTHY. Read-only PostgreSQL catalog query across non-system schemas found no tables named like `%store%` or `%oa_install%`. No real same-Tenant Store A/B Auth JWT/RLS UAT could be verified.
- Zalo OA official webhook describes `X-ZEvent-Signature: mac=sha256(appId+data+timeStamp+OAsecretKey)` and `POST application/json`. The source prototype's raw-body signature candidate does not establish provider compatibility without a real signed raw event.
  Official: https://stc-developers.zdn.vn/docs/v2/official-account/webhook/tin-nhan/su-kien-nguoi-dung-gui-tin-nhan
- Zalo OA official OAuth docs describe PKCE, OAuth code and OA readback; callback `code + oa_id` alone is not OA Admin ownership proof. Exact state handling remains unverified for the target real OA app.
  Official: https://docs.zaloplatforms.com/docs/OA
- Cloudflare Worker Access on authenticated direct requests supplies `ctx.access`, `ctx.access.aud`, `getIdentity()` when enabled. Access is for the private operator dashboard, **not** for provider-to-provider signed Zalo webhooks.
  Official: https://developers.cloudflare.com/workers/configuration/cloudflare-access/

### Implemented (source-only)

1. `qa/zalo-oa-source-admission/oa-04c-attestation-offline.mjs`
   - Uses **synthetic Ed25519 test signatures** from distinct merchant and independent operator attestors; rejects forged/tampered signatures and shared signing keys.
   - Requires authenticated non-revoked owner, independent Access-authenticated operator, approved exact Access app audience/hostname and no bypass/Everyone-style policy, injected trusted same Store owner lookup, exact app/OA ID from callback/profile readback, 5-minute TTL, separate operator-bound approval, one-shot replay.
   - Returns `realProviderVerified=false`, `accessHostedVerified=false`, `realCanaryExecuted=false`, `canActivate=false`, `canReceiveRealTraffic=false`, zero-send/zero-write under ALL outcomes. It **does not call Zalo, Cloudflare Access, or Supabase**.
   - The `Access` structural snapshot in unit tests is a fixture. A real Access application cannot be certified by passing this function; an independently authorized operator must verify actual Cloudflare API controls.
2. `qa/zalo-oa-source-admission/oa-04c-signed-canary-offline.mjs`
   - Offline ONLY simulated signed Zalo OA text event on original JSON bytes using inherited candidate verifier. Requires injected PENDING_REVIEW QA-only installation, exact trusted App/OA, time limit, atomic replay and no-send flags.
   - Returns `providerVerified=false`, `liveTrafficAccepted=false` even for synthetically signed cases. No inbound production HTTP listener, webhook route, provider fetch, Order/Stock write, customer data extraction, AI calls or notification.
3. Two independent synthetic unit suites and dedicated GitHub Actions check syntax, inherited regression, cryptographic negative cases and static no-provider/no-Commerce side effects.
4. Existing SOURCE-01/02/03/04/04B modules, Messenger Published, Zalo Bot Published, DEMO, Supabase hosted DB, Cloudflare Worker and live n8n workflows stay untouched.

### Critical real OA release gates (ALL BLOCKED)
- Real OA Admin login and consent to an exact approved Zalo App, exact QA OA ID, callback HTTPS domain and minimal scope. An uploaded screenshot, URL, file or client checkbox is **not** authority.
- A real OAuth exchange by a separately authorized private backend and read-only `/oa/getoa` identity match; valid anti-CSRF state binding. No tokens in the chat, GitHub, n8n pin data, logs or localStorage.
- Trusted Supabase Auth Owner session for **two Stores in the same Tenant**, owner-membership check and independent least-privilege Store-level RLS negative proof. No hosted RLS mutation until separate approval.
- Independent different TIEN404 operator approves no-send only, timestamp-bound, cost-bounded UAT. Not owner self-approval.
- A dedicated Access application for operator-only Worker, no bypass, explicit least-privilege allowlist, exact Audience, protection enforced **before upload** on every intended hostname, no accidental public preview. External unauthenticated-denial must be tested.
- A **separate public Zalo provider webhook ingress** (NOT behind browser Access) with native signature over captured raw bytes, durable atomic replay, rate limits, 128KB body bound, secret-managed verifier, exact App/OA→Store mapping. No customer send.
- A managed token vault, pre-refresh lease, recovery after unknown provider response, operator-signed private evidence store and emergency kill-switch.
- External browser canary, exact version/commit logs, signed event A/B negative tests, redacted receipts and independent operator acceptance with **provider_sends=0; commerce_writes=0; customer_data_reads=0**.

### Host/deployment permission
SOURCE-04C is not an authorization for a Cloudflare Access policy change, public webhook, OAuth exchange, secrets, paid resource, Supabase DDL, n8n publish, or real customer messages. Obtain explicit per-action approval with real private owner/OA evidence and exact cost scope. Existing permission remains source-only. **No hosted deployment was performed.**

### Threat model
- Forged OA admin file/URL, malware upload and fake OAuth callback → never fetch attachments or untrusted URL; only independently verified private OAuth/admin evidence allowed.
- Owner cross-Tenant/Store claim, reassigned Store owner or revoked session → deny; use live Auth and DB membership.
- Access application mismatch/bypass/Everyone rules, forged `cf-access-jwt-assertion`, wrong operator identity → deny and audit; Access policy verified on real Cloudflare account.
- Signed webhook replay, tampered raw bytes or provider-secret reuse across tenants → exact OA mapping and atomic replay; never trust `tenantId/storeId` in client payload.
- Real provider approval cannot be simulated. Positive Ed25519 / OA signature unit tests prove only the test harness, never provider-authoritative OA Admin consent.

### QA / checkpoint / rollback
- Run `node --test qa/zalo-oa-source-admission/*.test.mjs` in Node 22.
- Verify GitHub Actions at the PR's **final exact HEAD** before calling the branch TESTED.
- Rollback SOURCE-04C: close Draft PR; parent SOURCE-04B unaffected, no hosted resource to revert.
