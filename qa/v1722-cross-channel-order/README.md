# TIEN404 V17.22 — Messenger order → Zalo Bot status: Secure Cross-Channel UAT Candidate

**Current status:** `SOURCE-ONLY QA / GITHUB CI 42 OF 42 PASS / LIVE PROVIDER ROUTING NO-GO`.

**This source is NOT a provider integration, a Store-approved Commerce writer or a production order service.** It stores synthetic orders **only in its current in-memory QA process**. Every provider send, model call and real Commerce write is disabled.

## How the future real-user UAT should work

After a separately approved **opt-in, private QA channel adapter** is implemented and independently verified, the operator will use the following exact-command trial on **the same store**. These commands DO NOT yet work in the current Published Messenger/Zalo bots; DO NOT send them until the staging cutover gate is signed off:

| Step | Account | Message / action | Expected safe result |
| --- | --- | --- | --- |
| 1 | Messenger Account A, verified Page installation | `QA_ORDER PREVIEW QA_SKU_001 2` | Preview, SKU/qty and approved Store-specific sample price; no order committed |
| 2 | Same Messenger Account A | `QA_ORDER CONFIRM <preview_ref>` | Creates **QA-only** order reference, no payment/stock effect |
| 3 | Different Zalo Bot account owned by the **same tester** | `QA_ORDER STATUS <order_ref>` | **DENIED** until explicit link |
| 4 | Original Messenger Account A | `QA_LINK START <order_ref>` | First one-time code shown only to Messenger |
| 5 | Same tester on the approved **Zalo Bot** conversation | `QA_LINK CODE <messenger_code>` | Second one-time code shown only in Zalo; **no order details** |
| 6 | Original Messenger Account A | `QA_LINK CONFIRM <link_ref> <zalo_confirmation_code>` | Link approved after proof of **both channels**, TTL 5 minutes |
| 7 | Same approved Zalo Bot tester | `QA_ORDER STATUS <order_ref>` | Return **only** QA order status/SKU/qty/total; no phone/address/customer export |
| 8 | Independent Zalo Account B | `QA_ORDER STATUS <same_order_ref>` | Identical generic **DENIED** for known or unknown refs |
| 9 | Independent Messenger Account B | `QA_ORDER STATUS <same_order_ref>` | **DENIED**, even within same Page/Store |
| 10 | Account on Store B (same Tenant) / Store C (other Tenant) | `QA_ORDER STATUS <same_order_ref>` | **DENIED** with no Store A order metadata |
| 11 | Original Messenger Account A | `QA_LINK REVOKE` | Revokes link; subsequent Zalo status **DENIED** |
| 12 | Operator | Replay event, change SKU/qty, change account identity, retry failed OTP >3 times | Replay no duplicate sends/writes; conflicts and unauthorized actions deny |

**Use consenting tester accounts only, never customer data.** Do not put real names, phone numbers, addresses, credentials, Meta Page token or real store orders in chat or screenshots. Once approved, actual provider message timestamps/IDs must be correlated through **PII-minimized** private logs.

## Design and verified source behavior

- `cross-channel-qa-core.mjs` implements one synthetic, strict contract: **server-resolved Store/Page/Bot binding**, two-step order preview/confirm using a fixed QA catalog per Store, unique event replay suppression, two-channel *two-secret* OTP handshake, 5-minute link TTL, rate-limited invalid codes, and per-owner/private order lookup.
- Messenger Page A/B/C and Zalo Bot A/B/C are **fake fixtures** and cannot approve real Page ownership or OA subscriptions. The QA signer uses fake HMAC keys in source; **do not reuse for hosted**.
- Messenger original sender and Zalo Bot actor are **distinct channel-specific identities**. The initial Messenger OTP by itself cannot link. Zalo OTP must be returned to **the original verified Messenger sender**; another Messenger account cannot approve it. A completed link may be revoked.
- Order reference alone (or phone alone) **is not authorization**. All lookups require a trusted installation, same Tenant, same Store and a verified owner link. Wrong Store and unknown order must produce the **same generic denial**.
- No arbitrary customer-provided `store_id`, `tenant_id`, provider-verified flag, role or JSON authority claims. This QA source uses canonical fixture-only envelopes; real Meta HMAC and Zalo Bot shared-header verification must be performed separately.
- Test source is **in-memory**; its OTP limits, event replay and order state are **not durable/distributed**. Before live QA, use a dedicated private store, atomic replay and least-privilege writer. Do not claim live protection from fixture tests.

## Actual existing integrations, VERIFIED 2026-11-17

- Meta Messenger `Z7FdV7uDvApfbURQ`: signed Page webhook and opt-in `QA_CORE:` read-only route work, but **default agent retains legacy AI_SALES_DEMO create/manage/update order tools**, and its existing `get_order_status` reads **AI_SALES_DEMO Google Sheets**, not Commerce.
- Zalo Bot `yIJk8LvJoLF40Z62`: protected Bot webhook ingress, Owner/Customer isolation and no-send Core shadow work; **no Zalo customer reply node** in this Published graph. Bot header secret is not Zalo OA signature.
- Central Commerce Core `iyfGUiEsZlNTBWOR`: sandbox consultation/catalog read, **fails closed for unregistered Store/channel**, and has no approved multi-store order transaction writer / external customer authorization.
- Supabase staging `ifxlvrhyjhbzbrkdsida`: `public.orders` has tenant-scope but **no store_id**, and owner/manager read RLS; `public.stores` and `public.channel_identity_links` absent. Private `tien404_r1_qa.sandbox_orders` exists for earlier QA, but no verified Messenger→Zalo real-customer link contract is published.
- V17.21H.2 private Cloudflare DO is **only replay storage**, not a customer order database. It remains isolated/no public URL and is not connected to these order flows.

## Proposed private persistence, **NOT APPLIED**

`PRIVATE_STAGING_SCHEMA_CANDIDATE.DO_NOT_APPLY.sql` is an additive, private PostgreSQL schema `tien404_v1722_qa` (orders, OTP challenges, linked identities, replay) designed with `ENABLE/FORCE RLS` and **zero grants** to `anon`, `authenticated`, or `service_role`. It is **only a review artifact**; **do not apply** before a dedicated operator identity, backed-up rollback and independently approved integration contract. Do not expose this schema to PostgREST or service keys.

## Release gates and owner approval

| Gate | Status |
| --- | --- |
| Source-only cross-channel order + identity security tests | **PASS, 42/42** GitHub CI |
| n8n manual Order Ownership QA | **PASS, 25/25** execution #5023 |
| n8n OTP + staff security policy QA | **PASS, 40/40** execution #5023 |
| n8n V14.8 three-channel synthetic resolver QA | **PASS, 36/36** execution #5024 |
| Real Page → verified Store and Zalo Bot → SAME approved QA Store | **BLOCKED** (no private owner proof) |
| Real Supabase auth Store A/B + trusted transaction writer, isolated QA ledger | **BLOCKED** |
| Hosted dual-channel identity handshake with atomic OTP/replay/rate limit | **BLOCKED** |
| Independent Meta signed callback and actual Bot header event UAT | **Previously passed ingress independently; NOT cross-channel order UAT** |
| Real Messenger order + Zalo Bot status + account B denial | **NOT RUN / NOT ENABLED** |
| Native Zalo OA OAuth/signature/merchant Store authorization | **Separate NO-GO gate** |

Once all prerequisite gates pass, the **first real user-facing UAT must use opt-in QA prefixes and ONLY synthetic orders**. Do not publish unreviewed tools, join the legacy DEMO Orders/Products sheets, enable provider sends to unconsented people, or downgrade the Store security gate to make the UI appear functional. Actual Commerce orders require a separate confirmation, privacy, inventory and rollback release.

**Security note:** A user voluntarily sharing *both* channel OTPs or approving a fraudulent link can still be socially engineered; native provider/account ownership and optional account security notifications are needed for production.

## Rollback

These files are only in Draft PR #243. Revert `qa/v1722-cross-channel-order/**` and its `.github/workflows/v1722-cross-channel-commerce-ownership-nosend.yml` CI or close PR #243. **No n8n, Supabase hosted, Cloudflare, Meta or Zalo rollback is needed.**
