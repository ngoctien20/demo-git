# TIEN404 V19.8.9 — LOCAL Supabase Auth JWT × PostgREST × Store RLS UAT

**Status:** GitHub Actions experimental local integration QA — no hosted Supabase subscription. NOT a production migration, merchant ownership proof, or permission to send Zalo replies.

## Why this approach
- V19.8.8 hosted Supabase branch could not be created on the organization's Free plan; Supabase returned `PaymentRequiredException: Branching is supported only on the Pro plan or above`.
- Two existing Free projects are protected: `tien404-staging` and `ngoctien20-bio`.
- User approved continuing with **Option B**: real signed JWT and RLS tests inside an isolated local/CI Supabase stack rather than subscribing to Pro.
- This setup avoids any Supabase-hosted branch/project cost and does not issue cloud production Auth credentials.

## Test environment
- A temporary GitHub Actions `ubuntu-latest` runner launches the **pinned Supabase CLI 3.2.0** local stack using Docker.
- Only Auth, REST/PostgREST, PostgreSQL and required gateway services are used; unrelated services are excluded.
- The SQL fixture is run **only against 127.0.0.1:54322** and `postgres`, with synthetic records only.
- Test users have randomized `@tien404-qa.invalid` email addresses and generated test passwords held in process memory; not exposed in output or in repository secrets.
- This test's Auth server issues actual signed JWTs and verifies them via `GET /auth/v1/user`. A mock claim injected by SQL is **not** used in user-RLS tests.
- PostgREST must independently validate JWTs before applying DB RLS based on `auth.uid()`; each signed QA Owner can only see its authorized Store rows.
- No live Zalo, n8n, Cloudflare or hosted Supabase endpoints, credentials or customer data are involved.

## Test matrix
| Area | Expected |
|---|---|
| Two independent local Supabase Auth registrations and password logins | 2 real signed JWTs |
| `/auth/v1/user` validates each signed JWT | PASS, distinct users |
| One tenant with Store A and B, same SKU different prices | PASS |
| Owner A reads Store A product, order, conversation | 3 ALLOW |
| Owner A reads Store B product, order, conversation | 3 DENY |
| Owner B reads Store B product, order, conversation | 3 ALLOW |
| Owner B reads Store A product, order, conversation | 3 DENY |
| Anonymous reads on the same three private tables | 3 DENY |
| Invalid Auth JWT and tampered PostgREST JWT | DENY |
| Revoking Store A membership without changing the existing JWT | 3 DENY |
| Restoring Store A membership | ALLOW/DENY again |
| A Store A Owner tries to write a Store B product | DENY |
| Store B remains isolated after all negative tests | PASS |

## Files
- `local-auth-rls-fixture.sql`: synthetic tables + store-scoped RLS, no authenticated DML grants, prepared for the ephemeral local Postgres service.
- `local-supabase-real-jwt-rls.mjs`: local-only test runner; no secrets logged and hardcoded loopback API and Postgres endpoints.
- `.github/workflows/tien404-v1989-local-supabase-auth-rls.yml`: reproducible CI runner (may pull Docker images at runtime), no hosted connections or paid resources.

## Real-world limits / blockers
1. Local self-hosted Supabase **does not prove** real hosted Owner A/B session correctness or live Merchant Store Authority.
2. Fixture tables do not replace current Commerce public schema or its tenant-wide RLS policies. No migration was performed to shared staging.
3. No real authenticated Bot Installation → Owner → Store binding has been established.
4. Current Messenger/Zalo Commerce routing and provider Send are intentionally untouched.
5. Strict customer-price/stock correctness, stock reservations, order atomics, notification outbox, and billing remain separate gated workstreams.

## Safety / rollback
- The workflow runs only when QA code changes or it is manually dispatched. It uses no Supabase personal access token, project ref, service role key or connected credentials.
- Local API is fixed to `127.0.0.1:54321`; fixture setup is fixed to `127.0.0.1:54322`. If the local stack cannot start, the workflow FAILS; it must not fall back to a hosted project.
- It prints only a sanitized aggregate test result and discards all local containers on completion.
- Rollback: close Draft PR #459 or revert the V19.8.9 directory/workflow. Nothing changes in Supabase hosted or n8n.

**Acceptance:** CI must show Auth + PostgREST + PostgreSQL tests SUCCESS, not merely JavaScript mock tests. Until that evidence exists, mark V19.8.9 as IMPLEMENTED / NOT TESTED.

**Checkpoint:** `TIEN404_V19_8_9_LOCAL_SIGNED_AUTH_RLS_CANDIDATE / HOSTED_OWNER_UAT_BLOCKED`
