# TIEN404 V17.1-D — Real Page Authority × Isolated Shadow Callback × NO SEND

Checkpoint 2026-11-17 JST. SOURCE QA and isolated locked webhook implemented; actual Meta Page owner authority and signed real callback NOT VERIFIED / NO-GO.

## VERIFIED existing state (READ ONLY)
- Messenger Published Z7FdV7uDvApfbURQ remains active 27 nodes, version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92. Earlier real webhook execution #4176 success, native signature verified=true. This is NOT proof of Page→new Custom Bot binding.
- TIEN404_COMMERCE_CHANNELS has Messenger connectionStatus=sandbox. Staging Merchant Channels V4.5 Messenger row: owner_verified=false, verified=false, consent=false, enabled=false, Page ID missing. Neither is verified Meta Business Manager ownership.
- Historical operator evidence must be retained distinctly: user previously self-attested Full Control of the Page and prior screenshots showed Meta App Administrator and app webhook messages/messaging_postbacks configuration, with a prior successful subscription setup. These are useful OWNER_ATTESTED / SCREENSHOT_REPORTED facts, but still do NOT independently prove current Business Manager Full Control, an approved separately isolated QA App/Page, a current authorized Page subscribed_apps readback or consent to replace the production callback.
- No authenticated Meta Business Manager or Meta Developer browser session was present among connected browser tabs in this task; no Meta provider Page-admin tool was connected. Do not infer admin ownership from successful webhook receipt or HMAC verification alone.
- Existing V17.1-C synthetic Data Table cnSZ6hT7WCbNwGl5 is only synthetic, owner_authority_verified=false; previous manual n8n execution #4341 20/20 synthetic PASS. This is not a merchant-owned registry.

## IMPLEMENTED / TESTED actual n8n isolated shell
- New workflow TIEN404_V171D_ISOLATED_MESSENGER_SHADOW_LOCKED_NO_SEND ID 6ZWYRBKieTKQMzoQ.
- Version 732d376f-2cef-4ba7-bc3e-80136055dc56; inactive, no active version, 3 nodes; Personal / 90_QA - DIAGNOSTICS. No assigned credentials, no GET challenge, no external HTTP/LLM or Commerce tools.
- Unique POST webhook path tien404-v171d-meta-shadow-locked-nosend (distinct from Published tien404-messenger-qa). rawBody=true. Gate always returns SHADOW_LOCKED and Respond to Webhook configured HTTP 403 with no-store. It cannot be registered as a functioning Meta subscription in current state.
- Manual simulated webhook execution #4347 SUCCESS: gate SHADOW_LOCKED, intended HTTP 403, real Meta signature verified=false, merchant owner authorized=false, store resolver invoked=false, bot loaded=false, provider_sends=0, model_calls=0, Commerce writes=0. Response node executed. This is NOT proof of an external HTTP 403 or actual Meta callback.
- Snapshot of exact safe graph and execution metadata at qa/v171d-meta-authority/locked-callback-snapshot.json. Do not activate without separate scoped approval.

## IMPLEMENTED — read-only Page/App authority preflight, no token uploaded
- Node 22+ CLI: qa/v171d-meta-authority/page-app-readonly.mjs.
- Windows PowerShell: qa/v171d-meta-authority/verify_meta_page_readonly.ps1.
- Both are opt-in only (--live-readonly / -LiveReadOnly), take privately supplied expected Page ID and App ID, and prompt/use a Page access token only in local trusted operator process. They perform strictly GET against graph.facebook.com/v27.0/{pageId}?fields=id and /{pageId}/subscribed_apps?fields=id via Authorization Bearer header. They NEVER print token, Page ID, App ID, messages or raw Graph error. They NEVER change Meta subscription, app config, Page or message.
- If subscribed_apps shows app installation, the tool reports app visibility but explicitly maintains verified_merchant_business_owner=false, authorized_to_change_callback=false and real_shadow_callback_tested=false. Ownership needs independent private Business Manager/operator attestation.
- No real Graph request was run in this session because a private Page token/owner session was not available; no user credential was requested or exposed.
- Node source QA tests use fake provider responses only (20 tests). CI .github/workflows/v171d-meta-authority-locked-shadow.yml statically checks the inactive no-send state and runs the opt-in guard. Confirm exact-HEAD Actions conclusion before calling CI TESTED.

## Meta official constraint
Official Meta docs show App webhook subscriptions have a callback_url and verify_token, and Page app installation is attached to subscribed_apps. Reconfiguring an existing App callback may affect the existing Published Messenger path. Prefer separately authorized QA App and QA Page for this acceptance. Never POST /subscribed_apps, app/subscriptions or change App Dashboard without an explicit authorization.
- https://developers.facebook.com/docs/graph-api/webhooks/getting-started/
- https://developers.facebook.com/docs/graph-api/reference/app/subscriptions/
- https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-pages/
- https://developers.facebook.com/docs/graph-api/reference/page/

## Operator runbook (private; do not paste token into ChatGPT, screenshot or PR)
1. Open Meta Business Settings / Meta Developer App Dashboard for the intended TEST Page and App. Privately attest Page owner/admin control, App role, callback/subscription configuration and authority to test. Redact business secrets, tokens and customer PSIDs.
2. On the trusted Windows machine, with local repository checked out, run:
   PowerShell: .\qa\v171d-meta-authority\verify_meta_page_readonly.ps1 -PageId YOUR_PAGE_ID -AppId YOUR_APP_ID -LiveReadOnly
   The token is entered only through a hidden Read-Host secure prompt. Public Page/App IDs alone do not prove control.
   Alternatively run Node script with env T404_META_PAGE_ID, T404_META_APP_ID and T404_META_PAGE_TOKEN locally and explicit --live-readonly (do not log these variables).
3. Review only boolean output; if App subscribed and Page scope is visible, independently confirm business owner and one dedicated QA app/Page. Never assume this allows changing live production callback.
4. Only on separate scoped approval: configure a private credential-backed native HMAC verifier, GET challenge, server-trusted installation mapping, durable replay and no-send firewall for independent QA App/Page. Keep private real customer content out of GitHub or chat.
5. Execute an explicitly approved one-event real signed Meta inbound to isolated no-send shadow and collect private execution ID and metadata. Confirm 0 model calls, 0 Commerce writes, 0 provider sends. Do not use legacy demo credentials.
6. Hosted Store A/B RLS and one-shot claim remain gated under separate PRs #237 and #239.

## Release decision
SOURCE/INACTIVE SHADOW QA: IMPLEMENTED/TESTED, GO for code review only.
REAL Meta Page and App merchant authority: BLOCKED.
NEW real signed Page→shadow Custom Bot: NOT TESTED / NO-GO.
Real Commerce and live reply: NO-GO. No production or published changes.

Rollback: close existing Draft PR #243 and leave isolated workflow INACTIVE; do not archive/delete QA resources without explicit operator approval.
