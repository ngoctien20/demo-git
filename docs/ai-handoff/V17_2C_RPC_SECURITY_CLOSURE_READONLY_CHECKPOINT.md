# V17.2C — RPC Security Closure: independent read-only preflight

Date: 2026-11-18 JST
Parent: V17.2B Draft PR #384, pinned HEAD `431fa7c58d4c155f73624b94bcef374481af4acf`.
Environment: Supabase staging `ifxlvrhyjhbzbrkdsida`, PostgreSQL 17.11.
Status: **VERIFIED READ-ONLY / SOURCE-ONLY; HOSTED CHANGE NO-GO**.

## Scope and observed facts

Independent catalog query of `pg_proc` and `pg_namespace`, privileges via `has_function_privilege`, and `pg_get_functiondef` examined three advisor-listed SQL functions. No function was executed and no row or credential was retrieved.

| Function | SECURITY DEFINER / owner | anon | authenticated | service_role direct execute | search_path |
|---|---|---|---|---|---|
| public.qa_shop_b_zalo_claim(uuid,text,text,text) | true / postgres | yes | no | no | empty |
| public.qa_owner_pairing(uuid,text,uuid) | true / postgres | no | yes | no | empty |
| public.save_merchant_product(uuid,text,text,bigint,boolean,integer,timestamptz) | true / postgres | no | yes | no | empty |

Role-scoped EXECUTE is already present: findings are warnings about privileged execution paths, **not proven open execution or exploitation**.

- `qa_shop_b_zalo_claim`: checks private Vault secret against a request header, validates input shapes and calls a synthetic QA claim helper. Header-gate and provider ingress authenticity must be independently proven; no assertion of robust replay/signature validation from this review. An `anon` RPC route is present by design and cannot be closed without reviewing its live caller.
- `qa_owner_pairing`: checks `auth.uid()`, active owner membership and QA-only identity/bot configuration; grants execute to `authenticated`. Owner pairing logic and side-effect helpers require adversarial live no-send UAT before signoff.
- `save_merchant_product`: checks active owner/manager membership and an explicit allowlist of exactly two QA tenants, validates product input, applies create/edit with version guard, and writes audit event. It intentionally operates with elevated database privileges; simply converting to `SECURITY INVOKER` would likely break writes because current `public.products` policy only permits member SELECT.

`public.products` has `products_member_read` authenticated SELECT policy; `public.tenant_memberships` has `memberships_self_read` authenticated SELECT policy. No direct runtime change is permitted before caller and security review.

## Security closure admission checklist

1. Identify ALL callers of each RPC in GitHub/Cloudflare/n8n, pin source commit, deployed version, request authentication and approved traffic origin. Identify whether the Zalo webhook-to-anon-RPC flow still requires this exact route.
2. Review private Vault/header usage without printing secret values or headers. Test missing, wrong, replayed and oversized headers using disposable resources, not live provider events.
3. Verify strict QA-only identity binding; reject forged Tenant, Store, user UUID, ownership, disabled bot, expired challenge, duplicate claim, and revoked membership.
4. Verify product create/edit behavior on disposable stores only: owner allow, manager allow, unrelated authenticated deny, other tenant deny, null/invalid values deny, optimistic concurrency conflict, stock guard, audit write and rollback.
5. Prefer private signed ingress / trusted server-side caller for Zalo claiming rather than depending solely on a shared header secret. If the existing public RPC is needed for compatibility, keep fail-closed and document bounded transitional exception with expiration.
6. Propose precise GRANT/REVOKE or function changes **only after** proof of callers; test on disposable PostgreSQL and isolated staging. Preserve existing function signatures or explicitly migrate and regression-test callers.
7. Verify `pg_get_functiondef`, `has_function_privilege`, Supabase Security Advisor, GitHub CI, real Auth/JWT A/B negative tests and exact deployed SHA after any approved change.
8. Produce independent security acceptance, backup/rollback evidence and NO-SEND event proof. No production promotion or Merchant/DEMO data changes without separate approval.

## READ-ONLY SQL reproducibility

```sql
SELECT p.oid::regprocedure::text AS rpc,
       pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef AS security_definer,
       p.proconfig AS settings,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute,
       p.proacl::text AS acl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('qa_shop_b_zalo_claim','qa_owner_pairing','save_merchant_product')
ORDER BY p.proname;

SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies
WHERE schemaname='public' AND tablename IN ('products','tenant_memberships')
ORDER BY tablename,policyname;
```

## Acceptance decision

**Current: SECURITY CLOSURE NO-GO.** Read-only audit is verified. No privileges were revoked, no function replaced, no migration applied, no live tests executed, no secrets or customer records accessed. Close this child Draft branch/PR to roll back source documentation only; runtime remains unchanged.
