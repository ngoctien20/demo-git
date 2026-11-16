# TIEN404 V15.0-09C — PRIVATE OWNER / G2.3 CERTIFICATION RECORD
Date: 2026-11-16 JST | State: INTAKE PREPARED — NOT OWNER CERTIFIED

## Scope and non-negotiable boundary
This is an intake and reviewer checklist, not a certificate. NO hosted Store ownership can be inferred while public.stores and public.store_memberships do not exist. Existing paired/confirmed QA fixtures are NOT evidence of merchant's provider permission. No owner authorization and no provider signature can be invented by an LLM, claim string, Messenger PSID or Zalo sender text.

## Observed evidence (read-only aggregate; never publish identifiers)
- Supabase ifxlvrhyjhbzbrkdsida: 3 auth users, 2 Tenants, 3 active Tenant memberships.
- QA identity map 2 rows both map to existing Tenants.
- QA owner_bindings 2 rows status paired; owner_pairing_claims_v3 3 CONFIRMED and 1 PENDING_OWNER_CONFIRMATION.
- Owner challenge table 19 rows; 9 used; 10 expired and unused; 0 unconsumed and still valid; max failed attempts observed 5.
- No public.stores or public.store_memberships. 2 Products and 2 Orders lack proven Store ownership.
- n8n G2.1 attestor bOjbj4MZIZnMn8XP executions 3874, 3880 SUCCESS; G2.2 QA znp3ABDLUH5bTqFE execution 3881 SUCCESS. This is QA execution status only, not independent Owner consent/G2.3.
- Avoid renewing/issuing challenges automatically: new valid challenges require approved owner action.

## Required independently verified evidence bundle (PRIVATE)
For each real Store, combine all seven, separately sourced:
1. Auth session owner identity: genuine authenticated Supabase user (not raw client claim), status, issued_at/expires_at, session-revocation check, independent reviewer.
2. Tenant membership: active role and tenant; verify source directly from hosted DB with least privilege.
3. Canonical Store: UUID, belongs to Tenant, active/paused/revoked state; currently NOT PRESENT, so cannot certify.
4. Store membership: active specific (user, tenant, Store) role; currently NOT PRESENT.
5. Provider account/Bot ownership: provider-native signed getMe/account ownership evidence bound to exact environment/account/Bot, no tokens in receipt.
6. Provider ingress proof: provider-specific cryptographic validation, trusted event id, durable replay check and bound channel.
7. Independent merchant consent: owner signs off exact Store↔Bot/Account/channel in private controlled UI; revoke/expiry/owner changes handled.

All seven need a private evidence record with source system, verifier identity, observed time, expiration, version, independent signer, receipt hash and trace ID. Provider ownership evidence and Store membership are complementary, never substitutes. User-modifiable JWT metadata, phone/name matching and synthetic fixture keys cannot grant Store scope.

## Non-sensitive private receipt template (values are deliberately NULL, not manufactured)
{
  "contract": "TIEN404-V15.0-09C-private-intake-v1",
  "environment": "STAGING",
  "receipt_ref": null,
  "owner_authenticated": false,
  "tenant_membership_verified": false,
  "canonical_store_verified": false,
  "store_membership_verified": false,
  "provider_account_verified": false,
  "provider_signature_verified": false,
  "merchant_consent_independently_verified": false,
  "durable_replay_verified": false,
  "backup_restore_verified": false,
  "independent_security_approver": null,
  "owner_approval_timestamp": null,
  "expires_at": null,
  "certification_status": "BLOCKED",
  "authorize_migration": false,
  "authorize_send": false
}

Do not save or paste into public GitHub/Actions: real Auth UUID, channel recipient IDs, phone, email, PSID, Bot/Service Role token, pairing challenge/code, raw webhook body, raw signed JWT, vault secret, full user logs, business addresses or customer rows.
Never use naked SHA256 of phone/email/short secret as privacy protection; store a random opaque receipt ID or private keyed HMAC with controlled key and purpose, and avoid linking a public digest to actual PII.

## Owner and security acceptance (not yet checked)
- [ ] Merchant individually confirms ownership and grants the exact Store/Provider/Channel binding.
- [ ] Independent authorized reviewer checks provider-native proof, not just workflow SUCCESS.
- [ ] Matching Auth identity, Tenant Membership, Store, Store Membership is witnessed on an approved isolated target.
- [ ] Challenge fresh and one-time consumed; failed-attempt and replay policy checked privately.
- [ ] Subscription/revocation linked to real backend source of truth.
- [ ] No inadvertent cross-shop binding or cross-recipient notification.
- [ ] Receipt stored privately under access controls and retention; verifier identity and expiration recorded.
- [ ] Security reviewer + merchant approvals both signed before any Stage migration or provider send.

### Decision
CURRENT: G0 BLOCKED; G2.3 INDEPENDENT OWNER CERTIFICATION NOT ACHIEVED.
Source-only fixture validator (qa/v1509c-owner-recovery/evidence-gates.cjs) always returns NOT_CERTIFIED and cannot perform account checks. Never expose fixtures as real evidence.
