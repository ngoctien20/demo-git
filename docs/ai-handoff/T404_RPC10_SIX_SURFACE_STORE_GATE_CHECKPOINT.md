# TIEN404 RPC.10 — Six-Surface Store Ownership × RLS NO-GO Gate

**Date:** 2026-11-17 JST  
**Parent:** RPC.9 Draft PR #233, pinned base HEAD \`134e70b17f0c0b8dd515843fad823b991f4c7e9b\`  
**Mode:** additive offline-only source / no hosted writes, no-send.

## Live state (verified through Supabase read-only)
- Staging project \`ifxlvrhyjhbzbrkdsida\` ACTIVE_HEALTHY PG17.
- 2 Tenants, 2 Products, 2 Orders, 0 Customers; 3 active Owner Tenant memberships. Tenant 1 has 2 Owners, Tenant 2 has 1.
- No \`public.stores\` / \`public.store_memberships\`; six public Commerce tables lack \`store_id\`.
- Existing SELECT RLS is Tenant-scoped, PERMISSIVE. This does **not** prove same-Tenant Shop A/B separation.
- A local owner-accepted H11R application archive review remains \`PARTIAL_APPLICATION_ARCHIVE_LOCAL_QA_OWNER_ACCEPTED_WITH_LIMITATIONS\`; it is **not** a certified full Auth + Storage restore.

## What this branch implements
- Reuses RPC.9 without modifying its SQL or CI.
- \`qa/v152-rpc10/store-gate.cjs\`: offline-only, six-surface no-go validator.
- \`qa/v152-rpc10/store-gate.test.cjs\`: 47 synthetic/unit safety cases.
- \`hosted-baseline-sanitized.json\`: project/count/schema metadata only, with anonymized row slots.
- CI verifies Node tests and that all supplied flags, **even an all-green self-report**, cannot authorize DB migration, backfill, revoke, rollout, or billing.
- It deliberately does **not** re-implement owner signature validation: H11R.11 PR #205 is the independent source-only attestation design.
- It deliberately does **not** implement a second hosted migration: M1 PR #231 and atomic M2/M4 PR #233 remain authoritative candidates.

## Six-surface requirement
1. \`products\`: inventory/price by Store; scoped SKU key.
2. \`orders\`: order ownership and order-to-customer composite FK.
3. \`customers\`: store-scoped PII with explicit access policy.
4. \`order_items\`: order AND product must share tenant + Store.
5. \`conversations\`: session/channel bound to Store by trusted server resolver.
6. \`messages\`: conversation FK must include tenant + Store.

Classify \`app_private.channel_secrets\`, \`order_idempotency\`, \`audit_events\`, and \`tenant_agent_configs\` as either restricted Store-scoped or explicitly authorized Tenant-shared. Audit QA sandbox tables separately. Deny unreviewed \`SECURITY DEFINER\`, service-role shortcuts and unverified provider identity.

## Required real operator evidence / approval gates
- All **four existing rows** (two Products, two Orders) independently attributed to a real merchant/store, with original source, private digest, merchant attestation and independent reviewer. Tenant ID alone is not ownership proof.
- Exact current backup coverage + encrypted offsite retention + independently verified restore including the required Auth/Storage scope; old partial H11R acceptance must not be reinterpreted.
- Hosted M1 authorization only after evidence; M3 integrity & writer compatibility review; then M2+M4 in one transaction under an approved reader blackout. Never backfill into existing permissive Tenant policies before replacement.
- Run *real, separate, authenticated JWT* Owner A/Owner B within same Tenant: SELECT allowed only own Store; cross-Store denials for all six, plus cross-Tenant, revoked members, IDOR, FK mismatch, old-schema writers, RPC bypass and rollback.
- Independent Controller/Security Reviewer/DB Operator signoff **per operation**.

## Classification
- OFFLINE CODE: IMPLEMENTED
- NODE QA: TESTED locally 47/47; verify exact GitHub Actions run before CI VERIFIED
- SYNTHETIC PostgreSQL 17 six-surface SQL: not included in this PR; separate experimental local candidate pending CI
- HOSTED STORE OWNERSHIP: BLOCKED
- HOSTED RLS MIGRATION / RPC REVOKE / MESSENGER-ZALO LIVE COMMERCE: NO-GO

**Rollback:** close this Draft PR; branch contains source files only. No hosted mutation, n8n Published modification, live provider message or data export.
