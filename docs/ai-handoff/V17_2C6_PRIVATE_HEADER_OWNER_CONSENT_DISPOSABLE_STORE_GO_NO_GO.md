# V17.2C.6 — Private Header Name Attestation × Authorized QA Actor A/B Consent × Disposable Store Migration GO/NO-GO

Date: 2026-11-18 JST
Target: Supabase staging `ifxlvrhyjhbzbrkdsida`; n8n Cloud Published Zalo V2 `OgDZNSAvKEvhnAvn`.
Parent checkpoint: GitHub Draft PR #392, V17.2C.5 HEAD `9794f48ba36692891bc85d87f42bf07249ce23d6`.
**Decision: NO-GO_STRUCTURAL and NO-GO_PRIVATE_HEADER_CONSENT. No hosted security/migration admission.**

## A. Header provenance: independently verified vs not proven

- The live Published workflow remains ACTIVE, published ID `f00ba506-c52a-4340-9a0c-809fd9c6ea9a`. The `Submit pending claim for Shop B` node makes a POST request to `/rest/v1/rpc/qa_shop_b_zalo_claim`.
- Its credential type is `httpHeaderAuth`, exact linked credential ID `5wSQ7jWTd6JRfcCm`, and credential display name (metadata only) **`TIEN404_QA_SHOP_B_ZALO_PAIRING`**. Explicit node header name is `apikey`.
- n8n's available `list_credentials` action provides credential ID, display name/type and scopes, but **not the header name/value inside the credential**. Its display name does not attest that the credential emits `x-tien404-pairing`.
- The Supabase SECURITY DEFINER SQL checks header `x-tien404-pairing` against its private Vault gate. No secret was read; no POST was invoked.
- The one available historical execution `2858` is manual and status success on 2026-11-13, but there is no evidence the target HTTP node executed successfully, or that its pairing secret was accepted.

**Private human operator step (non-secret attestation only):** In n8n workflow editor open `Submit pending claim for Shop B` → credential `TIEN404_QA_SHOP_B_ZALO_PAIRING`; inspect **Name** field only (never share the Value). Report whether Name is exactly `x-tien404-pairing`; keep credential secret/refresh token in n8n. The operator should not edit or test the credential until a separate approved disposable target is available. A screenshots of the Name field must conceal the Value and credential IDs if showing any. If name differs, record mismatch; do NOT silently rotate a live credential.

## B. Authorized Auth QA actors: aggregates are not consent

Read-only Supabase authority snapshots returned:
- 3 existing Auth users, 3 active owner memberships, exactly one Tenant with >=2 distinct Auth-backed owners.
- 2 QA bot mapping rows, but **zero** Tenant with >=2 distinct QA store keys, and **zero** Tenant with both >=2 owners and >=2 QA store keys.
- `public.stores`, `public.store_memberships`, `public.channel_installations` absent.
- `store_id` columns across products/orders/order_items/customers/conversations/messages: zero.
- Existing public business records: 2 products, 2 orders, 0 customers. Do not mutate/relabel them or use them as test fixtures.

**Consent/authority requirements not yet met:** Two separate Auth accounts in a Tenant do not prove Store ownership. No existing user is automatically enrolled into QA; do not query/display email, phone, names, UUIDs, JWT or private sessions. A and B must each consent in a protected operator-controlled channel to a precisely scoped disposable QA Store role; independent reviewer checks the issued tenant/store mapping. Consent receipts store only pseudonymous, non-reversible audit references in a private registry, with expiry/withdrawal capability. A public ChatGPT statement alone cannot prove a second account owner's independent consent.

## C. Executable read-only gate and result

File: `qa/v172c-rpc-closure/v172c6-readonly-store-admission.sql`.

This SELECT-only SQL was fetched at commit `b6cbcf823daad4edb197c55b0bf2866fb2dff9e4` and executed against the real staging database without DDL/DML:

```text
auth_user_count                             3
tenants_with_two_auth_backed_owners         1
tenants_with_two_qa_store_keys              0
tenants_with_owner_and_qa_two_store_overlap 0
canonical_tables_existing                  0
commerce_store_id_columns                  0
existing_product_rows                      2
existing_order_rows                        2
existing_customer_rows                     0
admission_result                           NO_GO_STRUCTURAL
```

This is a verified **structural gate**, not a JWT negative UAT. The SQL intentionally returns `REVIEW_ONLY_NOT_APPROVED` even if structural conditions become nonzero; it never grants approval automatically.

## D. Disposable Store migration admission matrix

| Gate | Current evidence | Decision |
|---|---|---|
| Supabase project healthy | ACTIVE_HEALTHY PostgreSQL 17.11 | PASS metadata only |
| Existing Tenant owner identities | 1 Tenant with >=2 active Auth-backed owners | PASS prerequisite only |
| Store A/B in same approved QA Tenant | 0 same-Tenant pairs in QA map; no canonical stores | NO-GO |
| Independent private consent A and B | No private two-party proof | BLOCKED |
| Zalo pairing header name/value provenance | Credential ID + type/name known; internal header Name not exposed | BLOCKED |
| Existing business data isolation | 2 products, 2 orders already present; no Store discriminator | NO-GO to backfill without independent mapping |
| Canonical schema/migration compatibility | No stores, store_memberships or channel_installations | DESIGN ONLY |
| Genuine JWT A/B negative test | No consented Store-specific sessions or read-only known fixtures | BLOCKED |
| Cost/recovery/migration approval | Not separately confirmed for disposable DDL | BLOCKED |
| Independent security acceptance | Not yet evidenced | NO-GO |

## E. Proposed sequencing, never an implicit approval

1. PRIVATE HEADER ATTESTATION: verify configured credential **header Name** only; keep secret Value private. If `x-tien404-pairing` is missing, propose a versioned isolated fix after caller compatibility QA, not a live change.
2. PRIVATE OWNER AUTHORITY: collect A/B consent in authenticated channels, define two Store roles in the SAME disposable Tenant, and verify independent owner approval/revocation handling.
3. DISPOSABLE SCHEMA ADMISSION: review no-cost bounds, explicit operator authorization, existing data backfill NO-GO, recovery plan and rollback; apply only to isolated QA after approval. Composite Tenant+Store FKs and Store membership check are mandatory.
4. REAL JWT READ-ONLY UAT: use two short-lived real private Supabase JWTs on known synthetic catalog: A->A allow, A->B deny, B->B allow, B->A deny; unrelated, unauthenticated, revoked, forged and expired deny.
5. Only then consider GRANT/REVOKE/RPC closure, dependent n8n Published migration and provider ingress QA with explicit human release gate.

No SQL DDL/DML, no Auth changes, no Zalo message, no n8n/Cloudflare runtime change, no credential read/write, and no customer order access. Only read-only metadata queries and source-only additions. Rollback by closing Draft PR #392 or reverting the audit SQL and this checkpoint.

**Checkpoint classification:** VERIFIED (runtime read-only), IMPLEMENTED (SQL evidence and docs), TESTED (SQL on staging, returned NO_GO_STRUCTURAL), PROPOSED (migration and consent workflow), BLOCKED (private header Name, independent A/B consent and real JWT), RELEASED (none).
