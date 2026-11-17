# TIEN404 AI — V17.7H Scoped Inactive Hosted Worker × Verified QA Owner Consent × Native No-Send UAT

Checkpoint date: 2026-11-17 JST.
State: DRAFT SOURCE AND PREDEPLOY SAFETY CANDIDATE. REAL OWNER, REAL PROVIDER WEBHOOK AND REAL STORE A/B ARE **NO-GO**.
Parent Draft PR #342 head 05cabc1fb8f30dcfa47f656cc03a885ddee75b46 (435/435 local Request/WebCrypto tests, 7/7 CI). No merge.

## 1. Verified read-only baseline and why a separate Worker is needed

- Cloudflare account staging ac01685529c0a31fc185335f07648edf has **no V17.7H Worker** at the initial inspection. Existing RPC16 Merchant evidence Worker tien404-rpc16-merchant-evidence-inactive-staging has workers.dev DISABLED, previews DISABLED, a separate Access app f994d4b2-d4f9-419b-8585-5d33be506f13 with zero inline Allow/Bypass policies, and an R2_QUARANTINE binding. Existing RPC16 has a 100% deployment but no approved public route; do not modify or reuse that worker for provider callback.
- n8n QA MQcbjLWZ5QUTJW0k version b8aaf94c-def1-472c-bd92-fccea1d946b8 remains INACTIVE, manual trigger and Code only, previous execution 5026 was 12/12 synthetic PASS. Do not publish, change or execute it as a real webhook.
- Existing Messenger TEST Published contains an HTTP send, Zalo Bot Published contains QA marker upsert, so neither is safe for an independent zero-send/zero-write proof.
- Supabase staging QA maps two Tenants and maximum **one** Store per Tenant. Public Commerce still lacks accepted same-Tenant Store-qualified JWT/RLS, no public/production Store read or writes allowed from any channel.

Cloudflare official POST /accounts/{account_id}/workers/scripts/{script_name}/versions is an UPLOAD-VERSION-ONLY API, unlike PUT /workers/scripts/{name}, which may automatically deploy. Official docs:
https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/create/
Cloudflare warns Version/Preview URLs can have separate visibility from workers.dev. Both must be explicitly disabled and read back:
https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/
https://developers.cloudflare.com/workers/configuration/routing/workers-dev/

## 2. Scoped inert-only worker

Source: qa/v17-7a-oa-independent/v17-7h-hosted-deny-all-worker.mjs.
- Exported default fetch() returns empty HTTP 404 with cache-control:no-store and nosniff on ALL requests.
- Zero credential, token, Durable Object, R2, Queue, DB, HTTP client, provider or Commerce binding. No outbound call and no business logic.
- A real webhook DOES NOT belong here yet: even a correctly signed native event receives 404 and cannot read or write tenant data.
- Companion config v17-7h-inactive-worker-config.json declares workers_dev:false, preview_urls:false, routes:[], crons:[], observability disabled, no bindings.
- Source-only host metadata inspector requires exact script/version identity, exactly zero deployments, routes, custom domains, cron, preview, workers.dev and bindings; any missing/unknown metadata is NOT a pass.
- Private owner ticket inspector requires a redacted 15-minute QA-only ticket for ZALO_BOT or MESSENGER, distinct owner/operator/reviewer digests and strictly no sensitive data. A supplied ticket shape CANNOT authenticate the real provider owner or merchant and never grants a route or token.

## 3. Hard separation and actual phased steps

A — Inactive version staging (scoped):
1. On exact-head CI PASS and separate owner/finance cost gate, verify no script name collision. Do not use upload-and-deploy endpoint.
2. Version-only POST multipart of the exact deny-all source to a new isolated script. No bindings, triggers, secrets or routes.
3. Disable workers.dev AND preview URLs before any runtime activation, read back actual script subdomain and deployments, verify zero deployment/version-only.
4. Inspect account routes/custom domains/cron by independent read-only API. If any exposure or unexpected deployment appears, STOP: do not register webhooks or send traffic. Restore to deny-all nonpublic state through separately approved rollback.
5. Re-run CI and store only version ID/redacted metadata in GitHub. No private endpoint activated.

B — Authenticated real QA owner consent (NOT PERFORMED):
- A real independent QA Bot owner or Meta Page administrator must authenticate to the provider-managed portal, grant only one disposable QA installation, and independently attest Page/Bot-to-Store binding and independent operator consent through private authorized UI.
- Do NOT paste OAuth codes, app secrets, JWT, phone, raw customer messages, Merchant documents or token values into chat/GitHub. A hash or user statement alone is not proof.
- A real Merchant Store Owner also requires private G0 four original records, M0 recovery and G3 same-Tenant two Store JWT/RLS under canonical PR #247. No shortcut from provider secret to Store ownership.

C — Native no-send provider UAT (NOT PERFORMED):
- Requires a separate signed provider callback (not this 404 Worker) with real owner consent, bounded external route and exact provider-native header/signature, verified Page/Bot install and durable replay/rate gate.
- Zalo Bot X-Bot-Api-Secret-Token is a shared secret HEADER. Meta X-Hub-Signature-256 is HMAC over raw webhook bytes. Zalo OA OAuth + X-ZEvent-Signature are distinct and deferred.
- After explicit authorization, send exactly ONE labeled QA message from an approved QA actor only, then verify native inbound receipt and independent ZERO provider outbound sends, ZERO Commerce orders/stock writes. Existing Messenger TEST and active Zalo Bot QA marker-upsert must not receive this traffic.
- Unauthenticated external requests to Merchant proof Access must be denied at the Cloudflare edge; provider callbacks require native signature verification and cannot reuse a human login challenge. External denial test must use an independent observer, not simulated 404.
- Replay must be DURABLE in actual hosted Cloudflare Durable Object storage (RPC17.2 currently proved LOCAL Workerd SQLite, not this hosted canary). Real malware scan for Merchant evidence remains separate RPC16/17 milestone.

## 4. Deliverables

- v17-7h-hosted-deny-all-worker.mjs: 404 all methods/paths, no bindings.
- v17-7h-inactive-worker-config.json: no workers.dev/preview/route/cron.
- v17-7h-host-and-owner-admission-offline.mjs + .test.mjs: metadata and independent owner consent negative QA; no self-authorization.
- v17-7h-hosted-version-evidence.json: redacted observed state and strict false for real owner/provider/Store JWT and actual sends.
- .github/workflows/v17-7h-inactive-worker-owner-nosend.yml: inherited V17.7A–G plus new H offline tests, static safety and evidence gate.
- This checkpoint, rollback and explicit approval requirements.

## 5. Result / permissions / rollback

- VERIFIED: current read-only Cloudflare, Supabase, n8n, GitHub; actual script subdomain/version API contracts.
- IMPLEMENTED: source-only Worker deny-all, admission checks, owner consent offline linter, full CI.
- TESTED: record only after exact final HEAD GitHub Actions passes.
- BLOCKED: real QA Page/Bot ownership, independent authenticated reviewer, actual provider native event, hosted durable replay/rate and external edge UAT, real Store A/B JWT/RLS, Zalo OA.
- No production send, customer/merchant data, credential reads, RLS migrations, public webhook, Messenger/Zalo webhook re-pointing or new Cloudflare Access Allow/Bypass.
- Source rollback: close this Draft child PR. For any newly created **inactive version-only** Worker, verify exact script ownership/version ID before any cleanup and require explicit separate confirmation before deleting it. Never delete RPC16 Merchant worker or other projects.

NEXT suggested: V17.7H.1 — Operator/Owner Evidence Identity Challenge × Inactive Worker Version Hosting Readback × Bounded Native Canary Approval.
