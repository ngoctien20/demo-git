# TIEN404 AI — V17.1U Private Evidence Intake × Authorized QA Identity Provisioning Review

Date: 2026-11-17 JST. Parent: V17.1T Draft PR #318, HEAD `ef913cc8800dd7c8f116911dd46e9121afaafa4b`.
**Lifecycle:** IMPLEMENTED source-only review gate. No private hosted intake, no real Auth owner identity provisioning, and NO production release.

## 1. Independent live preflight — READ ONLY
- Supabase staging project `ifxlvrhyjhbzbrkdsida`: two mapped QA Stores belong to **two different Tenants**; two owner links exist but **zero** same-Tenant Store A/B distinct-owner pairs. Despite 3 Auth users/5 session rows, **zero** Tenants have two active member users with Auth sessions. No private JWT, personal identity or customer data read or logged.
- Legacy core `public.products/orders/customers`: **zero** direct Store-based SELECT policies and no `store_id` column. Cannot certify actual same-Tenant Store isolation.
- Legacy `public.qa_shop_b_zalo_claim`: SECURITY DEFINER executable by anon; P0 security review candidate, no exploit proven.
- Messenger TEST Published V17.17 `1064b1b3-d3f1-4a6b-a367-2414ba691522`, 32 nodes, all FOUR V17.15 nodes remain. Zalo Bot Lab Published V17.19 `2d912cb0-007f-452f-9536-b92ba12a03e6`, 12 nodes. V17.1P manual QA inactive 5 nodes and no credentials. No workflow writes or republish.

## 2. IMPLEMENTED — source-only private evidence verifier
`qa/v171u-private-evidence/private-evidence-intake.cjs` creates a V17.1T private admission gate internally. Its public API accepts two cryptographically verified opaque owner JWT receipts, the V17.1T FOUR Ed25519 operator/reviewer/Store A/Store B consent signatures, exact project/Store/commit-bound intent, and **four opaque private evidence references** only.

Each evidence reference is looked up by an injected *private registry* (not by network or client URL). The four mandatory types are `OWNER_A_PROOF`, `OWNER_B_PROOF`, `OPERATOR_SCOPE` and `SECURITY_REVIEW`. It rejects raw file bytes, external URLs, duplicate/missing proof, cross-Store or cross-Tenant records, unsigned/disallowed MIME, excessive file size, stale scan/review, unsafe/public storage, invalid CDR status and suspicious metadata.

Trusted evidence metadata must include a pinned SHA-256 digest, immutable object version, a passed independent malware scan and a passed content-disarm/sanitization status, plus an independent Ed25519 attestation signature. Signature covers status, visibility, scan/CDR state, exact Tenant/Store, digest, version, MIME, length and expiry, preventing an attacker from upgrading `UNSCANNED` to `CLEAN` by editing registry metadata. Attestor public JWK is obtained exclusively through a trusted, access-controlled registry callback and rechecked before producing a plan. An atomic durable replay callback is required.

**No evidence contents are accepted, fetched, downloaded, uploaded, parsed or exposed in this code.** This is a *review design*, not proof that actual files have been malware scanned/sanitized or that a protected R2/Supabase Storage environment has been created. A future protected object store requires private access policies, no public URL/domain, encrypted retention, review logging that excludes credentials/PII, object-version integrity checks and independent authorization.

The only success result is `PRIVATE_QA_IDENTITY_PROVISIONING_REVIEW_ONLY` with `identityProvisioningApproved=false`, `allowAuthWrites=false`, `allowMembershipWrites=false`, `allowStorageUpload=false`, `allowProviderCalls=false`, `productionReleaseApproved=false` and `HOSTED_NO_GO`. A signed operator setup approval is NEVER authorization to create Auth users, change Store permissions, read business orders or send a provider message.

## 3. Synthetic independent test coverage
- `qa/v171u-private-evidence/private-evidence-intake.test.cjs` exercises real cryptographic operations with **ephemeral, TEST-ONLY** RSA/Ed25519 keys and fake QA owner/Store identity fixtures. Tests cover trusted record and signature acceptance, PII-free result, wrong URLs/file bytes, cross-Store/Tenant, duplicate references, public/signed object metadata, malware/CDR failures, executable mime, oversize record, tampered SHA/version, attestor revocation, replay, missing consent, invalid pinned commit, invalid session/Store. **25 new expected**.
- CI inherits V17.1T 150 cryptographic tests plus 855 earlier source regressions (**1005 inherited**); candidate total **1030/1030** if tests pass independently. The separate disposable PostgreSQL17 same-Tenant Store A/B RLS test uses temporary fixture with full ROLLBACK, **not real Supabase Auth JWT**.
- Real hosted owner/Meta/Zalo/evidence provisioning job deliberately fails closed (NO-GO). A red overall workflow with passing source and PG17 is expected until private proof truly exists.

## 4. BLOCKED — real admission and required authorizations
1. Owner/operator must separately approve creation of **two real disposable QA identities belonging to different Stores under SAME Tenant**, with explicitly scoped membership, backup and rollback plan. Do not alter real merchant Store associations to manufacture evidence.
2. Authenticate two users through genuinely independent protected sessions. Verify JWT signature/issuer/audience/session_id, session liveness and actual Store ownership server-side; never paste JWT or credentials in chat/GitHub/n8n execution data.
3. A qualified operator, independent security reviewer and two verified Store owners must enroll private signing keys and sign exact scope. Do not trust a client `approved:true` or a copied JSON plan.
4. Provision protected private evidence registry/object storage **only after separate deployment/cost approval**, then receive and sanitize actual records through separate authenticated portal. Do not upload documents into GitHub, public R2, Messenger/Zalo or a chat transcript. Implement malware and file-content scanning in a separately managed worker before any real evidence is accepted.
5. Verify Store-level RLS using real JWTs, approved isolated fake QA Commerce rows (A→A allow, A→B deny, B→B allow, B→A deny); do not use SECURITY DEFINER or service_role as substitute for customer-scoped policies.
6. For native Meta/Zalo canary, separately approve QA Page/OA/App ownership and signed raw-body no-send receipt; no actual customer reply authorized.
7. Produce independently signed PII-free review receipt in private system; production remains separately approved after evidence review.

## 5. Change and rollback
Only child Draft GitHub PR source/tests/CI/docs and the read-only aggregate Supabase queries. No Auth user or membership created, no RLS DDL, no n8n edit, no credentials, no private Merchant files, no provider sends, no Commerce writes, no payment actions, no cost approval. Rollback: close child Draft PR. Keep parent PR #318 and Published Messenger/Zalo intact.

Supabase security context: https://supabase.com/docs/guides/auth/sessions and https://supabase.com/docs/guides/storage/security/access-control
