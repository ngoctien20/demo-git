# TIEN404 V15 — Messenger → Zalo Commerce Order Continuity — Draft No-Send

**Date:** 2026-11-16 JST  
**Source base:** GitHub Draft PR #131, HEAD `6e249b593f669655303983db6630114702d4ab7c`  
**Status:** IMPLEMENTED SOURCE-ONLY; LOCAL SYNTHETIC QA TESTED; HOSTED JWT/RLS + PROVIDER E2E BLOCKED  
**Release:** PRODUCTION **NO-GO**.

## Scope and prior work reused

- Reuse the existing V15 P256 synthetic ingress gate `qa/v15-hosted-readiness/trusted-ingress-gate.cjs` and PR #131's Commerce preview bridge / ephemeral PG17 Order+Outbox test. Do not copy DEMO Orders, credentials, Meta/Zalo secrets or publish workflows.
- New `qa/v15-cross-channel/no-send-order-continuity.cjs` is a **synthetic in-memory harness**, not a new hosted order database. A signed QA Messenger context pins Store/Tenant/subject/event. The QA order is written to a process-local Map ONLY after explicit confirmation, valid exact VND price and stock check, with duplicate event digest idempotency.
- `beginCustomerLink` requires explicit source consent, stores only SHA-256 hash of one-time QA challenge with 60s expiration, 3 tries, single consume. `completeCustomerLink` requires explicit Zalo consent, valid *synthetic signed* target binding and matching Store/Tenant. Same name/self-declared phone is not a link. `revokeCustomerLink` immediately blocks future reads. No raw OTP in logs/storage.
- `lookupQaOrder` has a uniform `NOT_FOUND_OR_NOT_AUTHORIZED` result for missing/unlinked/cross-store orders; returns no customer PII. `lookupAsOwner` deliberately fails closed because G2.3 Owner evidence and hosted Store membership are not certified.
- `fast-path-no-send.cjs` offers deterministic *routing suggestions*, never authorization, cached orders, price figures or live speed claims. Order/quote data must still come through verified backend.
- `pg17-cross-channel-proof.sql` runs **only after** the existing PR #131 disposable PG17 Store RLS and atomic Order+Outbox SQL in isolated CI. It tests a persisted synthetic order under a private backend join, unlinked and linked Zalo, same-Tenant Shop B, cross-Tenant Shop C, user name collision, replay and revoked linking. It does **not** prove hosted JWT / real provider signature, since inputs are synthetic and the SQL runner is privileged.

## Test levels

| Level | Requirement | State |
|---|---|---|
| Local Node | 21 synthetic link/order/negative cases using a temporary local stand-in of signed gate | TESTED locally; stand-in is **not committed** |
| Local Node | 5 fast-path route contract cases | TESTED locally |
| GitHub CI | Test 26 Node cases against **actual existing** V15 signed QA gate | Must run in PR CI |
| GitHub CI | Disposable Postgres17 real SQL persistence/join/RLS | Must run in PR CI |
| Supabase hosted | Genuine signed Auth JWT A/B authorization and negative cross-store under published RLS | BLOCKED — current schema missing stores, store_memberships, store_id |
| Owner G2.3 | Provider consent, owner proof and verified scoped binding | BLOCKED |
| Meta/Zalo LIVE | Signed provider ingress, cross-channel persisted order ID, read result/receipt | BLOCKED — separate explicit approval |
| Real AI latency | Measured P50/P95 and token/cost for production flow | NOT RUN; no paid model calls |

## P0 release blockers and approvals

1. Private independent owner identity and provider consent records; 4-row ownership evidence. Existing QA fixtures are not proof.
2. Encrypted hosted backup and isolated restore rehearsal (Supabase Free does not prove automatic backup).
3. Explicit approval for schema migration; add `stores`, `store_memberships`, `store_id` and composite FKs to products/orders/items, valid RLS and private channel identities. Do not guess legacy record allocation.
4. Actual Supabase Auth signed JWT A/B test via Data API (not SQL Editor/service_role), service-role misuse review, owner revoke, tenant/store negative tests.
5. Approved Commerce durable writer, confirmation, stock-price transaction, idempotency and outbox; no demo data/credentials.
6. Native verified Meta/Zalo signatures, provider-scoped account IDs and real provider Owner consent; then UAT sends on approved QA recipient. Never link based on phone/name claimed in message.
7. Capture measured baseline and fast-path controlled comparison with model/provider billing approval. Existing #3867/#3868 are only historical samples.

## Safety / rollback

No n8n workflows, hosted Supabase, secret, customer order, provider send, billing, Cloudflare deployment or production branch are modified by these source-only files. In a GitHub Draft PR, rollback is close PR/revert the additive commit. In local workspace, remove `qa/v15-cross-channel/`, its new CI YAML and this checkpoint. Do not promote until independent CI and owner UAT.