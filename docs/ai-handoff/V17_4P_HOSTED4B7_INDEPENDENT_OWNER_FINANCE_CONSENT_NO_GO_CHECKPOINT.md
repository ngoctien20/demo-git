# TIEN404 AI — V17.4P-HOSTED.4B.7
## Independent Private Identity Binding × Finance Consent Intake × Hosted Ledger GO/NO-GO

**Date:** 2026-11-17 JST
**Parent:** [Draft PR #324](https://github.com/ngoctien20/demo-git/pull/324), exact HEAD `9f1fb926754de14e364c450410855e5fc19d0cf1`; prior QA 507/507 SUCCESS.
**Stage:** Source-only independent Owner/Finance cryptographic consent contract implemented; local QA pending CI. REAL PRIVATE IDENTITY PROVIDER / REAL FINANCE CONSENT / HOSTED LEDGER **NO GO**. This PR performs no hosted resource writes.

### A. Real Cloudflare GET-only evidence
At **2026-11-17T11:57:40.290Z** (20:57 JST), live Cloudflare connector GETs verified:
- **30/30 Workers**, **30 scripts**; proposed V17.4P ledger Worker and QA Worker both absent.
- **3/3** protected Durable Object namespaces with distinct existing V17.5E.2, V17.5E.2A and Zalo V17.21H.2 owner scripts/classes intact.
- 2 Access apps, 0 reusable Access policies; 1/1 accepted Cloudflare account member with `Super Administrator - All Privileges` role.
- `GET /billing/spend-policies` returned an API failure/access denial. Therefore **finance budget/spend policy actual verification missing**. No private Finance signed consent observed. A single Super Administrator is not independent Owner/Finance authorization, and connector `whoami` is not an Owner signature.
- Inventory is point-in-time evidence only. Any future consent MUST bind a fresh, independently collected control-plane inventory; no current snapshot is a durable reservation.

### B. Implemented Owner & Finance mathematical signature contract (source only)
`qa/v174p-private-hosted/hosted4b7-independent-owner-finance-consent.mjs`:
- Strict JSON metadata schema: no arbitrary URL, HTML, file bytes, real email, JWT, identity document or payment credential fields.
- Proposed `LEDGER_FIRST_INACTIVE_UPLOAD` phase only; exact account, source SHA, proposed private Ledger Worker, owner and finance permit digests, sanitized current Cloudflare inventory digest and one short-lived nonce/change window.
- Two independent **Owner and Finance** Ed25519 approval signatures, each domain-separated, over the exact same immutable packet. Distinct Owner and Finance public keys; separate private broker key.
- Two independent private-broker-signed identity receipts: exact role, subject SHA-256, account, permitted audience, phishing-resistant MFA method, authentication freshness <=5 minutes, matching signed packet digest and nonce, opaque restricted `EV-...` references only. Owner identity receipt binds Cloudflare's accepted Super Administrator membership reference SHA-256; Finance identity is a separate privately registered role, NOT inferred from the account's Super Administrator membership.
- Hypothetical distinct positive USD allocations for QA and ledger, <=25 combined synthetic policy, explicit acknowledgement that shared-account Workers/DO cost controls **cannot assure a hard per-resource invoice ceiling**, and storage cost risk.
- Actual Finance spend-policy read-only evidence must be available from an independently authorized, audited source. An API 403 or unsigned human response cannot become `READ_ONLY_VERIFIED`. Current live status is **FORBIDDEN_OR_CONNECTOR_PERMISSION_ERROR**, not Finance consent.
- Explicit no public URL, routes, preview, Access/secret changes, no automatic upload, no provider/Commerce actions, no existing V17.5/Zalo/RPC16 mutation.
- No module network/API calls, Cloudflare credentials or auto-deploy. Every result, even a synthetic cryptographic success, includes `real_owner_identity_verified:false`, `real_finance_authority_verified:false`, `can_provision_ledger:false`, `can_upload_qa_worker:false`, `can_deploy:false`.
- **IMPORTANT TRUST LIMITATION:** Caller-provided key material, identity assertions or testing flags do NOT prove real human signers or independently trusted identity registration. This module cannot independently authenticate a real human; do NOT present passing source QA as a real owner/Finance approval.

`qa/v174p-private-hosted/hosted4b7-independent-owner-finance-consent.test.mjs`: 40 synthetic negative/positive cases for separate roles, missing/forged signatures, MFA and session freshness, nonce/phase replay, budget tamper, Source/Cloudflare inventory changes, billing 403, schema injection and no provider/Access/billing writes.

`qa/v174p-private-hosted/hosted4b7-independent-consent.pending.example.json`: all real Owner/Finance identity references, signed consent, MFA proofs and USD budgets intentionally `null`, all hosted mutation permissions `false`. Only sanitized GET counts and ERROR category recorded.

### C. Proposed real private authenticated Owner/Finance intake (BLOCKED)
A future implementation (requires private owner/security authorization, not assumed):
1. Independently selected secure IdP + Cloudflare Access Worker-level All Traffic and separate MFA-enforced Owner and Finance policy. Real `ctx.access` evidence is useful only for directly Access-authenticated Workers; it does not independently grant Finance or Merchant ownership. Policy and revocation verified by a separate operator.
2. Independently pinned trusted broker public keys and private document registry with least privilege, audit trail, consent-revocation and a short-lived anti-replay ledger; NO trust roots in GitHub.
3. Privately verified Cloudflare account owner identity mapping to signed consent and separate independent Finance legal/company mandate, bounded USD approval, billing access via approved Finance-only channel, rollback operator attestation.
4. Dedicated hosted private ledger remains separate; upload only after **new explicit finance+security+owner approval** for actual positive risk and protected resource topology. No first upload until genuine hosted consent and finance evidence accepted.
5. Explicit spending risk: Cloudflare Workers/DO spend caps are account-wide and may exclude stored DO data fees/subscription. Do not promise spend <=25 USD or another absolute ceiling from a synthetic policy. Do not change account-wide spending limits or paid subscription.

### D. QA, protections and rollback
- Maintain GitHub source security tests + **16 local real Workerd SQLite DO** + **21 local HTTPS Chromium simulated Access**.
- Real hosted private evidence intake HTTP UAT, live Cloudflare Worker/DO creation, and customer Commerce/Store RLS remain intentionally SKIPPED/NO-GO.
- This PR does **not** create Access/R2/DO/Workers or alter DNS, billing, secrets, GitHub production branches, real n8n, Supabase or Messenger/Zalo sends.
- Rollback via closing/reverting the child Draft PR only; parent #324 and all live resources retained.

### Cloudflare official documentation
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/billing/understand/billing-permissions/
- https://developers.cloudflare.com/durable-objects/platform/spend-management/
- https://developers.cloudflare.com/workers/platform/spend-management/
