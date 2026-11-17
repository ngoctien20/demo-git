# TIEN404 — V17.ZALO-SOURCE-04 checkpoint
## Provider Compatibility Hardening × Private Real OA No-Send Acceptance
Date: 2026-11-17 JST
Status: IMPLEMENTED / TESTED SOURCE-ONLY; REAL PROVIDER UAT BLOCKED; DO NOT MERGE / DEPLOY / SEND

Parent: Draft PR #294 HEAD 3c43bd03607a6b8f9d47084d733a27b0eadf9bb7.
Child branch: work/v17-zalo-source04-provider-compat-private-uat-nosend-20261117.
No change to parent PR #291/#292/#294, n8n Published workflows, Supabase hosted schema, Cloudflare hosted Worker, credential vault, Messenger or DEMO.

## Verified authoritative Zalo evidence
1. Official Zalo OA v4 documentation: https://stc-developers.zdn.vn/docs/v2/official-account/bat-dau/xac-thuc-va-uy-quyen-cho-ung-dung-new
   - Code verifier described as 43-character mixed uppercase/lowercase/digit string; unique per request. Derived SHA-256 code challenge, then Base64 without padding.
   - OA callback example includes code and oa_id. OA-specific guarantee about state echo is NOT independently established. We must not remove CSRF defense.
   - Authorization code one-use/10 minutes; access token 25 hours; refresh token one-use/3 months; refresh invalidates old access token.
   - OAuth code exchange request must be backend-private POST oauth.zaloapp.com/v4/oa/access_token using secret_key; provider OA identity from https://openapi.zalo.me/v2.0/oa/getoa. No such request occurred.
2. Official OA webhook: https://stc-developers.zdn.vn/docs/v2/official-account/webhook/tin-nhan/su-kien-nguoi-dung-gui-tin-nhan
   - POST JSON event and X-ZEvent-Signature; documented mac=sha256(appId+data+timestamp+OAsecretKey). Confirm byte/serialization semantics via independently authorized real signed OA canary. Do not treat Bot X-Bot-Api-Secret-Token as OA MAC.
3. OA quickstart: https://docs.zaloplatforms.com/docs/OA (shows code+oa_id OAuth callback and OA profile readback). Social OAuth docs also describe state but are not sufficient OA-specific proof.

## Implemented source-only patch
- Updates inherited oa-oauth-offline.mjs generator: 32 cryptographic random bytes -> 43-character base64url verifier; regenerate until mixed upper/lower/digits. Keep S256 and existing 5-minute atomic state/Store Owner gate. Its inherited QA assertion now checks 43 characters and class diversity.
- New qa/zalo-oa-source-admission/oa-provider-compat-offline.mjs:
  * checkOaPkceCandidate: conservative 43-character verifier and S256 challenge shape.
  * inspectOaCallbackShape: pinned HTTPS redirect path+origin, anti-CSRF state required, one value per query param, no code/OA/state in outputs; unknown callback format => deny with diagnostic.
  * inspectOaWebhookShape: requires raw bytes, limited content length, one OA signature header, JSON content type and conservative OA text/image/link event shape; no signature or provider ownership verification is claimed.
  * assessPrivateOaNoSendReadiness: permanent offline NO-GO gate despite untrusted self-reported evidence. Real verification cannot be self-attested in a public module.
- New 35 synthetic negative and shape tests; inherited OA suites also run.
- Dedicated source-only GitHub Actions workflow with syntax, inherited tests and static no-network/send guard.

## IMPORTANT protocol limits and implementation notes
- "Source structural check ok" is NOT "signed provider verified". No public gateway can call this as a standalone acceptance decision.
- Inherited oa-admission.mjs verifies a CANDIDATE signature formula over raw JSON bytes; actual signed event from a provider-owned OA is absent. Raw-body preservation MUST be guaranteed before verification; a proxy may parse/re-serialize and invalidate signatures.
- OA callback code input syntax and state propagation are unverified against a real QA OA. The safe failure response is DENY or operator escalation, never silently disable state. The Zalo platform's exact approved-app callback semantics must be independently proven.
- The provider callback oa_id is only an untrusted claim until token exchange plus /oa/getoa readback and independently authenticated merchant authorization. A cross-Tenant/Store globally unique OA binding must be atomic, including disabled rows.
- TOKEN issuance/refesh remains prohibited. Single-use refresh token requires per-OA lock or lease before provider invocation, atomic token generation swap, and recovery for uncertain network responses.
- Native Cloudflare Workers Node crypto or n8n webhook raw-body semantics require compatibility tests before any deployment. These Node-only modules are NOT Worker production code.
- Do not expose code, state, verifier, OA token, signature, sender ID or raw event in logs, public GH, pin data, browser localStorage or chat.
- No network, real provider calls, no real messages, no real DB schema/rows, no customer PII, no order writes, no model calls, no cost and no Published modifications performed.

## Real private QA OA no-send UAT — separate AUTHORIZATION GATE
BEFORE any real OAuth exchange, OA webhook configuration, private Worker upload, Supabase mutation or token custody:
1. Merchant signs consent through authenticated private channel: exact approved OA, Store, Zalo App, callback, scopes, timebox, NO SEND. Do not paste credentials into ChatGPT or GitHub.
2. Independent TIEN404 operator approves QA-only scope, budget ceiling and kill switch. No owner self-approval. Log approval privately.
3. Confirm same-Tenant two real Store owners with valid Supabase Auth JWT; independently test Store A/B least-privilege RLS. Current project evidence blocks this step.
4. Provision managed secret storage, DB identity least privilege, strongly consistent unique (ZALO_OA,oa_id) reservation, durable replay TTL/rate guard. No publicly exposed RPC bypass.
5. Confirm OA-specific PKCE code_verifier/challenge/state propagation and confidential callback, real token exchange and /oa/getoa ID equality in private one-shot. Discard code safely.
6. Validate provider-signed webhook raw bytes (unaltered), wrong/tampered signature 403, different Store/OA deny, replay deny, duplicate deny. ACK only after trusted admission; no external send.
7. Independent evidence: SHA/Workflow version, timestamp, redacted hashed event receipts, operator and owner attestation, evidence of 0 messages and 0 Orders/Stock writes, rollback plan.
8. Do not promote to Commerce until a later separately approved release gate.

## QA evidence taxonomy
- VERIFIED: source files existed and cited Zalo public documentation was checked.
- IMPLEMENTED: source-only hardening on child branch, not deployed.
- TESTED: local Node test suite / GitHub Actions only after execution on exact final HEAD is confirmed.
- BLOCKED: OA admin live ownership, provider signed canary, app consent, real same-Tenant Store owner JWT/RLS, managed secrets, hosted Worker, real OAuth.
- PROPOSED: independent private real OA UAT execution, separately approved, no traffic yet.

Rollback: close child Draft PR or reset branch to parent SHA. There are no hosted systems to roll back. Do not merge into production branches or publish anything.
