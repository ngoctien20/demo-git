# TIEN404 AI — V14.5Z-LIVE02 HOSTED NO-SEND INTEGRATION CHECKPOINT
Date: 2026-11-16 JST
Status: HOSTED_SYNTHETIC_QA_VERIFIED / LIVE_ZALO_NO_GO
Git branch: work/v145z-live01-limited-uat-gate
Draft PR: https://github.com/ngoctien20/demo-git/pull/103
NO PRODUCTION CHANGE, NO PROVIDER SEND, NO LIVE CUSTOMER/ORDERS/INVENTORY, NO CREDENTIAL OR BILLING CHANGE.

## Approved scope
One new Cloudflare Worker on a staging-only workers.dev subdomain, bound ONLY to the existing isolated QA D1; signed synthetic Bot→Shop→Owner resolver, atomic event replay/CAS/quota API, real HTTP dry-run QA. Do not touch active Zalo Published webhook, existing outbound gateway, Supabase, commerce data, credentials, billing or provider messaging.

## Deployment facts (verified live through Cloudflare API)
- Created Worker `tien404-zalo-live02-nosend-gate-staging`.
- URL `https://tien404-zalo-live02-nosend-gate-staging.tienmobi208.workers.dev`
- New Worker script currently deployed with version `9088f20e-1075-4dc5-9b01-1be27fbee011`, deployment ID `46fe82ca-49ef-4cd4-8bac-7b7e6e537f59` (this deployment applies only to the newly created staging Worker).
- Worker script binds exactly one resource: `LIVE02_DB` type `d1` id `d6604745-8f8a-4eac-95a3-83f6e4df0d39`, name `tien404-zalo-live01-security-qa-staging`.
- No secret bindings, no provider API calls or external fetch, and no Zalo token, payment, Orders or product data in Worker.
- Worker public subdomain enabled for QA, preview URLs disabled. Only GET /health and POST /v1/qa/claim exist; POST /v1/send, /v1/provider/*, /webhook/* hard deny 423; all others 404.
- Existing outbound Worker `tien404-zalo-outbound-v1-staging` still has `ZALO_SEND_ENABLED=false`. Existing Published ingress workflow `yIJk8LvJoLF40Z62` version `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e`, private router `sIPs6egzIwOY1GNv` version `8d91d23c-cd87-462f-a112-9cca2340bec8`, both active and unchanged.

## Trust design (SYNTHETIC QA, not real Bot binding)
- Each request contains kind, grant ID, tenant/store/bot/recipient/session/event digests, timestamp, expected CAS revision, ascending sequence and reserved tokens.
- Worker verifies ECDSA-P256 signature over exact METHOD/path/raw JSON, 90s window, strict schema, then independently looks up the precreated synthetic QA grant in its D1.
- Request-supplied `verified` or store identity cannot create authorization. Scope hash matching must equal the server-bound grant record, with `QA_ARMED` and `environment='OFFLINE_QA'`.
- D1 trigger `z145z_live01_atomic_claim_guard` is authoritative for grant expiry (database server time), unique event hash, session CAS+ordering+handoff, exactly three claimed reply/model reservations and aggregate 2500-token quota. Failed claims rollback event, session and quota together.
- QA ECDSA keypair was created ephemerally for tests, ONLY the public JWK was embedded in this new staging Worker. The private key was never returned to ChatGPT user, committed to GitHub, written to Worker or installed as an account credential. It was discarded after the test run. There is no real provider-issued Bot→Shop→Owner proof in this pilot.
- The Worker never calls an AI model or Zalo. `model_calls_claimed` is a reserved budget slot counter, NOT actual inference count or n8n invoice.

## Direct HTTP QA evidence
- Cloudflare connector test egress initially returned HTTP 403 for all public external hosts, including example.com and existing outbound Worker. The body stated outbound requests to those hosts are not allowed. **Those 403s are tool network policy failures and NOT Worker QA results.**
- Used connected n8n Cloud instead to issue real HTTPS requests to new Worker.
- Created manual-only, INACTIVE n8n QA workflows in Personal project / `90_QA - DIAGNOSTICS`:
  * `mJ3PH8qXhXKFh0kS` — `TIEN404_V145Z_LIVE02_HTTP_QA_DRIVER_NO_SEND`, version `08747085-fea6-4cef-8346-7d88188f6250`; manual webhook data injection using MCP, no public activation and no credentials.
  * `mfH7MaI2E4A4TDJn` — `TIEN404_V145Z_LIVE02_HEALTH_AND_SEND_LOCK_QA`, version `e9aaa17e-2580-4c28-b22c-18acf35d1d4f`; manual only; GET health then POST denied send.
- n8n execution **3844 SUCCESS**: unsigned synthetic HTTP POST to /v1/qa/claim → 401 `QA_SIGNATURE_REQUIRED`.
- n8n executions **3845–3852 SUCCESS (8/8 validated)**:
  3845 incorrect ECDSA signature → 401.
  3846 correctly signed but wrong shop → 403.
  3847 signed first claim 1000 tokens → 200 `QA_ATOMIC_RESERVED`.
  3848 duplicate event → 409 `REPLAY_OR_DUPLICATE`.
  3849 stale session revision → 409 `ATOMIC_CAS_OR_QUOTA_DENIED`.
  3850 signed second claim 1000 tokens → 200 `QA_ATOMIC_RESERVED`.
  3851 overage of 501 tokens → 409 `ATOMIC_CAS_OR_QUOTA_DENIED`.
  3852 signed third claim 500 tokens → 200 `QA_ATOMIC_RESERVED`.
- The ninth planned signed HTTP request (sequence 4) WAS NOT executed due to a connector orchestration tool-call limit. DO NOT mark it tested. Sequence >=4 is blocked by Worker schema and prior isolated D1 QA; GitHub tests cover that fail-closed code path.
- Direct D1 inspection after HTTP: grant `qa_live02_b_079f495ffeff`, `environment=OFFLINE_QA`, 3 atomic claims, session revision=3/last_sequence=3, 3 reply reservations, 3 model slots reserved, exactly 2500 tokens reserved.
- n8n **3853 SUCCESS**: GET /health HTTP 200 with D1 binding and no provider capability; POST /v1/send HTTP 423 `NO_SEND_LOCKED`, 0 provider sends.
- QA grants cleanup: both `qa_live02_b_*` fixtures were changed `QA_ARMED→QA_STOPPED` on isolated QA D1 after testing, 0 still active. No other databases or grants were modified.

## Source/CI
- Source: `qa/zalo-live-v145z/live02-nosend-worker.mjs` with deploy-time QA public JWK placeholder.
- Reference QA tools: `qa/zalo-live-v145z/live02-ephemeral-qa-runner.template.js`, `qa/zalo-live-v145z/live02-signed-qa-emitter.template.js`. These scripts create temporary signing keys for QA; no private key is persisted.
- Test file `qa/zalo-live-v145z/live02-nosend-worker.test.mjs`: 10 negative/positive tests.
- GitHub Actions run [43734568228](https://github.com/ngoctien20/demo-git/actions/runs/43734568228) SUCCESS, job `132874204384`: prior Zalo 28 + grant gate 32 + atomic D1 18 + new Worker 10 + conversation 44 = **132/132 PASS**, static syntax and no outbound safeguards pass.

## Budget/cost / limitations
- LIVE02 used **zero real AI model calls and zero Zalo provider sends**. D1 storage, Worker uploads and HTTP QA requests may count toward Cloudflare metered usage; no account billing settings or payment methods changed.
- The connected n8n tools and available browser tabs DO NOT expose the account's n8n Gateway credits balance, actual per-model n8n cost, auto-top-up state, or an approved monetary cap. The operator must inspect n8n Cloud Console → Manage → Gateway credits and record the balance/auto-topup/rate; no funding changes permitted.
- 2500 reserved tokens is an offline QA counter only, not an enforced actual LLM tokenizer/billing cap. A real AI adapter needs bounded max-output and token reconciliation, and the quota must be reserved BEFORE model inference.
- The previous D1 Time Travel snapshots documented in V14.5Z-LIVE01 remain the only currently verified recoverability checkpoints. No independent SQL dump file was verified (export signed URL returned HTTP 403).
- No real Zalo Bot Creator event entered this new Worker; no real Bot→Shop→Owner identity was authenticated. No real signed webhook verification, hosted tenant registry, authorized provider dispatcher/outbox, live receipt, 3-turn conversation, production traffic or cross-tenant commercial RLS were tested.

## Rollback and shutdown
- For immediate isolation, disable only the new Worker's workers.dev subdomain (DO NOT disable production, modify existing webhook or global gateway). This is a reversible setting change but should be separately approved before executing outside emergency response.
- The QA D1 now has all LIVE02 test grants STOPPED. Without the discarded private signer, no future claim can be authorized with the current Worker public key.
- Source rollback: close Draft PR #103 or revert LIVE02 commits; do not merge.
- D1 rollback remains isolated: Time Travel restore to PRE-LIVE01 bookmark affects entire QA DB and is destructive, **not executed**. Do not DROP/DELETE data without separate explicit approval.

## Release status
- VERIFIED: staging Worker deployed and new D1 bound, HTTP read-only and signed synthetic QA passed, anti-replay/CAS/quota enforced, no-send HTTP 423, GitHub CI 132/132 PASS, new test grants STOPPED.
- BLOCKED: exact real Zalo Bot identity→Shop B→Owner QA authorization, trusted webhook authentication/ingress integration, real model token+monetary cap, stateful provider outbox and send-specific idempotency, live phone receipt, final owner send approval.
- **Decision:** V14.5Z-LIVE02 HOSTED_NO_SEND_QA_ACCEPTABLE / REAL_ZALO_SEND_NO_GO. Do not promote or connect public inbound to the Worker. Next security gate: trusted binding and actual budget certification, then independent send-activation review.
