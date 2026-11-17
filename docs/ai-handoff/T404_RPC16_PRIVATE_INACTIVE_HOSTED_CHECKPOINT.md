# TIEN404 AI — RPC16 Private Hosted Admission × Inactive Worker × R2 Binding

**2026-11-17 JST | VERIFIED HOSTED INACTIVE / TESTED MOCK / MERCHANT INTAKE NO-GO.**

## Verified Cloudflare account state (after approved staging deployment)

- Created Cloudflare Access self-hosted application: **TIEN404 RPC16 Merchant Evidence Staging — DENY ALL**; ID `f994d4b2-d4f9-419b-8585-5d33be506f13`.
- Domain: `tien404-rpc16-merchant-evidence-inactive-staging.tienmobi208.workers.dev` (hostname **NOT publicly routed**).
- Access policies: **0** (no Allow, no Bypass); App Launcher hidden; session_duration `15m`.
- Existing staging Pages Access application preserved unchanged.
- Created new Worker: `tien404-rpc16-merchant-evidence-inactive-staging`, with **workers.dev disabled** and **preview URLs disabled** (read back directly after deployment).
- Worker source SHA-256 `112e72fd840066c8f74016ed84aff43eed5e9decb83c1454a325d4536e63ff59`, **matched exact deployed module** using Cloudflare GET Worker API.
- Worker handles every method/path by returning **404, no body**, with anti-cache headers; no network fetch, API, status, upload, R2 get/put/list/delete or provider send.
- Worker has private `R2_QUARANTINE` binding to `tien404-merchant-evidence-quarantine-staging`; verified with Cloudflare Worker Settings API.
- R2: APAC Standard, public development URL disabled, 0 custom domains and **0 objects**. No R2 API token created in this change. Token inventory remains **UNVERIFIED** due Cloudflare permission 403.
- R2 account billing budget alert remains enabled at **$1 notification threshold**, **not a hard spending cap**.

## QA and release boundaries

- Local Node 22: **74/74** negative-request/mock tests PASS.
- GitHub CI: pending at initial checkpoint; verify run ID/results before claiming success.
- This Worker is intentionally not usable to receive Merchant proof. Access application is deny-all and there is no public worker route.
- RPC13/14/15 source-only code is **not** enabled on hosted. No scanner, reviewer credential, durable registry or real identities are present.
- **No real Merchant documents uploaded.** No Supabase Commerce schema/RLS grants modified, no Messenger/Zalo production sends, no customer data changes.
- Original four-row Products/Orders evidence remains 0/4 verified; two real same-Tenant Store JWTs and canonical Store binding not accepted.
- Independent externally reachable browser canary is **not attempted**: intentional no-URL posture; cannot call this a successful live end-to-end Auth acceptance.

## Rollback/next gates

- Source rollback: close Draft PR on RPC15 base.
- Hosted rollback needs separate owner approval to delete only RPC16 Worker and RPC16 Access application; never change the R2 bucket or existing Pages app.
- Gate to enable real upload: independent reviewer, immutable hosted replay service, rate-limiter, actual malware scanning/CDR, private retention/recovery, Access allowlist explicitly approved, real Supabase Auth session, and explicit separate GO authorization.
- Gate to migrate Store RLS: signed Merchant primary sources for P1/P2/O1/O2, real same-Tenant A/B Store JWT UAT, approved backup and independent Security/DB operator sign-off.

**Checkpoint:** `RPC16_ACCESS_DENY_ALL_VERIFIED · WORKER_INACTIVE_VERIFIED · R2_PRIVATE_BINDING_VERIFIED · DATA_ZERO · HOSTED_MERCHANT_NO_GO`.