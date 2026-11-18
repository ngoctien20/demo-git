# V18.3.6B — Independent Real Auth A/B Admission Readiness

**Status: PREPARED / BLOCKED — no real Auth session has been inspected or used.**

## What is verified
- Two distinct synthetic actors are present in the disposable fixture, both owners of different Stores in the same synthetic tenant.
- The full SQL acceptance suite exercises Store A positive reads, Store B positive reads, same-tenant cross-Store isolation, cross-tenant isolation, no-identity fail-closed, revocation, legacy NULL Store denial, write denial, restrictive-policy protection against an extra permissive policy, and composite-FK rejection.
- The final audit verifies mapping counts and schema/policy/constraint invariants after replay.

## What is not verified
- Two real Supabase Auth users / independent sessions.
- Active session revocation and JWT signature, issuer, audience, expiry, or session binding.
- Canonical real actor → tenant → store mapping and signed owner approval.
- Protected gateway / privileged RPC behavior, service-role bypass isolation, or durable replay nonce.
- Actual merchant data mapping or production workflow writer compatibility.

## Admission prerequisites
1. Both Store owners separately approve a time-bounded, read-only catalog QA. Approval must be captured privately, with reviewer, scope, timestamp, expiry, revocation path and evidence hash.
2. An authorized operator verifies two independent real Auth sessions server-side. Do not paste JWT, refresh token, cookies, raw user IDs, session IDs or customer data into chat, GitHub, n8n execution logs or a public PR.
3. On every request, server-side authority must bind issuer + audience + subject + active session + tenant + canonical Store membership + installation/provider account. Ignore caller-supplied `store_id` and user-editable `user_metadata`.
4. Run read-only positive A→A and B→B catalog requests; negative A→B and B→A same-tenant reads; cross-tenant, revoked, expired, replayed, wrong-audience, wrong-installation and forged-Store-ID cases. Expected outcome for every negative: deny/no data.
5. Store only redacted execution IDs, case IDs, request hashes, policy/migration version and pass/fail. A reviewer independent of the implementer attests the evidence.
6. No Orders, customer PII, write operation, webhook, provider send, credential change, migration, or release is included in this admission.

## Current external blocker
The connected Supabase staging project was last inspected read-only: PostgreSQL 17.11; zero canonical `stores` / `store_memberships` tables; zero `store_id` columns in the six Commerce tables; zero restrictive Store SELECT policies; three active tenant memberships. This does not supply real Store A/B authority. Recheck metadata immediately before any separately approved staging change.

## Decision
`PG17_SYNTHETIC_MIGRATION_REPLAY` is **VERIFIED / PASS** on PostgreSQL 17.12; see run `44263318020` and `QA_CHECKPOINT_V18_3_6B.md`.
`REAL_AUTH_AB_READONLY_UAT` remains **BLOCKED**.
`STAGING_MIGRATION`, `PRODUCTION_WRITER`, `LIVE_SEND`, and `RELEASE` remain **NO_GO**.
