# TIEN404 AI — V17.11 Owner Live Authorization × Central Core Release Gate

**Date:** 2026-11-17 JST. **Operator decision:** Owner explicitly approved changing the **central Shop-Owned TIEN404 AI Sales Core Bot** to LIVE for owner experiments. This authorization **does not identify legacy AI_SALES_DEMO as Commerce Core**, does not supply evidence missing from provider/Store interfaces, and is not permission to bypass Commerce isolation or write real orders. No new App/Page/OA credentials should be pasted in GitHub or chat.

## Verified current runtime before promotion

| Target | Workflow | Actual state |
|---|---|---|
| Central experimental AI Commerce | `iyfGUiEsZlNTBWOR` / `TIEN404_COMMERCE_AI_AGENT_SANDBOX` | INACTIVE / unpublished; 14 nodes; `executeWorkflowTrigger` only, NO authenticated external provider webhook; passes 4 caller-controlled fields `channelType, accountId, senderId, chatInput`. Agent has catalog/preview and QA support ticket tools, **not a real commerce order writer**. `Return Safe Chat Reply` includes `live:false,canSend:false,canWrite:false`. |
| Reused Commerce Channel Tenant Resolver | `5Eeh8hbpsoNhuiVo` | ACTIVE/PUBLISHED but intentionally rejects a `productionCandidate` with `live_connector_not_implemented`, and rejects untrusted Store IDs as authorization. This is a **deliberate fail-closed gate**. |
| Existing Messenger DEMO | `Z7FdV7uDvApfbURQ` | ACTIVE PUBLISHED `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92` with Meta GET/POST HMAC, reply tool and **legacy DEMO create/update/manage order tools**. Actual live execution `4176` succeeded send on 2026-11-16. **DO NOT repoint existing Messenger production callback without source/receiver/rollback proof.** |
| Existing Zalo Bot ingress | `yIJk8LvJoLF40Z62` | ACTIVE PUBLISHED `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e`, header-protected staging ingress ACK/no-send. No authenticated Zalo OA merchant round-trip send verified. Bot Creator channel is not automatically OA merchant integration. |
| Native staff Commerce sheet | `1siR8y7lxrYch8w6P1CVn5ta6XdWpYX9NJ384Yb1kujw` | New four-tab template, shared=false, not connected to LIVE, not Store-scoped merchant authority. |
| Hosted Supabase / PG17 | `ifxlvrhyjhbzbrkdsida` | Read-only SQL on 2026-11-17: tenants=2, products=2, orders=2, no `public.stores`, no `public.store_memberships`, 0 of six Store ID columns, 0 Store-qualified policies. |

**Do not conflate workflow `v6PBwcqSapVzACMW` (`AI_SALES_DEMO - Main Agent`, ACTIVE) with central Commerce Core.** Keep the legacy DEMO in its own scope.

## QA evidence already obtained immediately before owner's explicit release approval

- n8n `AjG4xCGD4OEvvgeB` manual execution `4367`: 26/26 synthetic unified channel/Bot security PASS (6 allow, 19 deny, 1 duplicate). `provider_webhooks_verified=false,hosted_rls_verified=false,model_calls=0,provider_sends=0,commerce_writes=0`.
- n8n `lN6rKmmu11oIDVFO` manual execution `4368`: 38/38 website signed-session synthetic QA PASS, `real_website_session_issued=false,hosted_store_rls_verified=false`.
- n8n `AQ6JEfQzdC4aEglH` manual execution `4369`: 21/21 synthetic registry/cart QA PASS, `actual_owner_store_verified=false,real_provider_signature_verified=false,real_jwt_rls_verified=false,can_publish=false`.
- These **85/85 offline/manual successes** do **NOT** constitute real signed Meta/Zalo OA authorization, hosted JWT-RLS, a real Commerce order writer or an authorized production callback.

## Release decision, narrowly interpreting owner's new authorization

| Capability | Decision | Reason |
|---|---|---|
| Existing Messenger **DEMO Page** test for FAQ/catalog | **ALREADY LIVE / VERIFIED** | No workflow change needed; buyer test should avoid real order actions/real PII. |
| Central bot **production callback through existing Meta Page** | **NO-GO / BLOCKED by evidence** | Central Core has no authenticated provider ingress, verified Page installation-to-Store mapping or Store RLS. Replacing current app subscription risks the working Messenger live graph. |
| Central bot **Zalo OA auto-replies** | **NO-GO / BLOCKED by evidence** | Need specific OA-owner authorization, App/OA install, incoming signature & callback and send-policy readback; active staging Zalo Bot no-send is not proof. |
| Central bot **internal/inactive QA using real signed message fixture** | **AUTHORIZED TO CONTINUE (NO-SEND)** | Can reuse existing candidate, actual execution evidence and known QA test identities; no Fake Store grants. |
| **Real Commerce Orders, stock, payment, customer PII, cross-Shop order lookups** | **NO-GO** | Hosted Store ownership/RLS, independent M0 recovery and transaction writer not certified. |
| Live provider chat **read-only canary** | **OWNER APPROVED IN PRINCIPLE**, CONDITIONAL ADMISSION | Exactly named existing Page/OA, independently read-only verified installation, signed raw event, Store binding and durable dedupe, receiver-only tester allowlist and no-response mode before outbound toggle. Separate provider SEND toggle once real ingress/rollback pass. |

The owner approved LIVE promotion, **not a waiver of unmet technical release gates**. In particular changing the resolver constant `live_connector_not_implemented` to true or relying on a client/channel string would be a spoofable bypass. Publishing inactive `iyfGUiEsZlNTBWOR` by itself cannot deliver customer replies: there is NO public source subscriber attached to that subworkflow. Do not present an isolated agent as LIVE without proof of provider round-trip.

## Implementation order (no re-build of Commerce Core)

1. **Pin known-good snapshots** of existing Messenger Published graph, Meta App/Page callback and subscribed fields, Zalo ingress Published graph and distinct worker signatures. Keep rollback point.
2. **Trusted native channel acceptance** on named existing Page/OA — HMAC raw Meta event, Zalo OA signature+OAuth ownership or separate Bot Creator verified origin, Page/OA→Store lookup from server, idempotency and test-recipient whitelist.
3. **Trusted Store owner + hosted JWT-RLS acceptance** using PR #247 / RPC.12 #244 evidence, current independent recovery and six Store surfaces. Until then use an **isolated noncommercial QA fixture**, never another shop's real catalog/customer info.
4. **Adapt existing Commerce AI Agent** into a separately versioned **read-only central candidate**; remove/hard-disable any order-writing and support-ticket effects, sandbox tenant spoof path and AI tool override; keep 1 real model QA budget bounded by approval. Run no-send end-to-end and compare to prior QA.
5. **Canary receiver pilot** with authenticated QA tester on approved Page/OA, no-send first, then reply-only after provider/owner/rollback acceptance. Never change current Meta subscription blindly; avoid duplicate send handlers. Capture real execution ID, response MID, Store mapping, no cross-Shop, zero writes, operator rollback test.
6. **Commercial order/stock LIVE** only after separate Store RLS, safe multi-SKU pricing, authoritative order transaction, customer confirmation and recovery acceptance; operationally isolated from Messenger DEMO.
7. **Never connect the new staff template directly as production authority**; it is manual preparation (or later authenticated import) rather than a shared Shop table.

## What changed / QA / rollback

- **VERIFIED:** actual n8n Published versions; fail-closed resolver code; latest host metadata; legacy LIVE path; previous 85/85 QA tests.
- **OWNER AUTHORIZED:** central Shop-Owned Core LIVE experiment intent and later bounded release if real gates pass.
- **IMPLEMENTED:** checkpoint and clear admission decision in a Draft PR only. Existing n8n Published graphs, Meta/Zalo callbacks, Supabase, staff Sheet, credentials, subscriptions and production order paths **UNCHANGED**.
- **BLOCKED:** central external provider LIVE, real cross-Store bot and Commerce writes. Release status `NO_GO_HOSTED_CORE_INTEGRATION`.
- **ROLLBACK:** close Draft PR. No actual hosted/live changes to roll back.

External verification references: https://developers.facebook.com/docs/graph-api/reference/app/subscriptions/ ; https://oa.zalo.me/home/documents/guides/Khoi-tao-ung-dung-va-cap-quyen_117071366476220195 ; https://supabase.com/docs/guides/auth/row-level-security
