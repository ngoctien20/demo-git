# TIEN404 V19.0-B7 — Store Authority Closure Evidence & P0 Inventory

**Date:** 2026-11-18 JST
**Status:** Live Supabase metadata audited read-only; disposable PostgreSQL 17 RLS rehearsal tested; **real Store Authority NOT CLOSED**.
**Existing design authority:** V18.3.6D PR #417 (OPEN DRAFT). Do not replace its schema or release path.

## 1. Live Supabase facts (verified by SELECT)

Project: tien404-staging, PostgreSQL 17.11, region ap-southeast-1.
The following four public tables each currently have tenant_id but NO store_id:
- orders
- products
- customers
- conversations

Also inspected: public.order_items and public.messages. Their current SELECT policies remain Tenant-scoped.

Current six policies, all PERMISSIVE SELECT for authenticated:
- products_member_read: active Tenant member
- orders_manager_read: active Tenant owner/manager
- customers_manager_read: active Tenant owner/manager
- conversations_manager_read: active Tenant owner/manager
- order_items_manager_read: active Tenant owner/manager
- messages_manager_read: active Tenant owner/manager

The inspected six tables have no restrictive Store boundary. This establishes a **design/data boundary gap**, NOT proof that unauthorized access to real rows occurred; no real JWT A/B private data queries or customer records were read.

Confirmed privileged writer:
- public.save_merchant_product(p_tenant uuid, p_sku text, p_name text, p_price bigint, p_active boolean, p_initial_stock integer, p_expected_updated_at timestamptz)
- SECURITY DEFINER = true
- authenticated EXECUTE = true
- anon EXECUTE = false
- No store_id argument. Do not add a NOT VALID Store check or revoke/replace this RPC until all callers, compatibility and rollback are independently approved.

Confirmed products uniqueness: UNIQUE(tenant_id, sku). This conflicts with potential Store-local SKU uniqueness; do not switch to (tenant_id, store_id, sku) without decision D-02, legacy plan and writer audit.

## 2. What B7 actually rehearsed

The disposable GitHub Actions PostgreSQL 17 service creates only synthetic roles/tables in b7_fixture schema:
- Tenant1 Stores A/B/suspended, Tenant2 Store C;
- Owner A, Owner B, dual-member, Tenant Owner without Store membership, Staff, revoked, expired, Tenant outsider and unregistered actor;
- Legacy NULL Store record;
- PERMISSIVE Tenant-wide SELECT plus deliberately broad adversarial permissive true rule;
- Restrictive Store-scoped RLS AND membership/active store check.

Fifteen SQL assertions passed through SET ROLE as synthetic PostgreSQL roles:
- Owner A only A; Owner B only B; dual membership A+B;
- Tenant Owner without explicit Store membership sees zero Commerce rows;
- revoked and expired membership denied;
- Staff Store A read allowed but no direct UPDATE;
- tenant2 actor only Store C;
- unknown actor denied;
- legacy NULL Store row invisible;
- suspended Store row invisible;
- adding an adversarial permissive rule does not override the restrictive Store boundary;
- no direct INSERT/UPDATE/DELETE grants in this fixture.

**Scope qualifier:** PostgreSQL SET ROLE with synthetic DB roles is NOT Supabase Auth JWT verification. The fixture uses current_user to model actor identity only. Real RLS must use authenticated auth.uid(), Store memberships, DB privileges and private helpers approved in PR #417. No real Store A/B JWT test has passed.

## 3. Reuse V18.3.6D, do not make parallel authority

Existing V18.3.6D contracts to carry forward:
1. user subject comes from Supabase Auth, NEVER from Bot payload/client input;
2. Store membership separately required even for Tenant Owner;
3. canonical Tenant+Store+row composite foreign keys;
4. restrictive Store policy narrows existing permissive Tenant policy;
5. immutability of tenant_id/store_id on normal UPDATE, with controlled legacy backfill;
6. channel provider account/installation must bind to exactly one approved Store;
7. legacy rows without ownership evidence stay quarantined/NULL and invisible;
8. product SKU uniqueness choice D-02 awaits approval;
9. service-role bypass and public SECURITY DEFINER calls must be inventoried and gated;
10. physical deletion and subscription/payment changes stay out of B7.

## 4. Closure criteria and current result

| P0 gate | Evidence needed | Result |
|---|---|---|
| Canonical public.stores + store_memberships | Real schema, RLS and roles | BLOCKED |
| Store ID on six Commerce tables | Migration and FK validation | BLOCKED |
| Restrictive Store boundary | Scoped policy migration on live staging | BLOCKED |
| Authenticated Owner A/B same-Tenant JWT testing | Positive self Store, negative cross-Store | BLOCKED |
| Store-local SKU and legacy compatibility | D-02 decision + migration | BLOCKED |
| save_merchant_product writer cutover | All callers + no-write staging proof | BLOCKED |
| Merchant-approved provider->Store installation | Independent provider identity evidence | BLOCKED |
| Legacy NULL mapping | Signed mapping manifest + quarantine | BLOCKED |
| Disposable PostgreSQL 17 Restrictive RLS rehearsal | Synthetic role assertions | TESTED |
| Production order/inventory writes | Authorized atomically scoped service | NO-GO |

Do not silently change any blocker to VERIFIED because the disposable test passed. Real Store closure is a separate authorized migration workstream.

## 5. Non-destructive next moves

- Keep PR #417 as the canonical source of the Store Authority migration design.
- Build a fresh read-only writer inventory and source-to-store mapping report.
- Rehearse candidate migrations and rollback on disposable PostgreSQL17 with exact schema source, including FK and scope immutability. No real data backfill until owner approval.
- Identify actual caller(s) of save_merchant_product and plan service-role cutover before restrictive check.
- Obtain real Owner A/B session evidence without sharing JWTs, run true authenticated tenant/store RLS positive and negative tests.
- Only after independent review consider read-only Catalog/Cart pilot. Private orders and Store writes remain locked.

PostgreSQL references:
- https://www.postgresql.org/docs/17/sql-createpolicy.html
- https://www.postgresql.org/docs/17/ddl-rowsecurity.html

**Release decision:** DISPOSABLE_RLS_REHEARSAL_TESTED / REAL_STORE_AUTHORITY_BLOCKED / PRODUCTION_NO_GO.
