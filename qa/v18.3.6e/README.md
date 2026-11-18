# TIEN404 AI — V18.3.6E

**Disposable PostgreSQL 17 Implementation × Full DML RLS pgTAP × Composite FK Negative QA**

- Status: `CANDIDATE — SYNTHETIC DISPOSABLE DATABASE ONLY`
- Parent design: V18.3.6D Draft PR #417
- Base branch: `qa/v1836d-canonical-store-design-20261118`
- Database: `tien404_v1836e_disposable`; PostgreSQL 17.12 only; no network exposure
- Access: no Supabase, Auth sessions, customer records, production, webhook, provider sends or credentials

## Contents

1. `01_PG17_DISPOSABLE_SCHEMA.sql`: actual PG17 schema with Tenant T1 → Store A + B; Tenant T2 → Store C; explicit memberships for Owner A/B, manager/staff, dual Store Owner, Tenant Owner without Store membership, revoked/expired and cross-tenant actors. Six Commerce tables, composite Store foreign keys, NOT VALID checks, immutable ownership triggers, private SECURITY DEFINER membership helper with narrow grants and restrictive Store RLS.
2. `02_PG17_PGTAP_DML_RLS.sql`: **60 executable pgTAP assertions**, including SELECT/INSERT/UPDATE/DELETE, legacy NULL, same Tenant A/B leakage, injected permissive SELECT policy, composite FK negative cases, Store reassignment, Staff price/total edits, cross-Tenant, revoked/expired and suspended Store cases.
3. GitHub Actions workflow: builds disposable postgres:17.12 + pgTAP extension, creates fresh isolated DB, applies schema and executes tests, fails on any `not ok` or unexpected SQL error, deletes container on completion/failure.
4. `QA_CHECKPOINT_V18_3_6E.md`: final status and evidence after CI verification.

## Security notes

- This is a **synthetic design implementation**, not a Supabase staging migration.
- Actors use local synthetic `request.jwt.claim.sub` values under `SET ROLE tien404_e_actor`. This does **not** validate JWT signatures, real Auth session revocation or a protected provider installation.
- `qa_private.store_role` is SECURITY DEFINER only to avoid membership RLS recursion in this synthetic fixture. It is kept out of a public API schema, pinned to `search_path = ''`, and execution is granted only to the synthetic actor role. Must have an independent review before a real implementation.
- The fixture grants DML on SQL tables to the synthetic actor to exercise command-specific RLS. Production should prefer narrow transactional commands for orders/messages and never grant unrestricted table DML to customer-facing applications.
- Test fixture intentionally has a permissive products SELECT policy that returns true. Restrictive Store boundary must still block Store B and NULL legacy rows.
- Scope immutability triggers prevent even a dual-A/B owner from moving a record from one Store to another.
- `CHECK(store_id IS NOT NULL) NOT VALID` allows old legacy fixtures to remain without validation, but new/updated NULL Store rows are rejected.
- Public staging remains unchanged; no provider or customer calls are included.

## Known scope gaps

- Tenant/Store registry admin mutation policies and last-Owner invariants are NOT implemented in E.
- Provider installation provenance, `channel_installation_id`, real Auth A/B, Storage, legacy mapping approvals, actual Messenger/Zalo/Website operations and atomic order writer remain separate gates.
- pgTAP tests run as synthetic role, not real Supabase `authenticated` over live PostgREST.
- The fixture covers RLS DML and composite constraints but does not prove service-role/BYPASSRLS safety or full transaction/outbox recovery.
- No signed provider ACK/notification send; no production rollout.

## Decision

A green GitHub Actions run proves only the disposable PG17+pgTAP implementation. It does not approve any staging schema change, migration, backfill, real customer data read, provider send or writer cutover.
