# TIEN404 AI V14.2 — P0 Store RLS & Guided Onboarding Checkpoint

**Environment:** Supabase tien404-staging ref ifxlvrhyjhbzbrkdsida; GitHub ngoctien20/demo-git; n8n QA Personal.
**Status:** EXPERIMENTAL STAGING / NO PRODUCTION / RLS CHANGES NOT APPROVED.
**Predecessor:** V14.1 Draft PR #85, head cf7974b14deb5870560db5019d9c4b06663ebe34, CI 43703701557 SUCCESS.
**Current:** V14.2 Draft PR #86 based on branch work/v141-shop-knowledge-brain-offline-staging.

## 1. Live read-only audit — VERIFIED 2026-11-15

- PostgreSQL staging 17.11, Supabase ACTIVE_HEALTHY.
- No canonical public.stores, public.store_memberships or app_private.shop_knowledge_releases/items tables.
- Existing public tenant_memberships authorizes at tenant level; no store assignment exists for Commerce.
- public.products, customers, orders, order_items, conversations and messages all lack store_id.
- These tables have RLS enabled AND FORCED. anon SELECT=false, authenticated SELECT=true (subject to RLS). Therefore no blanket public-read finding, but tenant SELECT policies still allow access to rows in any store of the same tenant.
- public.products has UNIQUE(tenant_id,sku), not UNIQUE(tenant_id,store_id,sku). All existing Commerce FKs are tenant-only, including order_items→orders/products and messages→conversations.
- public.tenant_agent_configs knowledge_version is per tenant+channel, not store-aware.
- **Exact read-only table row counts:** public.products=2, orders=2, customers=0, order_items=0, conversations=0, messages=0. These counts do not identify ownership; **do not infer a store** from the tenant even when one store is present in fixtures.
- Security-definer read-only introspection: public.qa_shop_b_zalo_claim callable by anon (not authenticated); public.qa_owner_pairing and public.save_merchant_product callable by authenticated (not anon); tien404_tester_track_change is not executable by either. Advisor reports one anon and two authenticated WARN. These are **security-review flags**, not verified exploitation.

## 2. What V14.2 actually implements

### Store/Auth backend interface — IMPLEMENTED + TESTED offline
- qa/store-rls-v142/store-boundary.cjs
- Server must inject a verifier for a cryptographically validated Supabase session, an authoritative store membership lookup, and a restricted read-only Knowledge repository. No client-supplied tenant/role/verified flag is trusted.
- A store context is minted by authorizeStore and registered in an internal WeakSet. A forged plain object cannot be used as a trusted context.
- Every Knowledge read is scoped by tenant+store. Returned release MUST be PUBLISHED, match both scope keys, and carry only PUBLIC knowledge before reaching the deterministic retrieval core.
- Required schema gate: public.stores, public.store_memberships and app_private.shop_knowledge_releases/items. Existing staging FAILS the gate, so real hosted access is **blocked by design**.
- qa/store-rls-v142/postgres-repository.cjs has parametrized SQL read adapter for store assignments and published Knowledge. Uses injected query() and has **no write methods**.
- Important: No Supabase session verifier, DB connection or migration was activated in Render or Supabase. Service role bypasses RLS; SQL-scoping is a second guard, not a substitute for hosted user-JWT RLS QA.

### Merchant AI Shop Onboarding — IMPLEMENTED + TESTED offline
- qa/shop-onboarding-v142/onboarding-core.cjs: 11-step Vietnamese guided interview, drafts only, no model required.
- Fields: name, industry, founding year, public phone, address, hours, delivery area, delivery policy, returns policy, payment methods, safe AI tone.
- Phone accepts verified *format* 0xxxxxxxxx or +84xxxxxxxxx; checks format, **not ownership**.
- Missing founding year/phone stays UNKNOWN, never inferred from account age or private contact; required missing fields mark INCOMPLETE_DRAFT.
- Replay turn-id guard; per-step ordered validation, hostile prompt-like content flagged for staff review.
- Exported proposal is STAFF_ONLY, UNVERIFIED, not owner-signed or reviewer-approved. Not used as customer Knowledge.
- qa/shop-onboarding-v142/ui/index.html: chat-like 11-step mobile QA, local browser memory only, A/B/C fictional store selector, clear review and JSON draft preview. **No merchant login or real store RLS**.

### Proposed migration — PROPOSED / BLOCKED
- qa/store-rls-v142/PROPOSAL_ONLY_STORE_RLS_DO_NOT_RUN.sql includes a **hard RAISE EXCEPTION as first operation**, no DDL can execute from this file as-is.
- Phase 1 canonical stores + assigned active membership and access policies.
- Phase 2 nullable store_id expansion for six Commerce tables; no automatic backfill.
- Phase 3 validate FKs, NOT NULL, scoped UNIQUE(tenant_id,store_id,sku) with audit on existing tenant-SKU unique constraint.
- Phase 4 atomic replacement of tenant-only SELECT policies (permissive RLS OR trap) and user-JWT hosted QA.
- V14.1 Knowledge private schema requires a separate approval; V14.2 read adapter also requires revision int on release.

## 3. Test results

### Node.js contract/regression — CI
Test suites:
- V14.2 Store Auth/Knowledge boundary
- V14.2 parameterized Postgres repository adapter
- V14.2 guided onboarding
- V14.1 Shop Knowledge
- V14.0 image-SKU (offline only)
- V13.8 conversation/handoff

GitHub Actions CI: see Draft PR #86 latest successful run. Any earlier CI failures (e.g. after stricter WeakSet context checks) must not be concealed; successful rerun is the evidence for new HEAD SHA.

### Browser QA
Synthetic browser QA covering 320/360/390/430/768/1280px, 11-turn wizard, invalid phone, unknown year, review JSON, reload resets session, Shop B/C switch. No outbound requests to providers.

### n8n Staging QA
New inactive manual QA workflow FIE7nl2vgLXQI7mT, version b24c7a86-66bf-45a2-b48b-a81c54e375bb, in Personal/90_QA - DIAGNOSTICS.
Execution 3833 SUCCESS, **16/16 synthetic cases**, 0 provider sends, 0 DB/Orders writes, 0 model calls, 0 RLS changes.
This is a *separate smoke suite*, not execution of the GitHub Node module or a real Supabase RLS session test.

## 4. P0 hosted QA approval checklist

- [ ] Owner approves full SQL migration strategy, restore point, data mapping and security review.
- [ ] Each of 2 existing products and 2 orders mapped to a verified tenant/store with evidence; no blind store assignment.
- [ ] Production-like Shop A and Shop B accounts are explicitly authorized for staging tests. Test 2 stores in **same tenant**, and 2 stores in different tenants.
- [ ] Owner A READ Shop A=allow, READ Shop B=deny; Owner B reversed; staff assigned to A only must not read B.
- [ ] Anonymous/expired/revoked user sessions deny; low-privileged user cannot infer records across stores.
- [ ] Test SELECT and write paths including INSERT/UPDATE/UPSERT and existing SECURITY DEFINER functions. No cross-store FK for SKU/orders/conversations/messages.
- [ ] Old tenant-wide permissive policies removed atomically before declaring store RLS effective; no duplicated OR bypass.
- [ ] Hosted auth proof uses **real JWT sessions** via Supabase API, not server service_role which bypasses RLS.
- [ ] PUBLIC Knowledge read only PUBLISHED+VERIFIED+merchant-approved versions; STAFF_ONLY/RESTRICTED unavailable from customer context.
- [ ] Owner consent and independent staff review persisted/audited; rollback to last approved version tested.
- [ ] No write to real customers, credentials, payments or production without separate sign-off.

## 5. Rollback and release rules

No existing published workflow, database RLS, credentials, Render/Cloudflare production, customer data or subscriptions were changed by V14.2.
Rollback current source work: close/revert Draft PR #86 only. The new n8n QA workflow FIE7nl2vgLXQI7mT is INACTIVE; optionally archive it after review. Do not remove any prior active workflow or V14.1 draft.
Database migration rollback planning is required when and only when separately authorized: preflight backup → tested restore → dual-read diff → reversible rollout; no data deletion by default.

## 6. Next steps

1. P0 technical review of canonical Store/Staff membership and existing SECURITY DEFINER RPCs.
2. Obtain specific approval for staging-only schema + RLS changes, with rollback and two authenticated QA sessions.
3. Create actual migration with Supabase CLI under owner-approved release process, never copy paste proposal SQL with its stop gate removed.
4. Implement real hosted repository + Auth verifier and persist drafts in private Knowledge tables **after** schema and permissions are approved.
5. Connect reviewed Knowledge to Customer Sales Core in **read-only no-send** staging, measure accuracy and handoff; later consider real AI onboarding under separately approved model cost.
