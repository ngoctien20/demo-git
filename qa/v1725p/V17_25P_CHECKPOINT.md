# TIEN404 V17.25P — Exact Deployed Source Replay × Provider Port Admission × M0

**Date:** 18 Nov 2026 JST  
**Status:** `VERIFIED_BYTE_EXACT_SOURCE / TESTED_28_OF_28_SYNTHETIC / LEGACY_TENANT_ONLY_CONFIRMED / PROVIDER_PORTS_DESIGN_ONLY / M0_NO_GO / HOSTED_NO_GO / PRODUCTION_NO_GO`

## 1. Exact deployed source verified

Read-only Render service and deployment inspection:
- Service: `tien404-data-staging`
- Deployment: `dep-dbqj9plg1s2s73egr30g`, status LIVE at inspection.
- Deployed Git commit: `ab940a95dae8afdff426bc6ac71693833d5348ce`.
- Render branch: `ops/tenant-data-platform-v1-staging-20261110`.
- Auto Deploy: OFF.
- Build: `pip install -r ops/data-platform/requirements-test.txt`.
- Start: `cd ops/data-platform && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}`.
- Main source blob: `a7a11abeffb378b3f9952005ffdd489c54df1c13`.
- Signed n8n helper blob: `9f74b6b3e617acd20aa1bfd8fd50b4b12938907e`.

The two fixture files in `qa/v1725p/deployed_fixture/app/` are verified byte-exact using Git blob SHA-1 in CI. No deployed source is edited.

## 2. Verified compatibility behavior

Exact `GET /api/v1/tenants/{tenant_id}/orders` in deployed `main.py`:
- Calls Supabase `/auth/v1/user` using the user bearer token.
- Queries active `tenant_memberships` for actor + tenant.
- Allows tenant roles owner/manager for Orders.
- Queries Orders using only `tenant_id=eq.<tenant>`, created_at order and limit.
- Does not include `store_id` in PostgREST filter or selected output fields.
- An extra client `?store_id=` query is ignored by this route.
- Response sanitizer checks tenant_id and removes unselected fields, including store_id.

Synthetic fixture has two fake orders in the same tenant, one per Store. Both synthetic Owner A and Owner B receive both rows through the exact route. This establishes a **tenant-only legacy API contract incompatible with multi-Store isolation**. It is not evidence of a real exploited breach; current hosted schema still has no canonical Store membership or Store columns.

## 3. Actual CI evidence

- PR: [Draft #411](https://github.com/ngoctien20/demo-git/pull/411), head `ae3dac141799f9eda70490f5b56e43f7a4e9c9b4`, stacked on Draft PR #409 head `b5f7310b1c1362cf79cb237f11201551a3b1ce81`.
- Run: [GitHub Actions #44262745160](https://github.com/ngoctien20/demo-git/actions/runs/44262745160).
- Job: `134659794195`, completed SUCCESS.
- Log evidence: `V1725P_BYTE_EXACT_DEPLOYED_SOURCE_BLOBS_PASS`; `28 passed in 0.38s`; `V1725P_EXACT_SOURCE_SYNTHETIC_ONLY`.
- Test uses `httpx.MockTransport` for all outbound Supabase requests; real socket `connect` and `create_connection` are blocked in the test process. No real JWT, Supabase credential, customer/order row or network endpoint is used.
- Checks auth absence/format, membership roles and missing membership, provider errors, cross-tenant response fail-closed, bounds, sanitizer, security headers, health semantics, no write route and two synthetic tenant Owners seeing the same two Store fixtures.

This is a source replay using the exact deployed file, not a live Render HTTP test or Supabase RLS test.

## 4. Provider port admission design

No real adapter/verifier is implemented or enabled.

- **Meta Messenger/Page:** official docs specify `X-Hub-Signature-256: sha256=...`, SHA-256 HMAC over raw notification payload using Meta App Secret. Verify exact raw bytes before parsing, constant-time compare; Page ID must map to a server-owned installation. A webhook signature proves provider event origin only, not Merchant Owner identity.
- **Zalo OA:** official OA event docs specify `X-ZEvent-Signature` formula for the documented OA event family. Preserve exact signed input representation; verify app_id + oa_id + event type and active server-side OA installation. Do not assume one formula covers every OA/ZBS event.
- **Zalo Bot:** official docs confirm Bot Token and both long-polling `getUpdates` and webhook `setWebhook`; inspected official pages do not establish that the OA signature formula applies to Bot. Bot-specific webhook authentication remains blocked pending exact Bot API contract. Do not infer trust from third-party examples.
- **Website:** server-verified session, Origin/Host and CSRF checks, anti-replay/rate limits, server-side widget installation → Store mapping. Browser Store ID is a selector only, never authority.
- No cross-channel customer identity merge. Inbound customer sender identity never grants merchant Orders access.

## 5. M0 evidence ownership and decision

Reuse existing private RPC12 evidence intake and V18.0-P0D Draft PR #398 fail-closed evaluator. No new registry or public copy of private proof.
- Owner explicitly deferred the real local backup on 17 Nov 2026.
- Historical H11R archive: 5/5 application table data locally checked; 0/3 Auth and 0/2 Storage. Accepted with limitations, not a current independently recoverable backup.
- No current backup + isolated restore/readback has been independently verified.
- Supabase organization plan Free; do not assume paid-tier managed daily backup.
- V17.25P performed no backup, export, restore, local Docker action, branch creation, billing or private row inspection.

M0 stays `NO_GO` until the owner separately chooses scope/target and approves any cost, data export and restore operator; an independent reviewer verifies checksums and actual restored readback, including explicitly selected Auth/Storage coverage. Owner and independent reviewer must be different roles.

## 6. Live boundaries / risk

- Supabase staging metadata remains: PostgreSQL 17.11, canonical `stores` / `store_memberships` absent, Store columns 0/6.
- Render direct origin allowlist is `0.0.0.0/0`; service is public and Auto Deploy OFF. This source replay did not change origin access. Keep this as a separate hardening gate before protected hosted Auth UAT.
- No Render, Supabase, Cloudflare, n8n, Meta, Zalo, Auth, RLS, DDL/DML, credentials, customer/order, billing or provider-send mutations.
- Real Owner A/B JWT UAT remains `0/31 NOT RUN`.
- Hosted Store read/write and production remain NO-GO.

## 7. Rollback and next step

Rollback: close/revert Draft PR #411. CI service is ephemeral. No runtime rollback needed.

Next safe step: V17.25Q — Store-Aware API Contract Design + legacy endpoint deprecation matrix + no-host dual-owner route negative suite, still source-only. Do not add Store columns or switch RLS until M0, canonical owner provenance, independent review and explicit scoped approvals exist.
