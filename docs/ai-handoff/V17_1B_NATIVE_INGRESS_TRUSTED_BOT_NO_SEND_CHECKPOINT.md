# TIEN404 V17.1-B — Native Ingress × Trusted Custom Bot Binding × No-Send Pilot
Checkpoint: 2026-11-17 JST. SOURCE QA + manual n8n QA only; no production modifications.

## VERIFIED — existing actual ingress
- Messenger TIEN404_MESSENGER_TEST workflow Z7FdV7uDvApfbURQ, ACTIVE Published, 27 nodes, active version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92. Its POST webhook uses rawBody, credential-backed Crypto HMAC and timing-safe comparison of x-hub-signature-256. The published graph contains legacy Sales tools and live Send API, and was NOT modified.
- Read-only check real Messenger webhook execution #4176: status SUCCESS, mode webhook, Verify Signature Timing-Safe returned verified=true. This proves signature acceptance on the existing workflow, NOT a connection to new per-Store Custom Bot.
- Zalo Bot staging yIJk8LvJoLF40Z62 ACTIVE with headerAuth, 10 nodes. Private customer router sIPs6egzIwOY1GNv ACTIVE 6 nodes with QA bot registry/owner. Recent inspected Zalo executions were manual, no proof of live webhook.
- Zalo Bot and Zalo Official Account are DIFFERENT protocols. Header secret may be suitable for Bot transport, but does not establish merchant OA ownership or OA event signature. Official Zalo OA event docs reference X-ZEvent-Signature; do not reuse Bot header logic for OA.
- Existing V17.1-A Draft PR #243 source had 83/83 Node QA and 5/5 synthetic E2E, and inactive n8n workflow DCj7mQbovyYNf7Li manual execution #4197 (5/5 synthetic).

Vendor sources: https://developers.facebook.com/docs/graph-api/webhooks/getting-started/ ; https://stc-developers.zdn.vn/docs/v2/official-account/webhook/quan-ly/su-kien-tao-nhan

## IMPLEMENTED + TESTED — protocol QA
- Source qa/v171-channel-first/native-ingress-qa.mjs: Meta-native-shaped raw-body HMAC SHA-256 and timing-safe comparison with PUBLIC QA-ONLY fake secret, then strict event, Page and recipient validation and server-owned QA installation → Store → Bot mapping. Reject inbound client store_id, tenant_id, bot_id and verification_status, replay conflicts and unsupported event types. No provider request, real user ID, account secret, model call, Commerce write or channel send.
- Zalo Bot header secret flow simulated with a separate QA fake value, Zalo OA explicitly blocked and Website session explicitly blocked. Header-only QA never certifies real provider ownership.
- Source qa/v171-channel-first/native-ingress-qa.test.mjs: 60 synthetic Node assertions with positive/negative Meta HMAC, wrong Page, signature tampering, replay, forged Store, Bot, invalid recipient, Zalo Bot wrong header and other cases. The previous 83 source QA still applies.
- GitHub CI native protocol new suite plus inherited source tests was added. Check CI on final HEAD before reporting final status.

## ACTUAL n8n EVIDENCE
- New n8n QA workflow Bs4QX1fP2S226N8j, name TIEN404_V171B_NATIVE_INGRESS_HMAC_BOT_BINDING_QA_NO_SEND; Personal / 90_QA - DIAGNOSTICS. Four nodes, version c63336ba-38ee-45cb-b404-7b724d0cef2a, INACTIVE, no credentials, no webhook trigger, no network, no send/API/LLM/order node.
- Manual execution ID #4340 SUCCESS, 18/18 matched expectations: 3 QA ALLOW (Meta QA Page A, Meta QA Page B, Zalo Bot QA header), 14 DENY (tampered or missing HMAC, wrong Page, client spoof, stale/future, wrong recipient, echo, invalid Bot header, unsupported OA/Website), one DUPLICATE ignored. Metadata only, mock responses. Both stores A/B share a QA Tenant but bind distinct Bot/price/stock.
- All 18 cases report provider account verification FALSE, hosted Store RLS verification FALSE, outbound MOCK_ONLY_NOT_SENT, provider_sends=0, orders_written=0, model_calls=0.
- These are NATIVE-SHAPED QA fixtures checked with actual crypto primitives, NOT a real signed provider callback or end-to-end live Page→Custom Bot release.

## RELEASE GATES
- VERIFIED Existing Messenger native signed event #4176 on Published workflow, read-only check only.
- IMPLEMENTED/TESTED native-shaped protocol QA with Store/Bot mapping, execution #4340.
- NOT VERIFIED real Meta/Zalo Page/OA installation authority and authenticated channel→new resolver shadow delivery.
- BLOCKED Zalo OA-specific signature, Website server-issued session, hosted Store A/B JWT/RLS, durable atomic dedupe, actual customer identity.
- NO-GO live reply, Commerce write, model switch, paid provider call or Core Bot promotion.
- An interim V17.1-A static source-inventory CI failed when it expected three MJS files but new source added two; the strict inventory was updated to expect five without weakening no-network guard.

## NEXT OPERATIONAL STEP
Use a separate inactive native ingress shadow after Page/OA authority is independently proven. Either isolate a native real signed webhook test with a scoped callback or seek explicit authorization before touching a published webhook or external subscription. Have it invoke read-only trusted Store/Bot config, no legacy write tools, mock outbound only; retain private execution receipt without exposing user IDs or app secret. QA fixture mapping must NOT become hosted Store authority. Parallel Store security track PR #237 and Messenger canary PR #239 retain their separate approval gates.

Rollback: close Draft PR #243; keep QA workflows inactive and archive only with operator approval. Existing Published Messenger, Zalo, Supabase hosted, credentials, merchant customer records and billing untouched.
