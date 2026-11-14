# TIEN404 AI V12.4 — Credential approval, backup gate and isolated RLS acceptance

**Checkpoint:** 15/11/2026 JST. **Owner approved:** create NEW staging-only PostgreSQL credential, store separate HMAC secret in a secret manager, test least-privilege and concurrent sessions. **Unchanged precondition:** verify backup and restore before granting DB access.  
**Status:** IMPLEMENTED / TESTED on isolated PostgreSQL; BLOCKED for credential provisioning and Supabase runtime; NOT RELEASED.

## 1. VERIFIED — Real systems

- Supabase project **tien404-staging**, ref **ifxlvrhyjhbzbrkdsida**, PostgreSQL 17.11, ACTIVE_HEALTHY. Supabase organization plan **Free**; official docs do not provide automatic daily backups for Free. No actual full database encrypted dump or independent restore test has been verified via current connectors or Browser tabs.
- Staging private QA schema `tien404_dialogue_private` contains `shop_b_sessions=0`, `shop_b_receipts=0`. Existing Shop B sandbox orders/outbox = `2/2`.
- RLS enabled on both private tables; no relevant Shop B backend login role existed when inspected. `anon`, `authenticated`, `service_role` have no private schema/table USAGE/SELECT/INSERT. Existing source QA tables have RLS enabled and **no policies**, so new backend cannot safely read them by adding a password alone.
- PR #41 still open/draft, no merge. Independently published Zalo V1 version `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e` and Shadow `f00ba506-c52a-4340-9a0c-809fd9c6ea9a` remain outside this PR; no runtime changes made.
- Cloudflare Secrets Store API **accessible read-only**, account quota `100` secrets, current usage `0`, current stores `0`. An available API does not prove zero cost or a ready configured secret binding; no Secrets Store was created in this phase.

## 2. IMPLEMENTED — Inert security artifacts

- `docs/ai-handoff/V12_4_REVIEW_ONLY_SHOP_B_ROLE_RLS.sql` — NEW NOLOGIN role `tien404_shop_b_qa_backend`, `NOSUPERUSER`, `NOBYPASSRLS`, no client grants; private sessions SELECT/INSERT/UPDATE and receipts SELECT/INSERT; source catalog/Owner/claim/bot SELECT only with fixed Shop B tenant scope. Further restricted catalog to SKU F01, bindings to paired+unexpired, claims to CONFIRMED and bot to dry_run/synthetic_qa. **Not applied** to Supabase.
- `qa/zalo/v124-ephemeral-role-rls.sh` — creates two synthetic shops in ephemeral PG17, applies the exact V12.3 schema migration and draft Shop B RLS, exercises permitted and forbidden actions, verifies rollback without persistent rows.
- Existing guarded `qa/zalo/v124-manual-encrypted-backup.sh` remains prepared but **not executed against staging**.
- GitHub Actions workflow extended to run new role/RLS QA and existing real two-process lock and unique receipt tests on a **temporary CI PostgreSQL 17 database**. Not Supabase staging.

## 3. TESTED — Evidence

- GitHub Actions run `43614620298` (commit `8860eecf00fdf99b41ca350eb0aa5053ab6417e4`): **148/148** Node tests PASS; isolated actual PostgreSQL two-process FOR UPDATE wait **6.933 sec**; unique event receipt wait **6.929 sec**, exactly one inserted; Shop B backend RLS role QA **PASS** — Shop B-only catalog and Owner SELECT, private session/receipt writes, Shop A invisible, Orders read/catalog mutation denied, anon/authenticated/service_role denied, rollback 0/0.
- Narrower active/paired policy change in later commit `e65c4afc0a08ee20f0786c95ecbe3f66b0d3676a`, requires latest CI revalidation before application.
- Real Supabase RLS attempts under `anon`/`authenticated` had already returned expected error `42501`; this does NOT prove newly drafted backend role works on Supabase. No new Supabase DDL or production/Orders writes.

## 4. BLOCKED

- **P0 backup gate:** Free plan has no automatic daily backups, and a new full encrypted database dump + independent restore rehearsal has not been produced or verified.
- **P0 credential gate:** DO NOT create backend LOGIN/PG password, Cloudflare Secrets Store resources or HMAC until backup gate passes. No credential was provisioned in this session.
- **P0 platform:** need to choose the actual server-side execution environment, secure secret binding, and private network/database connection. Do not create paid Cloudflare Hyperdrive/Render resource without budget approval. Avoid existing production credentials/Workers.
- **P0 real staging QA:** Supabase staging concurrent two-connection contention, new role RLS tests under real login, session bridge and provider signature verification remain untested. This phase only proved equivalent controls on isolated PostgreSQL.

## 5. RISKS / SAFETY

- Never log secrets to GitHub Actions, Supabase SQL query results, n8n workflow nodes or chat; do not paste DSN/password/HMAC. Never use Supabase `service_role` as the shop executor.
- Do not add generic `SECURITY DEFINER` functions, public policies, or privilege escalation to fix missing SELECT.
- Previous independent V12.3 customer-router workstream advanced Zalo V1; no overwrite/rollback without audit.
- `commit_order_qa`, outbound Zalo auto-reply and Orders remain disabled; distinct approval required for each.

## 6. ROLLBACK

The new role/RLS SQL is **review-only**. To undo this phase, revert PR #41 additions without database changes. No credential/secret/role needs revocation because none were created; private Supabase V12.3 schema is unchanged and empty.

## 7. REQUIRED OPERATOR STEP

Use a trusted machine/workspace with private PG credentials and offline age identity to run `qa/zalo/v124-manual-encrypted-backup.sh`, and verify restoring the encrypted dump on an independent PG17 test DB; do not expose the backup or passwords to ChatGPT. Report **backup PASS/FAIL, UTC date, restoration PASS/FAIL** (optionally encrypted checksum prefix). No need to send file, password or token.

## 8. NEXT

Once full backup and restore evidence exist, create the scoped role and NEW login secret through a trusted private provisioning path, attach separately generated HMAC in the selected approved server-side secret manager, verify real staging RLS and concurrency with two persistent PG connections, then integrate read-only Shop B Owner session. Do not enable order commit or auto-send.

**References:** Draft PR #41, migration `20261114144917_v12_3_shop_b_private_session_qa`, Cloudflare read-only Secrets Store quota, [Supabase Backups](https://supabase.com/docs/guides/platform/backups), isolated QA `43614620298`.
