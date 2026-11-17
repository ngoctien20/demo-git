# TIEN404 AI — RPC17.8C Existing Owner Pairing Security Audit & Backup/Restore Admission

2026-11-17 JST · VERIFIED READ-ONLY SUPABASE CODE REVIEW · SOURCE ONLY · NO MIGRATION

## Baseline
- Parent RPC17.8B Draft PR #362 HEAD `1c49fcde4b8aece2ddf0f0a3722c342e146e9787`, CI 537/537 source tests and PG17 disposable restore rehearsal PASS.
- Supabase staging `ifxlvrhyjhbzbrkdsida` ACTIVE_HEALTHY. No development branches at audit; `rpc178_qa` and canonical public Store memberships still not previously provisioned.
- Prior migration list includes `qa_private_owner_challenge_issuer`, `qa_owner_pairing_dashboard_two_shops`, `v12_3_shop_b_private_session_qa`, `v175e2b_private_auth_customer_binding_intake_no_grants`. These are existing staging mechanisms; do not overwrite them.

## Directly verified Owner function contract

### `public.qa_owner_pairing`
- SECURITY DEFINER, PostgreSQL owner `postgres`, `search_path` pinned empty, EXECUTE for `authenticated`, not `anon`.
- Joins private `tenant_identity_map`, `shop_bots`, public `tenant_memberships`; checks `tm.user_id=auth.uid()`, owner role, active membership, hard-coded QA bot set, `dry_run`, `synthetic_qa`.
- Issue action creates a time-bound challenge, returning a challenge code to an authenticated owner. Status/confirm path ties requester_user_id to `auth.uid()`, claim status, short expiry and failed attempt count; cannot alone prove real Zalo account control or real Store authority.
- This is a **QA Owner Pairing path**, not a canonical Store Membership registry.

### `public.qa_shop_b_zalo_claim`
- SECURITY DEFINER, PostgreSQL owner `postgres`, empty search_path, EXECUTE for `anon`, not `authenticated`.
- Reads a private Vault gate by secret name, compares supplied `x-tien404-pairing` request header digest to the gate digest, validates challenge/code/sender/event shape and calls `tien404_r1_qa.claim_owner_pairing_v3_synthetic` scoped to Shop B QA.
- The header gate is a **shared-secret ingress control**, NOT native Zalo webhook HMAC/origin signature validation. Trust in upstream verified ingress is **UNVERIFIED** from this SQL definition alone; check provider adapter, signed body, timestamp/replay ledger, and leak protection separately.
- No exploit was performed or confirmed. No function execution or secret read (Vault contents not accessed).

### Underlying internal routines
- `tien404_r1_qa.claim_owner_pairing_v3_synthetic` uses code digest comparison, challenge expiry, failed_attempts, row lock and insert-on-conflict for replay resistance; no direct anon/authenticated EXECUTE according to inspected grants.
- `confirm_owner_pairing_v3_qa` checks pending claim, `auth.uid()`, requester, expiry, and writes a time-bounded QA owner binding. No direct anon/authenticated EXECUTE grants observed.
- `owner_authorized_qa` accepts only authenticated role + mapped active Tenant owner + dry_run synthetic bots. Auth claims are not treated as canonical real Store ownership.
- Never silently promote `tien404_r1_qa.owner_bindings` or `tenant_identity_map` into real merchant authorization.

## Supabase Security Advisor read-only result
- The security advisor reports RLS-enabled-with-no-policy entries for multiple private schemas including `tien404_r1_qa`. This is an INFO lint: closed private tables without grants/policies are often deliberate. Not evidence of a security breach. Actual ACLs and SECURITY DEFINER behavior require separate review.

## Backup/restore evidence
- We can verify RPC17.8B's disposable GitHub PostgreSQL 17 pg_dump/restore test, **not** Supabase staging backup existence or successful restore. The currently available Supabase connector has no dedicated database backup inventory/restore rehearsal endpoint; `restore_project` is not a database snapshot restore facility.
- No staging backup identifier, timestamp, checksum, storage inventory, isolated restore runtime, integrity comparison, or independent signed acceptance was obtained. Therefore **BACKUP/RESTORE NOT VERIFIED**.
- Never use GitHub disposable test data as evidence of recoverability of real staging.

## RPC17.8C implementation
- Source-only `qa/v152-rpc178c/owner-contract-audit.mjs` enforces expected QA grants/guard patterns and explicitly requires independent provider signature acceptance; always NO-GO.
- `qa/v152-rpc178c/staging-recovery-gate.mjs` requires 14 independently verified real backup/restoration/owner/reviewer checks and refuses CI synthetic restore as live proof; always NO-GO even with toggled checklist fields.
- Negative unit tests and inherited RPC13–RPC17.8B source QA. No source files capture Vault secret, user info or live JWT.

## Release and permission gate
- DO NOT change existing functions/ACLs, Vault, webhook, Supabase Auth, migrations, Cloudflare Access, products/orders or customer data.
- A future approved `rpc178_qa` DDL requires signed exact SHA256, verified owner/auth, independent security review, actual staging-compatible isolated restore, no-new-cost consent, and rollback decision. Then distinct real Auth A/B sessions and privately isolated RLS can be evaluated without sending messages.
- Source rollback: close Draft PR; there are no hosted resources to delete.

**DECISION: REAL OWNER AUTHORITY NOT VERIFIED · STAGING BACKUP/RESTORE NOT VERIFIED · STAGING DDL NO-GO · REAL JWT A/B NO-GO.**
