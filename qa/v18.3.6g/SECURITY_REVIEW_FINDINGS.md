# TIEN404 AI — V18.3.6G Security Review Findings

**Classification:** SECOND-PASS AUTOMATED SECURITY REVIEW; NOT AN INDEPENDENT HUMAN AUDIT.  
**Base:** V18.3.6F PR #425, head daee41076c02d16c7ff902db600a407e8e44f429.  
**Date:** 2026-11-18 JST. **Scope:** PostgreSQL 17 disposable SQL, grant model, membership, BYPASSRLS gateway and proposed Ed25519 read-only issuer.

## Source and live audit

- V18.3.6F final CI: 61/61 E regression, 87/87 F pgTAP, concurrent last-Owner protection and nonce single-use PASS.
- Current read-only Supabase staging: PG17.11; zero canonical Store tables, Store columns and restrictive public policies; three active tenant memberships; two Products and two Orders.
- No actual Auth JWT/session, provider consent or merchant secrets were inspected.

## Findings

| ID | Priority | Finding | Remediation and status |
|---|---|---|---|
| G01 | P0 | F `auth.uid()` is populated by synthetic SQL GUC `request.jwt.claim.sub` | Real session signature, issuer, audience, expiry and revocation verification required; BLOCKED |
| G02 | P0 | F `tien404_f_executor` uses `BYPASSRLS` and raw SELECT can see Store A/B/legacy | Production gateway must never expose direct SQL or service role; BLOCKED |
| G03 | P0 | F `server_verified` and `owner_consented` are Boolean fixture columns | Not cryptographic signatures, owner consent or provider scope proof; BLOCKED |
| G04 | P0 | Staging lacks `stores`, `store_memberships` and six Store columns | Real same-Tenant Store A/B is unavailable; BLOCKED |
| G05 | P1 | F SECURITY DEFINER administrative functions have privileged fixture ownership | Dedicate minimal function owner, restricted schema, explicit ACL; BLOCKED |
| G06 | P1 | F invites self-populate `approved_by=actor` | Independent approval/receipt and acceptance flow still needed; BLOCKED |
| G07 | P1 | Store activation trigger in F protects UPDATE but not direct privileged INSERT as active | Require default provisioning + INSERT guard and transaction-final-owner check; BLOCKED |
| G08 | P1 | F receipt nonce is tested locally, not backed by durable issuer | Need shared atomic idempotency/nonce store; PROPOSED |
| G09 | P1 | Signed JWT verification alone does not ensure instantaneous session revocation | Protected server must re-check active session, not trust stale JWT claims; BLOCKED |
| G10 | P1 | Provider installation ownership, actual scopes and media consent not proven | Verify provider origin and exact Store installation separately; BLOCKED |
| G11 | P1 | F synthetic WRITE_CONFIRM is not atomic Commerce writer | Order/stock/outbox/notification still require independent approval; BLOCKED |
| G12 | P2 | Disposable Docker image/pgTAP packages not pinned by digest/lock | Supply-chain pinning needed before protected runner use; PROPOSED |
| G13 | P1 | G issuer delegates Supabase Auth validation to injected trusted server adapter | Never accept a request-supplied callback or Boolean as verification; CANDIDATE |
| G14 | P1 | G Ed25519 private keys are ephemeral CI fixtures | Real issuer requires HSM/key-service ACL, rotation, revocation and audit; CANDIDATE |
| G15 | P1 | G evidence checklist accepts only redacted metadata, not underlying proofs | Even complete checklist returns READY_FOR_PRIVATE_REVIEW, never ADMITTED; PROPOSED |
| G16 | P0 | No independent human reviewer has approved this security architecture | Human independent review and signed decision are REQUIRED; BLOCKED |

## What the G offline code does

- Uses actual Ed25519 signature operations, pinned public keys, explicit authority JWT type and exact algorithm allowlist.
- Binds token to issuer, audience, capability, Tenant, Store, session HMAC fingerprint, membership revision, issue/expiry, random JTI.
- Revalidates server-provided session and canonical membership on redemption.
- Requires an injected durable and atomic nonce-consuming interface. Synthetic CI uses in-memory Set only to test behavior.
- Only `CATALOG_READ` and `ORDER_READ`; zero live write or provider send.
- Rejects algorithm/key/type confusion, forged Store/capability, stale membership, revoked session, replay and expiry.
- Does not provide a production HTTP endpoint or a real Supabase adapter.

## Reviewer evidence required

Independent reviewer identity, scope, approved code hashes, review time, expiry/revocation path, evidence digest and explicit P0 closure. No credential, user ID, JWT, contact details or token may be added to GitHub.

**Decision:** Independent human review BLOCKED. Real Auth A/B BLOCKED. Staging DDL / Commerce writer / provider send / release NO-GO.

References: [RFC 8725](https://www.rfc-editor.org/rfc/rfc8725), [Supabase Auth sessions](https://supabase.com/docs/guides/auth/sessions), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
