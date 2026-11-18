# V18.3.6C — n8n Workflow Compatibility Audit

Read-only workflow inspection only. No workflow was executed, changed, published or deactivated.

## 1. Messenger

- Workflow: `TIEN404_MESSENGER_TEST`
- ID: `Z7FdV7uDvApfbURQ`
- Active: yes
- Active version: `1064b1b3-d3f1-4a6b-a367-2414ba691522`
- Contains a Google Sheets Products read node, a configured HTTP Messenger send node, and AI Agent tools for Create Order, Update Order, Manage Order, Order Status and Support Ticket.
- Create Order tool `KrSn4DNR9ALX5ng4` is active and uses Google Sheets Read Products, Read Orders and Append Order.
- Update Order tool `BkAi6TVUKAjCnI7v` is active and reads/updates/verifies a Google Sheets row.
- Manage Order tool `fDB9dvs1qPPVt9Sp` is active and reads/updates/verifies Google Sheets.
- Messenger also contains a separate V17.15 QA_CORE-only path to Commerce Core. That branch normalizes the query to a read-only QA topic, passes `canWrite=false`, and asserts sandbox/no-send/no-write before using the response. This does not replace the legacy create/manage/update tools attached to the general Messenger AI Agent.

**Compatibility decision:** Messenger is not yet a canonical Store-aware Commerce writer. Do not reconnect its legacy Sheets tools to the new Store authority without a separately tested adapter and writer cutover.

## 2. Zalo Bot

- Workflow: `TIEN404_ZALO_BOT_LAB_V1_STAGING`
- ID: `yIJk8LvJoLF40Z62`
- Active: yes
- Active version: `2d912cb0-007f-452f-9536-b92ba12a03e6`
- Protected header-auth webhook.
- Calls V12.3 private customer router read-only and V2 owner-gate shadow.
- Calls `TIEN404_V1715_ZALO_WEBSITE_SHARED_CORE_SHADOW_NO_SEND`.
- Ingress acknowledgement is explicitly named `Ack Zalo (No Message Sent)`; no OA send is configured in the inspected path.

**Compatibility decision:** staging/shadow only; no production provider authority or Store writer proof.

## 3. Commerce Core

- Workflow: `TIEN404_COMMERCE_AI_AGENT_SANDBOX`
- ID: `iyfGUiEsZlNTBWOR`
- Active: yes
- Published version: `456862c9-e5ee-4bfa-9931-47dbc39ab73d`
- Current draft version: `c96422e0-170b-46a3-8d75-3a2695e645e7`
- Draft differs from the published version; do not assume draft changes are active.
- Published graph uses `TIEN404_COMMERCE_TENANT_RESOLVER`, `TIEN404_COMMERCE_CATALOG_QUERY`, `TIEN404_COMMERCE_CART_PREVIEW` and sandbox business-core tools.
- Tenant resolver uses n8n DataTables for channel, tenant and feature flags. It accepts `messenger`, `zalo_oa` and `website` channel types and matches caller inputs `channelType + accountId` to a unique configured row.
- It explicitly rejects an active tenant+active channel as `live_connector_not_implemented`; only sandbox configuration is admitted. It returns `canWrite=false` and `canSend=false`.

**Compatibility decision:** sandbox consultation only; no live channel authority or Commerce writer.

## 4. DataTable shape

There are 16 `TIEN404_COMMERCE_*` DataTables. Fourteen include `tenantId`; none includes `storeId` or `storeKey`.

- Tenant rows: 4 (3 sandbox, 1 onboarding).
- Channel rows: 6 (3 sandbox, 3 not_connected); 3 enabled; all six have no credentialRef.
- Product rows: 8 active across 3 tenants; no missing/unknown tenant reference or duplicate SKU within tenant.
- Feature flag rows: 23; no duplicate tenant+feature key.
- One Messenger channel and two Website channels are sandbox-enabled. Zalo OA is not connected/disabled.

The Orders DataTable schema includes customer name, phone and address. Its row data was intentionally not read during this audit.

## 5. Cutover rule

No cross-channel UAT should be considered a same-tenant multi-Store acceptance until Messenger, Zalo and Website all resolve the same canonical `tenant_id + store_id` from trusted server-side authority, and their data adapters read the same Store-scoped Commerce Core. Current workflows do not meet this contract.
