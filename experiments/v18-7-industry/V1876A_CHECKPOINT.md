# TIEN404 V18.7.6A — Canonical Store Authority Preflight

Date: 2026-11-19 JST. Status: CANDIDATE / OFFLINE QA / REAL AUTH BLOCKED / PRODUCTION NO-GO.

## Dependencies and scope
- Parent Draft PR #443 (synthetic signed admission; HMAC QA only).
- Draft PR #422 (industry profile mock).
- Draft PR #420 (disposable PostgreSQL 17 RLS model).
- Neither #420 nor #443 has performed real Supabase Store RLS or real Owner A/B JWT acceptance.
- This PR only adds metadata evidence, a stateless NO-GO checker, tests and compatibility documentation.

## VERIFIED — Supabase staging, metadata-only
- public.stores and public.store_memberships DO NOT exist.
- Existing Commerce products, orders, order_items, customers, conversations, messages are tenant-scoped and do not have store_id.
- These Commerce tables have RLS and FORCE RLS enabled; SELECT policies are PERMISSIVE and do not prove same-tenant Store A/B restriction.
- Current product uniqueness uses (tenant_id, sku). Real Store-local SKU business semantics need owner decision.
- Order/customer, order_item/product, order_item/order, message/conversation FKs are tenant-scoped.
- public.tenant_memberships is the (tenant_id,user_id) umbrella — do NOT simply redefine it as store membership.
- public.tenant_agent_configs is keyed (tenant_id,channel); per-store channel config needs compatible new binding.
- Supabase Security Advisor: THREE public SECURITY DEFINER RPCs require P1 grant review. qa_shop_b_zalo_claim is executable by anon. qa_owner_pairing and save_merchant_product are executable by authenticated. Grant flags alone DO NOT prove exploit or unsafe implementation.
- All observations were obtained using read-only metadata queries (no table data, customer names, PSIDs, tokens, session JWT or function body contents).

## IMPLEMENTED — isolated
- Static evidence snapshot (not a live database connection).
- Pure read-only metadata checker, returning NO_GO on missing canonical store, store scope, RLS/JWT evidence, FK/SKU conflict and P1 review.
- All outputs, even a hypothetical fully green input, set realAuthVerified=false, rlsVerified=false, canReadRealData=false, canSend=false, canWrite=false and productionReady=false.
- Node.js offline regression tests. Run with:
  node --test experiments/v18-7-industry/tests/*.test.cjs

## REAL AUTH A/B prerequisite / protected procedure
1. Obtain explicit owner approval for separate private staging data and real Auth JWT UAT.
2. Identify store ownership and authoritative tenant/store relationship; settle SKU uniqueness and whether customer is tenant-global or store-local.
3. Audit RPC callers, contracts and role/argument validation. Do not grant/revoke EXECUTE or alter SECURITY DEFINER until compatible and owner-approved.
4. Plan canonical stores + store_memberships schema and (tenant_id,store_id) composite integrity, using PR #420 as the non-live reference; reject duplicate Store authority schemas.
5. Preview migration against a backup/restore-capable isolated dataset, test unique collisions and reader/writer compatibility, then formally approve SQL if needed.
6. Verify Owner A and Owner C within the SAME tenant, and Owner B in a DIFFERENT tenant using authenticated sessions and actual store-level RLS.
7. Verify independent per-store Product/Order/Customer and Channel installation resolution. No customer cross-channel linking without separate ownership proof.
8. No provider send, order writes or production promote without separate owner approval.

## QA evidence template (real UAT NOT RUN)
- Environment: private staging, isolated store-scoped dataset, approved test principals.
- Test A: Owner A reads own Store A but not Store C (same tenant) and not Store B (other tenant).
- Test C: Owner C reads Store C, not Store A (same tenant).
- Test B: Owner B reads Store B, not Store A/C.
- Test revoked: inactive store membership reads zero rows.
- Test staff: cannot invoke admin/write/private order operations outside approved role.
- Data output: redacted query counts and yes/no acceptance only — never paste JWT, refresh tokens, user IDs or row contents into chat.
- Result: BLOCKED until actual evidence exists.

## ROLLBACK
Close the stacked Draft PR; no external resources were changed.
A future migration must have an independent pre-change backup, verified restore, revisioned code/DB compatibility and owner-approved rollback plan. Do not execute the disposable PG17 fixture against Supabase.

Checkpoint: V18.7.6A | METADATA VERIFIED | NO LIVE STORE AUTH | RPC P1 REVIEW | OFFLINE QA | NO SEND | NO WRITE | PRODUCTION NO-GO.
