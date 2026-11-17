# V17.6-B.2 — Hosted Supabase JWT / Store A+B Admission Review

**Reviewed:** 2026-11-17 JST. **Method:** direct read-only Postgres catalog, columns, `pg_policy`, grants and aggregate Auth-session metadata on Supabase staging `tien404-staging` (PostgreSQL 17).

**Classification: VERIFIED_METADATA / HOSTED_JWT_TWO_STORE_ADMISSION_BLOCKED / NO_DB_CHANGES.**

## What is currently verified

- Supabase staging project was `ACTIVE_HEALTHY` during this review.
- `public.products`, `public.orders`, `public.order_items`, and `public.customers` have RLS enabled and force-RLS; they expose `tenant_id` but **not** `store_id`.
- Current product read policy checks active `tenant_memberships` by `tenant_id` and `auth.uid()`. Order read policies check manager/owner roles by **tenant**, not Store.
- `authenticated` has SELECT privileges on these tables, `anon` does not. Grants plus RLS govern reads.
- Metadata shows more than one active Tenant member under one Tenant; however there is **NO verified binding to two different Stores**, no independent token-holder attestations and no accepted dual-Store UAT. Session-row metadata is not proof that a real caller possesses, can refresh or has independently validated a usable JWT.
- In `tien404_v175_qa.order_ownership`, test policies reference two QA actors on the same `qa-store-a`; they do not constitute different Store owner acceptance.
- `tien404_r1_qa` has synthetic Store/owner registry tables; these are not a substitute for verified Auth Store ownership and real hosted reader authority.

No user IDs, email addresses, real tokens, phone numbers, addresses, customer rows or raw order data were accessed or committed by this review.

## Admission gate G01 (all pending)

- [ ] Independently prove **two real Supabase Auth sessions** with separate principals belonging to one Tenant **and different Stores**. Merchant/Owner identity proof through private protected intake; do not put JWT or PII in GitHub.
- [ ] Verify a server-controlled Store/Owner mapping and revocation/fresh session check; never trust model/chat supplied `store_id`, `raw_user_meta_data`, or unchecked JWT claims.
- [ ] Design and owner-review per-Store schema/ownership/membership/RLS in an **isolated disposable PG17 environment**, including policy `USING` and `WITH CHECK` / permission grants for each operation. Do not alter `public.products/orders/customers/order_items` on hosted staging as a side effect of this review.
- [ ] Run independent positive and negative Store A/B `SELECT` under real user-scoped auth and require denied unauthorized `INSERT/UPDATE/DELETE`, with no `service_role` shortcut.
- [ ] Verify that a reader cannot access another Store through queries, views, functions, RAG indexes, tool output, or cross-channel identity binding.
- [ ] Revoke staff/Store authority and prove stale sessions/claims are rejected by authoritative gate.
- [ ] Confirm provider signed Meta/Zalo events and installation owner proof separately before live channel access.
- [ ] Preserve zero-send; report redacted receipts, safe rollback and explicit Owner/QA signoff.

## Current decision

**NO-GO: per-Store hosted JWT/RLS proof cannot be accepted using the current tenant-only legacy Core schema/policies.** No real Store A/B JWT or browser Canary was attempted here. Do not equate source-only CI passes or synthetic n8n 208/208 passes with hosted acceptance.

## Security references

- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Auth architecture: https://supabase.com/docs/guides/auth/architecture
- OWASP GenAI: https://genai.owasp.org/llmrisk/llm01-prompt-injection/

## Change control

Read-only metadata queries only. No schema, migration, RLS policy, grants, credentials, user sessions, Orders, Products, provider callbacks, billable AI model or production workflow were changed. Rollback: no database action required; close the Draft PR if proposed guard is rejected.
