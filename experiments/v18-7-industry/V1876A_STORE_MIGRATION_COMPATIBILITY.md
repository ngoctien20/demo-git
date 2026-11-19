# TIEN404 V18.7.6A — Store Migration Compatibility Decision Record

Status: PROPOSED, NOT APPROVED. No DDL, ALTER POLICY, REVOKE, COMMIT, JWT or provider call.

## Decisions required before a live migration

| Area | VERIFIED current design | Decision / constraint |
| --- | --- | --- |
| tenant_memberships | unique tenant + user; owner roles tenant-level | KEEP as umbrella; create authorized store memberships separately |
| products | unique tenant + SKU; no store_id | Decide whether SKU is Store-local; assess collisions and API contract |
| orders / customers | tenant-scoped FK and select policy | Define Store ownership and optional tenant-global customer-sharing safely |
| order_items | order and product are tenant-scoped FK | Same-Store composite FK required if data is Store-specific |
| conversations / messages | tenant-scoped conversation relation | Define Store-scoped conversation and verified cross-channel account linking |
| tenant_agent_configs | PK tenant + channel | Profile/version binding per Store and Channel, preserve legacy readers |
| app_private.channel_secrets | existing tenant-oriented connection secrets | Authorized Page/OA per Store, private credential reference, no frontend secret exposure |
| n8n Messenger | Published, fixed Page mapping, legacy DEMO tools | Avoid cutover, preserve published version, mock signed routing first |
| n8n Shared Core | draft differs from Published | Pin and reconcile API contracts before any real query |
| Store Authority | PR #420 disposable PostgreSQL 17 only | Independent review and owner approval needed before a canonical schema cutover |

## Three privileged RPCs to review (NO CHANGES)

1. qa_shop_b_zalo_claim: SECURITY DEFINER, executable by anon. May have intentional proof flow; needs dependency mapping, challenge expiry, replay/rate limit, abuse and per-Store authority review.
2. qa_owner_pairing: SECURITY DEFINER, executable by authenticated. Needs caller inventory, active owner authorization, Store binding and audit.
3. save_merchant_product: SECURITY DEFINER, executable by authenticated. Current tenant-oriented writes cannot be assumed Store-aware; test price/SKU and permissions carefully.

These are advisory risk flags, not claims of exploit. Do not revoke or change security rights before signed-off impact analysis. SECURITY DEFINER can bypass RLS; a fixed search_path alone is not proof of safe authorization.

Supabase remediation references:
https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## Safe migration sequencing — design only

Phase 0: Freeze baseline SHA, full dependency/caller inventory, backup/restore evidence, tenant and Store ownership decision.
Phase 1: Create isolated Store Authority schema preview + FK/index/restrictive policy QA in disposable environment. Reuse design from PR #420.
Phase 2: Design non-breaking compatibility adapter for tenant-only legacy and new store-aware structures, with no real sends or writes. Do not hide ambiguous legacy rows.
Phase 3: Owner approves staged migration plan after collision and rollback review. Use real SQL only when approved in private staging.
Phase 4: Actual Supabase Auth Owner A/C same-tenant and Owner B separate-tenant RLS acceptance with read-only JWT-scoped queries.
Phase 5: Private read-only Commerce industry adapter and regression test; release remains separately approval gated.

## Explicit blockers

- Canonical stores/store_memberships absent.
- Tenant-only Commerce tables and FK/unique constraints.
- Real signed Owner A/B or Owner A/C JWT evidence absent.
- THREE privileged RPCs need P1 dependency review.
- No private hosted receipt with durable replay/identity proof.
- No verified protected Commerce reader contract; Core draft != Published.

Never declare a Store-specific SaaS release based on synthetic tests.
