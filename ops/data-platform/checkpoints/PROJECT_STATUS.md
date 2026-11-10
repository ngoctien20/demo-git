# TIEN404 — SaaS Data Platform V1 — PROJECT_STATUS

Snapshot: 2026-11-10 (Asia/Tokyo). This is an **additive staging design** based on existing Super Admin PR #2 (`ops/super-admin-v4-staging-20261110`).

- Implemented in isolated branch: review-only PostgreSQL schema (8 public RLS tables; 3 private), staging-only FastAPI read gateway, Supabase user-JWT validation via Auth `/auth/v1/user`, membership/role checks and cross-tenant guards.
- Verified locally: 11/11 isolated pytest cases PASS, no external network requests.
- **Supabase project: NONE (0 returned by connector); Render staging service: NOT CONNECTED/DEPLOYED; n8n workflow: UNCHANGED; Sites Control Hub: UNCHANGED.**
- Not implemented: provisioning, real database migration, Auth account migration, order transactions, stock decrement, billing, webhook verification, production release.
- Boundary: `AI_SALES_DEMO` Sheets and credentials remain isolated from Commerce SaaS.
- Security: all exposed public tables have read-only authenticated RLS policies; no public write grants; no service_role key committed; private schema denied to anon/authenticated.
- Caveat: SQL static review is not a real Supabase migration or a live two-tenant RLS penetration test. Staging acceptance remains blocked until those succeed.

GitHub staged deliverable: Draft PR #5 (`ops/tenant-data-platform-v1-staging-20261110`) built on the existing Super Admin PR #2; data-platform and super-admin CI both succeeded (runs 42824818633 and 42824818584). No real Supabase/Render connection yet.
## Actual staging provisioning — 2026-11-10 (verified)

- Supabase project **tien404-staging** (ref `ifxlvrhyjhbzbrkdsida`, region `ap-southeast-1`), state **ACTIVE_HEALTHY**. Project cost quote was **USD 0/month** at creation; this is not a guarantee of future billing under changed usage or plans.
- Migration `20261110133819_tien404_staging_tenant_read_only_v1` applied successfully; verified 8 `public` tables with RLS + FORCE and 3 `app_private` tables with RLS and no browser policies. All tenant/product/order counts currently zero; this is **empty staging**, NOT customer data imported.
- Supabase security advisor: **INFO** only for 3 private tables with deliberately no policies (deny), as designed; not proof of a complete security penetration test. Performance advisor: 4 foreign-key index INFO findings, plus 6 initially unused indexes; review under load later.
- SQL role checks: `anon` cannot SELECT products; `authenticated` has no INSERT on products and no UPDATE on orders; `authenticated` cannot USAGE `app_private`. A `SET LOCAL ROLE authenticated` check with no user claims sees 0 tenant/product/order rows. Real cross-tenant RLS with two Auth users NOT RUN.
- Render **tien404-data-staging** on Free/Singapore, service `srv-dbphtas9v7es73bursrg`, URL https://tien404-data-staging.onrender.com, branch `ops/tenant-data-platform-v1-staging-20261110`, automatic deployment **OFF**. Deploy `dep-dbphtbk9v7es73burv50` status **live**, source commit `dfbd3b5a73d90e44c017cf060ac04375f5ac1001`; build logs show Uvicorn startup. It has Supabase URL + publishable key only, no service-role secret. No auth users created.
- GitHub PR #5 remains draft, stacked on Super Admin PR #2. Source branch may be ahead of deployed commit because autoDeploy=off; never imply the latest HEAD was automatically deployed.
- HTTP GET `/health` from an independent external client has **not yet been verified**; GitHub read-only remote smoke workflow was added but its result must be checked separately. Render 'live' is infrastructure status, not full API or database integration acceptance.
- No frontend, Sites Control Hub, n8n production, order management or billing integration changed.
