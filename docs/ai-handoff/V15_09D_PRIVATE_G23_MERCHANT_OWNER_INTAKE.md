# TIEN404 AI V15.0-09D — Private Merchant Owner G2.3 Intake & Role Separation
Status: PRIVATE INTAKE PREPARED, G2.3 CERTIFICATION BLOCKED
Date: 2026-11-16 JST

## Source-of-truth and non-goals
Read-only hosted checks: Supabase staging ifxlvrhyjhbzbrkdsida has 2 tenants, 3 auth.users, 3 active tenant memberships, 2 QA paired Owner bindings and 3 QA CONFIRMED claims plus 1 pending. There are 19 pairing challenges (9 used, 10 expired unused, none active unused). n8n G2.1 #3874/#3880 and G2.2 #3881 succeeded technically. These are NOT independent real owner/provider G2.3 certification.
No canonical public.stores or public.store_memberships exists. Owner four-row proof cannot be completed with real hosted Store data until a separately authorized migration.

## Two distinct approval capacities
1. MERCHANT_OWNER: authorizes linking the merchant's particular Store to the exact Messenger Page, Zalo Bot/OA, Website Widget and owner notification recipient. It does NOT authorize exporting another tenant's data or changing database policies.
2. PLATFORM_DATA_CONTROLLER / authorized custodian: can request private whole-staging backup and justify legal/data-protection scope, but cannot certify individual merchant ownership or issue verified provider attestation by self-assertion.
3. INDEPENDENT_SECURITY_REVIEWER: separate person/authorized verifier with independent access, must review scope, identity proof and backup handling. A single actor cannot sign for both data controller and security reviewer. All eventual real signatures must be verified by a trusted backend against securely enrolled public keys; their mere presence as text is not certification.

## Actual Owner G2.3 private evidence intake — 7 separate proof lanes
A. Authenticated customer/owner identity from trusted Supabase Auth / session validation, private opaque receipt.
B. Active Tenant Membership, direct hosted database evidence, no raw user ID in public GitHub.
C. Canonical Store→Tenant relationship, not QA store_key and not user-provided text.
D. Active Store Membership with exact owner/tenant/store match.
E. Provider-native account and Bot identity, verified getMe/attestation and trusted account binding.
F. Provider-specific ingress signature and durable event replay evidence for exact channel.
G. Explicit owner consent, source authenticity, scope, time, expiry and revocation. Consent must be confirmed independently, cannot be inferred from QA CONFIRMED/paired statuses.

Each lane must have a PRIVATE record: random opaque receiptRef, source authority, observer identity, evidence collected at, expiration, source version, SHA keyed HMAC where appropriate (do NOT hash short phone/password), and a verifier audit reference. Evidence/data always stays in private vault with access logs; do not paste personal IDs, Bot Token, keys, JWT, phone, Zalo recipient, PSID, pairing code or raw webhook data into a PR, AI chat, public CI logs or exported checkpoint.

## Hard stops
- Any row missing, expired or revoked = BLOCKED.
- A Store pointer from an LLM, browser or user prompt never grants authority.
- Owner has consented to their Bot is NOT proof Store schema exists.
- A successful Workflow execution is NOT proof provider signature, merchant approval or account owner consent.
- If there is no fresh one-time QA challenge, do not automatically renew or send a new challenge.
- Never publish new merchant channel binding or enable real sends from a private-intake draft.

## Acceptance checklist — EMPTY (do not auto mark complete)
- [ ] Merchant independently verifies Auth identity through approved private flow.
- [ ] Separate authorized reviewer verifies Tenant/Store and membership 4-row chain on a dedicated safe target.
- [ ] Provider account/Bot bound to Store; native signature/attestor proof and one-time replay evidence verified.
- [ ] Owner explicitly signs scope per channel and recipient; consent expiry and revocation tested.
- [ ] Reviewer signs independent approval; private receipt indexed to source SHA and timestamp.
- [ ] Security/privacy review for whole-database backup is handled separately by platform custodian.

Owner G2.3 status: BLOCKED. No human signatures or original provider verification collected or fabricated by V15.0-09D.
