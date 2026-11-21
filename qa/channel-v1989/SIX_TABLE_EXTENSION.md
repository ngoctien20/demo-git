# TIEN404 V19.8.9 — Six-table Commerce RLS extension (local Docker only)

Status: **CANDIDATE pending GitHub CI acceptance**. This extends the independently working 30-case local Supabase Auth/REST/RLS suite without replacing or editing the original three-table fixture/runner.

## Architecture
- Run the proven `local-supabase-real-jwt-rls.mjs` against `t404_uat1989_*` first.
- Within the **same disposable Docker Supabase stack**, run `local-real-auth-uat.test.mjs` safeguards and then `local-real-auth-uat.mjs` against completely separate `t404_v1989_*` fixtures.
- All local test actors are freshly created **real GoTrue/Supabase Auth users**. Actual Auth-issued JWTs are sent to actual **local PostgREST**; there are no SQL-injected mock `auth.uid()` claims.
- One synthetic Tenant has Store A and Store B; same SKU `F01`, prices `159000` vs `189000` VND, stock `5` vs `9`. Stores are distinguished by composite database keys and a strict store membership.
- Fixtures provide Store-scoped SELECT policies across **six Commerce-like tables**: Products, Customers, Orders, Order Items, Conversations, Messages. Composite foreign keys prevent cross-Store Order Item and Message linkage.

## Acceptance
- Owner A and Owner B must get distinct signed Auth sessions verified by `/auth/v1/user`.
- Each Owner can read their own single synthetic row in all six tables (positive control); foreign Store rows are denied with the **same signed JWT**.
- Same-tenant member with no Store membership sees zero rows in all six tables. Anonymous users see zero rows.
- Invalid JWT is rejected by Auth.
- Owner A cannot perform a POST into the other Store (no authenticated INSERT grants).
- After revoking Owner A Store membership in the disposable database, **the still-valid Auth JWT must lose all six Store reads immediately**. This proves the server queries current membership rather than stale role claims.
- Any unexpected positive/negative result fails CI. Never claim PASS on a queued/failed CI run.

## Security limitations and next admission gate
- Docker and GitHub-hosted runner are **not Supabase Hosted UAT**. This does not verify real merchant Owner identities, actual provider Bot→Store binding, real Commerce RLS schema, provider reply, payments, or production readiness.
- No Supabase project, branch, real data, customer PII, n8n workflow, Zalo webhook, live API key or hosted credential is read or changed.
- SQL fixture is test-only, not a production migration, and should never be executed against hosted staging.
- The local Auth signup creates synthetic test users **only in disposable Docker**; accounts and containers are removed on stack teardown.
- Public GitHub CI output must contain only aggregate test labels and count, no JWT, email, password, user ID or service-role values.
- Actual hosted Owner A/B JWT UAT remains BLOCKED by the Free plan and missing approved disposable hosted target.

## Rollback / checkpoint
Close Draft PR #459 or revert only `qa/channel-v1989/` and the corresponding QA workflow. No hosted rollback exists because hosted systems are untouched.

Checkpoint: **V19.8.9_SIX_TABLE_LOCAL_GOTRUE_POSTGREST_RLS_CANDIDATE / HOSTED_NO_GO / NO_LIVE_CHANGES**.
