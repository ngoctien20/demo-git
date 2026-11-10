# TIEN404 — Data Platform V1 — NEXT_ACTIONS

1. Read this checkpoint and the current PR2 Super Admin branch; check upstream HEAD before editing (another agent may be modifying it).
2. Review proposed `schema.staging.sql`, private schema grants and tenant separation. Do not apply it to live databases.
3. Confirm owner-selected **Supabase organization** and **Render workspace**, then get billing quote; seek explicit approval for any nonzero cost.
4. Create isolated Supabase staging project, generate formal migration with supported CLI, run SQL in staging, verify with Supabase advisor.
5. Create synthetic Auth User A / User B and two distinct tenants; execute real RLS/cross-tenant and refresh-session tests with complete evidence.
6. Deploy FastAPI to isolated Render staging service with HTTPS, only publishable key server env; verify Auth endpoints, 401/403/429/5xx and origin policy, configure monitoring. Never publish an untested static fallback as a real database.
7. Map existing Super Admin custom IDs/SQLite to Supabase Auth UUID before any actual shared session; do not disable existing MFA, CSRF, audit, RBAC.
8. Stage verified n8n signed gateway and atomic order RPC separately; never run production AI_SALES_DEMO order workflows with staging customer data.
9. Update these five checkpoints after each stage and maintain PR review gate.
## Checkpoint after provision — 2026-11-10

1. Supabase staging `ifxlvrhyjhbzbrkdsida` and Render Free staging `srv-dbphtas9v7es73bursrg` were created successfully. **Do not create duplicates or reapply initial migration**. Compare API state and migration history before further writes.
2. Confirm remote smoke GitHub Actions result for https://tien404-data-staging.onrender.com/health and anonymous `/api/v1/tenants` HTTP 401; diagnose only if failed. Auto-deploy on Render is OFF.
3. Review advisor's 4 missing FK indexes; add a new incremental non-destructive staging migration when justified, avoid removing new unused indexes prematurely.
4. Create *synthetic* Supabase Auth test users A/B and tenant A/B only under a documented approved test procedure; verify real 2-tenant RLS, owner/manager vs staff, origin enforcement and authenticated API. Do not use personal or production data.
5. Review identity bridge with Super Admin PR #2 and Sites Control Hub before shared sessions or production migration. No live order, payment, subscription or n8n workflow writes.
6. Add independent safe health checks distinguishing configured vs genuinely connected. A 200 health response currently only reports CONFIGURED_NOT_VERIFIED.
7. Capture backup/restore evidence and security audit before any production pilot. Update PR #5 checkpoints and require review before merge.
