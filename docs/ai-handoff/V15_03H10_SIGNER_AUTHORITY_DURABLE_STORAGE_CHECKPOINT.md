# TIEN404 AI — V15.0-03H.10
## Independent Signer Authority Gate × Durable External Storage Idempotency Review

**Checkpoint: 16 November 2026 JST**  
**Mode:** OPEN DRAFT / SOURCE-ONLY / DISPOSABLE PostgreSQL 17 / NO SEND / NO HOSTED BACKUP / NO MIGRATION / NO MERGE

### 1. Evidence and inheritance
- Child of **V15.0-03H.9 PR #160** at exact HEAD \`56c93b77a91ff2d39e808cacb8c1e117bc7e2bfd\`. Existing H.8 #153, H.7 #149, H.6 #141, V15.0-09D #135 and Store migration #133 remain independent/unmerged.
- Supabase connected read-only check: project \`ifxlvrhyjhbzbrkdsida\`, 3 Auth users, 2 Tenants, 3 active Tenant memberships, 2 Products, 2 Orders, 0 Storage buckets; no \`public.stores\` or \`public.store_memberships\`.
- User-provided Supabase screenshot on 16 November shows **Owner role in the project UI**. The project name is \`tien404-staging\`, yet the Dashboard labels the primary branch **Production**. This provides **USER_SUPPLIED_UI_OWNER_ROLE_OBSERVED**, not independently authenticated human identity, a certified organization Data Controller or rights to multi-tenant export. Do not copy user email, screenshot, ID or private proofs into public GitHub.
- Supabase Free does not guarantee managed automatic daily backups. Official docs: https://supabase.com/docs/guides/platform/backups and https://supabase.com/docs/reference/cli/supabase-db-dump. A default CLI dump excludes database rows/custom roles and filters managed Auth/Storage schemas. Full-scope recovery is not certified.

### 2. Independent Signer Authority Gate — source contract only
\`qa/v1503h10-durable-idempotency/independent-authority-gate.cjs\` validates a **synthetic untrusted packet**:
- Project and environment exactly staging ref \`ifxlvrhyjhbzbrkdsida\`; purpose review one-time logical-export proposal only, bounded expiry and zero additional cost.
- Three **distinct role and principal claims**: Platform Data Controller, independent Security Reviewer, and Backup Operator. Controller/Security signer key fingerprints cannot overlap; Backup Operator must not be a signing approver. A fourth independent witness ID cannot equal a signer ID.
- Private identity checks, key possession, independent Controller/Security approval, operator authority, vault access and durable trust/approval ledger remain explicitly **PENDING / NOT SUBMITTED / NOT DEPLOYED**.
- Rejects self-declared real approval, screenshot promoted to independent identity, revoked/expired/duplicate signer, cross-project/production, unauthorized fees and leaked passwords/keys/tokens/PII.
- Even a valid packet returns \`SYNTHETIC_AUTHORITY_PACKET_CONSISTENT_NOT_AUTHORIZED\`, with **ALL real-action permissions false**. No connected identity provider, MFA, cryptographic key service or protected registry is used. An in-memory fingerprint is NOT an independently attested public key.

### 3. Durable external storage idempotency — disposable PG17 simulation
\`qa/v1503h10-durable-idempotency/ephemeral-pg17-conditional-object.sql\`:
- Runs **only** if \`current_database()='tien404_h10_ephemeral'\`. Creates private mock storage schema with RLS + FORCE, no PUBLIC schema/table/function grants, SECURITY INVOKER functions. PostgreSQL CI owner is privileged; this is not proof of hardened application-role isolation.
- Tables \`approvals\` (one immutable operation + request hash + nonce + expected mock object key, worker, fence, expiring lease, state) and \`objects\` (unique key and operation, payload digest, declared size, provisional/sealed metadata only).
- \`conditional_put\` serializes on the approval row and implements **insert if absent** with \`ON CONFLICT DO NOTHING\`. Exactly one concurrent caller may create a metadata receipt; identical attempts return **NO_WRITE**, changed content enters **NEEDS_REVIEW**; no overwriting an existing receipt.
- \`seal_once\` requires matching worker/fence and live lease and can only change \`provisional → sealed\` once. A later separate connection can read the sealed manifest after a lost ACK, but cannot reupload/reseal.
- Expired, revoked and crashed approvals fail closed. \`mark_uncertain\` quarantines expired leases. A provisional mock object may remain; it cannot automatically be resumed or deleted.
- **No data bytes, archive, actual object store, encrypted vault, backup client, real signers or Supabase hosted SQL**. PostgreSQL fixture simulates durability across separate client connections only; no actual external object durability under node crashes, multi-region partitions or disk loss is proven.

### 4. Actual design gate for a future real executor — NOT IMPLEMENTED
1. Independent private out-of-band **human identity** and organizational Data Controller authority proof. A Shop Owner cannot authorize exporting other tenants. Verify Security Reviewer and Backup Operator separately; preserve revocation and key/version attestations.
2. Real trusted signer registry and server-side canonical scope signature with project+environment, operation, data scope, signed digest, nonce, retention, cost, recipient/destination class, expiry. Verify both approval signatures and real operator identity at every admission. Never accept client/LLM Boolean flags or uploaded screenshot as authorization.
3. Dedicated protected and auditable **persistent issuer ledger**, lease fencing and crash recovery, restricted privileges inaccessible to \`anon\`/\`authenticated\`, limited operator credentials, no public secret/key disclosure.
4. Real storage **atomic conditional create**/compare-and-swap or equivalent with immutable object key, versioning, encryption, private destination, checksum and retention policies. Independent restore and audit determine recovery completeness. Validate source schema/data/Auth/roles/RLS/Storage and external dependencies.
5. A robust reserve → provisional object → confirm checksum/custody → seal → read-back reconciliation process. After uncertain/partial writes, **manual review and a newly scoped authorization** are required; no automatic second export. Hardware/signer revocation, lease fencing and external side-effect cancellation must be threat-reviewed.
6. Real cost/destination approval and separate explicit **one-time hosted staging backup export** authorization are required. Restore is an independent permission. No real export can run through this source-only PR.

### 5. Acceptance gates
| Area | Status |
|---|---|
| H10 offline authority shape/negative tests | QA SOURCE ONLY |
| H10 disposable PG17 conditional-create idempotency | QA DISPOSABLE ONLY |
| H10 8 concurrent requests, 1 create / 7 no-ops | QA DISPOSABLE ONLY |
| Independent Owner/Controller real verified identity and provider consent | BLOCKED |
| Real independent Security Reviewer + Operator authority | BLOCKED |
| Trusted privately hosted signer/approval ledger and credential custody | NOT DEPLOYED |
| Actual offsite encrypted external storage and create-if-absent | NOT DEPLOYED |
| Hosted Free backup, artifact fingerprint and isolated restore | NOT AUTHORIZED / NOT TESTED |
| Canonical Store/StoreMembership & signed JWT Store A/B/C | BLOCKED |
| Hosted migration/production/Sales Lite customer pilot | NO-GO |

### 6. QA, deployment and rollback
- Workflow \`.github/workflows/v1503h10-authority-durable-storage-no-send.yml\` runs Node22 H10 + inherited H9–H6 tests, PG17 fixture, 8 parallel independent client connections and lost-ACK mock-seal recovery.
- This PR is **DRAFT** and contains only additive source/docs/CI. No connected Supabase hosted DDL/DML/RLS/GRANT/RPC/Auth, no credential reads/rotation, backup/restore, customer orders/stock, n8n Published edit, Meta/Zalo send, Cloudflare deploy, paid resource or production merge.
- Rollback: close H10 child Draft PR; prior PRs and all hosted services untouched.

**Next permission decision:** Private signer authenticity/role, scope, vault and operator approvals must be independently established in an approved private system. H10 never provides the legal/technical authority for a real database export.
