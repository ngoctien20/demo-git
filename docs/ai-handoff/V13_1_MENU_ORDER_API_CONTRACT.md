# TIEN404 SALES LITE V1.1 — Menu & Order Contracts V13.1

**Phạm vi:** Staging proposal, no provider write. Tham chiếu registry `qa/sales-lite/v131/menu-registry.json` và V12.4R Customer Core PR #52; Owner sessions PR #41. Các hợp đồng dưới đây **không** là chứng nhận đã tích hợp hai PR.

## 1. Phân lớp kiến trúc

```text
Zalo Bot customer/owner chat
  → Existing protected V1 ingress (Published; do not change)
  → server-side Bot→Shop→Tenant resolver + role/Owner binding (P0 not wired)
  → MenuActionRouter (V13.1 candidate)
       ├─ CUSTOMER: V12.4R Customer Core preview port (PR #52)
       ├─ OWNER: V12 Shop B owner operations port (PR #41)
       ├─ SUPPORT: TIEN404 Support ticket port (not connected)
       └─ SUBSCRIPTION: backend read-only account membership port (not connected)
  → Existing Order Request & Notification Outbox (writes DISABLED)
  → Zalo provider sendMessage (DISABLED)
```

Source of truth: **GitHub MenuRegistry**, not a duplicated n8n list. The new n8n smoke workflow independently asserts a small set of constants; it is NOT a runtime bridge. A deployable bridge will need a signed/verified provider event and a server-controlled credential and must not trust role/tenant IDs in message JSON.

## 2. Menu Action Contract

Every registry action includes: `action_id`, `menu_version`, `label`, `description`, `actor_role`, `action_type`, `required_permissions`, `requires_confirmation`, `idempotency_policy`, `fallback_command`, `next_state`, `enabled`, `channel_support`.

- Stable `action_id` e.g. `CUS_PRICE`, `OWN_PAUSE_SHOP`, never derived from Vietnamese label or button order.
- Numbered text commands `1`..`7` are scoped to a **trusted** actor role. Number `1` means `CUS_CATALOG` for Customer, but `OWN_NEW_ORDERS` for Owner; role cannot be provided by user text.
- `TEXT_NUMBERED` and `TEXT_COMMAND` are the only Zalo Bot **conceptual** formats enabled. `MOCK_TESTED` renders in browser only. `NATIVE_MENU`, `QUICK_REPLY`, `INLINE_BUTTONS`, provider callbacks fail closed until official provider schema + explicit send authorization are verified.
- `channel_support` represents **our contract**, not claims about provider menu support.
- A denied/disabled action must not produce a send, order insert or subscription update.

Example registry action:

```json
{
  "action_id": "OWN_PAUSE_SHOP",
  "menu_version": "1.1.0",
  "label": "🌙 Tạm nghỉ",
  "description": "Dừng nhận yêu cầu mới sau xác nhận",
  "actor_role": "OWNER",
  "action_type": "WRITE_PROPOSAL",
  "required_permissions": ["shop:status_change"],
  "requires_confirmation": true,
  "idempotency_policy": "RECEIPT_REQUIRED",
  "fallback_command": "4",
  "next_state": "OWNER_CONFIRM",
  "enabled": true,
  "channel_support": ["ZALO_BOT_TEXT","MOCK_WEB"]
}
```

## 3. Authenticated processing boundary

Input to actual production/staging integration MUST be **server-derived context** from provider-authenticated gateway and current DB binding, not a client-provided object. The current `source: BACKEND_AUTHENTICATED_CONTEXT` shape in tests is a **fixture interface**, not a cryptographic security control. A production bridge must verify:

1. Provider webhook security (Zalo token header/allowed callback semantics, never log secret).
2. Bot belongs to exactly one registered active Shop/Tenant, not supplied from chat text.
3. Customer identity is bound to provider sender; Owner requires verified pairing and current role permissions.
4. Subscription active/expired, shop pause, tenant-scoped catalog and order readback under RLS.
5. Cross-worker session, TTL, replay and transaction idempotency; RAM fixture receipt is NOT enough.
6. Only then invoke an action port. Important mutations require a **separate server-side confirmation challenge** and backend receipt before committing.

## 4. Customer Order Request

States: `DRAFT → PENDING_OWNER → ACCEPTED → COMPLETED → PAID`, alternatives `REJECTED`, `CANCELLED`. No automatic transition based on AI intent.

Required before a real Order Request save:
- source SKU, price, inventory, policy & stock all freshly verified for the exact tenant/store/bot;
- integer VND with safe arithmetic; a changed SKU/quantity requires recalculated expected_total and confirmation;
- customer identity, quantity and contact/address needed by business contract;
- dedupe key and atomic write of order plus `HELD/SEND_DISABLED` outbox, with server-side readback;
- never report `PENDING_OWNER` until DB write ACK.

Current `business-contracts.cjs` calls an injected `customerCore.preview()` port and refuses `ordersWritten!=0`, `externalSends!=0` or `productionReady!=false`. It **does not** save orders or import PR #52 implementation. PR #52 remains authoritative for the preview transaction/catalog. Explicit integration needed after PR coordination.

For `CUS_MY_ORDERS`, order ID alone is insufficient: `SERVER_VERIFIED_CUSTOMER` binding and customerKey must match authenticated sender and tenant/store; else fail closed.

## 5. Owner operations

Actions: `OWN_NEW_ORDERS`, `OWN_APPROVE_ORDER`, `OWN_REJECT_ORDER`, `OWN_PAUSE_SHOP`, `OWN_OPEN_SHOP`, `OWN_REPORT`, `OWN_SUPPORT`. Owner menu only for paired Owner/Manager with corresponding permissions.

- `CONFIRMATION_REQUIRED` means **no write happened**.
- `SERVER_COMMIT_REQUIRED` after QA nonce is a *proposal*, not a saved change; no runtime write port configured.
- `PAID` must have independent evidence of payment (not just customer/Owner chat).
- Paused shop blocks new draft requests; must not discard already accepted orders.
- Report includes separate `requestCount`, `pendingOwnerCount`, `acceptedCount`, `completedCount` and `paidRevenueVnd`. Only paid evidence counts as actual revenue.

## 6. Outbox / owner notification

`prepareHeldNotification()` only yields `OUTBOX_CANDIDATE_ONLY` after a **trusted backend port** supplies `dbCommitted=true`, tenant/store/bot/order id match and validated Owner binding. Never trust such flags directly from client. It cannot write or send itself. Existing Notification Outbox (not this adapter) must transactionally create an event and dedupe it.

Status vocabulary future: `PENDING`, `SEND_DISABLED`, `PROCESSING`, `ACCEPTED_BY_PROVIDER`, `DELIVERED` **only when evidence exists**, `FAILED`, `RETRY_PENDING`. A provider ACK is not proof of delivery.

Owner binding must be established after verified Owner chat/pairing; account that created Zalo Bot is not automatically authorized to manage arbitrary shops. No fallback to Gmail/Telegram without approval.

## 7. Support Bot / Subscription Lite

Support Bot separate from merchant Bot. Ticket action is `SUPPORT_TICKET_DRAFT_ONLY` until actual support backend saves a ticket and returns ID. Subscription frontend read-only API must return trusted subscription status, expiry and shop binding. No billing mutation, no fake QR or payment success. Website `mock/subscription-lite.html` contains placeholders, explicitly not live.

Candidate plans for economic validation only: Lite 199.000đ/month, Plus 349.000đ/month. No Billing changes.

## 8. Error/no-send semantics

All candidate outputs include `ordersWritten=0`, `externalSends=0`, `outboxWrites=0` where applicable. Error categories: `BACKEND_ACTOR_UNVERIFIED`, `ROLE_DENIED`, `PERMISSION_DENIED`, `SUBSCRIPTION_INACTIVE`, `SHOP_PAUSED`, `CATALOG_NOT_FRESH`, `READBACK_SCOPE_UNVERIFIED`, `CALLBACK_PROVIDER_UNVERIFIED`, `STALE_MENU_VERSION`, `DUPLICATE_EVENT`.

Read backend failure in the QA-only engine releases the in-memory event receipt and does not advance session. This does not replace a real transaction and separate reprocessing policy.

**Pre-deploy gates:** sync API contract ownership with PR #41/#52; verify backup and backend credentials; producer signature, store isolation, RLS; persistent sessions/dedupe; cost cap for paid AI; separate approvals before any Zalo outbound, Order writes or migration.
