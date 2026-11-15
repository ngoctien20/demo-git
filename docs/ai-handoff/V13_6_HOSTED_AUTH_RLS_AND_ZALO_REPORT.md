# TIEN404 AI — V13.6 AUTH / SHOP A-B & NEXT ZALO BOT UPDATES

**Checkpoint audit:** 2026-11-15 JST. **Two separate workstreams:** customer-account hosted security (PR #81) and Zalo channel innovation (PRs #79/#80/#82).  
**Current state:** EXPERIMENTAL / NOT RELEASED / no new production changes.

## A. Hosted Auth/RLS and Render Customer Portal

### A1. Read-only VERIFIED facts
- Render workspace **My Workspace**, service `tien404-auth-staging` (`srv-dbpj4irm8hqs73e2h2rg`) static-site `https://tien404-auth-staging.onrender.com`; source branch `work/supabase-auth-staging-v1`, `autoDeploy=no`, PR previews disabled; current LIVE commit `b14501a0ebf04d991302cb32b5d548a68d6b39bd` (Nov 14). It does **not** contain V13.5R.1 source from PR #81.
- Supabase staging `ifxlvrhyjhbzbrkdsida` ACTIVE_HEALTHY. `orders`, `customers`, `tenants`, `tenant_memberships`, `products` have FORCE RLS; PostgreSQL `anon` SELECT=false; `authenticated` SELECT=true, direct INSERT/UPDATE/DELETE on `orders` and `customers` = false.
- Aggregated QA fixture counts: Shop A **1** active owner/manager, **1** Order; Shop B **2** active owners/managers, **1** Order; **0** overlapping owner/manager user identities across Shop A/B. Read-only aggregate counts, no personal records disclosed.
- Current `orders_manager_read` is active-tenant-membership scoped to `auth.uid()` for owner/manager. These static SQL facts are **not a successful real JWT/session test**.
- User asked to test **two authorized real QA sessions**. The connected Browser tool returned: *Browser access requires originating browser context; open ChatGPT in browser with connected extension*. No sessions were available in this Android/app conversation; real JWT-mediated test was not run.
- Public no-auth Render URL was also not accessible to the generic web fetcher, so no public HTTP status claim is made.

### A2. Implemented read-only acceptance harness (Draft branch only)

`qa/v136/hosted-rls-browser.mjs` performs real HTTP/JS-in-browser checks against the **exact** Render staging hostname, using TWO independently authenticated Playwright `storageState` files provided securely on the operator's machine, **never by GitHub Actions, chat, commit, or n8n**.

Checks in each browser: `auth.getUser()` current verified user, positive membership in own tenant, zero foreign membership, positive own Orders rows, zero foreign Orders rows, zero foreign tenant visibility, customer UI protected area visible, no PostgREST mutation. A third anonymous browser must remain locked with 0 Orders. Outputs only PASS/FAIL booleans (no JWT, user ID, name, tenant ID, order ID, phone). It explicitly fails closed on malformed or missing sessions; never mints a JWT or impersonates via database `SET ROLE`.

`qa/v136/hosted-rls-contract.mjs` and `hosted-rls-contract.test.mjs` test negative failure behavior offline. **Passing this unit suite means the test harness is sound at source level, NOT that hosted RLS has passed.**

**Local authenticated QA preconditions:**
1. Two distinct already-authorized QA identities: Shop A owner/manager (not a Shop B member), Shop B owner/manager (not an A member). Use the existing Render login and separately isolated private browser profiles.
2. Capture Playwright `storageState` from the same authorized browser contexts **outside Git repository**; POSIX files mode `0600`. Never upload session storage or paste cookies, OTPs, JWTs or passwords into ChatGPT, GitHub, CI or screenshots.
3. Obtain Shop A/B UUIDs from project metadata in an authorized Supabase dashboard; these are scope labels, not evidence of authorization. On the **operator's trusted local machine only**, set `QA_SHOP_A_STORAGE_STATE`, `QA_SHOP_B_STORAGE_STATE`, `QA_TENANT_A_UUID`, `QA_TENANT_B_UUID`; ensure Node 22 and pinned Playwright installed, then run `node qa/v136/hosted-rls-browser.mjs`.
4. Capture the sanitized booleans and HTTP result only; remove session snapshots securely afterward. Revocation tests require a separately approved plan and cannot be inferred from the script.
5. This program does **not** test a newly deployed V13.5R.1 build; it tests the currently hosted Render Auth app. A follow-on staging deploy and second full UI acceptance is necessary.

**Current Hosted Shop A/B status: BLOCKED (missing available authenticated browser context). No false 2/2 real sessions claim.**

### A3. Render staged release gate — NOT DEPLOYED
Before switching the Render source branch or triggering manual deploy, require: two-session hosted QA PASS; authorization and snapshot of current Render source commit/build config, approved staged deployment window + rollback; Tester smoke; isolated customer account redirect and mobile order QA; real signed-out and cross-shop negative; subscription UI explicitly unverified; no real payments or data writes. Render auto-deploy and PR previews are OFF. Merely calling `trigger_deploy` would rebuild the **old branch**, not deploy PR #81, so do NOT do that.

Rollback target: Render Auth pre-release commit `b14501a0ebf04d991302cb32b5d548a68d6b39bd`, with original branch `work/supabase-auth-staging-v1`, build command `node scripts/build-auth-preview.mjs`. Avoid overwriting deployed Tester portal or stale business pages before release review.

### A4. Remaining P0
- Real Shop A owner ↔ Shop B owner session isolation, cross-tenant Orders and membership; anonymous; expired/revoked membership **real** test.
- Security Advisor: `public.qa_shop_b_zalo_claim` SECURITY DEFINER `anon EXECUTE` still WARN. Do not revoke/change before callsite inventory + separate approval. <https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable>
- Subscription, Staff assignment, roles and store-level isolation still need independent server-backed authority. No commercial Staff privilege was added.


### A5. 2026-11-15 screenshot manual A/B — observed UI only

The project owner supplied four screenshots from Cốc Cốc: a normal browser window on the deployed `/account.html` with **QA Shop A** displayed as active `owner`, read-only data, and one visible **pending order** totalling **123,000 VND**; plus an isolated incognito browser window showing **QA Shop B**, active `owner`, read-only data, and one distinct **pending order** totalling **456,000 VND**. Both screens display one shop-specific order. Screenshots were inspected in the current conversation; **none uploaded to GitHub** to avoid exposing the visible account/email/order identifiers.

**Status:** `MANUAL_UI_VERIFIED` for visible Shop A/B authorized portal state and one distinct order apiece. **NOT** `HOSTED_RLS_PASS`: no cross-tenant API request/response has yet been observed from either real session; no revocation negative, anonymous API or canonical V13.5 customer-route hosted test has been performed. Both screenshots show the existing deployed `/account.html`, not the PR #81 future static redirect.

**Next strictly read-only check:** in each *separate* authenticated browser console, query existing Supabase client for `orders` and `tenant_memberships` using exact staging tenant IDs, with `count:'exact',head:true`. Only print aggregated counts / error status. Expected for Shop A: own orders >0, foreign orders 0, own membership 1, foreign membership 0; Shop B vice versa. An HTTP error must be treated as `BLOCKED` or `FAIL`, never as 0. Do not paste JWT, user IDs, email or complete API responses into tickets/chat. No writes.

### A6. 2026-11-15 — Verified real Shop A/B cross-tenant API reads (manual Console screenshots)

**Evidence:** Two original screenshots supplied in the current user conversation (not committed due to visible order information). Both run the previously reviewed browser-side Supabase `getAuthClient()`, `auth.getUser()`, and real `head:true, count:'exact'` SELECT calls against `orders` and `tenant_memberships`, filtered by the two known QA tenant UUIDs. Session A is the ordinary Cốc Cốc browser; session B is the separately signed-in private browser. Neither console output reports an API error.

| Authenticated browser | Shop A orders | Shop B orders | Shop A active membership | Shop B active membership |
| --- | ---: | ---: | ---: | ---: |
| Shop A owner | 1 | 0 | 1 | 0 |
| Shop B owner | 0 | 1 | 0 | 1 |

**Status: VERIFIED — `HOSTED_REAL_CROSS_TENANT_READ_PASS`** for two distinct QA sessions, direct `orders` and `tenant_memberships` SELECT counts. The documented fixture has a distinct order per shop, so cross-shop `0` is meaningful. No service-role/admin credential was used in these browser calls, and no writes were requested. This closes the *specific* cross-tenant read gate.

**Still not proven:** same-tenant different stores (store-level isolation), `customers`, `conversations` and `messages` cross-scope access, token expiry and membership revocation with an existing JWT, anonymous session API negative case, and the new Customer Portal on Render staging. Current screenshot URL is still the **deployed legacy `/account.html`**, not the Draft PR #81 canonical redirect. Do not elevate the entire Hosted Auth/RLS or V13.6 release gate to PASS.

**Next:** first test logout/anonymous read-only denial in an independently logged-out browser. Revocation requires separately approved test-account membership state changes and rollback. Then review Render staging deployment with source/build snapshot; do not auto-trigger the old branch.


## B. Zalo Bot — actual progress through V13.8

| Version | Verified and tested | Not proven |
|---|---|---|
| V13.5 Rich Text T1–T3 | Three Bot messages API-accepted and visually observed by owner on desktop, old quota consumed | Native buttons/callbacks |
| V13.6 Button Lab — PR #79 | 18/18 offline security contract QA and 5-width clickable **browser simulation**; Bot Creator numbered text fallback, OA capabilities preview-only | Bot Creator native button JSON schema / click callback |
| V13.7 Five APIs — PR #80 | `getWebhookInfo` read-only n8n 3823 SUCCESS, webhook bound to staging, sends=0. Four outbound API methods via n8n execution **3826 SUCCESS**; provider API_ACCEPTED and owner acknowledged receipt; old four-call quota used | Actual image/sticker/voice render/playback across devices; no fresh send approval |
| V13.8 Conversation/Handoff — PR #82 | 255/255 Node, 6/6 Chromium, n8n **3827 20/20**, **3829 19/19**, all offline no writes. Existing ingress active ACK/no-send; router read-only | Real authenticated customer ↔ shop staff ↔ AI messaging, durable inbox or outbox |

The n8n execution metadata for 3823 / 3826 / 3827 / 3829 was rechecked on 15 Nov and all had `status=success`. This does not independently re-prove content delivery; the PR checkpoints include redacted provider and owner acknowledgement evidence.

**Official Zalo references:**
- Bot Creator create/own Bot, getUpdates, webhook, sendMessage: <https://docs.zaloplatforms.com/docs/BOT/create_bot>
- Bot `sendMessage` declares `chat_id`, `text`, `parse_mode`, `text_styles` only, with NO public native `buttons` or callback schema: <https://docs.zaloplatforms.com/docs/BOT/apis/sendMessage>
- Bot `getWebhookInfo`, `sendPhoto`, `sendSticker`, `sendChatAction`, `sendVoice`: <https://docs.zaloplatforms.com/docs/BOT/apis/getWebhookInfo>.
- OA Chatbot exposes menu and CTA user interactions but is a separate product/provider: <https://oa.zaloapp.com/home/function/interaction?type=menu-chatbot>.
- OA OpenAPI requires app, OA and granted scopes: <https://oa.zalo.me/home/documents/guides/Khoi-tao-ung-dung-va-cap-quyen_117071366476220195>.
- Technical OA test generally needs an already verified company OA: <https://oa.zalo.me/home/documents/guides/tao-tai-khoan-oa-thu-nghiem-ky-thuat_4023591696049457534>.

**Native Action verdict: UNKNOWN for Bot Creator; VERIFIED as provider-specific capability only in OA documentation, NOT activated on our account. Do not send unverified Bot keyboard payloads.** For Lite use numbered choices; Plus staff-managed conversational/menu drafts; Enterprise OA conditional on approved business and provider scopes.

## C. Recommended next bot upgrades (prioritized)

### P0 — sell safely with shop separation
1. **Store-level conversation isolation**: current `public.conversations` and `public.messages` have tenant-scoped RLS, FORCE RLS and **no `store_id` column**. Different shops under one tenant cannot be isolated at store granularity by these tables today. Additive schema/RLS migration, backfill, tenant/store constraints and rollback require **separate explicit approval**. No new replacement tables.
2. **Authorized staff inbox READ-ONLY first**: linked to one verified assigned shop and staff session, not Tester role, not Platform Owner wildcard; include status `AI_ACTIVE/WAITING_STAFF/HUMAN_ACTIVE/RESOLVED`, unread counts, private audit and bounded pagination. Implement on shared TIEN404 backend; do not wire live Bot until hosted Shop A/B/staff negative tests pass.
3. **Durable customer conversation event and outbox**: trusted Bot+Customer+Tenant+Store resolution, provider event replay ID, revision CAS, per-message idempotency, suppress AI during HUMAN_ACTIVE, keep order/sold-price truth with Sales Core. Ensure Owner notification after stored order event, never on a quote or a failed order.
4. **One real staged 1:1 customer→Bot→human→Bot handoff** only after separate recipient and message quota approval, staging-only scoped key/worker with `ZALO_SEND_ENABLED=false` global unchanged, bounded one-shot gate, no retries and actual device screenshots. Do not reuse consumed V13.7 claims.

### P1 — improve Vietnamese sales usability (low operational cost)
5. **Natural numbered textual choices** (products, price, stock, ask human, order status) as Bot Creator compatible fallback; improve no-fake-price/stock/expected_total/duplicate-order handling. Prioritize mobile-friendly short replies and human escalation; avoid large rich menus.
6. **Shop pause and subscription guard**, independent per shop, no global kill switch changes; each shop can pause AI and prioritize staff without disabling other shops.
7. **Channel integration center** that presents Bot Creator, OA, Messenger, Website Chat as **distinct adapters**, with verified health, connection, quotas, consent and owner notification routes.

### P2 — extras AFTER commercial MVP
8. Photo product cards and voice/sticker UX with actual per-device evidence, format validation and cost/rate limits.
9. Native OA buttons / quick replies only when enterprise OA scopes and external documentation verified. For Bot Creator, await official button/callback schema; don't use unofficial endpoint.
10. Advanced AI Studio/menu factory preserved for FUTURE, not prioritized over working order/tenant/staff flows.

## D. Minimum proof to move from EXPERIMENTAL → CANDIDATE

- **Two real Shop A/B signed sessions** verify read isolation; user of A cannot read B orders/conversation/messages. Stale/revoked session denies.
- Staff assignment/revocation and store-level RLS, including same-tenant two stores, independent negative evidence.
- 20 scenario natural-language shop sales tests, exact VND/stock and no fake orders, duplicate event and prompt injection; correct AI-to-human handoff.
- 1 bounded externally approved reply test, dispatcher ACK + delivery or user visual verification, paused shop and subscription expiry, data retention and consent.
- No raw token/chat ID/phone in logs or repo. Cost estimate for real AI messages + platform fees measured from pilot, no invented unlimited promises.

## E. Direct runtime and offline QA recheck (2026-11-15 JST)

- Cloudflare staging Worker `tien404-zalo-outbound-v1-staging` read directly: latest verified deployment ID `2ce7ea81-3755-47b1-afdd-a799db3da3c8`, version `ed172d3c-e1f1-4daa-bc56-643406441091` at 100%, `ZALO_SEND_ENABLED=false`. Bindings names/types confirmed without reading secret values; no change made.
- Current n8n execution metadata read directly: `3823` getWebhookInfo SUCCESS; `3826` media four-call SUCCESS; `3827` Shop B conversation SUCCESS; `3829` handoff fixture SUCCESS.
- GitHub Actions [run 43694900835](https://github.com/ngoctien20/demo-git/actions/runs/43694900835), source commit `b82da85a795a66c3bedba445f031a5b007c0bfea`: **15/15** new V13.6 hosted test-harness contracts PASS; 54/54 account negative, 16/16 prior security, 9/9 preview build, total **94/94** source/contract checks; 5/5 locked route + 5/5 signed-in mock browser viewports PASS (10/10), both jobs SUCCESS. **None** of these are actual authenticated hosted Shop A/B sessions.
- Inherited Auth static / Tester / V13.5 / Account and Navigation workflows for same source commit all SUCCESS; no Render deploy.

## E. Actions and rollback

**This V13.6 checkpoint adds only GitHub source/security tests and documents to existing Draft PR #81.** No Render service deploy, Cloudflare Worker change, Supabase ACL/SQL write, Zalo send, n8n modification, user session capture, payment or production commit.

Rollback: close/revert Draft #81 changes or revert only V13.6 files; V13.8 Zalo PR #82 and V13.7 source are untouched. No database restore needed.

**Next safe operation:** User opens the already-authorized Shop A and Shop B accounts in the connected ChatGPT Work/browser context, or runs the local test harness on a trusted machine. Record sanitized real results, then review a Render staging deploy with rollback. For Zalo start a **read-only staff-inbox access design** following hosted RLS, not another public Bot API send.
