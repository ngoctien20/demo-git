# TIEN404 V17.5 — Product-First Trusted Store Binding × Hosted RLS Read-Only Checkpoint
**Date:** 2026-11-17 (Asia/Tokyo)  
**Status:** `VERIFIED metadata + PRIVATE QA STRUCTURE` · `BLOCKED hosted same-tenant Store JWT acceptance`  
**Release:** `NO_GO` · **Production mutations:** 0 · **Messages:** 0 · **Model calls:** 0

## 1. Decision and lineage

User approved continuing the next step after simplifying Google Sheets. Maintain the **two-tab, product-first** workbook as the operator-friendly QA view, NOT a 31-tab merchant UI and NOT the authorization backend.

- **Authoritative operator QA file:** [TIEN404_PRODUCTS_SIMPLE_MERGED_QA_V17_4](https://docs.google.com/spreadsheets/d/1xVCzUPVhyUJ0v0pYNpJQKwOKzlr-gNoOCEMkS7AEmKc/edit); `Products` gid `1759621798`, `HUONG_DAN`. 30 DEMO rows = 21 legacy AI_SALES_DEMO snapshots + 3 Shop A synthetic + 3 Shop B synthetic + 3 Shop C synthetic. Keep 5 legacy headers in order: `sku,name,price,stock,price_clean`.
- Additional 9 fields: `store_id,category,variant,unit,wholesale_price_clean,status,image_url,source,demo_only`; **14 fields total**. `wholesale_price_clean` blank for legacy entries; do not invent a price rule or vendor product image.
- **Real, separate QA:** n8n workflow [V17.4 manual products QA](https://ngoctien20.app.n8n.cloud/workflow/ZKTkS5eeo2cMiXWD), execution `4348` **SUCCESS 15/15**, read-only, 0 model calls / order writes / provider sends. These 15 are product fixture and n8n fixed-filter checks only; do NOT treat them as real JWT-RLS acceptance.
- **Only QA bot was pointed to the simple Sheet:** [inactive bot](https://ngoctien20.app.n8n.cloud/workflow/8HtaQAJuZWKyNhXu) draft version `f56aa370-1254-470f-9813-0960d72a97b6`. `Read Products QA ONLY` has a static `store_id=S_QA_A` read filter. This is a **QA routing/filter**, not an RLS security boundary. Order tools remain disconnected.
- **Preserve** `AI_SALES_DEMO` original Products/Orders/Customers, 31-tab technical workbook V17.2, published Messenger `Z7FdV7uDvApfbURQ` version `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`, Zalo production, Supabase existing records/credentials. No replacement of legacy order-price source.

Existing parallel source/QA lineage must NOT be rewritten: [Store Ownership/RLS Gate #247](https://github.com/ngoctien20/demo-git/pull/247), [Hosted Security Audit #246](https://github.com/ngoctien20/demo-git/pull/246), [Custom Bot Channel First #243](https://github.com/ngoctien20/demo-git/pull/243). All were DRAFT when inspected. This V17.5 checkpoint is an isolated **read-only evidence and adapter contract**, not a competing M0/M1/M3 migration.

## 2. VERIFIED Supabase hosted observation (STAGING ONLY)

Project: `ifxlvrhyjhbzbrkdsida`, PostgreSQL 17, read-only SQL executed through connected Supabase tool on 2026-11-17. **No real customer or credential rows queried.**

| Observation | Hosted result | Interpretation |
| --- | --- | --- |
| Six canonical surfaces (`products,orders,customers,order_items,conversations,messages`) | 6/6 RLS ON and FORCE RLS | Existing baseline; tenant protection, not Store proof |
| `store_id` fields across these six surfaces | **0/6** | **P0 NO_GO** for same-Tenant Shop A/B |
| Canonical `public.stores` and `public.store_memberships` | Both absent | **P0 NO_GO** for owner authority |
| Store-qualified public RLS policies | **0** | **P0 NO_GO** |
| Private `tien404_r1_qa` `shop_bots / owner_bindings / catalog / sandbox_orders` | **2 / 2 / 2 / 4** | Separate QA structures, not production Store authority |
| Private QA unbound bots / orphan bindings / orphan catalog | **0 / 0 / 0** | Positive structure/read-only data integrity, not JWT isolation |
| Private QA composite scoped foreign keys / scoped uniques | **9 / 4** | Qualified Tenant–Store–Bot enforcement exists in QA schema |
| Public SECURITY DEFINER functions callable by anon | **1** | Privileged surface requires deliberate source/permission review |

The one anon-callable privileged function is `public.qa_shop_b_zalo_claim`. Prior source review found a Vault-backed header guard; **do not report an actual exploit and do not blindly REVOKE**. Two other privileged RPCs are callable by authenticated users, including `save_merchant_product` which remains tenant-scoped, not Store-scoped. Keep security review gate open.

**Repeatable live source query:** `qa/v175-products-store-rls/hosted-readonly-preflight.sql`. It selects metadata and counts ONLY. Counts can change with ongoing tests; always capture new exact run timestamp before making a release decision.

## 3. Product-first Commerce adapter — PROPOSED (not connected)

The two-tab Google Sheet should be easy for a shop owner to operate, while tenant/store security stays in server-side identity and transactional database storage.

```text
Verified Meta/Zalo/Website ingress (native signature, strict replay/dedupe)
     -> SERVER resolver verifies {channel_id, installation/page_oa_id, tenant_id, store_id, bot_id}
     -> owner/member/merchant authority (database) + subscription gate
     -> Store-bound Product adapter (SKU + price_clean integer VND + stock integer)
     -> Read-only quote preview, stock and special-quote gate
     -> explicit customer confirmation -> separate approved order commit adapter
     -> idempotent transactional order + outbox (only after gated release)
```

**Non-negotiable invariants:**

1. The customer, model, prompt, Sheet row or webhook payload cannot choose an authoritative `tenant_id` or `store_id`. Derive it server-side from previously authenticated channel/merchant binding, then revalidate it for each tool.
2. In the new Sheet, `DEMO_LEGACY` is untrusted snapshot data from AI_SALES_DEMO; do not expose it to Shop A as a shared public catalog. `S_QA_A/B/C` are synthetic labels, **not** Supabase authenticated Store UUIDs. No implicit mapping from them into hosted `public` records.
3. Read only rows for the *server-resolved* Store. Client-supplied Store/SKU, metadata and requested price are never a privilege grant. Static n8n Sheets filter is a QA convenience, not a secure RLS substitute.
4. Use integer `price_clean` / `stock`. Fail closed on price mismatch with human-facing `price`, non-integer/negative stock, inactive product, SKU collision, absent price/stock, cross-Store request, unverified wholesale policy, or special quote shipping condition.
5. Split read-only quote from actual order creation; customer confirmation cannot itself turn on write capability unless owner-approved transactional writer and JWT Store authority exist.
6. Never wire Products preview to legacy DEMO order tools with a different source of truth. Preserve `Create Order`, `Manage Order`, `Update Order` legacy DEMO until a separate atomic migration/QA gate is passed.

## 4. M0 → M1 → M3 (review-only, no hosted DDL)

- **M0 ownership + recovery:** private four-row Store owner evidence accepted by independent operator, verified encrypted backup *and restore rehearsal*, affected RPC/caller inventory, explicit rollback plan, and classification of every existing tenant-only row. Earlier "backup performed" or locally saved archive is not automatically verified full hosted recovery.
- **M1 expand-only:** introduce canonical `stores`, `store_memberships`, and Store FK identifiers on **all six** business surfaces in a backward-compatible staged migration, no synthetic default Store for ambiguous real rows. Do not auto-promote QA label `S_QA_A` into Store UUID.
- **M3 composite integrity:** `(tenant_id,store_id)` ownership FK; `(tenant_id,store_id,sku)` catalog uniqueness; same-Store child→parent composite constraints for `order_items`→`orders` and `products`. Cover conversation/message and customer linkage as well.
- **RLS acceptance:** positive and negative tests using real, independently verified Shop A and Shop B JWTs under the SAME Tenant; verify anon, revoked owner/manager, cross-store, cross-tenant, role escalation, RPC service/bypass and UPDATE `USING`/`WITH CHECK`. Must prove both isolation *and legitimate access*, not just an empty result from an unauthenticated role.
- **Order-write release:** fresh Store-bound price/stock readback; atomic quantity/price revalidation and customer-confirmed quote, idempotency/unique keys, concurrency, outbox HELD by default, rollback and audit. Authorized disposable test only first; external provider send needs distinct scoped approval.

## 5. Acceptance gates and scope boundary

| Gate | Result | Why |
| --- | --- | --- |
| Simple two-tab product data and 30 unique SKUs | `TESTED / PASS` | V17.4 #4348 15/15 |
| Private QA composite relations / orphan checks | `VERIFIED / PASS as metadata` | 9 scoped FKs; zero orphans among checked rows |
| Hosted canonical Store ownership for six Commerce surfaces | `BLOCKED / NO_GO` | Store tables/columns/policies missing |
| Hosted Shop A/B **real JWT** isolation | `NOT TESTED / NO_GO` | No independently authenticated Store JWT acceptance |
| Privileged RPC release security | `REVIEWED / NO_GO` | Definer call grants and implementation impact need authorized review |
| Actual model answer / provider send / order commit | `NOT TESTED / NO_GO` | No cost/send/write approved in this scope |
| Recoverable hosted migration and rollback | `BLOCKED` | Independent backup+restore proof not established |

**Changed in this work:** GitHub read-only preflight + checkpoint ONLY. No Supabase DDL/DML/GRANT/REVOKE, no workflow changes, no Meta/Zalo webhook or messages, no model call, no payment.

**Rollback:** close this draft PR/branch; remove no running resources. Existing n8n QA and Sheets remain as previously verified; no production rollback necessary.

**Next action:** Get independent M0 Store owner evidence and hosted backup+restore approval, then prepare additive migration on isolated branch for explicit review, without replacing PR #247's six-surface gate or PR #246's security audit. Only after that can any store-scoped JWT-RLS and real Commerce order write be marked TESTED.
