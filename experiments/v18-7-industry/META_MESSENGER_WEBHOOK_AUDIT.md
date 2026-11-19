# TIEN404 Messenger — Meta Page Webhook Subscription Audit
Date: 2026-11-19 JST | READ-ONLY VERIFIED CONFIG + META DOCS | NOT LIVE SUBSCRIPTION PROOF

## Verified Meta references
- https://developers.facebook.com/docs/graph-api/reference/page/subscribed_apps/
- https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-pages
- https://developers.facebook.com/docs/graph-api/webhooks/reference/page/
- https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start
- https://github.com/fbsamples/messenger-platform-samples

Meta fields are predefined. Applications subscribe to supported fields for the Page object; the Page itself also must subscribe to the app via subscribed_apps. Each feature has separate permission and App Review/Advanced Access requirements. The Meta list does not confirm this app's actual current subscribed_fields.

## Candidate subscriptions by priority
| Field | Why it matters | Current n8n published Extract Messenger Text |
| --- | --- | --- |
| messages | Incoming text, text quick replies, attachments | Supported text; attachments yield textual fallback, no image recognition |
| messaging_postbacks | Start, buttons and menu | Generic greeting only; button payload NOT parsed into commerce action |
| message_deliveries | Sent-message delivery receipt | No separate processor |
| message_reads | Customer read receipt | No separate processor |
| message_echoes | Page-authored outgoing messages | Existing parser skips is_echo, no detailed receipt handling |
| messaging_referrals | Messenger source referrals | No separate processor |
| messaging_handovers | Handover events | No separate processor |
| standby | Events while standby/not primary | No separate processor |
| messaging_optins | Opt-in events | No separate processor |
| messaging_policy_enforcement | Provider policy enforcement | No separate processor |
| message_reactions | Message reactions | No separate processor |
| message_edits | Message edits | No separate processor |
| feed | Page feed comments/posts (NOT direct messages) | Separate integration/permissions, not a Messenger bot default |
| leadgen | Lead form ads | Separate integration/permissions |

## Current n8n evidence
- Workflow: TIEN404_MESSENGER_TEST ID Z7FdV7uDvApfbURQ, active, draft and Published same at inspection, 32 nodes.
- Has GET verification, POST Webhook, crypto and timing-safe signature nodes, message ID de-dup and published send path.
- Extract Messenger Text requires object=page, a single hard-coded page ID, entry[].messaging, and e.message or e.postback. It skips echoes and unsupported/deleted items.
- Postback branch produces a generic start greeting rather than decoding per-button payload. Do not use order/payment buttons for real mutations.
- No data was read from Meta App Dashboard; subscribed_fields and App Review status are UNKNOWN, NOT VERIFIED.

## Merchant/owner self-test, without sharing credentials
1. Open https://developers.facebook.com/apps/ and select the TIEN404 app. Locate Webhooks or Messenger Webhooks and choose Page.
2. Record available and subscribed Page fields, app mode, API version, callback verification and permission review status. UI labels vary.
3. Check the Page-level App subscription using Meta UI or authorized read-only GET /{page-id}/subscribed_apps in your own secure session. Never paste Page Access Tokens or raw IDs.
4. Compare App-level and Page-level subscriptions: both are required. Test from permitted Admin/Developer/Tester roles until App Review permits broader access.
5. Start with P0: messages and messaging_postbacks. On a permitted QA account, send harmless text; record n8n execution ID and response. Try a Get Started or simple postback button; do not interpret generic greeting as payload-specific support.
6. Send an image/audio file as a test: bot should request a text description, not assert it recognized contents.
7. From the Page send a manual message: parser should skip is_echo and not reply in a loop.
8. For invalid signature/verification negative cases use only an isolated QA endpoint and synthetic payload, not the Published webhook.
9. Add delivery/read/referral/handover/standby to a separate NO-SEND classifier in the future; keep live handler unchanged until QA approval.
10. Redact personal identifiers, PSIDs, message contents, signatures, access tokens and Page IDs from screenshots/evidence.

## Evidence table to fill manually
| Case | Field | App subscribed? | Page subscribed? | Role/permission? | Real event observed? | Status |
| --- | --- | --- | --- | --- | --- | --- |
| MWH-01 | messages | UNKNOWN | UNKNOWN | UNKNOWN | NOT TESTED | BLOCKED |
| MWH-02 | messaging_postbacks | UNKNOWN | UNKNOWN | UNKNOWN | NOT TESTED | BLOCKED |
| MWH-03 | message_echoes | UNKNOWN | UNKNOWN | UNKNOWN | NOT TESTED | BLOCKED |
| MWH-04 | message_deliveries | UNKNOWN | UNKNOWN | UNKNOWN | NOT TESTED | BLOCKED |
| MWH-05 | message_reads | UNKNOWN | UNKNOWN | UNKNOWN | NOT TESTED | BLOCKED |

Permissions commonly relevant include pages_messaging, pages_manage_metadata, and in some cases pages_show_list/pages_read_engagement; the exact permission set depends on operation and current Meta App use case. Do not request extra permissions solely because a field exists.

## NO-GO
No automatic Meta Page subscription, App permission change, Graph API send, n8n Published update, customer data read, or production webhook configuration from this audit.
