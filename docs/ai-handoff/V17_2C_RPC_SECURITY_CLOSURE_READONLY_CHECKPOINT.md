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


## V17.2C.1 — 2026-11-18 JST read-only caller and ACL negative follow-up

### Current checked scope
- GitHub default-branch code search for each of the three exact RPC names returned zero matches. **This searches default branch only and is not proof of zero callers** on work branches or deployed Cloudflare Workers.
- n8n exact draft/published graph inspection of Zalo V1 webhook `yIJk8LvJoLF40Z62` (active; draft/published same), V12.3 customer router `sIPs6egzIwOY1GNv` (active; draft/published same), and V17.1P Commerce Reader synthetic QA `p5OsIaB0NkMDFMw7` (inactive) found zero explicit RPC-name references, `/rest/v1/rpc` URLs, or Supabase calls in inspected workflow definitions. **Other workflows and external deploys remain unverified**.
- Independent staging read-only ACL query via `pg_proc` + `aclexplode(coalesce(proacl,acldefault('f',proowner)))` verified **PUBLIC EXECUTE=false for all three**, exactly scoped `anon`/ `authenticated` rights as in prior checkpoint, and service_role explicit execute false. This is privilege metadata, not an HTTP 403 or real auth probe.
- Added `qa/v172c-rpc-closure/privilege-negative-contract.test.cjs` and `.github/workflows/v172c1-rpc-privilege-negative.yml`. 18/18 local Node source contract assertions PASS, using captured metadata fixture; no actual RPC called. GitHub exact-HEAD Actions job was not returned at checkpoint creation; CI acceptance pending.
- No negative HTTP request, JWT, trusted provider callback or hosted SQL-function invocation performed. No live credential or customer data accessed.

### Compatibility decision
Retain all three existing RPC grants temporarily; `qa_shop_b_zalo_claim` currently requires verified upstream Zalo/Cloudflare caller inventory, `qa_owner_pairing` requires real caller tracking, and `save_merchant_product` has only SELECT RLS on products (cannot swap to invoker without redesign). Do **not** interpret missing GitHub default search hits as deployed inactivity.

### Next blockers for release
Exact deployed Cloudflare Worker script/route caller scan; full GitHub work-branch caller inventory; targeted n8n Supabase-connected workflow inventory; independent no-send, no-mutation authenticated/unauthenticated HTTP tests in disposable staging; safely review how Vault header secret is delivered; test correct denial, replay, cross-store and revocation using real authorized QA identity. Real hosted security closure remains **NO-GO**.

### Evidence
PR #392, source-only local Node test 18/18 PASS; parent V17.2B PR #384; staging Supabase `ifxlvrhyjhbzbrkdsida`. No runtime rollback necessary.


### Additional Cloudflare six-script bounded scan

Cloudflare API listed Worker script names in the connected account. A read-only `GET /workers/scripts/{name}/content/v2` response was inspected for six relevant scripts: `tien404-rpc16-merchant-evidence-inactive-staging`, `tien404-v1721h2-zalo-replay-private-nosend-staging`, `tien404-v175e1-private-issuer-nosend-staging`, `tien404-v175e2-ab-gateway-nosend-staging`, `tien404-v177h-provider-nosend-inactive-staging`, and `tien404-zalo-outbound-v1-staging`. Returned content representation had no literal occurrence of the three exact RPC names or `/rest/v1/rpc/`. **Bounded scan only**: not all scripts, modules, external call chains, and routes are covered; absence of matches is NOT a full deployed caller proof.

Source contract test independently reproduced in a local Node runtime with **18/18 PASS**, no network. GitHub HEAD workflow status must be verified separately.
