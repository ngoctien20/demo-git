# V19.8.16 — Privileged RPC security review (observed read-only on 2026-11-20)

Project: `ifxlvrhyjhbzbrkdsida`. Read-only introspection of `pg_proc`, `pg_get_functiondef`, `has_function_privilege`; no calls to these RPCs were made. Privilege observations do NOT prove exploitability. Supabase Security Advisor warnings remain actionable until properly reviewed.

| Function | Current EXECUTE | Body facts verified | Risk and safe decision |
|---|---|---|---|
| `public.qa_shop_b_zalo_claim(uuid,text,text,text)` | anon yes, authenticated no, SECURITY DEFINER owner postgres | Compares request header `x-tien404-pairing` against Vault shared secret; requires synthetic QA and limited Shop B scope; hashes sender/event with HMAC. | **P1 review**: anonymous API entrypoint is intentionally guarded, but header authenticity, caller inventory, replay scope, rate limit and origin ingress must be proven. DO NOT revoke blindly. No real Zalo ownership derived. |
| `public.qa_owner_pairing(uuid,text,uuid)` | authenticated yes, anon no, SECURITY DEFINER owner postgres | `auth.uid()` plus active `tenant_memberships` role=owner, fixed QA bot tuples, synthetic dry-run. | Tenant owner is not canonical same-tenant Store owner. Need Store membership and request lineage before promotion. Existing QA behavior preserved. |
| `public.save_merchant_product(uuid,text,text,bigint,boolean,integer,timestamptz)` | authenticated yes, anon no, SECURITY DEFINER owner postgres | Requires authenticated active tenant owner/manager for 2 explicitly allowlisted QA tenants; product by `tenant_id,sku`, optimistic timestamp and audit. | Current product writer is tenant-scoped. Multi-Store same SKU and isolation not supported. Mark P1 promotion blocker, but do not break current two-tenant QA. |
| `public.tien404_tester_track_change()` | anon no, authenticated no, SECURITY DEFINER | Trigger function; no direct caller grant observed. | Recheck trigger owner/dependency before any privilege change. |

Security Advisor flagged 1 anon and 2 authenticated SECURITY DEFINER executable functions, plus leaked password protection disabled and 23 private/QA tables with enabled RLS but no policies (often intentionally denied). Advisory info does not authorize blanket policy changes. Useful references: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable and https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## Caller inventory required before mitigation
1. All n8n **Published and Draft separately**, including credential ID metadata only, webhook ingress, trigger, Execute Workflow tools, HTTP Request RPC strings and dynamic runtime URLs.
2. Cloudflare Workers/Pages current deployed version and GitHub references, plus preview versions.
3. Render services, env **names only** and all RPC callsites; connected browser, dashboard and custom applications.
4. Supabase Edge Functions, SQL triggers and internal functions; authenticated/anon API clients and externally integrated services. Dynamic callers may be unknowable: document limitation.
5. Pin Git SHA + deployed version + workflow ID and activeVersionId; verify negative spoofing, expired JWT, A→B, B→A, concurrency, ambiguous acknowledgments and rollback.

No blind REVOKE, ALTER FUNCTION, DROP, publish or credential rotation. Do not quote Vault secrets, tokens, customer data or raw JWT in issues/PRs. Current privileged RPCs remain a **NO-GO** for generalized multi-Store Commerce authority.
