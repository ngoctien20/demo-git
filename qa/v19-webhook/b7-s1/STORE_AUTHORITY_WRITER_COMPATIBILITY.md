# TIEN404 V19.0-B7-S1 — Store Authority Writer Compatibility Review

**Date:** 2026-11-18 JST  
**Scope:** read-only Supabase staging audit plus disposable PostgreSQL 17 regression. No live migration, no provider send, no customer write.  
**Canonical architecture design:** V18.3.6D Draft PR #417; inherited B7 checkpoint PR #436.

## 1. VERIFIED live Supabase facts

Six Commerce tables (products, customers, orders, order_items, conversations and messages) still rely on PERMISSIVE Tenant-level SELECT RLS. The inspected public Commerce tables lack store_id. A tenant role must NOT be treated as Store membership.

The current public.save_merchant_product:
- SECURITY DEFINER, search_path fixed to an empty string.
- EXECUTE granted to authenticated, not anon.
- Checks auth.uid(), owner/manager Tenant membership and its bounded QA Tenant allowlist.
- Inserts/updates using tenant_id and sku, not store_id.
- Generates private audit events.
- Has no canonical Store ownership input or Store membership proof.

Current products uniqueness is UNIQUE(tenant_id,sku), not Store-local uniqueness. Design decision D-02 remains unresolved.

**P0:** Adding NOT VALID Store checks to live products would cause the existing tenant-only RPC's new rows to fail. Its current caller inventory and versioned replacement/rollback are not complete. The old RPC must NOT be removed, bypassed or modified by B7-S1.

A literal source search on gh-pages assets/app.js, assets/saas.js, assets/v4.js, assets/ai-consultant.js and dashboard.html found no save_merchant_product reference in those five files. This is a limited check, NOT a full inventory of Render, n8n, other branches or external RPC callers.

## 2. B7-S1 disposable PostgreSQL 17 QA

GitHub Actions creates only a synthetic b7s schema:
- Stores and synthetic Store memberships covering Owner A/B, dual Store membership, Tenant Owner without Store membership, revoked role, Staff and separate Tenant.
- Six minimal Commerce tables with Tenant+Store composite keys and FKs.
- Composite FK cross-Store denial for Orders-to-Customers, OrderItems-to-Orders/Products and Messages-to-Conversations.
- A nullable legacy Store row before adding CHECK (store_id IS NOT NULL) NOT VALID: existing NULL remains, but a new NULL write fails.
- Existing Tenant-wide product SKU uniqueness preserved as a compatibility signal.
- A BEFORE UPDATE trigger prevents reassignment of Tenant/Store identity.
- Deliberately broad PERMISSIVE SELECT constrained by a mandatory RESTRICTIVE Store policy, with RLS forced on all six tables.
- Synthetic NOLOGIN roles with no broad DML grants.

Negative checks include cross-Store relationships, same-SKU across two Stores (current uniqueness conflict), new product lacking Store (old RPC compatibility failure), legacy NULL quarantine and scope rewrite denial.

**Limitation:** synthetic PostgreSQL current_user emulates an actor; this is not Supabase Auth JWT, auth.uid(), production RLS, service-role bypass or real Owner A/B authentication proof. This is a relationship-and-policy rehearsal, not an executable production migration.

## 3. Required independent closure gates

1. Complete real caller inventory for public.save_merchant_product, including Render, n8n, website and Supabase-based clients; record exact version and owner.
2. Decide SKU uniqueness D-02; do not modify an existing unique constraint before approving the behavior.
3. Reconcile six-table FKs, Store memberships, private installation registry and legacy NULL quarantine with PR #417.
4. Prepare a new versioned Store-aware product command in disposable staging and test compatibility before any live RPC change.
5. Run verified real Owner A/B Supabase Auth JWT positive and cross-Store negative tests, without sharing tokens.
6. Review SECURITY DEFINER ownership and grants, service-role bypass, Data API exposure, scope immutability and order/stock invariants.
7. Approve migration and per-phase rollback with backup/restore evidence; no real writes before this gate.

## 4. Evidence classification

VERIFIED: Supabase metadata, exact existing RPC contract, limited gh-pages search.  
IMPLEMENTED: disposable PostgreSQL 17 rehearsal and deny-only hosted preflight.  
TESTED: only if the current B7-S1 CI passes, see checkpoint.  
BLOCKED: live Store Authority closure, complete writer callers, hosted Cloudflare Worker binding, provider installation identity, production.

Canonical references:
- https://github.com/ngoctien20/demo-git/pull/417
- https://www.postgresql.org/docs/17/ddl-rowsecurity.html
- https://supabase.com/docs/guides/database/postgres/row-level-security

**No existing product, order, auth, n8n, Cloudflare or Supabase record was modified.**
