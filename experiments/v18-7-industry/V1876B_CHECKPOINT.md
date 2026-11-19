# TIEN404 V18.7.6B — Checkpoint

Date: 2026-11-19 JST | STATUS: DRAFT PR / DISPOSABLE PG17 / REAL AUTH NO-GO

## Prior evidence
- V18.7.6A Draft PR #445: 189/189 offline synthetic/metadata tests passed; no real Store migration.
- V18.6.3 Draft PR #420: disposable PG17 Store RLS model only.
- Supabase staging has tenant-scoped Commerce tables; canonical public stores and store_memberships not yet verified deployed. No approved migration in this work.
- Current n8n Messenger/Core Published unchanged.

## This isolated PR
- RPC metadata/grant audit plus six textual QA-schema references to qa_owner_pairing; actual total callers remain unverified.
- Disposable PG17 source, explicit Store assignments and a transactional migration preview.
- Store-composite Products, Customers, Orders and Order Items FK integrity, Store-local identical SKU with distinct VND prices, Page installation uniqueness.
- RLS synthetic Owner A and Owner C in same tenant, Owner B in another tenant, staff and revoked principal checks.
- Test-only SET LOCAL request.jwt.claim.sub simulates claims, does not authenticate JWT.
- Protected real Auth A/B/C UAT runbook, prepared but NOT executed.

## Evidence/rollback
- CI run ID and exact pass count are to be recorded after workflow completion.
- Never run SQL fixtures on Supabase. No n8n, Cloudflare, Meta, Zalo, customer data, credential, payment, order, production modification.
- Rollback: close Draft PR; ephemeral PG17 service is discarded. No external rollback.

## Gates
P0: Real canonical store schema/membership and Store RLS not deployed/verified.
P0: Real Owner A/B/C JWT UAT not performed.
P1: RPC dependency graph incomplete, requires caller inventory before any grant changes.
P1: Synthetic migration does not prove safe real data mapping, collision-free migration or production compatibility.
P1: Industry read-only Core adapter still blocked by authentic Store binding, access proof and published/draft contract.
NO SEND | NO WRITE | NO LIVE MIGRATION | PRODUCTION NO-GO
