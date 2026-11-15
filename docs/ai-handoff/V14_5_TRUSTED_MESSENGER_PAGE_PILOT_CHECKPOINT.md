# TIEN404 AI V14.5 — Trusted Messenger Page Inspection × No-Send QA Gate

**Date:** 16 November 2026 JST  
**Mode:** EXPERIMENTAL / DRAFT / NO SEND / NO HOSTED WRITES  
**Branch:** work/v145-messenger-trusted-page-gate-no-send-20261116  
**Parent:** V14.4.7–V14.4.10 Draft PR #110 HEAD 14ae74bf55176a1f973c002d8d1ec211ca775e9e.  
**Other dependencies:** PR #86 Store/Knowledge and PR #95 Messenger Replay remain separate Drafts.

## 1. VERIFIED — Existing Messenger Published (read-only)

- Published workflow TIEN404_MESSENGER_TEST ID Z7FdV7uDvApfbURQ remains ACTIVE, Draft/Published version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92.
- POST Webhook1 has options.rawBody=true, followed by HMAC Crypto, a Timing-Safe SHA256 signature check, and a signature branch.
- Send Messenger Reply HTTP node has a credential configured and targets Meta Graph API. No credential or Page secret was read or exported.
- Most recent visible webhook execution #2246, 11 Nov 2026 11:50:42 UTC, returned verified=true in signature nodes and a provider message_id on a successful Send Reply. Historical success only; not evidence of Page token validity today.
- Published bot still connects order creation, management and update to legacy Google Sheets AI_SALES_DEMO. This MUST NOT be silently reconnected to Store Commerce.
- Its message MID dedupe checks a Data Table rowNotExists before writing a success record after send; this is not proof of durable atomic idempotency with concurrent webhook executions.
- Offline Rich UI workflow X0MwwQ7LRUqfOVjM remains INACTIVE and the existing manual n8n Four-Flow QA jeLqAGOlG06LanDv remains INACTIVE (execution 3862, 8/8 scripted offline cases).
- No directly inspectable Meta Developer Page/App browser tab or connected Meta Page permissions tool was available. Current App ID, Page ID, tester role, pages_messaging permission, MESSAGE Page task, Page subscriptions and live token validity remain UNVERIFIED.

## 2. VERIFIED — Supabase baseline (read-only)

- Staging project ifxlvrhyjhbzbrkdsida PG17.11: Products=2, Orders=2, canonical Stores/Memberships absent, six old permissive tenant SELECT policies.
- Actual isolated restore of the operator backup is still deferred/unverified. Real Store-specific hosted Order writes, Store schema and JWT/RLS acceptance remain BLOCKED.
- Previous V14.4.6 atomic transaction and inventory tests ran only on disposable PostgreSQL 17 CI.

## 3. IMPLEMENTED — Synthetic signed Page-to-Store gate

Files:
- qa/messenger-live-gate-v145/trusted-webhook-qa.cjs
- qa/messenger-live-gate-v145/trusted-webhook-qa.test.cjs
- .github/workflows/v145-messenger-trusted-page-no-send.yml

Security properties:
1. Only OFFLINE_SIGNED_FIXTURE_ONLY mode; synthetic App Secret and Page registry; no real token, HTTP server, Meta send, Supabase or n8n API calls.
2. Validates X-Hub-Signature-256 on ORIGINAL Buffer bytes before JSON parsing, using Node crypto HMAC SHA256 and timingSafeEqual.
3. Resolves Page→Tenant→Store only from a server-owned synthetic allowlist, not from event, sender or AI-provided storeId.
4. Refuses unknown/inactive Page, wrong recipient, missing/invalid MID, timestamp anomaly, sender mismatch, mutated payload, oversized batch, replay key conflict and capacity exhaustion.
5. Ignores echo events and returns hashed event/sender scopes without raw PSID, body text, tokens or secrets.
6. Replay is IN-MEMORY and therefore NOT atomic across machines/processes; no durable replay acceptance is claimed.
7. Readiness remains LIVE_SEND_NOT_AUTHORIZED even when hypothetical boolean evidence fields are all true. Separate actual Meta verification and owner SEND approval must be checked outside the mock.
8. Local Node 22 test run: 45/45 PASS after fixing missing-MID type checking. Final GitHub Actions evidence to be recorded after run.

## 4. Owner actions for a future real Messenger QA pilot

Consult Meta official:
- https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start
- https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-pages
- https://www.postman.com/meta/messenger-platform-api/documentation/iyp204x/messenger-platform-api

**READ-ONLY inspection checklist (no credentials should enter chat or repository):**
- [ ] Identify the intended QA Facebook Page and Meta App by non-secret Page ID and App ID.
- [ ] Check App Mode, and that a tester Facebook account has an app Developer/Tester role when required.
- [ ] Verify pages_messaging permission and that the Page owner has the MESSAGE task.
- [ ] Confirm Page has subscribed to the correct App and fields messages / messaging_postbacks, including webhook callback.
- [ ] Confirm Page token validity inside secure Meta UI. Do NOT paste or screenshot token, App Secret, Verify Token, or customer PSIDs.
- [ ] Ensure tester initiated the conversation within the standard 24-hour Messenger Send API window or another explicitly authorized policy.
- [ ] Explicitly authorize a bounded LIVE pilot: named QA Page, tester account(s), maximum message count, text-only consultation/quotation first, NO real customer Order writes or owner notification broadcasts.
- [ ] Snapshot existing app/webhook settings and plan immediate rollback before changing anything.

**Separate approval required** for sending actual Meta messages, token changes, webhook subscription, n8n Published changes, and any Commerce Customer/Order data write. Current generic progress permission does not grant those.

## 5. Release level and evidence

LEVEL 1 OFFLINE: previous n8n 8/8 and 612/612 Node regressions, disposable PG17 30+8, plus current signed synthetic 45 cases once final CI confirms.
LEVEL 2 STAGING CONNECTED: NOT VERIFIED, because real AI + trusted catalog + atomic Order/outbox are not yet connected end-to-end.
LEVEL 3 LIVE MESSENGER QA: NOT VERIFIED, because current Meta Page/App permissions and tester/send scope are unverified and no new live message has been sent.
LEVEL 4 COMMERCIAL RELEASE: BLOCKED pending backup restore, four-row ownership, hosted Store/RLS/JWT and independent release authorization.

**Rollback:** close/revert only this Draft source PR. No Supabase DB/schema/policies, real Page/App, n8n published workflow, credentials, customer data, billing or production resources were altered.

**Next:** owner-approved READ-ONLY Page/App inspection through authenticated Meta UI; then limited SEND approval for tester-only read-only consultation/quotation, with new evidence. Store-specific Order pilot only after actual security and restore gates.


## 6. Final CI and post-run evidence (VERIFIED)

GitHub Actions run 43747334381:
https://github.com/ngoctien20/demo-git/actions/runs/43747334381

- **3/3 jobs COMPLETED SUCCESS**.
- **45/45** new raw-buffer SHA256 HMAC / Page→Store / time/MID/replay security unit tests PASS.
- **612/612** inherited Node Messenger+Commerce tests PASS.
- Total **657/657 Node PASS**, zero FAIL.
- Disposable **PostgreSQL 17: 30/30** order/stock functional SQL assertions PASS, **8/8** genuine concurrent database session checks PASS. No hosted database.
- Initial local development test caught a missing-MID type validation bug (2 cases); code fixed and rechecked locally **45/45 PASS** before upload, with CI confirming 45/45.
- Post-run Supabase READ-ONLY: PG17.11, Products=2, Orders=2, canonical Stores=false, Memberships=false, six old permissive tenant SELECT policies unchanged.
- Post-run n8n READ-ONLY: Published Messenger ID Z7FdV7uDvApfbURQ remains ACTIVE version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92, 27 nodes. Four-Flow Manual QA jeLqAGOlG06LanDv remains INACTIVE/no Published version. No changes to tokens, webhook, Meta Page or existing customer Orders.

**Outcome: SOURCE SECURITY GATE TESTED + LEGACY MESSENGER HISTORY VERIFIED. REAL PAGE INTEGRATION NOT YET VERIFIED / LIVE SEND NOT AUTHORIZED.** Read-only Meta Page/App ownership and tester permission evidence remain missing. No current Page credentials, secret, token, sender PSID, order content or business data was copied to this checkpoint.
