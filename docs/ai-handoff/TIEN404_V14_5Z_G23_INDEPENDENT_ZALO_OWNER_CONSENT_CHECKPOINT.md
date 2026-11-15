# TIEN404 AI — V14.5Z-G2.3 — Independent Zalo Owner Proof × Merchant Consent
**Checkpoint:** 2026-11-16 JST  
**Branch:** `work/v145z-live01-limited-uat-gate`; **PR #103 DRAFT**  
**Classification:** `IMPLEMENTED_SOURCE_ONLY / TESTED_SYNTHETIC / BLOCKED_REAL_OWNER_ATTESTATION`  
**Previous gate:** G2.2 actual signed Zalo provider Bot identity matches exactly one isolated QA Shop B candidate; OWNER_CERTIFIED=0; no-send remains hard locked.

## 1. Executive decision
**DO NOT certify the Owner, modify merchant permissions, renew the allowlist or allow Zalo send.**
The real Zalo Bot ID to Shop B QA *candidate* matching proven by G2.2 does not identify which human has Bot Creator control, which Supabase authenticated Owner account is linked to that Zalo identity, or whether the authorized merchant has consented to let TIEN404 manage the channel. User's instruction to implement G2.3 is not equivalent to Shop B's authenticated merchant consent.

## 2. Real read-only audit of connected systems
- Supabase staging `ifxlvrhyjhbzbrkdsida`: Shop B QA slug `qa-staging-shop-b-20261110` has **2 active Owner memberships, 2 distinct Auth subjects and 2 email-confirmed associated accounts**. No personal emails, auth UUIDs or Chat IDs copied into this checkpoint. Existing RLS on public tenant/membership tables enabled. This is identity/membership *metadata*, not consent.
- Supabase Auth `auth.identities`: `email` provider count 3 globally; **no Zalo Social OAuth identity provider present** in existing Auth identities. `app_private.channel_secrets`: 0 total, including 0 Zalo. No auth identities, permissions or channel data changed.
- n8n QA Owner allowlist `dRPj5k0t51hihJUW` one `ALLOWED_STAGING_OWNER`, expires **2026-11-20 13:17:32.511 UTC = 22:17 JST**; this row alone does not verify Bot Creator control or Shop B membership and was **not extended**.
- Isolated G2.2 D1 `tien404-g22-botmap-qa-staging`: exactly **one CANDIDATE, owner_certified=0**, expires **2026-11-18 20:33:02.859Z / 2026-11-19 05:33 JST**. This candidate may expire before G2.3 human review; it must never auto-renew or auto-promote.
- Existing Zalo outbound staging Worker `tien404-zalo-outbound-v1-staging`: `ZALO_SEND_ENABLED=false`, unchanged version `3422864f-f095-45b9-85ca-a7d03cb87a3f`. Published n8n Zalo ingress `yIJk8LvJoLF40Z62`, version `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e`, unchanged, still synthetic Shop B routing.
- n8n G2.2 hosted HTTP regressions **3881** real signed Bot→Shop B QA candidate and **3882** negative tests passed earlier. They are not Owner certification.

## 3. Official Zalo capability and gap
- Zalo Bot overview: https://docs.zaloplatforms.com/zalo-bot lists `getMe`, `getUpdates`, `getWebhookInfo`, `setWebhook` and `sendMessage`. `getMe` verifies a Bot profile, **not human ownership**. This documentation does not expose a verified API for user-to-Bot-Creator admin membership or proof of Store agency.
- Zalo Bot Creator onboarding: https://docs.zaloplatforms.com/docs/BOT/create_bot states that account receives creation information and Bot Token; **possessing a token or a screenshot** does not independently prove that the same person owns Supabase Shop B.
- Zalo Social OAuth reference https://docs.zaloplatforms.com/docs/Social/social-api/tham-khao/user-access-token-v4 describes user authentication `state`, PKCE `code_challenge/code_verifier`, short-lived authorization code and server token exchange. It can verify a *Zalo user session* after separately configuring an OAuth application; it **does not establish Bot Creator administrator rights or a Supabase Auth user link by itself**.
- No Zalo OAuth application credentials or verified Bot Manager admin-proof API was discovered in the connected project; do not invent credentials or assert the connection is active.
- **Validated proposed approach:** independent trusted Zalo OAuth account proof + separately observed authenticated Bot Creator control challenge reviewed by distinct operator + authenticated Supabase Shop B Owner membership + explicit authenticated merchant consent. All four independent server-side attestations must bind to same nonce, Bot/tenant/store/subject and pass a durable single-use challenge store.

## 4. Implemented G2.3 security candidate — NOT deployed as an active Owner intake API
- `qa/zalo-live-v145z/g23-independent-owner-consent-gate.cjs` implements read-only fail-closed four independent ECDSA P-256 signer roots, reject shared/duplicate keys, signed claim issuer/purpose/expiry checks, common nonce and hashed Bot/Tenant/Store/Supabase subject, server-pinned Shop B, Owner roles, genuine Zalo OAuth PKCE/server exchange, separately signed Bot Creator control review, JWT-validated Supabase Owner membership, QA-only explicit and revocable consent, live allowlist, live G2.2 candidate and injected trusted durable atomic nonce consumption.
- Client-supplied trust roots, identity booleans, screenshot, Chat ID, unverified OAuth user, tenant/shop overrides and consent self-check cannot pass. The gate uses **no actual provider, OAuth, DB, credential or network calls**, and does **not** change runtime registry, owner membership or grant.
- **Even when four synthetic signed proofs and a mock atomic nonce store pass**, the highest output is `ELIGIBLE_FOR_PRIVATE_HUMAN_REVIEW_ONLY` with `private_owner_certified:false`, `merchant_authority_certified:false`, `can_send:false`, `real_zalo_approved:false`, `owner_permission_changed:false`, `orders_written:0`, `provider_sends:0`. No actual signing roots or replay store were provisioned.
- `qa/zalo-live-v145z/g23-independent-owner-consent-gate.test.cjs`: **46/46 synthetic tests PASS**, including duplicate roots, missing proofs, OAuth unlink, Bot Manager spoof, Owner role-manager/disabled/JWT fail, revoked/expired consent, allowlist expiration, G2.2 expired, Shop A and nonce replay. Full CI [43760901522](https://github.com/ngoctien20/demo-git/actions/runs/43760901522) **500/500 PASS** (previous 454 +46).
- `qa/zalo-live-v145z/g23-owner-evidence-contract.json` lists the required real evidence inputs, missing issuer keys and permission scope, and explicitly marks all real owner proof as BLOCKED.

## 5. Source-of-truth responsibility matrix
| Evidence | Trusted issuer / data | Required human action | Current |
|---|---|---|---|
| Zalo authenticated user | server-side OAuth 2.0 app, PKCE and signed account-link | Separate Zalo OAuth app registration/configuration, user sign-in & consent | BLOCKED, no identity link configured |
| Bot Creator control | separately verified authenticated Bot Manager session **and fresh control challenge**, signed by independent reviewer | Owner takes part in private review; screenshot alone insufficient | BLOCKED, no authentic challenge |
| Supabase Owner | signed server-side `auth.uid` + active membership against pinned Shop B, JWT validated | Owner signs into actual secure TIEN404 Dashboard | BLOCKED, only aggregate membership count exists |
| Merchant consent | separate signed record in authenticated Dashboard for QA-only/no-send scope, TTL, revoke | Owner selects explicit consent (not a blanket G2.1/G2.2 approval) | BLOCKED, not recorded |
| Allowlist | existing n8n allowlist, current and bound to same independently authenticated subject | Expiry review; do not renew or change permissions without separate approval | PENDING; expires Nov 20 JST |
| Mapping | G2.2 signed Bot Shop B QA candidate + valid TTL | New provider signed mapping if expired, no auto-renew | VERIFIED CANDIDATE; expires Nov 19 JST |
| Atomic replay | trusted private durable single-use nonce store and distinct signing roots | Security design and separately reviewed signer provisioning | BLOCKED, only mock QA |

## 6. Owner UAT path (no token, password or PII in chat)
When the trusted authenticated consent component exists, the owner should:
1. Log in to TIEN404's authenticated staging Shop B dashboard using their own existing account; select Shop B and confirm role **Owner** (not staff or manager).
2. Initiate an explicit OAuth session for the same person in Zalo with secure state and PKCE, using a separately registered application under an approved credential scope; do not paste OAuth codes or access tokens into ChatGPT or GitHub.
3. Complete the independent Bot Creator control review in a private environment with a fresh server-generated challenge and distinct reviewer. Keep evidence private; a Bot Creator screenshot is only supporting information.
4. View a clear consent statement: *“Tôi là người có quyền đại diện Shop B trong phiên kiểm thử TIEN404 AI và đồng ý liên kết Bot Zalo được xác minh với Shop B, **chỉ để kiểm thử danh tính trên staging, không gửi tin, không truy cập khách hàng hoặc tạo đơn**. Tôi có thể rút lại sự đồng ý.”* Then accept from an authenticated session, with expiry and revocation.
5. A trusted server signs all four proofs; audit nonce CAS, binding, expiry, role and consent. Return only private evidence IDs + blocked/eligible status; no raw Owner, Zalo user, Chat ID, Supabase User ID or tokens to public documents.
6. Human reviewer independently approves/rejects private evidence. Even if G2.3 approved, **G2.4 ingress**, **G2.5 full 4-role certificate**, **G4 live send**, and **G5 production** remain separate gates.

No trusted interactive Owner UAT or Zalo OAuth flow has been deployed under G2.3. Do not portray the checklist as a working authenticated portal.

## 7. Decisions, approvals and rollback
**Proposed next scoped approval:** authorise (a) Zalo Social OAuth **application/callback configuration** and safely provisioned credentials on staging; (b) a separate authenticated staging Owner consent form with Supabase server session verification, with private persistence for explicit consent and revoke; (c) private Bot Creator control challenge and independent review process; (d) 4 distinct signing key provision and atomic nonce store. Treat app credentials, permissions, and auth-provider changes as approval-sensitive. Do not modify Supabase `GRANT`, RLS, existing Owner memberships, existing allowlist, Published n8n ingress or real customer data in the absence of distinct scope/approval.
**Rollback today:** revert source-only G2.3 commits on Draft PR, no live service rollback required. G2.2 Worker and candidate untouched; no keys, OAuth apps, auth/session or payments created; no Zalo send.
**Next milestone:** `G2.3A — Authenticated Owner Intake Design × Private Issuer Readiness`, then real authenticated UAT and G2.3 signing evidence only when issuer provenance is verified.
