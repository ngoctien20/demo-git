# TIEN404 — V17.2C.40B No-Write Canonical Store Migration Plan

**Status:** PROPOSED / NOT EXECUTED. Source: direct Supabase read-only audit V17.2C.40A/40B; n8n QA registry comparison. Existing Draft PR #392 only. No DDL/DML, live JWT, real Order rows, new branch, added cost or workflow publish authorized.

## G0 — Owner-approved authority decision (hard prerequisite)
The one Tenant with two active owners has only **one QA Store**. Explicitly decide whether the two people are **co-owners of one Store** (S1) or owners of **two distinct Stores under one Tenant** (S2). If unapproved or S1 without a second authorized Store, the planned same-tenant Store A/B isolation test cannot run. Independently attest the Store ownership and role of each account in a protected system; do not store identifiers/tokens in GitHub.

A non-executable fail-closed source candidate lives at `qa/v172c-rpc-closure/v172c40b-owner-authority-registry-NOT_APPROVED.json`: no real mappings or owner grants, all release gates false. Real approvals require separate protected evidence storage.

## G1 — Trusted alias resolution, no automatic joins
Build privately a revisioned crosswalk `source_namespace + external_tenant_alias + external_store_alias + provider_installation -> canonical tenant UUID + canonical store UUID`. Evidence must include immutable source, owner consent, reviewer, date, scope, signing verification, expiry/revocation and collision rules.

Current observed: n8n 6/6 Commerce Channels match its 4 internal Tenant aliases; **0/4** of those aliases match actual Supabase tenant UUIDs by exact string; **0/2** QA bot Store tuples match Supabase QA bot tuples. No Store assignment can be inferred. Check multiple aliases to same canonical tenant, one alias to multiple tenants, one installation claimed by multiple Stores, revoked proofs and cross-tenant reassignment. Block unknown provenance.

## G2 — Reviewed backup and disposable PG17 rehearsal
After separate budget/backup approval, take an encrypted access-controlled backup (metadata, schema, data according to approved policy) and **test restore** in isolated authorized infrastructure. Record logical/physical recovery strategy, migration checksum, current Git SHA, n8n Published/Draft workflow version IDs, owner mapping revision and rollback owner. Never place customer records or backups in GitHub/CI artifacts.

Rehearse with **synthetic** PostgreSQL 17 fixtures only, then run Store A/B security tests. Do not assume Supabase Free supports branching; no branch creation is authorized.

## G3 — Additive schema plan, not applied
Propose separately reviewed, initially nullable Store lineage:
- canonical `stores(tenant_id,store_id,...)` and `store_memberships(tenant_id,store_id,auth_user_id,role,active,verified_at,revoked_at,source)`;
- private `channel_installations` with signed provider source and trusted Store scope; private revisioned `alias_crosswalk`;
- nullable `store_id` for Orders, OrderItems, Products, Customers, Inventory and `app_private.order_idempotency`; composite Store/Tenant FK, unique indexes and audit records.
Never backfill an ambiguous historical Order from phone number, provider sender ID, SKU or AI inference. Quarantine Store-unknown legacy rows.

Current `products UNIQUE(tenant_id,sku)` requires explicit collision/repricing compatibility review before `UNIQUE(tenant_id,store_id,sku)`. Current Orders statuses are `pending,confirmed,paid,cancelled,refunded`, not V36–39 candidate `reserved,expired`: business approval of reservation policy is needed. Also review tenant-level revenue RPC and product writer.

## G4 — RLS atomic cutover (requires approved stage)
Current permissive tenant-only SELECT policies can continue exposing same-tenant rows if simply OR-combined with Store-aware policies. Design one coordinated, rollback-reviewed cutover that **removes/restricts old broad access** while applying Store+Tenant+active membership `USING` predicates and correct `WITH CHECK` on writes. Use `security_invoker` for exposed views, and independent review of privileged SECURITY DEFINER functions and service_role bypass. Never restore tenant-wide Order reads as an emergency rollback shortcut.

## G5 — Read-only actual A/B acceptance
After owner-approved **two distinct Store memberships**, separately verify real signed Auth session A/B with consent in a protected environment. Test A→A and B→B read, A→B and B→A denied, revoked/expired membership, cross-tenant C, forged order key, anon denial and legacy Store-unknown fail-closed. Do not paste JWT, email, phone, session_id or real Order data into issues/chat. Fail this gate if two accounts are only co-owners of the same Store.

## G6 — Protected writer compatibility (NO WRITE until separate approval)
Keep Published Messenger Google Sheets Create/Manage/Update in an isolated DEMO lane. Do not silently redirect them to Commerce Core. A versioned protected writer must validate current Store/actor/channel installation + consent, exact VND quote, stock/idempotency and atomic Orders/Items/Outbox. Order status changes and subscription rules require distinct regression QA. Start with server-side no-write contract tests, never provider sends.

## G7 — Independent release decision
Require evidence for G0–G6, tested backup/restore, security reviewer, no unresolved P0/P1, cost/credential approval and an explicit signed owner release decision. Keep PR Draft and canary disabled until then.

## Stop/rollback truth table

| Cut point | Safe response |
|---|---|
| Before G2 | Abort; no change (current system) |
| After authorized additive G3 | Stop writer, preserve new columns/data, assess rollback after verified restore; do not drop live rows blindly |
| After authorized G4 RLS cutover | Fail closed; revert only using independently approved **Store-scoped** policy, never re-open broad tenant access |
| After authorized real writes | Use reviewed compensating transaction / audited restore; no overwrite from synthetic snapshots |

**Current decision:** No canonical Store, no approved alias mapping, no actual Auth A/B read test or migration. **BLOCKED / NO-GO** for production. Issues #399/#402/#403 remain open.

**References:** V17.2C.40A checkpoint, V17.2C.40B alias matrix and owner approval packet; Supabase official RLS docs https://supabase.com/docs/guides/database/postgres/row-level-security .
