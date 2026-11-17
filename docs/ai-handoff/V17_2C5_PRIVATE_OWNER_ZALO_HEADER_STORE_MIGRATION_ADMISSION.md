# V17.2C.5 — Private Owner Authority Evidence × Zalo Pairing Header Provenance × Isolated Canonical Store Migration Admission

Date: 2026-11-18 JST.
Parent: PR #392 Draft; predecessor HEAD `eb0ae62e9ef108b591bd338e476a6acd933c39de`.
Target: Supabase staging `ifxlvrhyjhbzbrkdsida`, active n8n `OgDZNSAvKEvhnAvn`.
**Status: VERIFIED READ-ONLY, DESIGN PROPOSED, LIVE JWT/MIGRATION/PRIVILEGE CHANGES NO-GO.**

## 1 — Independent owner authority evidence

Read-only counts from actual Supabase:
- `auth.users` 3; active `owner` memberships 3; exactly 1 tenant with >=2 active distinct owners.
- QA `tien404_r1_qa.shop_bots` 2 rows.
- `public.stores` table 0; `public.store_memberships` table 0; `store_id` columns across six Commerce business tables 0.
These aggregates do **not** establish real signed consent by two independent QA actors, possession of current Auth sessions, actual Store ownership, or Store-specific authorization. Tenant ownership is distinct from Store ownership. No user emails, UUIDs, tokens, secrets or customer rows exported.

**Private intake contract before real JWT UAT:**
1. Founder written bounded approval for only disposable synthetic QA tenant and Stores A/B, two distinct QA Auth identities, no outbound provider send or real data reads/writes. This authorization must identify exact staging environment and no-cost/approved cost boundary.
2. Actor A and actor B each prove consent using authenticated private channel/session tied to a backend-verified `auth.users.id` (do not display identity or token publicly); independent security reviewer must independently attest role, Store and session eligibility. An existing dual-owner Tenant count is insufficient.
3. Record opaque consent receipt IDs, signer roles, scope, nonces, timestamps/expiry, source project ref and pinned deployed SHA only in private access-controlled registry. Enforce one-time nonce, short expiry and revocation; do not put secrets/JWT in GitHub, n8n logs, PR or chat.
4. Require single authoritative Store mapping with verified composite `(tenant_id,store_id)`, no `store_key` guess or customer data reuse.
5. Only after independent consent, approved migration plan plus recovery/rollback authority, provide two private real JWT sessions, test read-only PostgREST RLS A->A and B->B allowed, A->B/B->A denied, invalid/expired/revoked/forged/cross-Tenant denied; collect masked HTTP evidence.

## 2 — Zalo V2 header provenance

Read-only published workflow `TIEN404_ZALO_V2_SHADOW_STAGING` `OgDZNSAvKEvhnAvn`, version `f00ba506-c52a-4340-9a0c-809fd9c6ea9a`, ACTIVE and draft==published.
- Connection: `Recognize Shop B pairing command (staging)` → `Submit pending claim for Shop B`.
- HTTP Request method POST, target `/rest/v1/rpc/qa_shop_b_zalo_claim`. Node enabled.
- Node's genericCredentialType = `httpHeaderAuth`, credential binding present; explicit `headerParameters` includes only `apikey`. Auth credential secret and exact header name are not revealed by the metadata.
- Privileged Supabase RPC expects `request.headers->>'x-tien404-pairing'` matching a Vault secret. This check was read previously from actual function definition. The presence of an `apikey` header alone does not prove the required pairing header.
- Execution metadata query returned 1 execution (`2858`), manual, success, 2026-11-13T12:42:13Z. This is NOT proof the specific RPC node ran, passed the pairing header, or mutated a claim; no execution payload inspected and no RPC called by this audit.
- RLS/runtime function ACL remains `qa_shop_b_zalo_claim` anon EXECUTE true, authenticated false; `qa_owner_pairing` and `save_merchant_product` authenticated true, anon false. All `SECURITY DEFINER` with fixed empty `search_path`.

**Required private proof:** approved operator opens n8n Credential Inspector for that specific `httpHeaderAuth` credential without ever copying value into chat; verify header name (expected pairing header), correct managed-secret source and binding, test short-lived disposable clone without the real Vault claim, missing/wrong/replayed header fails and valid approved header reaches only synthetic target. Capture non-secret status and audit fingerprint. No live POST/replay, no webhook change, no credential rotation without explicit approval.

**Compatibility decision:** retain `anon EXECUTE` and current workflow Published unchanged; cannot yet claim pairing header provenance or deploy a privilege closure.

## 3 — Canonical Store migration admission, preview only

Current Tenant-only data model must not be silently relabeled Store-owned. Required future tables:
- `stores(id, tenant_id, status, created_at)` plus composite `UNIQUE(tenant_id,id)`.
- `store_memberships(tenant_id,store_id,user_id,role,active)`, composite foreign keys and membership/role revocation check.
- Server-issued `channel_installations(tenant_id,store_id,provider/channel identifiers, verified state, private secret reference)` with signed source identity; do not trust inbound tenant/store text.
- Business tables `products,orders,order_items,customers,conversations,messages` must map to validated Store scope; unresolved rows remain quarantined or unmigrated, not assigned guessed Store ID.
- Store-aware RLS for reads and writes, `WITH CHECK` on mutations, security-invoker views, and explicit RPC permission check. Preserve existing Tenant-level APIs until compatibility suites pass.

**Admission gates (all must be true):**
- [ ] Privately verified A/B operator/owner consents and independent reviewer.
- [ ] Approved isolated disposable schema/tenant resources; cost and backup/rollback approval; baseline row counts and DDL compatibility.
- [ ] Canonical Store FK/membership and channel identity single contract approved.
- [ ] Verified Zalo V2 pairing header provenance and caller migration compatibility.
- [ ] Real short-lived Auth sessions for A and B, no exposed JWT, independent signed proof.
- [ ] No-send/no-production/no-customer-mutation test harness available.
- [ ] Negative cross-Store and cross-Tenant RLS HTTP UAT with synthetic fixtures, plus revocation checks.
- [ ] Exact SHA and security reviewer acceptance.

**NO-GO now:** identity/session and Store schema are not admitted. There is no new migration, grants, auth users, Vault changes, provider send, execution or customer mutation.

## 4 — Acceptance summary, evidence and rollback

VERIFIED: staged Supabase ACL + aggregate authority prerequisites; n8n graph/header metadata and execution metadata; GitHub source parent.
IMPLEMENTED: source-only checkpoint document.
TESTED: read-only connector fetches; not actual HTTP negative UAT.
BLOCKED: independent two-actor consent, exact secret-header proof, isolated Store migration approval, real JWT session admission and hosted security acceptance.
PROPOSED: safe scoped migration and private header-provenance verification. Source rollback: close Draft PR #392 or revert this docs-only commit. Runtime rollback unnecessary; no runtime changed.

Next: V17.2C.6 — Private Header Name Attestation × Authorized QA Actor A/B Consent × Disposable Store Migration GO/NO-GO. Remain fail-closed until independent evidence exists.
