# TIEN404 V18.0-P0D — Store A/B authorization enforcement (DISPOSABLE ONLY)

**Status: CANDIDATE / SOURCE-ONLY / NO HOSTED MIGRATION / NO REAL JWT.**
Related: original P0C Draft PR #385 (reused), release Issue #368, RPC17.8B #362.

## Evidence and reproduction

- `store-scoped-rls-disposable.sql` requires exact disposable DB name `t404_v180_p0d_ci`, PostgreSQL >=17 and `current_user=postgres`, with no pre-existing test schema. **Never apply to actual Supabase.**
- Creates 9 synthetic QA tables: stores, memberships, products, customers, orders, order_items, conversations, messages, channel_installations.
- Two different Stores A/B inside one tenant, plus Store C in another tenant. All use UUID tenant+store scopes. Products support duplicate SKU values across different Stores.
- FORCE RLS on all 9 tables; invoker-only `can_access` consults active database membership and active Store, NEVER editable `user_metadata`; only current-session simulated `auth.uid`.
- Products read roles owner/manager/staff; writes owner/manager only; customer/order/conversation/message/install reads owner/manager; no client direct order writes in candidate. Store transfers blocked by an immutability trigger even for a user belonging to both Stores. Cross-Store composite FK checks on order/customer/product and message/conversation.
- RPC candidate `shop_qa.save_product_scoped` **only in isolated test schema**, not a replacement of legacy `public.save_merchant_product` in staging. Explicit owner/manager Store proof, optimistic concurrency and same Store write.
- Asserts positive and negative cases for owner A, owner B, staff A, unrelated actor, dual Store A+B actor, other-tenant actor, revoked member and suspended Store; crosses FK boundaries and checks no cross-Store updates.
- Uses fake JWT subject via PostgreSQL test GUC; **this is NOT Supabase JWT verification** and must never be treated as authentication if used by a public client. Real authenticated ingress must come from the Supabase Auth/verify_JWT layer.

## RPC10 CI investigation

Inherited workflow `.github/workflows/v152-rpc10-six-surface-nohost.yml` at blob SHA `825ce7daeb388f9132831a3ae4dec16d3bbbd73d` contains a truncated Python G0.2 assertion, detached `run: |`, and duplicate job keys. This causes zero-job GitHub Actions failures on the P0C parent and inherited branches, **not a PostgreSQL regression**.

**Already fixed independently** in [Draft PR #328](https://github.com/ngoctien20/demo-git/pull/328), head `f33086ac7f5c3a98c825c4c35944d719b561910c`; its [run #44079319453](https://github.com/ngoctien20/demo-git/actions/runs/44079319453) was SUCCESS. Do not duplicate or edit RPC10's workflow in this P0D branch. Merge/port must be separately reviewed by responsible team and synchronized with release graph.

## No-go and waiver

- Real Supabase public Commerce tables remain tenant-only and have no store_id. This is a **new disposable candidate**, not proof of production Store isolation.
- Native Meta/Zalo signatures, real customer account pairing, real tenant/Store JWT, published n8n caller graph, backup/restore and hosted database migration remain untested/unapproved.
- Founder deferred backup evidence **only** for source-only and disposable QA. Restore proof is still required before any staging/production changes.
- No new paid external services, credentials, provider sends, tenant/customer rows, migrations, RLS/grants of existing DB, or production publish.
- Rollback is closing Draft PR #385; GitHub Actions container is ephemeral.

## Review gates

1. Confirm SHA, explicit PASS notices, GitHub run ID and fake DB preflight.
2. Verify there are 9 FORCE RLS tables, member role predicate and `WITH CHECK` for product writes.
3. Evaluate security with verified realistic hosted JWT/claim source before any migration.
4. Add approved migration plan and tested restoration only when staging change is proposed.
