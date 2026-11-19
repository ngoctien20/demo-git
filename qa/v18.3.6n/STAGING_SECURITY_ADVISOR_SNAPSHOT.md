# V18.3.6N — Supabase Staging Security Advisors (Metadata Only)

**Project:** `ifxlvrhyjhbzbrkdsida` (staging)  
**Checked:** 2026-11-19 JST  
**Tool:** Supabase Security Advisors **read-only**. Did NOT retrieve function source/bodies, real Auth sessions, passwords, JWTs, customer orders, keys or credentials.

| Advisor | Level | Findings | Next owner action |
|---|---|---:|---|
| `anon_security_definer_function_executable` | WARN | **1** | Explicit private function-body review consent; determine intended invoker, tenancy predicates, exposed schemas |
| `authenticated_security_definer_function_executable` | WARN | **2** | Review same as above; role authentication alone is NOT Store authorization |
| `auth_leaked_password_protection` | WARN | **1** | Independently review Auth password-security settings, UX and availability; change only after owner approval |
| `rls_enabled_no_policy` | INFO | **23** | Verify whether tables are intentionally private/deny-by-default; do not create permissive RLS policies reflexively |

**Interpretation:** SECURITY DEFINER warnings corroborate previous aggregate SQL privileges, but **do not prove a vulnerable function or that a public caller can exploit tenant scope**. Counts can overlap. A table with RLS enabled and no policy is often an intentional deny-by-default design, particularly in private schemas. Do not reduce isolation or create generalized access policies in response to informational lints.

**References:**
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

**Decision:** READ-ONLY VERIFIED, reviewer action requested, **NO GRANT/REVOKE, PASSWORD AUTH CHANGE, DDL OR PRODUCTION ADMISSION**.
