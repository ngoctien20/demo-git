# TIEN404 V19.8.18 — Canonical Store RLS × Real Local Auth JWT × Caller Closure

**Scope: isolated CI CANDIDATE only.** Extends Draft PR #471, uses the real tested migration SQL fixture from `qa/channel-v19817/`, adds local PostgreSQL RLS on the **same six migrated tables**, and asserts access with Auth-issued JWTs through **actual local Supabase Auth → PostgREST → PostgreSQL**. No hand-crafted JWT or SQL-injected auth.uid claim. Owner A/B accounts are ephemeral and synthetic, not hosted merchants.

## How CI works
`.github/workflows/tien404-v19818-migrated-store-jwt-rls.yml` starts its own disconnected Supabase CLI `3.2.0` + PG17 on localhost, applies the existing V19.8.17 migration drill, then `local-migrated-store-rls.sql` (SELECT-only policies and SECURITY INVOKER read RPC). The Node runner creates 3 *real local* GoTrue Auth actors and local memberships and reads through PostgREST. All setup/identifiers are synthetic and disposed after CI.

## Required positive and negative cases
- Owner A reads one record in each of six tables in Store A; Owner B reads Store B, with same SKU `F01` and differing prices 159000/189000 VND.
- A→B and B→A return zero records in every table **under the same valid signed JWT**.
- Authenticated tenant-only member sees zero records; anonymous and invalid/tampered tokens denied.
- Authenticated PostgreSQL role has SELECT only on fixture tables, no INSERT/UPDATE/DELETE.
- Revoking A Store membership (without revoking A JWT) instantly denies all A reads; B remains able to read.
- Disabling Store B itself denies all B Store reads even with current membership and valid JWT.
- Private fixture schema isn't directly exposed in PostgREST; the public `t404_v19818_read_store` function is `SECURITY INVOKER` with no write side effects.

## Important limitations
- These local JWTs are authentic **local** Auth JWTs. No hosted Owner A/B session, actual Bot, real Zalo provider, customer order or production access is established.
- RLS policies are test-only and cannot be pasted into hosted before mapping/comparing every existing RLS/policy/actor and performing independent security review.
- Source-only SQL fixture contains a simplified legacy data model, **not** actual hosted PII/data or a backup.
- Published DEMO Google Sheets writers remain unchanged and do not accept trusted Store identity; see `PUBLISHED_WRITER_CALLER_AUDIT.md`.
- The RLS test passes only when the GitHub Action for the exact source SHA completes success; queued/in-progress/failed is not PASS.

## Open release blockers
Verified hosted backup/restore, same-tenant real Owner Store A/B, exact provider installation binding and approved Store-scoped schema migration; full Render/Cloudflare/n8n caller inventory; independent privileged RPC audit; legacy demo separation, rollback and production approval. **NO-GO for hosted/production.**

Rollback is limited to closing this Draft PR, reverting new QA files and CI disposable container teardown. No hosted migration, direct service invocation, credential change, n8n publish, payment change or real provider send.
