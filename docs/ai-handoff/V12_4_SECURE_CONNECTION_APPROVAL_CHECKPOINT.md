# TIEN404 AI V12.4 — Secure Connection Authorization Checkpoint

Checkpoint: 15/11/2026 JST. Scope: staging Shop B only. Status: PARTIALLY IMPLEMENTED / BLOCKED BY BACKUP GATE.

## 1. VERIFIED

- Supabase project tien404-staging, ref ifxlvrhyjhbzbrkdsida; PostgreSQL 17.11; organization plan free, tier_free.
- Official Supabase backup policy (2026): Free plan does not include automatic daily database backups. See https://supabase.com/docs/guides/platform/backups and https://supabase.com/kb/faqs/platform/free-plan-backups.
- Full database backup / external restore proof NOT FOUND through available connectors and current browser tabs. Existing V12.3 scoped rollback checkpoint is NOT a full backup.
- Current private session tables: 0 sessions and 0 receipts. Shop B sandbox: 2 Orders, 2 HELD outbox, F01 price 199000 VND and stock 5; 0 non-HELD outbox.
- Both session and receipt tables have RLS enabled; anon, authenticated, service_role have no private schema/table grants. Fresh actual SQL tests with SET LOCAL ROLE anon and authenticated returned 42501 permission denied.
- n8n V1 protected webhook yIJk8LvJoLF40Z62 published version 8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e; Shadow OgDZNSAvKEvhnAvn version f00ba506-c52a-4340-9a0c-809fd9c6ea9a, both active. A different Zalo customer-route workstream has legitimately advanced V1: not overwritten.
- Cloudflare diagnostic-only Zalo Gateway version ef7b7a33-5551-48e0-954b-646c047b5c6d, ZALO_SEND_ENABLED=false.

## 2. IMPLEMENTED (GitHub Draft PR #41)

- qa/zalo/v124-ephemeral-pg-concurrency.sh: real two-process psql locking and simultaneous duplicate receipt QA against an isolated throwaway PostgreSQL 17 container. Does not reference or contain Supabase credentials.
- .github/workflows/v12-shop-b-dialogue-qa.yml: new independent isolated-postgres-qa job; still executes 148 no-send dialogue/security unit tests; syntax/negative-mode checks backup helper.
- qa/zalo/v124-manual-encrypted-backup.sh: staging-host-locked manual full logical dump, encrypted with age before disk; verifies encrypted archive table of contents. Requires private PG credentials, recipient and identity managed outside ChatGPT/GitHub; script NOT EXECUTED against staging.
- docs/ai-handoff/V12_4_BACKUP_SECRET_PROVISIONING_GATE.md: verified Free-tier backup policy, offline restore rehearsal requirement and planned least-privilege session credentials/HMAC design.
- NO PostgreSQL role or password created, no HMAC secret created, no grants added, no Edge Function or n8n credential altered, no published workflow changes and no Orders write.

## 3. TESTED — Evidence

- GitHub Actions run 43612747401, job 132501135466, PostgreSQL 17 EPHEMERAL ONLY:
  - Two independent backend connections, FOR UPDATE row-lock actual contention: waiter 6.936 seconds, PASS.
  - Two independent backend connections racing to write the same unique event receipt: waiter 6.927 seconds, only one stored receipt, PASS.
  - No actual Supabase staging DB credentials used. This tests PostgreSQL transaction semantics, not Supabase schema privileges.
- GitHub Actions job 132501135123: 148/148 Node conversation, Owner resolver, session service and mock-PG tests PASS.
- Latest GitHub run 43613147187: both dialogue-policy and isolated-postgres-qa jobs completed successfully after manual backup helper was added and checked.
- Fresh Supabase real SQL authorization tests: anon and authenticated direct SELECT on private shop_b_sessions DENIED (SQLSTATE 42501); no data changes.
- Supabase post-check: 0 private session/receipt rows; 2 sandbox Shop B Orders; 2 outbox (HELD), F01 199000 VND / stock 5.

## 4. BLOCKED

- GATE P0: No independently verifiable full encrypted manual backup plus restore rehearsal of Supabase Free plan staging. User authorized secure credential provisioning AFTER this precondition; not authorized to bypass it.
- Accordingly no dedicated PostgreSQL login/secret and no internal HMAC key have been provisioned.
- Real two-connection contention on actual Supabase staging with a least-privilege backend identity, RLS grants and persistent multi-turn session integration remain UNTESTED.
- Outbound Zalo remains disabled; sandbox order commit from chat remains disabled.

## 5. RISKS / APPROVAL

- Database credentials must never be pasted into ChatGPT or GitHub. Encrypted backup must be stored offsite under Owner control, with private age identity separate.
- Granting broad service_role/table privileges or a generic SECURITY DEFINER function to work around private RLS is forbidden.
- Any backup/PITR or new cloud service that incurs unexpected cost requires separate cost approval. No charges initiated in this work.
- No new permission needed to finish the previously approved safe setup ONCE backup/restore evidence exists; authorization does not waive the backup gate. Orders writes and Zalo auto-reply still require distinct approval.

## 6. CHECKPOINT / NEXT

1. Owner or approved operations staff creates manual encrypted PG17 dump from tien404-staging using the staging-only helper and a secure local PGPASSFILE; private key/backup stays outside this conversation.
2. Test pg_restore to a separate isolated PostgreSQL 17 instance, verify schema and counts. Only report PASS/FAIL, timestamp and optional encrypted backup checksum prefix; NEVER password, DSN, HMAC or backup contents.
3. Once backup is actually verified, provision a scoped non-bypassrls staging role and two independent CSPRNG secrets in an approved server-side secret manager; verify grants/RLS and revoke on rollback if needed.
4. Run dedicated two-session lock/receipt QA against actual Supabase staging, then integrate trusted HMAC ingress to read-only Shop B session adapter.
5. Do NOT call commit_order_qa, send Zalo messages, alter production or merge draft PR without further acceptance.

Rollback: Revert this GitHub PR feature branch if regression. No Supabase schema, secrets, roles or published workflows were changed in V12.4 secure connection work. Existing V12.3 empty private schema can be left in place.
