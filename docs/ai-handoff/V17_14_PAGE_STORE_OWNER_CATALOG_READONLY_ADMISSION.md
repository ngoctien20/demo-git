# TIEN404 V17.14 — Real Meta Page → Store Ownership × Merchant Catalog Read-Only Admission

**Date:** 2026-11-17 JST. **Decision:** `GO_QA_PAGE_TO_SANDBOX_TENANT_CATALOG` and `NO_GO_REAL_PAGE_TO_STORE_OWNER_AND_CORE_CUSTOMER_REPLY`. Owner requested genuine Page→Store validation, accurate merchant products, central bot read-only counseling and **no order/stock updates**.

## Preflight: sources genuinely inspected

1. **Meta Page technical ingress:** Existing V17.13R real signed provider POST n8n execution `#4431` is VERIFIED. `Webhook1/Crypto/Verify Signature Timing-Safe` returned valid Meta raw-body HMAC. Page ID and recipient hardcoded allowlist matched. Existing Messenger DEMO sent exactly one reply accepted by Meta; shadow `#4432` and central `#4433` ran, with no central model or writes. This certifies an App/Page technical inbound path, NOT proof of private Meta Business ownership of a specific real merchant Store.
2. **Existing Page channel mapping:** n8n Data Table `TIEN404_COMMERCE_CHANNELS` ID `gKN8yR1CabZT2nZ8`: exactly one enabled messenger row for Page ID `2379295362359912`, mapped to `tenantId=demo_tien404`, `connectionStatus=sandbox`, no Commerce credential reference; corresponding `TIEN404_COMMERCE_TENANTS` ID `3WaS0PEoqjlmMeKB` shows `shopName=Tien404 AI Demo Shop`, `status=sandbox`, `plan=demo`. This is not an independently owned real Store. Zalo OA remains unconfigured.
3. **Existing Commerce catalog:** n8n `TIEN404_COMMERCE_PRODUCTS` ID `0apQXtt2gcKfVaSl` contains sample-only `demo_tien404` products:
   - F-101 `Áo phông unisex cơ bản (MẪU)`, sample price 159000 VND, sample stock 20.
   - F-102 `Áo sơ mi slimfit (MẪU)`, sample price 289000 VND, sample stock 12.
   - Other QA tenants (materials and groceries) have distinct sample catalogs, do not belong to this Page.
4. **Canonical hosted Supabase Postgres 17 staging:** live read-only query: `public.stores` NOT PRESENT, `public.store_memberships` NOT PRESENT, zero `store_id` columns on Products/Orders/Order Items/Customers/Conversations/Messages, zero Store-qualified RLS policies. The two hosted Tenants have **synthetic QA-only** Products `QA-A001` and `QA-B001`, not the real Page's shop catalog. Never infer Store from Tenant.
5. **Staff-friendly native Commerce Google Sheet:** `1siR8y7lxrYch8w6P1CVn5ta6XdWpYX9NJ384Yb1kujw`, tab `SAN_PHAM` bounded live read `A1:J8`: **header only**, zero merchant product rows. Still not connected LIVE. Thus cannot claim verified market product prices/stock or catalog revision.
6. **Owner authority:** V17.1E checkpoint records historical owner self-attestation/screenshots for current Page Full Control and developer App Admin, but does **not** independently verify actual current private Meta Page control/Store ownership. Connected Browser has no authenticated Meta Business Manager/Developers tab. No verified Page→merchant Store authority evidence, no current independent Store owner row, no private Page subscribed-app/role readback. Do not upgrade operator-attested to VERIFIED.

## Actual new n8n executable QA

Created manual-only **INACTIVE** n8n workflow:
- **`oeq7G38t916BdyJ8`** — [TIEN404_V1714_REAL_PAGE_TO_TENANT_CATALOG_QA_NO_SEND](https://ngoctien20.app.n8n.cloud/workflow/oeq7G38t916BdyJ8), version **`1cf1c059-caad-47b4-b6d1-2abe9670f730`**, in Personal / `90_QA - DIAGNOSTICS`.
- Validated n8n Workflow SDK code before creation. Manual trigger → 8 synthetic Page/Tenant/catalog queries → **8 direct subworkflow calls to the existing actual Published `TIEN404_COMMERCE_CATALOG_QUERY` `oOOXicKXGkBskKqh`** with `mode=each` → fail-closed price, tenant and product-leak assertion.
- **Actual n8n execution `#4435` SUCCESS — 8/8 PASS**. One real existing Commerce catalog read-only invocation per case; no new credential, no model, no send, no order/stock write, no actual customer data:
  1. Existing signed Page ID → F-101 only, sample price 159000.
  2. Existing signed Page ID → F-102 only, sample price 289000.
  3. Unknown Messenger Page → DENIED, zero returned products and no tenant ID.
  4. Existing Page asks for another tenant's VL-101 → zero products.
  5. Materials QA website → own VL-101 only, sample price 79000.
  6. Grocery QA website → own TG-101 only, sample price 4500.
  7. Existing Page query `*` → exactly F-101/F-102, no other tenant records.
  8. Materials QA website asks for Page F-101 → zero products.
- Final code output `V1714_ACTUAL_PAGE_TENANT_CATALOG_QA_8_OF_8_PASS`, `pageToTenantMappingVerified:true`, `pageToStoreOwnershipVerified:false`, `catalogIsDemoOnly:true`, `canPromoteCommercialCatalog:false`. This verifies **tenant filtering in sandbox application code**, not DB-level JWT Store RLS.
- Existing G06 manual workflow `FqEcdmc8PRRMNUEb` re-run **execution `#4452` SUCCESS 36/36** (7 allowed, 28 denied, 1 duplicate), with `real_provider_signature_verified:false`, `real_store_owner_verified:false`, `real_jwt_rls_verified:false`, `can_publish:false`. All provider credentials/signatures simulated in G06; do not claim they are native live proof.

## Security release gate — prior to any REAL merchant Page → Store binding

**REQUIRES independent private evidence (not customer text, not credentials in GitHub):**
- `Meta Page authority`: authenticated owner/admin Page access read-back in Meta Business Suite or scoped official Graph API Page task/access evidence; exact App ID / Page ID / Page subscription verification, no token disclosure. Signed webhook shows technical App/Page provenance but *not* merchant/Store ownership by itself.
- `Store authority`: actual verified merchant owner principals and Store ID recorded server-side, Page installation authorized to exactly one Store, independent attestation from original merchant, verified revocation path. **Do not map to Store merely because the tenant name looks plausible.**
- `Product authority`: merchant explicitly approves SKU, name, retail/wholesale price, stock, active status, image URL if used, catalog source and freshness revision. Staff Google Sheet should be imported through a supervised, authenticated, sanitized read-only process (not open arbitrary external URLs or active formulas/scripts); no real data present yet.
- `Read-only permissions`: Core gets **only verified server context**, not client-supplied store/tenant IDs; catalog query enforces Store-qualified least-privilege RLS; remove or disable support-ticket/write tools from the actual customer-facing Core candidate; quote is explicitly non-binding until confirmation.
- `Test gate`: authorized Page→Store A actual Product/price/stock read, unbound Page deny, same-Tenant Store B deny, deauthorized Page deny, invalid signature deny, stale catalog deny, duplicate event no second send, no order/stock/ticket/PII write, rollback verified. Test on scoped QA identities before exposing to customers.

## Release decisions

| Capability | Verdict |
| --- | --- |
| Existing Messenger signed ingress and legacy DEMO reply | VERIFIED / unchanged |
| Existing Messenger Page→n8n DEMO Tenant mapping | VERIFIED (sandbox only) |
| Actual n8n tenant catalog negative/positive read-only test | TESTED 8/8 / demo prices only |
| Synthetic QA Store signature scenarios | TESTED 36/36 / not live proof |
| Meta current Page owner authority → one real merchant Store | **BLOCKED / NOT VERIFIED** |
| Real Merchant product data and Store-scoped RLS | **BLOCKED / NOT VERIFIED** |
| New Core customer-facing advice | **NOT ENABLED** |
| Real create order, stock, payment, shared customer PII | **DENIED** |

## What changed / QA / rollback

- Created one INACTIVE 4-node QA workflow and ran read-only 8/8 plus existing G06 synthetic 36/36. Nothing changed in existing Published Messenger `ff7a57d2-519a-4283-933c-37a854df92d2`, Shadow Bridge `450f2693-aad9-47d8-aaba-ac7a94abe644`, Core `ddc3ce5b-365e-47e2-a06d-08daffceb9a8`, Zalo staging, live Meta callback, Supabase DB, Google Sheet or credentials.
- New QA workflow rollback: leave inactive or, with operator approval, archive. Existing production rollback: Messenger prior-good `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`, if a regression occurs; no republish needed for this task.
- **Next operator action:** obtain private Meta Page Full Control/App binding readback (Meta authorized account, *not* a pasted token), Store owner source-of-truth and real product rows. Once present, implement dedicated authenticated read-only per-Store catalog connector, first real signed NO-SEND core catalog preview, then canary customer-facing advice with strict no-write tool allowlist. Commercial order/stock LIVE requires separate approval and tests.
