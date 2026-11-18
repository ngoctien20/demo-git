# TIEN404 AI V18.3.6B — Full PG17 Migration Replay (CANDIDATE / NO PROD)

## Purpose
Replay the **original V18.3.6 disposable SQL files byte-for-byte** on a fresh, isolated PostgreSQL 17.12 Docker container. This is separate from the reduced V18.3.6A proof.

## Exact source artifacts
The three original SQL files are stored as gzip+base64 text under `source/`. The runner decodes them, verifies SHA-256, and executes them in order. No SQL source edits are applied.

| Source | SHA-256 |
|---|---|
| `00_DISPOSABLE_ONLY_PREFLIGHT.sql` | `b08eb8b3d8d18e839a0116cde3945505aa92ef7225c7d38c02f70487c6a6e508` |
| `01_DISPOSABLE_MIGRATION.sql` | `29ef6c47e632f66c227e574d1968f294ac70bd30f1f19bb71ea95b3d570408dc` |
| `02_DISPOSABLE_AB_RLS_ACCEPTANCE.sql` | `b8067f22ccd110afda820902a09c8df16cf752facee936b96b0f163385d7dbaa` |

Additional `03_DISPOSABLE_FINAL_AUDIT.sql` verifies expected mapping counts, RLS on ten tables, six restrictive policies, ten validated foreign keys, non-writable QA role, same-tenant Owner A/B fixture distinctness, and legacy-order invisibility for both A and B.

## Safety
- Runs only on GitHub-hosted `ubuntu-24.04` in a temporary `postgres:17.12` container with `--network none` and no published port.
- The database name is exactly `tien404_v1836_disposable`; the original preflight and migration both enforce the name and PostgreSQL 17 guard.
- No Supabase connection, n8n, Cloudflare, provider API, credentials, JWTs, customer data, webhooks, or sends.
- GitHub Actions permissions are read-only `contents: read`; no repository secrets are referenced.
- Container is removed with an `if: always()` cleanup step.
- PR is Draft. Never merge automatically.

## What a PASS proves
Only that the exact synthetic V18.3.6 migration and RLS acceptance scripts execute on the tested PostgreSQL 17 image with their synthetic fixtures. It does **not** prove compatibility with the live Supabase schema, data mapping, real Auth sessions, privileged RPCs, provider permissions, media rights, or production writer compatibility.

## Known design boundary
The synthetic mapping statements in `01_DISPOSABLE_MIGRATION.sql` are explicit fixture mappings, not inferred mappings of the live database. The QA-LEGACY product and legacy order deliberately remain `store_id IS NULL`; no automatic mapping is authorized. Real historical records require a separate private owner-approved mapping manifest.

## Auth A/B admission
See `AUTH_AB_ADMISSION_READINESS.md`. Real Supabase Auth A/B UAT remains BLOCKED until two independent owners approve a private, server-verified, read-only session test after a separate staging migration approval and backup/PITR gate.
