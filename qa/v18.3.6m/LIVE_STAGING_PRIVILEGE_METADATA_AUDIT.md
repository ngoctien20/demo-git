# V18.3.6M — Supabase Staging Privileged SQL Grant Inventory (Read-only)

**Scope:** project `ifxlvrhyjhbzbrkdsida`, PostgreSQL **17.11**. Captured 2026-11-19 JST using aggregate-only metadata from `pg_proc`, `pg_namespace`, `pg_extension`, and ACL helpers. **No user data, function source/body, Auth session records, secrets or customer rows accessed.**

## Verified function-level counts in schema public

| Metric | Aggregate |
|---|---:|
| Public SQL functions | 8 |
| Public SECURITY DEFINER functions | **4** |
| SECURITY DEFINER with effective EXECUTE for role `anon` | **1** |
| SECURITY DEFINER with effective EXECUTE for role `authenticated` | **2** |
| SECURITY DEFINER with effective EXECUTE for `service_role` | **1** |
| SECURITY DEFINER with `proacl IS NULL` | 0 |

Counts can overlap (one function can be executable by multiple roles). `has_function_privilege` checks effective PostgreSQL privileges, including inherited grants; it does **not** prove exposed routing, network accessibility, exploitable function arguments, tenant bypass or unguarded use. No SQL function bodies were inspected.

**Security finding M-SECDEF-01 — REVIEW REQUIRED (potential P0 if authorization bypass confirmed).** Review the affected functions' identity checks, resource/Store scope, ownership, `search_path`, default grants and exposure through the configured PostgREST/Data API schemas. Until independently reviewed, **do not promote** the production gateway or claim tenant-safe authority.

## Explicitly NOT executed

- No REVOKE/GRANT/ALTER, SECURITY DEFINER rewrite or migration.
- No invocation of these public functions, no data access through them and no credential/secret handling.
- No change to `auth.sessions`, `auth.users`, `public.orders`, Products/stock or n8n Published workflows.

## Recommended private follow-up authorization

Request owner approval before any permission adjustment or function-body security audit that could expose sensitive implementation details. First inspect redacted source/definitions in a private, authorized review environment with a second human reviewer; map precise invoker/role/policy guards and preserve working callers; snapshot grant state and create rollback SQL before modifying permissions.

**Decision:** `VERIFIED_METADATA / EXPLOIT_NOT_PROVEN / CHANGE_APPROVAL_NOT_GRANTED / PRODUCTION_NO-GO`.
