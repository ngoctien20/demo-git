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