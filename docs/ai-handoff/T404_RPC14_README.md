# RPC14 — Private Merchant Evidence Security Hardening (EXPERIMENTAL)

Parent: RPC13 Draft PR #285. All current work is **source-only**, not a deployed upload portal.

This package adds the bounded-stream intake API, durable one-use invitation ledger **synthetic PostgreSQL 17** candidate, signed-scan state-transition interface and explicit independent reviewer/Store provenance NO-GO, plus adversarial Node QA.

- `qa/v152-rpc14/hardened-private-intake.mjs`: strict multipart streamed bytes cap, dual verified identities through inherited RPC13, server-issued one-use invitation bound to Auth+Access+slot+source_type, quarantine-only.
- `qa/v152-rpc14/scan-review-state.mjs`: scanner-verdict signature-adapter checks and fail-closed state transitions, not an antivirus scanner or original-source attestation system.
- `qa/v152-rpc14/pg17-invite-ledger-disposable-only.sql`: disposable-only PG17 atomic invite reservation and retention state contract, **SECURITY DEFINER restricted to NOLOGIN non-BYPASSRLS service role**. This code does **not** validate Supabase JWT and must not be deployed on hosted as-is.
- `qa/v152-rpc14/ci-pg17-invite-ledger-disposable.sh`: container guard with dedicated DB `t404_rpc14_ci`, cannot execute hosted.
- `qa/v152-rpc14/hosted-readiness.cjs`: immutable HOSTED_NO_GO even on all-green self-reported metadata.
- `.github/workflows/v152-rpc14-private-evidence-hardening-nosend.yml`: inherited RPC13 tests + RPC14 Node + actual disposable PG17 test, no external customer systems.
- `docs/ai-handoff/T404_RPC14_EVIDENCE_REPLAY_QUARANTINE_CHECKPOINT.md`: factual status, risks and gates.

Run static locally: `node --test qa/v152-rpc14/hardened-intake.test.mjs`. Actual PostgreSQL executes only inside self-contained GitHub Actions disposable CI. Never send user JWTs, owner documents or file links to GitHub, chat or CI logs. Real sources only via separately approved private Access app and quarantined storage with independent security validation.