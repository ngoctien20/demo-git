# TIEN404 AI — Render dependency audit before Supabase postgres password reset

**Date:** 15/11/2026 JST. **Scope:** read-only, Render workspace `My Workspace` (`tea-dbphgh0n74is73dvsnng`), Supabase staging `ifxlvrhyjhbzbrkdsida`. **No password reset, credential change, redeploy, environment mutation or production action occurred.**

## VERIFIED — Render inventory

Two services, neither suspended, both `autoDeploy=no`, both from `ngoctien20/demo-git`:

| Service | Render ID | Type / deployed SHA | Runtime / integration |
|---|---|---|---|
| `tien404-auth-staging` | `srv-dbpj4irm8hqs73e2h2rg` | static site, LIVE deploy SHA `70b3ab4dfae0ec4ae884917a1a4567077bbb7399` (14 Nov 17:14 UTC) | Public static Auth app; source `assets/auth-client.js` uses Supabase JS/Auth URL + publishable key, not native PostgreSQL |
| `tien404-data-staging` | `srv-dbphtas9v7es73bursrg` | Python FastAPI web service, LIVE deploy SHA `ab940a95dae8afdff426bc6ac71693833d5348ce` (12 Nov 03:40 UTC) | `cd ops/data-platform && uvicorn app.main:app ...`; source `app/main.py` calls Supabase Auth/REST via HTTPS using `httpx` |

- `tien404-auth-staging` build: `node scripts/build-auth-preview.mjs`, static output `auth-preview-dist`; no backend DB password required by build/runtime inspected.
- `tien404-data-staging` requirements: `fastapi==0.128.2`, `httpx==0.28.1`, `pytest==9.0.2`, `uvicorn==0.48.0`. No `psycopg`, `asyncpg` or PostgreSQL driver.
- Its `Settings.from_env` reads `TIEN404_SUPABASE_URL`, `TIEN404_SUPABASE_PUBLISHABLE_KEY`, `TIEN404_APP_ORIGIN`, `TIEN404_DATA_MODE`. The optional n8n handshake reads `TIEN404_N8N_STAGING_SECRET` (unrelated to DB `postgres` password). No code path in the **deployed FastAPI runtime** reads `PGPASSWORD`, `DATABASE_URL`, `PGHOST` or `postgresql://`.
- `app/main.py` instantiates `app=create_app()` with `commerce_connect=None` by default. Files `commerce_transactions.py` and `merchant_orders.py` exist as adapters but are **not wired as an active database connection** in this deployed entrypoint. No native PostgreSQL pooler/client dependency is installed in Render requirements.
- Render workspace lists **no Render Postgres instances** and **no Key Value instances**. This does not imply Supabase or external databases are absent.
- Deploy histories: latest deploy statuses `live`; backend latest deploy completed 12 Nov, static Auth latest 14 Nov. The inspected sample of 60 backend application logs (from 12 Nov) contained no direct PostgreSQL connection or password-authentication errors; sample coverage is limited and not a guarantee of future availability.
- Render `get_service` **does not expose environment-variable key names or values** through the available connector. Neither was accessed or modified.

## Risk assessment — Supabase project `postgres` password reset

**LOW direct dependency risk** for the TWO Render services, based on exact live Git commit SHA and runtime. They use Supabase HTTPS Auth/PostgREST with public publishable key/JWT, not `postgres` password. Resetting project `postgres` password does not rotate publishable API keys.

**Residual uncertainty:** Render Environment may contain unused/external PG secret variables not exposed by the connected Render API. This audit cannot certify 100% that no arbitrary external job or hidden dynamic config references the old password. For a final operator cross-check, open Render Dashboard for **both** services → **Environment** and inspect **KEY NAMES ONLY**: `DATABASE_URL`, `SUPABASE_DB_URL`, `POSTGRES_URL`, `PGHOST`, `PGUSER`, `PGPASSWORD`, `DATABASE_HOST`, `DB_PASSWORD`. Do NOT share secret values or screenshots revealing them. Also check any env groups (if attached). If any PG/password key is present, stop and review its consumer before rotation.

Official Supabase guide: https://supabase.com/docs/guides/database/postgres/roles states managed Supabase services automatically update to the new database password, but external hardcoded password consumers must be updated manually.

## Operator-controlled reset (PROPOSED only — NOT APPROVED OR EXECUTED)

1. Owner reviews environment variable KEY NAMES in Render. If no PG password-dependent variables are in use, direct Render impact is low.
2. Owner separately approves resetting **only** Supabase project `tien404-staging` (not `ngoctien20-bio`). Use a quiet window.
3. Generate a high-entropy new database password in a trusted local password manager. Enter it **only in Supabase Dashboard > Database Settings > Reset database password**. Do not provide this password to ChatGPT/GitHub/n8n.
4. Verify Render endpoints, Supabase Auth/REST tenant isolation, and Zalo/Messenger read-only QA afterward. Resolve errors before further migration.
5. Connect pgAdmin with Session Pooler host **copied directly from Supabase Connect**, port `5432`, username `postgres.ifxlvrhyjhbzbrkdsida`, `sslmode=require`; if GSS negotiation interferes, `gssencmode=disable`, never disable TLS.
6. Create an encrypted full logical backup and rehearse restore on isolated PostgreSQL 17 before creating new staging credentials, grants or HMAC runtime integration.

No changes to production, n8n workflows, orders, stock, Supabase credentials, Render config, or Cloudflare sending occurred in this audit. **STATUS: VERIFIED for runtime/source/deploys; OPERATOR CHECK PENDING for Environment variable names; RESET NOT EXECUTED.**
