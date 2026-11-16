# V15.0-09B — PRIVATE Merchant Ownership Evidence Intake
Status: TEMPLATE / NOT CERTIFIED / NO REAL IDENTIFIERS OR SECRETS IN PUBLIC GITHUB

## Rule
The 4-row chain MUST be verified using independently authenticated hosted records and a server-side Store resolver, not string keys from synthetic QA fixtures.
Do not paste real auth.user IDs, PSIDs, Zalo IDs, phone, email, pairing codes, Bot Tokens, JWTs, Service Role Keys or screenshot PII into GitHub PR, Actions logs, this file or public Checkpoint.
Store sensitive evidence in an approved private owner-only evidence vault with retention, auditor, access log and redacted receipt hash.

## Minimum 4-row proof — per proposed Store A/B/C
1. auth.users: server-verified authenticated user UUID, active session status, Auth provider, verification timestamp; consent to associating this identity with merchant.
2. public.tenant_memberships: same user + tenant; role owner/manager and active; independent owner assignment approval.
3. public.stores: canonical UUID Store belonging to same Tenant; ACTIVE/PAUSED lifecycle, address/business details only when necessary and owner-authorized. **Currently absent in hosted**: cannot claim this row exists.
4. public.store_memberships: exact Tenant+Store+user, active and explicit role; never inherit owner of all Stores from Tenant alone. **Currently absent in hosted**.

Separate fifth independent proof:
5. Provider bot/page account ownership and consent for exact Provider+Environment+Account+Bot+Store, evidence issued by verified provider method. Track issued_at, expires_at, revocation, evidence digest and approval actor. In prior QA: owner_bindings=2 'paired'; claims_v3 3 'CONFIRMED', 1 pending; these are SYNTHETIC receipts only, NOT trusted live G2.3 certification.

## Public-safe receipt structure (sample schema, no real values)
- evidence_reference: randomized identifier/sha256 receipt (no raw user IDs)
- version: V15.0-09B
- environment: qa_only | private_staging
- tenant_evidence_verified: false
- store_evidence_verified: false
- membership_evidence_verified: false
- real_authenticated_owner_session_verified: false
- provider_ownership_consent_verified: false
- backup_restoration_rehearsed: false
- signed_by_owner: false
- signed_by_security_reviewer: false
- issued_at: null
- expires_at: null
- private_evidence_location: null (do not publish even storage links without authorization)
- authorization_to_migrate: false
- authorization_to_send: false

## Approval checkpoints
- [ ] Identify owner of each actual QA Store without deriving them from client text or PSID.
- [ ] Confirm independent correct Tenant/Store/Owner pairing; owner must explicitly approve association.
- [ ] Confirm A and B same-Tenant test design AND C separate-Tenant scenario with no accidental privileges.
- [ ] Attach independent provider-side consent proof to private controlled access location.
- [ ] Reconcile old Products=2 / Orders=2 with explicitly approved Store, no automatic default Store or data mutation.
- [ ] Verify backup archive, restore rehearsal, complete rollback feasibility and migration isolation.
- [ ] Record signed owner and security approvals for staging schema test, distinct from production release.
- [ ] If any evidence is missing, state BLOCKED and do not infer a successful hosted Store certification.

## Existing confirmed evidence — 16/11/2026 JST read-only
auth.users=3; tenants=2; tenant_memberships active=3.
QA tenant_identity_map=2 rows and both map to existing Tenant IDs.
QA owner_bindings=2 status 'paired'.
QA owner_pairing_claims_v3=3 status 'CONFIRMED' and 1 'PENDING_OWNER_CONFIRMATION'.
public.stores and public.store_memberships DO NOT EXIST.
Hence the 4-row real hosted Owner→Store proof is structurally impossible at current schema.
No real customer/provider verification, migrations, GRANT/RLS or live sends performed by this checkpoint.

## Disposition
- VERIFIED: aggregate hosted structural facts and synthetic QA pairing statuses.
- IMPLEMENTED: this private intake checklist and source-only decision tester.
- NOT VERIFIED: owner authorization, independent provider proof and Store-level JWT/RLS on hosted.
- PRODUCTION GATE: NO-GO.
