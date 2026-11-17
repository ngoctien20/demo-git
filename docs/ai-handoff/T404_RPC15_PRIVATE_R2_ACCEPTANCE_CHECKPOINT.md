# TIEN404 AI — RPC15 Private R2 Acceptance × No-Token Worker Binding

**Checkpoint:** `RPC15_R2_PRIVATE_BUCKET_READONLY_VERIFIED · NODE_QA_45_45_PASS · SOURCE_ONLY · HOSTED_NO_GO`  
**Date:** 2026-11-17 (JST).  
**Scope:** Dedicated R2 quarantine bucket and RPC14 source-only integration. Supabase Commerce, Meta Messenger, Zalo, n8n production all out of scope.

## 1. Status verified from Cloudflare API (read-only)

| Item | Verified result |
|---|---|
| R2 account | Enabled; previous 403 error `10042` resolved |
| Bucket | `tien404-merchant-evidence-quarantine-staging` |
| Bucket count | 1 |
| Region | APAC |
| Storage class | Standard |
| r2.dev development public access | **Disabled** (`enabled:false`) |
| Custom domains | **0** |
| CORS | No CORS configuration (API 404 code `10059`) |
| Objects | **0** (empty, no Merchant documents uploaded) |
| Lifecycle rules | Existing default abort incomplete multipart after 604800 seconds (7 days); **no object expiry/retention policy approved** |
| Object Lock | 0 rules |
| Billing alert | Verified earlier at **$1**, enabled; alert is **not a spend cap** |
| Cloudflare user/account token inventory | **Not readable** by current connector (HTTP 403, missing token-read permissions). Do not claim that no tokens exist. No API/S3 token was created during this work. |

**Privacy qualification:** Disabling `r2.dev` and Custom Domain prevents those direct public routes, but a Worker with an R2 binding could expose objects if coded unsafely. No R2-bound Worker or download/upload endpoint is deployed here.

## 2. Source created (RPC15)

- `qa/v152-rpc15/private-r2-quarantine.mjs`: internal `env.R2_QUARANTINE` binding, no API token, no GET/LIST/DELETE/public URL methods. Allows `quarantine/<UUIDv4>` only, exact 8 MiB max, bytes and SHA-256 integrity, fixed binary private headers, pending scan state, atomic `If-None-Match: *` create-only condition. Any unexpected result fails closed.
- `qa/v152-rpc15/verified-r2-bucket-snapshot.json`: **sanitized read-only facts**, no merchant IDs or secrets; reports token inventory unverified and real evidence gates false.
- `qa/v152-rpc15/verify-private-r2-readiness.cjs`: private bucket baseline acceptance while **unconditionally denying hosted upload/Commerce release**.
- `qa/v152-rpc15/private-r2-quarantine.test.mjs`: offline positive and negative tests, including path traversal, over-limit payload, metadata spoof, wrong digest, R2 overwrite precondition, API binding missing and R2 fake errors.
- `.github/workflows/v152-rpc15-private-r2-source-nosend.yml`: only offline Node tests + inherited RPC14/RPC13 regression. No Cloudflare/hosted write secrets or deploy step.

## 3. Local QA

- Node.js 22: `45/45` tests PASS.
- Actual private R2 bucket API: READ-ONLY privacy/metadata check PASS.
- Worker binding: **NOT DEPLOYED**, no real R2.put invoked.
- No real JWT, Access app, storage, invitation, scan, Merchant upload or original-owner UAT executed.

## 4. Remaining blockers

1. Dedicated independently protected Cloudflare Access application, verified identity policy and first real external browser canary.
2. Hosted scoped JWT admission, durable one-time invite registry, real rate limit and independent staffed review.
3. Actual virus/malware scanning (or vetted content disarm and reconstruction) and safe quarantine-to-reviewed state transitions.
4. Owner-approved retention, audit trail and deletion/restore procedures; **no auto-delete change** made.
5. Private source-ledger and independent authentic Merchant attestation for `P1/P2/O1/O2` (0/4 verified).
6. Verified canonical Store ownership, real same-Tenant two-Store authenticated Supabase JWT A/B UAT, independent recovery evidence.
7. Security/DB/operator owner approval **before** any privileged hosted migration, grant or bot send.

## 5. Changes / exclusions / rollback

- GitHub source-only draft branch stacked on RPC14; no Merge. No public or hosted Worker route, API token, R2 object, bucket policy, Cloudflare Access edit, Supabase DDL, n8n workflow change, Commerce data, or provider send.
- Rollback: close Draft PR and delete only new branch. No hosted rollback required.
- Do **not** promote the R2 adapter without testing actual Workers binding and authenticated untrusted input in an isolated private staging environment.

## 6. Next step

- Verify GitHub Actions status and SHA. Then seek specific authorization for a **separate Access app and inactive, non-public Worker with R2 binding** plus malware scanner/retention controls. Only after authenticated end-to-end no-send canary and independent review may real original-source documents be received.