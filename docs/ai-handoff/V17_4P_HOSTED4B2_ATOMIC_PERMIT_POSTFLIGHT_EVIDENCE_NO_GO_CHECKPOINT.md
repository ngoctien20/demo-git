# TIEN404 AI — V17.4P-HOSTED.4B.2
## Atomic One-Use Permit × Inventory Race Check × Inactive Worker Postflight Acceptance

**Date:** 2026-11-17 JST  
**Status:** IMPLEMENTED SOURCE-ONLY; Local QA pending. Hosted changes forbidden.  
**Parent:** [Draft PR #289](https://github.com/ngoctien20/demo-git/pull/289) exact source HEAD `763d215450c2908875f3f5860292d0a9bb872170`, 317/317 local/source tests PASS.

### 1. Fresh, read-only Cloudflare control plane
At **2026-11-17T09:48:47Z** Cloudflare API GETs returned:
- **28/28** Worker entities using explicit page=1/per_page=100, **28** Worker scripts;
- **2** Durable Object namespaces already owned by other V17.5E.2/E.2A workstreams; **no** V17.4P namespace;
- **1** Pages-related Access application, **0** reusable Access policies; **1** unrelated Worker domain;
- Proposed `tien404-v174p-private-qa-issuer` remains **ABSENT**.
No Cloudflare resource was created, deployed, updated, deleted or billed by this work. This is a point-in-time inventory, **not** an ongoing reservation.

### 2. P1 in V17.4P-HOSTED.4B.1: nonce was not actually consumed
The parent validation requires `nonce_uniqueness_verified_by_durable_private_ledger:true` in a supplied evidence object. This Boolean by itself does **not** prove an atomic durable reservation. Two independent operator processes might both see an unclaimed permit and attempt the same upload.

**New** `qa/v174p-private-hosted/hosted4b2-atomic-permit-and-postflight.mjs` adds:
- First rechecks the prior **full** signed-permit cryptographic/manifest/inventory gate; blocked permits never call the ledger.
- Calls a separately operated **trusted durable ledger** `claimOnce` interface with hashes of nonce and permit; only `claimed:true` plus **durable-commit-confirmed receipt** is accepted. No raw JWT, private signing key or personal email is written in claim metadata.
- Refreshes independent Cloudflare inventory **after** successful claim and refuses any target/script/DO/Access drift or incomplete/stale (over 60s) evidence.
- On an uncertain claim or failure to refresh, the signed permit is **consumed / cannot be retried**; recovery requires owner and security review and a **new permit**.
- Always returns `can_upload:false`, `can_deploy:false`, `can_change_access:false`, `can_run_cloudflare_uat:false`. Review code cannot execute a deployment or grant owner authority.

`hosted4b2-dedicated-private-ledger.reference.sql` contains **fully commented out** suggested PostgreSQL DDL, with a nonce PRIMARY KEY and UNIQUE(account_id,worker_name,phase) for **first upload only**. This prevents both reuse of the same nonce and two different first-upload permits for the same Worker if and only if executed by an independently controlled, properly privileged private ledger. **Never execute against real Commerce or customer Supabase.** No SQL was applied.

### 3. Independent AFTER-upload evidence template, not hosted QA
The new `assessInactiveCloudflareChangeSet` strictly compares **complete raw** pre/post inventories after a hypothetical future approved upload. Allowed delta:
- Exactly one new Worker entity and script with the exact dedicated V17.4P name and new 32-hex Worker ID.
- Exactly one new SQLite Durable Object namespace `tien404-v174p-private-qa-issuer_V174PReplayGuard`, class `V174PReplayGuard`, owned by that dedicated Worker, new unique namespace ID.
- **No** modification, deletion, rename or replacement of existing V17.5 namespaces, Workers, Access apps or policies, or Worker domains.
- Separately collected Worker configuration evidence must confirm **no workers.dev, preview, route, cron, queue consumer or other public binding**.
- Trustworthy GET provenance/role attestation is mandatory; a fabricated test snapshot is not independent real evidence.

The comparator never calls Cloudflare. A locally passing comparator does not mean a real Worker exists.

### 4. QA and security limitations
- Synthetic test ledger uses in-memory atomic `Set` **only for unit tests**, NOT viable across distributed operators or restarts. The suite also tests two differently signed nonces targeting the same first-upload Worker: exactly one wins. Production ledger needs a real dedicated database and nonrepudiable operator identity service, with mandatory private review and approval before provisioning.
- Atomic nonce and target collision check avoids repeated permits within that ledger; it **does not solve all Cloudflare time-of-check/time-of-use races** against other actors who do not use this ledger. Cloudflare account RBAC and a single scoped deployment operator remain required.
- A document containing strings `claimed:true` or `registered_out_of_band:true` can be fabricated. A separate trusted service must independently attest its durable commit and operator identity; no such service has been provisioned or verified in this conversation.
- No irreversible deletion; a future QA namespace rollback requires separate owner authorization.
- Private trust anchors/real identities/signing keys are **not** in GitHub; 2-of-2 real signatures and budget USD still MISSING.

### 5. Rollback and next gate
Rollback source-only: close/revert the child Draft PR, parent PR #289 and all hosted Cloudflare remain untouched.
Next **BLOCKED** host stage still requires signed exact-scope owner/security/finance approval, real private operator and rollback identity, a separately approved dedicated durable permit ledger, positive USD budget and correct Cloudflare RBAC. Only then can an operator perform **inactive upload** (no public route), validate postflight evidence and separately seek Access/UAT authorization.

Cloudflare spending limits apply at account scope, can interrupt unrelated Workers, and are not a hard invoice cap; Durable Object stored data charges may continue beyond usage caps. Never adjust shared account spending limits here.

### 6. Source documentation
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/workers/platform/spend-management/
- https://developers.cloudflare.com/durable-objects/platform/spend-management/
- https://developers.cloudflare.com/workers/wrangler/commands/general/#versions-upload
