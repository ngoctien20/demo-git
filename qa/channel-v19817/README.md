# TIEN404 V19.8.17 — Disposable PG17 Store Migration × Composite FK × Legacy Compatibility

**Scope CANDIDATE / separate from hosted**. Extends V19.8.16 Draft PR #470. The SQL file is an explicitly isolated PostgreSQL 17 **migration drill** and is not a Supabase migration or authoritative hosted schema snapshot. DO NOT APPLY it to Supabase hosted/staging, any real PostgreSQL database, or any environment containing customer records.

## What gets executed
GitHub Actions starts a fresh `postgres:17` service on loopback and executes a **fixture that mirrors the structural issues confirmed in the hosted audit**: six tenant-scoped Commerce tables, tenant-level FKs, unique `(tenant_id,sku)`, tenant-only legacy writer. It inserts synthetic historical Store A data, then explicitly assigns those artificial rows to Store A (not an approach for real data). A new Store B in the **same Tenant** is added with SKU F01 at a different VND price.

The drill creates `stores`, `store_memberships`, Store columns in six Commerce tables, non-null lineage, composite parent candidate keys, and composite FKs for Orders→Customers, OrderItems→Orders, OrderItems→Products, Messages→Conversations. It substitutes tenant-only SKU uniqueness with tenant+Store SKU uniqueness **inside the throwaway database only**. It validates positive Store B same-SKU insert and negative cross-Store FK collisions, missing Store identity and duplicate within Store.

A separate `t404_v19817_legacy` simulation holds the unchanged tenant-only legacy DEMO writer. Its function definition checksum and ability to write after migration are checked. **This proves only synthetic compatibility**, not deployed n8n or Render callers. Old tenant-only inserts into the NEW canonical product schema intentionally fail closed.

## Security limits
- The PostgreSQL drill has no Supabase Auth or real owner JWT. V19.8.15 separately accepted 26/26 local GoTrue/JWT registry QA.
- RLS is enabled and forced on new fixture tables **without authenticated grants or policies**; the DDL tests integrity constraints only. No claim that hosted RLS passed.
- No real owner claims, provider callbacks, Zalo API or secret, customer data, order mutations, published n8n workflows, payment channels, or hosted migration.
- The synthetic Store A assignment must **never** be inferred for legacy hosted orders/products. Collision and writer acceptance must be signed off after complete caller inventory and backup/restore readback.

## Required hosted gates
1. Verify authentic backup origin, integrity digest, retention, restore and rollback on isolated snapshot.
2. Close n8n Published/Draft, Render, Cloudflare Worker and Supabase SQL/RPC caller inventory. Legacy DEMO remains separate.
3. Review real owner→Tenant→Store bindings; no automated legacy Store backfill.
4. Review nullable customers and Store-scoped foreign key strategy, real migration lock impact, SKU collisions, and RLS changes.
5. Confirm exact migration under a disposable restored snapshot with rollback and independent security review.
6. Explicit approval for any hosted DDL/DML/credential/publish or costs.

**Release decision:** local drill may become TESTED only after GitHub Actions completed SUCCESS. Hosted/production remain **NO-GO**.

**Rollback:** close this Draft PR or revert only the new QA files. PostgreSQL CI service is disposed; no hosted rollback is needed.
