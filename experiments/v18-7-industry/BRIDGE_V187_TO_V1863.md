# TIEN404 V18.7 / V18.6.3 — Trusted Industry Read-Only Adapter Contract

Date: 2026-11-18 JST | PROPOSED | STAGING ONLY | NO REAL COMMERCE

## Grounded dependencies
- V18.7 Industry Profiles + synthetic channel testing: Draft PR #422.
- Canonical Store Authority and restrictive composite RLS in DISPOSABLE PostgreSQL 17: existing Draft PR #420. It is a synthetic implementation, NOT proof of live Supabase Auth or Store migration.
- Supabase staging Commerce has tenant-scoped products/orders and lacks verified public canonical stores/store_memberships in the inspected schemas.
- Messenger workflow Z7FdV7uDvApfbURQ is published; Core workflow iyfGUiEsZlNTBWOR has different draft/published versions. Do not cutover.

## Protected read-only admission — REQUIRED BEFORE IMPLEMENTATION

1. Verify source authenticity by provider-specific ingress (Meta signature over raw payload, Zalo provider proof or Website Auth); never trust model text.
2. Resolve an installed provider connection by server-owned installation ID. Client-provided tenant_id, store_id, channel, role and provider names cannot authorize data access.
3. Verify a short-lived server-issued receipt with cryptographic proof, issuer, audience, subject, tenant/store, installation, expiry, nonce or idempotency, narrow read scopes. A matching JSON object with verified=true is not enough.
4. Verify active canonical store membership, subscription entitlements, channel status and revocation. Fail closed if Store Authority is missing.
5. Load exact approved Industry Profile version, Store Overrides version and Knowledge version; never allow a store override to extend security-critical tools.
6. Execute only Store-scoped read-only Commerce operations against a vetted, store-aware staging catalog with real RLS tested under verified JWT. No RAG-based price/stock guesses.
7. Build an abstract channel response; no Meta/Zalo/Website provider send and no order write until independently approved.

## Trusted context shape (not a client input)
Fields: issuer, audience, subject_reference, tenant_id, store_id, installation_id, channel, profile_id, profile_version, store_config_version, knowledge_version, policy_version, entitlements_version, issued_at, expires_at, receipt_id, read_scopes and readonly=true.

Never expose a signed receipt or secrets in LLM prompts, browser JavaScript, Google Sheets or n8n logs. The real adapter must validate proof, not rely on the fake actor_key used by QA.

## Negative QA gate
- Same-tenant Store A/C with identical SKU but different price and inventory: must not leak.
- Different-tenant Store B access: deny.
- Unknown or revoked Page/OA/Widget installation: deny.
- Missing store membership despite tenant membership: deny.
- Stale/replayed/invalid receipt: deny.
- Unapproved profile version or override attempting tool escalation: deny.
- Client-supplied price/stock: deny.
- Cross-channel private order lookup without verified customer linkage: deny.
- Provider sends, order writes, debt updates, unauthorized admin actions: deny.

## Migration preview (NO DDL RUN)
Only after review and owner approval, reuse canonical (tenant_id, store_id) and store memberships from Store Authority work PR #420. Do NOT create another competing store table.
Future profile bindings must reference canonical composite Store keys and immutable profile revisions. Override changes must produce new versions and audit records, never silently overwrite merchant customizations.
RLS is not just TO authenticated; authorize actual store ownership and staff role. Avoid dangerous public SECURITY DEFINER and bypass-RLS service routes; test with real A/B JWT before UAT.

## Release / rollback
PR #422 stays Draft. Mock PASS does not imply real RLS or OAuth PASS. No provider credentials, webhooks, production orders or database changes in this branch.
Rollback is close or revert PR #422 only. Leave PR #420, Published Messenger and active Commerce Core untouched.
