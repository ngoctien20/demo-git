# TIEN404 AI V14.4.10 — Real Messenger QA Page Integration Preflight (NO SEND)

This is a READ-ONLY approval checklist, not a Meta connection or rollout. Date: 16 Nov 2026 JST.

## Grounded baseline
- Published Messenger workflow Z7FdV7uDvApfbURQ is ACTIVE, contains Meta GET/POST webhook, signature verification and Send Reply node. Its last visible webhook success #2246 is 11 Nov 2026, not a new 16 Nov real Page test.
- It still calls Google Sheets DEMO product/order tools, not an approved multi-Store Commerce Order Request/RLS backend.
- Offline Rich UI V13.6M candidate X0MwwQ7LRUqfOVjM is INACTIVE; new manual QA jeLqAGOlG06LanDv is INACTIVE and has no credentials.
- No verified Meta Page/App role, Page token validity, pages_messaging approval, current subscribed fields, webhook subscription permissions, or message-window entitlement was inspected or changed in this release.
- No user authorization has been given to alter a live Page/App credential, publish a webhook, send a Meta reply or modify existing Published Messenger workflow.

## Meta documentation verified as of 16 Nov 2026
- Meta Messenger quick start: https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start
- Meta Webhooks: https://developers.facebook.com/docs/graph-api/webhooks/
- Meta Webhooks signature: https://developers.facebook.com/docs/graph-api/webhooks/getting-started/
- Meta Messenger Postman reference: https://www.postman.com/meta/messenger-platform-api/documentation/iyp204x/messenger-platform-api

Important: Meta webhook notifications include a SHA-256 HMAC signature in X-Hub-Signature-256; compare digest computed on ORIGINAL raw body with App Secret using constant-time comparison. URL verify_token on GET alone is NOT POST integrity. Never log signatures, tokens, sender PSID or raw customer content to CI.
Webhooks and Page privileges depend on app permissions and Page authorization; app review/testing eligibility must be independently verified in Meta.
Standard Messenger send window is typically the 24-hour window after customer interaction. Do not send unsolicited owner/customer broadcasts or use unsupported message tags.

## Required owner-authorized REAL QA gate (all still UNCHECKED)

- [ ] Named, existing QA Facebook Page ID and app ID identified by owner in a private approved connection; no secrets pasted in chat or GitHub.
- [ ] Owner grants permission to inspect Page/App configuration; confirm tester role and Page MESSAGE task.
- [ ] Confirm pages_messaging permission and any additional required permissions/app review for actual tester cohort.
- [ ] Verify exact subscribed Page, webhook callback, message + postback fields and whether live mode is permitted; do NOT change callback while production users might receive messages.
- [ ] Validate POST raw-byte X-Hub-Signature-256 against the correct existing App Secret using a safe isolated negative+positive QA; reject wrong signature before tenant/store lookup.
- [ ] Confirm server-owned Page→Tenant→Store binding. Do not trust store_id from inbound message or Page display name.
- [ ] Confirm trusted Sender PSID handling, replay-resistant MID, and no cross-Page order/session leak.
- [ ] Verify Meta Page token is valid with required Page task without printing the token. Token creation/rotation requires separate approval.
- [ ] Independent Commerce data isolation gate: actual private backup RESTORE, four legacy record-owner attestations, Store schema/RLS and JWT A/B same tenant acceptance. If unavailable, keep the real Page test to READ-ONLY consultation/quotation using separately approved synthetic catalog and DO NOT WRITE customer orders.
- [ ] Exact owner-approved sending scope: tester accounts only, named QA Page, max N QA messages, no outside 24h window, no customer PII in logs, rollback plan.
- [ ] Owner authorizes LIVE send separately. No token, Page, webhook or Paid/Published workflow modification without new approval.
- [ ] Capture redacted test evidence: inbound event accepted, signature verification status, safe handler intent, returned Meta message ID, validated tester receipt, no duplicate/out-of-scope sends.

## Recommended incremental gate
1. LEVEL 1: already TESTED — 8/8 n8n offline mock, 33/33 offline Node multi-turn, 579 inherited regressions, 30+8 disposable PG17.
2. LEVEL 2: PENDING — connect adapter, trusted synthetic catalog, Order Request and no-send Outbox in an isolated QA execution; preserve real Page/Meta credentials untouched.
3. LEVEL 3A (only after separate approval): QA Page inbound text and **read-only** consultation/quote, no real order write.
4. LEVEL 3B (only after independent Restore+Store RLS/JWT+stock policy gates and separate approval): QA Page test synthetic Order Request, owner notification and Rich UI.
5. LEVEL 4: commercial release requires separate full review.

Do not expand an existing LIVE webhook blindly: rollback might disrupt users. Prefer separate QA-only Page/App binding or a consciously approved safe test cohort, with snapshot/checkpoint of any configuration before modifications.

## Operator acceptance
The owner must explicitly identify the QA Page/App and authorize (A) read-only inspection and then (B) a bounded actual send if desired. Permission to read does NOT imply permission to modify Page credentials or send messages.

No real message send was performed by V14.4.7–V14.4.10. No changes to Published workflows, production, Supabase schema, RLS, customer Orders, stock or billing.

Source rollback: close/revert Draft PR; preserve existing inactive n8n QA workflow for test or archive it only after separate approval.
