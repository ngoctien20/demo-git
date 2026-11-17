# TIEN404 AI V17.23J — Owner Provenance & Private JWT Admission

**DRAFT SOURCE-ONLY / PRIVATE EVIDENCE NOT RECEIVED / HOSTED UAT NO-GO / PRODUCTION NO-GO**

## Parent & independent pre-existing systems
- Direct parent: V17.23I [PR #352](https://github.com/ngoctien20/demo-git/pull/352), HEAD `cf9dfb81e7f2849a4075ac486958413cce0a9fa7`.
- Private original evidence intake: RPC12 [PR #244](https://github.com/ngoctien20/demo-git/pull/244), HEAD `c18ea0e23d95ddc1078fb2966a24f669b3e311c7`, `qa/v152-rpc12/private-operator-intake.cjs`. **Do not duplicate or bypass the private file-intake protocol.**
- Disposable PG17 Store A/B inherited from [PR #346](https://github.com/ngoctien20/demo-git/pull/346), CI run 44089888136; not real JWT proof.

## Direct read-only Supabase baseline (2026-11-17 JST)
Project `ifxlvrhyjhbzbrkdsida`: 2 tenants, 2 products, 2 orders, 0 customers, 3 Auth users, 5 sessions. `public.stores`, `public.store_memberships` absent; 0 of 6 Commerce surfaces have store_id. `tien404_r1_qa.tenant_identity_map` has 2 rows; `owner_bindings` has 2 rows, yet **0** same-tenant Store A/B pairs. `tien404_v175_qa.auth_customer_binding`, `channel_identity`, `order_ownership` all have zero rows.

**Original real records:** exactly 2 Product + 2 Order require independent, primary-source Store lineage. Do not publish real UUIDs or assign store based on Tenant membership, SKU, channel key, imported data or AI inference.

## Private Operator process (existing RPC12; not executed here)
1. Private authenticated Operator confirms real authority, independent reviewer, expiry, scope and pre-approved data boundaries.
2. RPC11/12 local-only reconciliation reads four original row identities **outside the repository**. Link each record to exact Store with original merchant records and out-of-band attestations. Original identifiers and signatures must not be uploaded to GitHub, ChatGPT or public R2.
3. Independently establish current M0 recovery after owner-selected scope and separately approved restore. Historic H11R partial archive remains owner-accepted with limitations but not sufficient for M1.
4. After authorized M1 + M2/M4 + M3 and independently audited same-Tenant Store Owner mappings, run *private authenticated* real Supabase JWT A/B UAT using two sessions validated by issuer and database; validate revoked/foreign Store, cross-customer, channel signature, challenge replay. **No provider sends, no order writes.**
5. Independent Reviewer signs acceptance outside this public CI. This repository never authorizes hosted actions from a self-supplied flag.

## New V17.23J safe source contract
- `private-owner-provenance-gate.mjs` validates only an **opaque four-slot metadata manifest** (T1_PRODUCT/T1_ORDER/T2_PRODUCT/T2_ORDER) with 3 distinct evidence classes per slot, no row IDs or PII.
- Every output remains `storeOwnershipCertified=false`, `canApplyM1=false` and `real JWT NO-GO`. It cannot verify any signature, original ledger, Merchant identity, JWT or provider event.
- GitHub source CI tests negative cases. No secret input; no provider, database or network operations in application modules.
- Store owner claims from QA table are not proof of canonical Store membership.

## Newly verified privileged RPC review candidates (no change)
Supabase `public.qa_shop_b_zalo_claim` is SECURITY DEFINER with anon EXECUTE; `public.qa_owner_pairing` and `public.save_merchant_product` are SECURITY DEFINER with authenticated EXECUTE. These **require authorized caller inventory/code-path/security audit**, not presumed exploitable. Never REVOKE or call them without independent migration/caller approval.

## Rollback and release boundary
Close Draft PR only. No Supabase schema or role changes; no credentials; no backup; no owner data; no CI deployment; no n8n Published edits; no Messenger/Zalo send; no paid services. Real JWT and hosted migration remain **BLOCKED**.
