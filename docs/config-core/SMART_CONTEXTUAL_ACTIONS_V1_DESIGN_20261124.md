# TIEN404 AI — Smart Contextual Actions V1 (DESIGN CANDIDATE)

Date: 2026-11-24  
Scope: native Meta Messenger, optional Website Widget preview.  
Status: **PROPOSED only; NOT wired into production; NO_SEND / NO_WRITE**.

## Baseline (read-only attestation)
- Messenger workflow: `Z7FdV7uDvApfbURQ` (`TIEN404_MESSENGER_TEST`).
- At audit, n8n **published** version `1f4069a5-5e74-4c79-935b-40f02b3582d8` and **draft** version `41bcea84-703d-40bc-be2a-71f84ca4e2d8` **differ**.
- Published `Prepare Messenger Reply` includes Meta Button Templates and Quick Replies. Draft additionally includes catalog paging and context-menu routing. Neither changes the native Messenger visual style.
- Config Core `config-core/lib/channel-render.mjs` already provides `render/visibleItems`, Page-published action IDs and capability fallbacks. Use this; do **not** build a duplicate menu database.
- The menu bridge `9HXjjJ5ghPKUu43b` has a separate version lifecycle. Coordinate before any live wiring.

## Hard platform constraints (Meta)
Native Messenger does **not** expose application-controlled CSS positioning, button background, hover states, border radius or center-screen floating components.

Use the delivery mechanism to choose *where a native UI component appears*:
- **Quick Replies**: above the input composer, appear for the current reply; do not treat them as permanent navigation.
- **Button Template**: up to 3 action buttons attached to a specific message in the conversation.
- **Generic Template / carousel**: content cards with their own actions, inside the message stream; only show verified items/media.
- **Persistent Menu**: repeatable Page navigation near composer/menu entry; not a movable top bar.
- **Website Widget**: own HTML/CSS; may use sticky footer, centered modal/drawer, colored CTA and responsive layouts. Never claim equivalent Meta support.
- The UI cannot arbitrarily move previously sent native Messenger messages or reorder buttons inside messages already delivered.

## Context → action-slot contract

| Conversation state | Main placement | Actions (examples only, conditional on *published* Page config) | Secondary |
|---|---|---|---|
| New greeting | Quick Replies above composer | Xem sản phẩm / Tra cứu đơn / Gặp nhân viên | Persistent Menu |
| Browse catalog | Message carousel/cards or button template | Xem SKU on its card; category paging | Quick Replies Trang trước/tiếp |
| Product detail | Inline actions on product card | Xem tương tự / Hỏi thêm | Quick Reply Xem mẫu khác |
| Order inquiry | Plain text + one context action | Xác minh quyền sở hữu first, otherwise Gặp nhân viên | No order details before trusted verification |
| Human handoff | Minimal plain-text acknowledgement | No misleading bot CTA until provider success/owner returns thread | No repeated sales prompts |
| Artist / creator | Playlist/profile cards | Nghe nhạc / Thông tin / Liên hệ quản lý | No shop-only items |
| Service / professional Page | Service card / one contextual CTA | Xem dịch vụ / Liên hệ chuyên viên | Avoid unsolicited emoji/reactions |

**Rule:** Put 1–3 immediately relevant actions in the transient slot, rank by current intent, then Page-owner order. Do not show unrelated buttons under every message. For 4+ items prefer paging/vertical category navigation; do not hide inaccessible actions after a 3-button truncation. Allow users to type normally.

## Security / API invariants

1. Account/Page/tenant authority comes from the signed/validated inbound channel and server-resolved published config; never from a button label or a client-supplied store ID.
2. Keep the action ID and `T404:M:<id>` semantics; do not replace with index-only quick reply values that can change meaning between states. Retain and safely resolve old `TIEN404:*` postbacks.
3. A catalogue SKU, current unit price and stock must be read from the right authorized DEMO/merchant source. Never let styling make an unverified order/stock/payment commitment.
4. Action renderers must support `quick_replies`, `attachment`, plain text and safe fallback. No unsupported JSON should reach the Send API.
5. Limit titles per Meta-specific schema (Quick Reply and Button Template labels <=20 chars; Quick Replies <=13; Button Template <=3). UX target <=3 for first screen.
6. Zero writes, sends or Meta changes from this design. Release requires approval, independent checkpoint and rollback plan.
7. Multi-turn state and button payload routing must resist cross-Page/cross-sender collisions, replay and stale menu versions.
8. Staff handoff: keep standby/return-to-bot behavior; do not assert transfer success before a provider-confirmed response.

## Acceptance (all pending real device QA)
- C-01: greeting → 2–3 contextual quick replies visible on Messenger Android/iOS and Web desktop.
- C-02: catalog → first card and page navigation tappable on mobile; no 4+ SKU dead ends.
- C-03: product card → correct SKU when tapped, no false stock/price or order write.
- C-04: 4+ items → paging/category behavior, no silently dropped items.
- C-05: order lookup → unauthorized customer sees no other person's order; ownership verification required.
- C-06: artist Page → artist actions, **no** shop SKU/checkout actions.
- C-07: Page A/B isolation and stale/disabled action IDs both fail closed.
- C-08: Meta failed handoff / standby / staff completes → state recovers accurately.
- C-09: web widget preview may use custom CSS; native Meta still obeys capability limits.
- C-10: accessible labels, keyboard/touch, narrow mobile, no horizontal clipping of essential CTA.
- C-11: existing published behavior and old payload handling unchanged unless approved and regression-tested.
- C-12: output message cap and idempotent delivery confirmations preserved.

## Rollout gates
1. Build a **pure** context-action planner on top of Config Core `visibleItems`, not new business actions. Context inputs must be server-validated.
2. Generate preview/snapshots and deterministic fixture-based offline QA for each Page/intent.
3. Integrate on a **staging fork** or versioned Messenger draft with external Send API and business writes stubbed. Preserve exact rollback version and diff.
4. Compare Meta mobile vs web screenshots during a separately approved live QA window.
5. Request explicit approval of published workflow ID/version and Meta menu setup before promotion.

## Checkpoint / rollback
No n8n, Meta Page, product, Commerce, Supabase, payment or customer records changed by this **design-only PR**. Existing published `1f4069a5-5e74-4c79-935b-40f02b3582d8` remains authoritative **at the time of this read-only audit**; re-read it before any subsequent change.
