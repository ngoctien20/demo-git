# TIEN404 AI Social Reactions — V21 CANDIDATE (22/11/2026)

**Trạng thái: IMPLEMENTED ở GitHub + n8n Messenger Draft (shadow mặc định OFF), TESTED qua QA cô lập, NOT RELEASED.**

## 1. Phạm vi đã có

- Pure classifier: config-core/lib/social-reactions.mjs.
- QA unit: config-core/test/social-reactions.test.mjs.
- Trình tạo Code node n8n dạng không gửi: config-core/n8n/build-reactions-code.mjs.
- QA VM cho node được tạo: config-core/test/reactions-bundle.test.mjs.
- Thao tác Meta mới chỉ được **dựng body dạng DRY_RUN_ONLY, sendAllowed=false**; không có HTTP, credential, webhook hay Page ID thật trong các file.
- Messenger Published Z7FdV7uDvApfbURQ: 47b48f6d-bc3d-40ae-afe6-96c5fd5452ac (kiểm tra 22/11); Messenger draft b967d427-62e6-40aa-90f4-60d222bb6e03. Cả hai đều **không được thay đổi** bởi nhánh này.
- Config Core PR #489; Menu QA PR #491; branch mới được tách từ PR #491 để giữ tương thích mà không viết chồng lên hai PR đó.
- AGENTS.md không tìm thấy tại root của nhánh nguồn (không suy diễn thêm quy tắc chưa kiểm tra).

## 2. Hành vi V1

Một lời cảm ơn thuần túy (vd. "Cảm ơn shop nhé") có thể đề xuất ❤️, khen ngắn có thể đề xuất 👍. Các tin nhắn còn lại đều chạy qua đường trả lời cũ, không làm mất tư vấn/báo giá/đặt hàng.

Các guard bắt buộc do **adapter tin cậy** cấp, không được lấy từ chính văn bản khách gửi:

- Meta HMAC đã xác minh; tenant/store và account/Page đã resolve; Page được allowlist cho tenant.
- Message là tin chữ của khách, có MID, PSID, Page ID đúng; không phải echo, postback, comment, voice hay reaction webhook.
- Page vẫn do bot sở hữu hội thoại; còn trong window cho phép của Meta; owner đã bật feature flag riêng cho Page.
- Đã có quyền reaction cooldown từ cơ chế rate limit; không có pending order, payment, approval, privileged action hay human handoff.
- Dedupe phải là unique atomic claim theo [tenant, page, sender, message, react] **trước** outbound send.
- Ưu tiên bất biến: nghiệp vụ, quyền riêng tư và thông tin thật > trải nghiệm emoji.

Tin "Được tiếp tục", "Đồng ý", "OK", "Đặt 2 món", "Cảm ơn, giá bao nhiêu?" **không được** reaction-only. Reaction của khách trên tin nhắn bot chỉ là social signal; không là phê duyệt, không mở công cụ, không tạo đơn hay thay trạng thái thanh toán.

## 3. n8n QA — chỉ chạy trong workflow riêng

Có thể tạo script offline:
node config-core/n8n/build-reactions-code.mjs > /tmp/tien404-social-reactions-qa.js

Gán output này cho một Code node **trong workflow QA không có HTTP node**. Input mỗi item:
{
  "event": {
    "channel":"messenger", "kind":"message", "messageType":"text",
    "tenantId":"tenant-a", "pageId":"1234567", "senderId":"7654321",
    "messageId":"mid.$synthetic", "text":"Cảm ơn shop nhé"
  },
  "gate": {
    "featureEnabled":true, "signatureVerified":true, "tenantResolved":true,
    "pageAuthorized":true, "botOwnsThread":true, "withinMessagingWindow":true,
    "cooldownGranted":true, "allowedPageIds":["1234567"]
  }
}

Output: decision (pass_through, skip hoặc reaction_candidate), dryRun (chỉ cho candidate), metaCallExecuted=false.

Không cho phép sử dụng input test này từ endpoint public để tự đặt các trust flags thành true. Luồng production phải dựng chúng từ webhook HMAC, trusted tenant resolver, Page installation registry và ownership state đã xác minh.

## 4. Meta API gate

Meta v27.0 Page Messages liệt kê sender_action REACT/UNREACT nhưng contract payload cụ thể và khả năng hỗ trợ trên Page/app đang có cần **test real isolated**. Đã có báo cáo lỗi #100 / 2018311 Invalid sender action trên một số cấu hình. Không được coi một body QA là bằng chứng gửi thành công.

Cần owner phê duyệt riêng trước khi:
1. Dùng một Fanpage test + một tài khoản tester được phép, HMAC và quyền App Review phù hợp;
2. Gửi đúng **một** reaction thật, ghi HTTP status + redacted error code + MID liên kết (không log token/PSID raw);
3. Gỡ/tắt thử nghiệm, xác minh luồng fallback khi provider 100/613/190/200;
4. Ghép vào Messenger flow theo feature flag mặc định OFF, không ảnh hưởng menu / voice / human handoff / order tools;
5. Live mobile Messenger + desktop acceptance và rollback.

Thao tác gửi phải đặt sau atomic idempotency claim và phải tắt trong lúc đang có handoff. Không retry tự động khi transport không rõ kết quả.

**Zalo Bot:** chưa có API reaction official xác minh; không gửi mô phỏng qua API tài khoản cá nhân hoặc unofficial SDK. **Web:** có thể xây reaction UI riêng, không nhầm UI local với provider Messenger.

## 5. Chạy QA offline

node --test config-core/test/social-reactions.test.mjs config-core/test/reactions-bundle.test.mjs

CI của Config Core đang chạy node --test config-core/test/*.test.mjs trên pull request thay đổi config-core; không cần secret hay hosted infrastructure. Kết quả chỉ được ghi PASS sau khi xem kết quả workflow thực tế.

## 6. Các rủi ro & điều kiện nghiệm thu

- Tránh reaction-only cho câu vừa cảm ơn vừa nhắc đặt hàng, refund, complaint, OTP, approval.
- Page A không được reaction vào thread Page B; dedupe key không dùng MID đơn lẻ.
- Customer reaction không thay thế consent/owner approval.
- API bị từ chối phải tiếp tục trả lời bình thường, không spam.
- Không lưu PII / Page access token trong public repo hoặc QA artifact.
- Không thay đổi giá, tồn kho, Orders hoặc billing; không dùng credential DEMO cho Commerce.
- Đặt ngưỡng rate limit và chỉ theo dõi số lượng phản ứng được xác minh.
- Không publish Messenger khi chưa có UAT thật và owner duyệt workflow version cụ thể.

## 7. Rollback/checkpoint

- Git: revert riêng nhánh và PR Social Reactions (chưa nhập vào các nhánh released).
- n8n: không sửa draft hay Published, nên không cần rollback runtime.
- Chỉ chuyển giai đoạn CANDIDATE -> APPROVED -> RELEASED sau khi đủ test evidence và owner consent.
- Nếu Meta không hỗ trợ, giữ tính năng OFF; đường trả lời văn bản hiện tại không đổi.

Nguồn Meta: https://developers.facebook.com/docs/graph-api/reference/page/messages


## 8. Continuation UAT gate / n8n synthetic acceptance (2026-11-22)

**Status: TESTED ISOLATED, LIVE META UAT = BLOCKED (no verified tester message target).**

- Created separate **unpublished** n8n workflow YkVVBQcSsqYdPC9U (TIEN404_V21_SOCIAL_REACTIONS_ISOLATED_QA — NO SEND) in Personal / 90_QA - DIAGNOSTICS.
- Workflow has exactly 2 nodes: Manual Trigger (pinned synthetic inputs) -> Code (pure module from this branch). **No HTTP, webhook, external credentials, database writer, agent, or Send API node.**
- Builder validation: valid=true, nodeCount=2, no warnings.
- n8n test execution **6706**, mode manual, status **success**, 9 synthetic cases:
  - thanks -> ❤️ candidate; praise -> 👍 candidate
  - price question -> pass_through
  - migration approval -> pass_through
  - active human handoff -> pass_through
  - feature disabled -> pass_through
  - cross-Page -> pass_through
  - echo -> skip
  - commerce pending -> pass_through
- Inspected output of Classify reactions - DRY RUN ONLY: 9/9 expected decisions, **every case metaCallExecuted=false** and positive candidates had sendAllowed=false.
- CI previously confirmed: Config Core run 45004416858 PASS (unit, offline PG17), V23 Owner App run 45004416878 PASS. These do not test real Meta reaction delivery.
- Messenger verified at this continuation: Published 47b48f6d-bc3d-40ae-afe6-96c5fd5452ac, Draft b967d427-62e6-40aa-90f4-60d222bb6e03; **unchanged**.
- Live ingress reviewed read-only: recent executions exist but last two were **voice**. They are not a suitable fresh, approved text reaction sample; sender Page scope, tester consent, MID and 24h window must be verified together before a one-off send. No live reaction was attempted.

**Important Meta contract uncertainty:** Graph API v27.0 lists REACT/UNREACT for Page Messages, but its documented top-level payload type is a string while an existing community example passes an object and receives error #100/2018311. The current buildMetaReactionDryRun is therefore an *unvalidated request candidate*, not a production-ready serialization contract. Do not connect it to an HTTP Request node until the exact request shape, permission and result are accepted on an isolated tester account.

**Next acceptance gate:** authorized tester sends a new harmless Messenger text (e.g. "Cảm ơn shop nhé!") to the QA Page while the bot controls the thread; preflight confirms correct Page/MID/PSID and active Meta credential without exporting tokens; send at most 1 controlled reaction with redacted provider outcome, inspect Messenger mobile/web, then revert/flag OFF. If Page or tester cannot be verified, stop with BLOCKED, not a synthetic PASS. A separate owner approval is required before wiring into the live bot.


## 9. Meta v27 single-request live UAT (2026-11-22) — API ACCEPTED, UI PENDING

**Owner consent:** người dùng đã gửi từ tài khoản thử nghiệm và báo "Đã gửi reaction test" theo yêu cầu trong phiên. Không có thao tác gửi với khách khác.

**Nguồn dữ liệu đã kiểm chứng:**
- Messenger DEMO workflow Z7FdV7uDvApfbURQ execution **6707** (2026-11-22 09:23 UTC): inbound text "Cảm ơn shop nhé!".
- Meta HMAC verification và timing-safe verification đều true. Entry Page = recipient Page = extracted Page; sender/mid khớp webhook; không phải is_echo. Page được phép: đúng DEMO. Tin đến trong một giờ khi chạy UAT.
- Published Messenger vẫn **47b48f6d-bc3d-40ae-afe6-96c5fd5452ac**, draft **b967d427-62e6-40aa-90f4-60d222bb6e03**; live bot đã trả lời bằng text như cũ. Không sửa workflow này.
- n8n Personal / 90_QA - DIAGNOSTICS: một workflow riêng, chưa publish, **N8aRqyJtUVKbYsVa** (4 nodes: Manual-only Webhook → strict source/Page/MID/age/consent gate → Meta HTTP Request → redacted result). Reused existing credential TIEN404_META_PAGE_SEND; no tokens copied/exported.
- Chỉ **một** execution **6711** ở chế độ manual, 2026-11-22 09:28 UTC. HTTP POST tới Graph API v27.0 Page Messages bằng sender_action = react, emoji ❤️, và **payload STRING** chứa JSON serialized {message_id, reaction}. Provider response **HTTP 200**, body có recipient_id, không có error. Code normalize providerAccepted=true. Không retry / không gửi tin chữ bổ sung.
- Ngay sau thử nghiệm đã **archive** workflow N8aRqyJtUVKbYsVa, kiểm soát chống gửi lặp. Source project, status của workflow Published DEMO không đổi.
- Bộ tạo body dry-run trong config-core/lib/social-reactions.mjs được cập nhật theo contract thực tế được Meta chấp nhận (payload string, không phải object). Unit + VM tests được cập nhật theo.

**Không suy diễn:** HTTP 200 chứng minh Meta chấp nhận request, không chứng minh ❤️ đã hiển thị trên app Messenger iOS/Android hoặc Messenger web. LIVE UI acceptance = PENDING owner screenshot/observation.

**Tiếp theo:** xác nhận bằng ảnh hoặc báo cáo của người dùng rằng ❤️ nằm trên đúng bong bóng tin "Cảm ơn shop nhé!" trên điện thoại/web (không phải tin nhắn ❤️ mới). Nếu không thấy, điều tra trước khi bật flag. Không mở rộng reaction tự động và không publish bot trong giai đoạn này.

**Rollback:** live one-off đã archive; PR #493 vẫn Draft; không có thay đổi Supabase, giá, đơn hàng, thanh toán, credential hay Published Messenger. Không gửi thêm Meta reaction trước khi có nghiệm thu hiển thị.


## 10. Messenger mobile visual acceptance — OWNER CONFIRMED (2026-11-22)

**UAT RESULT: PASS — OWNER-REPORTED MOBILE VISUAL CONFIRMATION.**

- Sau khi gửi reaction thử nghiệm, owner xác nhận bằng tin nhắn **"đã có"** để trả lời câu hỏi cụ thể: biểu cảm **❤️** đã xuất hiện trực tiếp trên bong bóng tin **"Cảm ơn shop nhé!"** trong Messenger điện thoại.
- Đây là bằng chứng xác nhận trực tiếp từ người thử nghiệm, **không phải** ảnh chụp hay kiểm tra giao diện độc lập bởi QA. Chưa có bằng chứng cho Messenger web, các emoji khác hoặc tài khoản khách bình thường.
- Liên hệ execution nguồn Messenger **6707**, Meta one-off **6711** (HTTP 200, error absent); workflow one-off **N8aRqyJtUVKbYsVa** đã archive để ngăn gửi lặp.
- CI GitHub tại commit **9c6af97196ffa59632c397ed227531485475f691**: Config Core run **45007786853 SUCCESS** và V23 web + Owner App run **45007786844 SUCCESS**.
- Trong quá trình UAT, phiên khác đã cập nhật Messenger **draft** sang **9c08fdd3-7583-49e5-adb4-8b4d9e0c0688**; Messenger **Published vẫn 47b48f6d-bc3d-40ae-afe6-96c5fd5452ac**. Không ghi đè draft và không publish.
- **Phạm vi đạt:** Meta accepted one-off ❤️ và owner thấy ❤️ trên Messenger di động.
- **Chưa nghiệm thu:** Messenger web, multi-Page A/B real, AI reaction tự động/feature flags, inbound reaction, rollback sau phản ứng tự động, phản hồi khi Meta lỗi/rate limited, human handoff/đặt hàng chạy song song. Không đồng nhất single-request UAT với production release.

**Release gate còn giữ nguyên:** PR #493 là DRAFT. Trước khi ghép vào workflow Messenger cần tái kiểm toán draft mới, kiểm thử regression không-send với đầy đủ luồng shop/menu/order/handoff/voice, fail-safe/idempotency, Page-scoped feature flag mặc định OFF và phê duyệt publish riêng. Không thử gửi thêm reaction nếu chưa được giao UAT mới.


## 11. V21 Messenger SHADOW per-Page gate — isolated QA (2026-11-22)

Status: **IMPLEMENTED in GitHub candidate + n8n isolated QA, NOT WIRED to shared Messenger DRAFT.**

### Code and QA artifacts

- Added public generator: config-core/n8n/build-messenger-reactions-shadow.mjs, which uses the existing pure classifier and emits a Code node for insertion between Classify explicit human request and Human handoff request?.
- Per-Page policy map in generated code: **Object.freeze({}) = all Pages OFF by default**. No actual Page ID, credential, webhook secret or user PSID appears in public code.
- Only **trusted** policy inputs may eventually unlock a candidate: HMAC/timing-safe verification, correct Page/Sender/MID/text from webhook, tenant binding, Page authority, fresh thread ownership, atomic dedupe claim, within-hour timestamp, no human handoff, no business/privileged action.
- A candidate is **shadow metadata only** (outgoingSendEnabled:false), always passed on to the original menu/handoff/voice/AI graph. It does **not** send Meta reactions, skip replies or create orders, even in the candidate case. This is deliberately NOT the production routing/sending path.
- New offline VM test: config-core/test/messenger-reaction-shadow.test.mjs (default OFF JSON parity, synthetic Page ON, HMAC/ownership/dedupe/business guards, Page mismatch, menu/SKU/voice/handoff).
- New dedicated GitHub CI: .github/workflows/tien404-social-reactions-qa.yml (Node 22, only 3 reaction-focused tests, no hosted access, no secrets).
- Isolated n8n workflow **9ckigv7nLJ7E7ydj** in Personal / 90_QA - DIAGNOSTICS, **inactive**, 2 nodes only: Manual Trigger + Code. Contains synthetic mock Page/trust policy solely for QA; not an authorized live policy.
- Manual synthetic execution **6722**: **13/13 expected decisions PASS**, 2 candidate emojis (❤️, 👍), 11 guarded/pass-through or unchanged cases, all outgoingSendEnabled=false/no Meta call.
- Dedicated reaction CI at commit d7c4a18: run **45008880586 SUCCESS**.
- Old aggregate Config Core CI during parallel catalog development failed on unrelated menu tests (syntax in messenger-catalog-page.test.mjs, and a previous ai-to-catalog expectation in messenger-phase2-route.test.mjs); do not mask as a reaction failure, and do not alter other team's catalog tests here.

### Historical checkpoint: why DRAFT was not edited in section 11 (superseded by section 12)

Messenger workflow Z7FdV7uDvApfbURQ is being edited by another QA workstream. During this work its draft advanced from 9c08fdd3 to **18125761-5898-4950-bcd8-3c8d15539063**, adding paginated DEMO catalog support. The latest graph contains 67 nodes, published is still **47b48f6d-bc3d-40ae-afe6-96c5fd5452ac**.

Avoid concurrent edits / lost work. The validated integration point currently exists:
Classify explicit human request -> Human handoff request?.

When the shared Messenger draft is frozen and ownership coordinated:
1. Re-read current draft and full graph; record current versionId as rollback checkpoint.
2. Generate Code from config-core/n8n/build-messenger-reactions-shadow.mjs and verify literal PAGE_POLICIES map is empty.
3. Atomically add Code node "V21 Social Reactions Shadow (ALL OFF)" at an unused canvas position; replace ONLY one edge to form Classify explicit human request -> shadow -> Human handoff request?.
4. Assert all pre-existing nodes/connections/credentials/groups unchanged except this one edge and new node; published version unchanged.
5. Replay mocked Messenger menu, product SKU, voice, handoff and customer text through the affected path. Verify exact pass-through on default OFF and no external send. Keep draft unpublished.
6. To enable real reactions requires additional approved owner controls, trusted current thread ownership, atomic persistent idempotency + per-Page policy, Meta error fallback and live mobile/desktop regression. Never switch feature ON merely by changing a boolean inside a Code node.

### Rollback / gates

- GitHub: revert only the V21 reaction generator/tests/CI in Draft PR #493, no merge.
- n8n: isolated QA workflow remains inactive; shared Messenger draft/Published were NOT modified by Social Reactions work in this section.
- Real Meta reaction UAT #6711 and mobile owner confirmation remain valid as a **one-message tester result**, not an automatic bot release.


## 12. Messenger shared DRAFT integration (2026-11-22) — ALL PAGES OFF

**IMPLEMENTED — n8n Draft only.** Following V21 owner instruction to continue, installed a strictly non-sending shadow gate into the latest inspected Messenger draft after the parallel catalog update stabilized.

- Target workflow: TIEN404_MESSENGER_TEST / `Z7FdV7uDvApfbURQ`.
- **Before (checkpoint / rollback):** draft `18125761-5898-4950-bcd8-3c8d15539063`, 67 nodes; Published `47b48f6d-bc3d-40ae-afe6-96c5fd5452ac`.
- **After:** draft `9a705cbe-79bd-4bd5-ae41-578da7286c4f`, 68 nodes; Published remains **unchanged** `47b48f6d-bc3d-40ae-afe6-96c5fd5452ac`.
- Added exactly one v2 Code node `V21 Social Reactions Shadow (ALL OFF)`, position [1912, -240], from code generated by `config-core/n8n/build-messenger-reactions-shadow.mjs` at PR #493.
- Atomically replaced **only** `Classify explicit human request -> Human handoff request?` with `Classify explicit human request -> V21 Social Reactions Shadow (ALL OFF) -> Human handoff request?` (four n8n atomic operations).
- Compared *actual saved baseline workflow history* with new complete workflow: **all 67 original nodes byte-equivalent as JSON**, only one new node; only connection keys changed are the original classifier and the new shadow node. Original node groups are identical. No credentials/hosted data were modified.
- The shadow Code contains `const PAGE_POLICIES = Object.freeze({});` and `outgoingSendEnabled: false`, has no Meta API call, HTTP Request, credential or external I/O. With all Pages OFF it emits exactly the original input JSON, preserving original menu/voice/product/order/handoff route and matching paired items. It is intentionally NOT yet production reaction routing.
- n8n validation returned only two **pre-existing** warnings (unconnected memory subnode and OpenAI builtInTools conditional config), plus top-level canvas layout warning. No new parameter/credential warning or removed node group.

**TESTED — no-send on n8n synthetic pinned manual run**:
- QA workflow `9ckigv7nLJ7E7ydj` in Personal / 90_QA - DIAGNOSTICS, **inactive**, extended to exactly 3 nodes: Manual Trigger branches into (a) synthetic enabled policy Code and (b) the **exact JS source copied from the saved Messenger Draft shadow node**. No HTTP/webhooks/data tables, credentials, external I/O or live Messenger messages.
- Execution **6723**, success. 16/16 synthetic policy decisions PASS (❤️/👍 proposals and 14 safe pass-through or unchanged states). 16/16 actual ALL OFF Draft Code items PASS (unchanged JSON, no reaction metadata), **32/32 path assertions**. Covers thanks, praise, price, purchase, approval, handoff, menu, SKU, voice, QA_CORE, quick reply, wrong Page, privilege, catalog paging, referral and sticker.
- Full live workflow test was **intentionally not run**, because credential-free n8n Data Table nodes can perform actual reads/writes even when HTTP nodes are pinned. There is no proof of end-to-end mobile/web regression after publishing; don't claim it.
- Structural recheck immediately after change: draft `9a705cbe...`, Published `47b48f6d...`; no pre-existing node changed, 3-node QA inactive, PR #493 remains Draft.

**Rollback:** restore the saved n8n draft version `18125761-5898-4950-bcd8-3c8d15539063` **only after confirming no newer parallel draft edits**, or atomically remove exactly the shadow node and reconnect classifier -> handoff. Do not restore a stale draft over newer work. Published rollback is unnecessary since it has never been touched.

**Remaining prerequisites for automatic reactions:** trusted, published owner per-Page settings; real merchant/tenant/Page mapping; current Meta thread ownership verification; persistent atomic dedupe and rate limits; correct error/fallback without double response; P0 order/handoff/QA_CORE regression under full no-send harness; UI visibility on Messenger web; explicit separate publish approval. The real one-off ❤️ mobile tester UAT remains PASS but is not proof that automatic reaction routing is released.
