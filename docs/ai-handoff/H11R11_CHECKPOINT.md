# TIEN404 H11R.11 — Independent Caller Attestation × Legacy Store Ownership × Recovery Operator Acceptance
**Date: 2026-11-16 JST · Source-only and disposable PostgreSQL17 · NO hosted mutation**

## Inherited exact checkpoint
- Parent H11R.10 Draft PR #200 HEAD a2cbed8baf8c46a31ef85ffa03e9a10f95f85e57.
- GitHub Actions prior run #43848708874: 2/2 SUCCESS, 36/36 Node metadata tests and disposable PostgreSQL17 compatibility. Do not reuse old PASS to assert this new SHA passed.
- H11R.9 PR #195 separate OPEN DRAFT; RPC.3 PR #186 separate OPEN DRAFT; none merged.

## Direct read-only evidence in this checkpoint
### Hosted legacy-owner slots (no PII or raw Tenant IDs)
| Slot | Active Tenant memberships | Active owner memberships | Products | Orders |
|---|---:|---:|---:|---:|
| tenant_1 | 2 | 2 | 1 | 1 |
| tenant_2 | 1 | 1 | 1 | 1 |
The slots are anonymous ordinals, not merchant identities. Two Owners on one Tenant do not prove two independently owned Stores. Current hosted canonical public.stores/store_memberships=0, inspected core Store IDs=0.
Four legacy Products/Orders in aggregate have no independently proven per-row Store ownership. NO AUTOMATIC BACKFILL.

### Privileged RPC caller inventory
- n8n Named Published: Zalo V1 yIJk8LvJoLF40Z62 (active) executes Zalo V2 Shadow OgDZNSAvKEvhnAvn (active), enabled HTTP POST to public.qa_shop_b_zalo_claim (SECURITY DEFINER, anon EXECUTE). Published and drafts share observed versions at audit time. Execution #2858 manual success only; not provider signature.
- n8n title search: 33 Zalo named workflows / 3 active; 'Supabase' 4 named / 0 active; 'Owner' 18 named / 1 active. Name searches are not full node/caller discovery.
- Supabase Edge: exactly one function ACTIVE named tien404-r1-owner-preflight, verify_jwt=true. A static inspection found no literal named public RPC call; not proof against dynamic calls, internal services or other accounts.
- Supabase log-source availability in explicit 2026-11-15T10:00:00Z to 2026-11-16T10:00:00Z window: 7 PostgREST events among the aggregated sources, but no independently signed RPC invocation/caller absence established. Log count is not authenticated caller evidence.
- Cloudflare one connected account: 23 Worker script metadata entries; one accessible zone (ngoctien20.io.vn) exposes 0 Worker routes in its zone route listing. Pages projects endpoint returned HTTP 400; deployment routing, workers.dev routes, Pages, other accounts, and third parties remain NOT VERIFIED.
- Independent 6-domain complete caller certification: NOT VERIFIED. Exact RPC REVOKE remains NO-GO.

## H11R.11 new source implementation
1. qa/h11r11/private-evidence-intake.cjs and tests:
   - Ed25519 metadata signatures with exact project and source-parent checkpoint, independently enrolled role/key/actor anchors, duplicate key/actor/signature denial, short TTL, nonce replay ledger.
   - CALLER roles CONTROLLER + SECURITY_REVIEWER + CHANNEL_OPERATOR. STORE_OWNER roles MERCHANT_OWNER + SECURITY_REVIEWER + CHANNEL_OPERATOR. RECOVERY roles CONTROLLER + SECURITY_REVIEWER + BACKUP_OPERATOR.
   - CALLER requires six evidence domains. RECOVERY requires six coverage domains, including Auth/ACL/Storage/encryption/restore/retention. STORE_OWNER requires 4 record digests (2 PRODUCT, 2 ORDER), separate Owner/Reviewer/Channel evidence digests, disallows duplicate rows.
   - IMPORTANT: ALL keys, actors and row hashes are runtime SYNTHETIC. A correct signature proves only possession of a test key, NOT legal authority or independent raw observation. Even all-green valid signatures return SIGNED_METADATA_PENDING_EXTERNAL_VALIDATION, with canRevokeRpc, canExportAuth, canApproveStore, canApplyMigration, canMerge, canSendProvider ALL permanently false.
2. qa/h11r11/pg17-disposable-owner-evidence.sql inherits H11R.10 real disposable QA; creates a 4-row synthetic Store claims registry under temporary transaction, tests missing owner claim, wrong-Tenant Store FK, duplicate row assignment, active Owner role acceptance, and revoked Store membership; ROLLBACK.
3. GitHub workflow new job: uses a new ephemeral PostgreSQL17 service only, pg_dump custom archive of synthetic QA schema and pg_restore into another ephemeral database; compares row/price/policy manifest. This verifies *synthetic mechanical restore*, not real Auth/Storage/roles/backup operator qualification or actual independent disaster recovery.

## Evidence that must be supplied outside this PR (PRIVATE)
- CONTROLLER: directly authenticated legal authority for all Tenants and data scope; purpose, lawful basis, retention/erasure, exact one-time operation and expiry. Self-report not sufficient.
- SECURITY_REVIEWER: independently verified identity, separated from author/operator, enrolled keys, immutable private review of exact contents/hashes, recorded denial/approval and conflict-of-interest check.
- BACKUP_OPERATOR: authorized least-privilege service access, encrypted OFFSITE destination and separate key custody, validated manifest with Auth/roles/ACL/Storage/external assets, realistic RPO/RTO drill and restore receipt.
- MERCHANT_OWNER / CHANNEL_OPERATOR: independently verified actual Store and Page/OA ownership, real-provider signed webhook provenance, exact channel/tenant/store mapping. Four row hashes must be matched against a privately controlled snapshot before any application or migration.
- All six external caller domains: authenticated real request observation (redacted in public), discovered dynamic routes/external clients/manual operators and documented unknowns.
- Consent documents and raw data must never be put in public GitHub, ChatGPT chat or CI logs.

## Decision
H11R11_SIGNED_SYNTHETIC_EVIDENCE_QA is TESTABLE ONLY. REAL_CONTROLLER=NOT VERIFIED; REAL_MERCHANT_OWNER=NOT VERIFIED; REAL_INDEPENDENT_REVIEWER=NOT VERIFIED; REAL_BACKUP_OPERATOR=NOT ACCEPTED; REAL_PROVIDER_CALLER=NOT VERIFIED; FULL_RECOVERY=NOT CERTIFIED.
RPC_REVOKE=NO-GO; AUTH_EXPORT=NOT AUTHORIZED; HOSTED_STORE_MIGRATION=NO-GO; PROVIDER_SEND=NO-GO; PRODUCTION=NO-GO.

Do not treat CI as approval. Closing Draft PR rolls back source-only changes, leaves hosted untouched.
