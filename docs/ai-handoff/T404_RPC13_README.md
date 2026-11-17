# TIEN404 RPC13 — Authenticated Merchant Evidence Intake × Real JWT Two-Store UAT

**2026-11-17 JST | EXPERIMENTAL | SOURCE-ONLY | HOSTED NO-GO**

Incremental to RPC12 Draft PR #281. Existing hosted Supabase/n8n/Cloudflare Access policies are unchanged.

## Already verified
- Supabase: 2 Products + 2 Orders, 3 active Tenant Owners tied to real Supabase Auth IDs; two confirmed Owners in one Tenant but only one with non-null last sign-in. No canonical Store tables, no store columns in six Commerce tables, no real four-row Merchant source proofs.
- Cloudflare Access: exactly one current Access-protected staging Pages app, with email-allow policy; no dedicated evidence intake app or source storage verified.
- This package's simulated Node QA tests check Cloudflare JWT cryptographic verification (generated RSA keys), Supabase `/auth/v1/user` validation (mock), private invitation quarantine, four-row proof NO-GO, read-only PostgREST A/B canary isolation (mock).

## Source files
- `qa/v152-rpc13/dual-verified-identity.mjs`: verify CF Access **signature**, pinned issuer/audience/JWKS; confirm same account email via Supabase Auth `/auth/v1/user` on exact staging project. No user-supplied Tenant/Store in identity.
- `qa/v152-rpc13/private-intake-core.mjs`: private admission service core, demands trusted invite registry and private quarantine object store. PDF/PNG/JPG up to 8MiB; **returns 202 only for quarantine, never ownership APPROVED**. Not connected to a deployed Worker, R2, antivirus or real authority registry.
- `qa/v152-rpc13/owner-evidence-admission.mjs`: four P1/P2/O1/O2 original owner gate is always NO-GO without independently reviewed source/signatures.
- `qa/v152-rpc13/live-auth-uat.mjs` + CLI: future real authenticated PostgREST GET-only testing for 2 actual JWTs in same Tenant but distinct Stores, with synthetic canaries on all six tables. No token output, CI forbidden.
- `qa/v152-rpc13/hosted-owner-readiness-READ_ONLY.sql`: repeatable no-PII aggregate check.
- `.github/workflows/...`: only offline unit tests, no secret, upload, hosted migration, real JWT, or messages.

Run local tests from repository root: `node --test qa/v152-rpc13/secure-identity-and-uat.test.mjs`.

## Security review before deployment
Dedicated Access app/policy; verified Auth sessions; private durable one-time invitation registry; independently approved Merchant roster; R2 private **quarantine**; malware scanning/CDR; request-body/time limits; abuse throttle; quarantine retention; encrypted audit with minimal metadata; independent Reviewer; trusted private original-row mapping; recovery and real two-session JWT UAT. The supplied modules are **not a complete deployable hosted portal**.

**No actual Merchant proofs have been received. No real Auth sessions/ownership transferred. No unapproved hosted changes.**