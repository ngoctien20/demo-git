# TIEN404 AI — V18.3.6F

**Protected Store Membership Administration × Last-Owner Invariant × Trusted Gateway Service-Role Bypass Negative QA**

**Status:** `CANDIDATE — DISPOSABLE PG17 / NO STAGING DDL / NO LIVE AUTH`

## Scope

This is an isolated, synthetic PostgreSQL 17.12 continuation of V18.3.6E. It does not connect to Supabase staging, real Auth accounts, Messenger, Zalo, website customers, credentials or customer databases.

Files:
- `01_MEMBERSHIP_ADMIN.sql`: Store create/activate, per-Store invite/accept/revoke, Tenant Owner vs Store Owner vs Manager separation, last-active-Owner database guard, immutable membership scope, private membership audit.
- `02_GATEWAY_BYPASS_GUARD.sql`: dedicated simulated BYPASSRLS executor with narrow SQL grants, no direct database grants to gateway caller, private verified-installation fixtures, short-lived single-use receipt and exact Store+order+capability binding.
- `03_PGTAP_ADMIN_GATEWAY.sql`: **87 pgTAP assertions** covering authorized and unauthorized administrative operations and a broad negative gateway matrix.
- `.github/workflows/tien404-v1836f-membership-gateway.yml`: runs E 61/61 regression on a clean database, drops and recreates it, runs F, and attempts real PostgreSQL concurrency tests for last-Owner revocation and receipt replay.

## Intended security invariants

1. **Tenant Owner controls Store lifecycle and Store Owner grants.** A Store Owner can invite/revoke only Manager/Staff within their Store; Manager and Staff cannot administer membership.
2. An invitation is not an active membership. The target must accept the fresh invitation; revoked membership requires a new invitation and acceptance.
3. Store activation is refused until a Store Owner has accepted and is active.
4. Removing/demoting the final active Store Owner of an active Store is blocked by a database trigger, including when the SQL caller has elevated privileges. Store-level row locking serializes competing revocations.
5. Tenant/Store/user identity of a membership is immutable.
6. A simulated privileged executor has `BYPASSRLS` and narrowly scoped SQL grants. The gateway runtime has **no direct access to the underlying Orders, Stores or proof tables**, and can only execute the guarded operation.
7. The privileged function checks server-attested receipt state, exact Store+order+installation, capability, audience, owner consent, expiry, single-use replay status, verified provider installation and allowed order status transition. An invalid proof is denied.
8. Receipt consumption uses `SELECT ... FOR UPDATE`. CI will test simultaneous requests to the same receipt, expecting exactly one allow and one replay denial.
9. CI will also attempt to revoke two Store Owners concurrently, expecting exactly one success and one rejection; at least one active Owner must remain.

## Important limits and assumptions

- **No real authentication proof:** `auth.uid()` is a synthetic mock using `request.jwt.claim.sub`, which local SQL clients can set. Real signatures, issuer, audience, expiration, session revocation and owner consent are NOT verified by this test.
- **The receipt is not a real cryptographic signature.** Its `server_verified` and `owner_consented` fields are fixtures inserted by trusted test setup. Production must have a separately validated private issuer and cryptographic/audit proof before allowing any request.
- The simulated executor demonstrates the danger of a BYPASSRLS principal: it can read the entire Orders table, including cross-Store and unmapped legacy rows, if it has raw SQL privileges. The only safe exposed surface is the narrow gateway method. This is a test contract, not proof the real production service-role key is safe.
- Administrative functions run as a privileged SECURITY DEFINER in a disposable database and use a mocked actor identity. They require least-privilege ownership, search-path/grant audits, real identity verification and independent security review before production.
- No real provider installation, provider permission, Meta/Zalo token, customer PII, payment, order delivery or production channel write was involved.
- The gateway `WRITE_CONFIRM` action changes only synthetic order status. It is **not** an approved atomic Order Commit, inventory reservation, billing, notification outbox or real production writer.
- The Last Owner guard protects row transitions and tested transaction concurrency; it does not prove disaster recovery, superuser-trigger disable protections or real account lifecycle integration.
- E's synthetic table grant model is retained to run its 61 regression tests; real Commerce writes should use narrow transactional commands and a protected issuer.

## Release gates

This PR **must remain DRAFT**. Do not merge as an authority promotion. No Supabase staging DDL, real Store binding, migration, legacy backfill, provider send, credential changes, wallet/billing or production deployment.

For any future real UAT, separately require two signed Auth sessions, owner approvals, scoped installation proof, independent security review, backup/PITR and a verified rollback.
