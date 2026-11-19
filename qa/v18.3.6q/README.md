# TIEN404 AI — V18.3.6Q

**Private Security Review Approval Intake × GoTrue Local Runtime Admission × Transaction-Bound RPC Trust Closure**

Date: 2026-11-19 JST. Parent V18.3.6P Draft PR #457 final HEAD `f8404ca771244592db4fcb795b27c4deae5d496e`, CI #44512981812 PASS (515/515 Node + 70/70 PG17).

## Deliverables

1. `private-approval-intake.mjs`: strict review **request** metadata with independent actor labels, pinned source SHA/manifest and <=1h scope. Even a complete request never gives consent.
2. `gotrue-runtime-admission.mjs`: strict **preflight only** for isolated local Supabase Auth/GoTrue stack, version pins, egress/credentials and teardown. Never starts Auth.
3. `rpc-proof-fixture.mjs`: strict canonical Node HMAC-SHA256 signing/verification using an **intentionally public QA-only fixture key**.
4. `01_DISPOSABLE_PG17_SIGNED_RPC.sql`: private EXECUTE-only role, signer fixture table, signed scoped catalog read that delegates to M's synthetic session/Store/nonce in one PostgreSQL transaction. **DO NOT RUN ON SUPABASE STAGING/PRODUCTION**.
5. `02_DISPOSABLE_PG17_ACL_PGTAP.sql`: 30 PostgreSQL 17.12 ACL/function/fixture negative assertions.
6. `generate-disposable-pg17-vectors.mjs`: dynamically generates 22 Node-to-PG17 test vectors with valid/invalid signatures, wrong Store, wrong session, expiry and nonce replay.
9. `generate-concurrent-signed-call.mjs`: signs one disposable JTI for two separate simultaneous PostgreSQL connections; CI requires exactly one `ALLOW_CATALOG`, one `REPLAY` and one durable nonce row. This is an extra concurrency integration check, not a pgTAP assertion and not a GoTrue live test.
7. `test-q-security.mjs`: 84 offline negative tests.
8. `PRIVATE_SECURITY_APPROVAL_INTAKE.md`, `GOTRUE_LOCAL_RUNTIME_ADMISSION.md`, `TRANSACTION_BOUND_RPC_TRUST_CLOSURE_MATRIX.md` and checkpoint.

CI intended coverage after implementation: inherited G–P Node 515 + Q offline Node 84 = **599 Node**; disposable replay M53+P17+Q ACL30+Q signed HMAC22 = **122 PostgreSQL** pgTAP assertions; total **721** expected. These counts require actual final-HEAD CI proof before VERIFIED.

**No live Auth/GoTrue service, function body, customer/merchant identity, production credential, Supabase schema/ACL/crypto key, n8n workflow or provider send touched.**

## Rollback
The new changes are scoped to QA and a dedicated GitHub Actions workflow in an OPEN DRAFT PR. Closing the PR is sufficient; PG17 fixture container and temporary synthetic HMAC key are discarded by CI. Real production trust and independent human review remain NO-GO.
