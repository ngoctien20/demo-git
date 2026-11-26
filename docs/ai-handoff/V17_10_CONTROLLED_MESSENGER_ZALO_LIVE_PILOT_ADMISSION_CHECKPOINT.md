# TIEN404 — V17.10 Controlled Messenger + Zalo Live Pilot Admission

Date: 2026-11-17 JST. Staged admission plan only; no live callback/published workflow or production data modifications in this milestone.

## Owner ask
Connect tested Messenger/Zalo AI Sales bots to LIVE for owner-run experimentation. Distinguish proof of **existing Messenger live** from hypothetical new **Commerce / Zalo OA live**.

## Verified read-only provider/channel evidence
- Messenger n8n workflow `Z7FdV7uDvApfbURQ` **ACTIVE / PUBLISHED** version `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`. It already has GET verification webhook and POST raw-byte HMAC verification, dedupe, OpenAI Agent, legacy **AI_SALES_DEMO** sheet catalogue, reply and legacy toolWorkflow order actions. This is **not** the Store-secured Commerce workflow.
- Real webhook execution `4176` (2026-11-16 11:31:09 UTC) **SUCCESS** traversed signature check, Messenger AI Agent, provider HTTP reply, reply validation and recorded MID. Exec `3868` also read old DEMO products and sent reply. No change required to claim that this **existing** Messenger route is live for its current DEMO.
- Zalo `yIJk8LvJoLF40Z62` **ACTIVE / PUBLISHED** staging ingress version `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e`, header-protected `tien404-zalo-bot-lab-v1`, ACK/no-send and calls `sIPs6egzIwOY1GNv` private read-only router. Observed only **manual** latest 11 executions; no real Zalo webhook or sent response independently certified. **Zalo Bot API ingress does not establish Zalo Official Account (OA) merchant integration**. OA App permission and trusted webhook plus appropriate message send rights require separate evidence. No Zalo OA/merchant ownership attested here.
- Inactive locked Messenger shadow `6ZWYRBKieTKQMzoQ` returns 403 no-send until independent App+Page proof. Dedicated QA Meta App/Page were previously deferred by owner; no new test Page/App has been independently verified. NO Meta callback or subscription rewiring done.
- New native [V17.9 Staff Commercial Sheet](https://docs.google.com/spreadsheets/d/1siR8y7lxrYch8w6P1CVn5ta6XdWpYX9NJ384Yb1kujw/edit) has four empty tabs and is not shared. Its formulas were tested with temporary synthetic 343000 VND order then cleared. It is **not** connected to any n8n LIVE bot, and raw Google Sheet sharing cannot provide per-Store JWT or staff ACL. DO NOT point the live Messenger DEMO read/write tools to this blank template.

## Revalidated independent QA on n8n (actual executions, 2026-11-17)
1. `AjG4xCGD4OEvvgeB`, execution `4367` **SUCCESS 26/26** for synthetic multi-channel Store/Bot catalog guard, 6 allow/19 deny/1 duplicate; `provider_webhooks_verified=false`, `hosted_rls_verified=false`, `actual_messenger_zalo_website_ingress=false`, sends/writes/models all 0.
2. `lN6rKmmu11oIDVFO`, execution `4368` **SUCCESS 38/38** for synthetic signed Website QA session, 3 allow/34 deny/1 duplicate; `real_website_session_issued=false`, `hosted_store_rls_verified=false`, `all_provider_sends=0`.
3. `AQ6JEfQzdC4aEglH`, execution `4369` **SUCCESS 21/21** for inactive synthetic trusted registry/catalog, 6 allow/14 deny/1 duplicate; `real_provider_signature_verified=false`, `actual_owner_store_verified=false`, `real_jwt_rls_verified=false`, `can_publish=false`, sends/writes/models 0.

**Total new manual QA assertions: 85/85**, but this is not real Meta/Zalo provider integration or Store safety certification. Do not confuse 85 synthetic tests with a successful live pilot.

## Hosted Store blocker
Fresh read-only Supabase staging check 2026-11-17: 2 Tenants, 2 Products, 2 Orders, 3 Auth users, **zero canonical public.stores/store_memberships**, zero `store_id` columns across Commerce six surfaces, zero Store-qualified policies. No independently accepted current full recovery. Legacy DEMO must stay separate.

## Real controlled live experimentation — progressive release contract

**Pilot M — Messenger on EXISTING owner-controlled Page; currently available for existing DEMO only**
- No change to published webhook, Page token or Graph subscription at this checkpoint.
- Owner may test ordinary **catalog/FAQ only** on their current Messenger Page; those messages route through live AI and may incur model/provider usage.
- **Do not test creating/changing genuine orders** on the current legacy DEMO Page because its old workflow still exposes create_order/update_order_address/manage_order tools. Never submit real customer's personal data; use approved test identity only.
- To route NEW per-Store bot instead of existing agent, first verify owner authorization for that *specific* Page/App (non-sensitive metadata only), decide whether separate Page/App or carefully controlled cutover, snapshot current callback/config and rollback, confirm verified raw-body HMAC + durable idempotency, safe read-only sandbox Store binding and explicit no-order/write/no-send policy. Published replacement requires a separate specific bounded release approval.

**Pilot Z — Zalo Bot technical ingress; Zalo OA merchant chat is separate**
- Identify authorized specific bot vs Zalo Official Account, App rights and OA install, webhook callback validity and event signing. Existing header-protected `yIJ` is an active staging bot but **not evidence of OA send capability**.
- First real event on separately approved QA resource routes into an isolated no-send handler, validates provider identity, logs only pseudonymous outcome, checks dedupe and no cross-Store read. Require primary evidence real event execution ID before auto-reply.
- Any public owner-facing OA reply, cross-channel identity linkage, or Shop order lookup requires separate provider-specific proof, verified customer identity challenge and Store-scoped authorization. No assumption that Messenger sender ID and Zalo user ID identify the same customer.
- Any billed notifications or template messages need provider policy and explicit budget approval.

**Pilot W — Website signed bot** remains offline mock until an independently issued real server session, nonce/TTL, verified shop binding and live no-send browser UAT. Not necessary to block Messenger DEMO catalog read tests.

**Commercial Sheet/live order gate**
- Do not write order/payment/stock nor read personal customer data from new V17.9 Sheet through provider bots until source-of-truth, per-Store roles, idempotent transaction, safe customer consent and recovery gates pass.
- Pilot replies may say `tạm tính — cần khách xác nhận`; never claim `đã đặt hàng` until authoritative durable order write succeeds. Image matching remains suggestion requiring merchant-product reference image corpus and final customer confirmation.

## Minimal live acceptance matrix (future, not executed)
A. Real signed and owner-authorized inbound message on exactly approved Page/OA.  
B. Unknown installation / invalid signature / forged recipient / cross-Store event denied.  
C. Same customer ordinary catalog request yields correct SKU/price/stock from approved trusted Store with freshness.  
D. Unknown SKU/photo returns candidates and explicitly requires customer confirmation before attempting order.  
E. Real order/change action denied in inquiry-only pilot; existing DEMO production write tools remain isolated.  
F. No duplicate send for replayed event; no tenant/customer PII leaked.  
G. App/Page subscription and callback rollback rehearsed; current Messenger existing route still healthy.  
H. Owner approves the **named test Page / OA**, allowed test users and send/write scope separately.

## Outcome / rollback / approvals
- **VERIFIED:** existing Messenger DEMO real signed successful send; Zalo staging ingress Published but no provider webhook verified; 85/85 new offline n8n QA; Commerce candidate Sheet blank/not shared; Supabase Store NO-GO.
- **IMPLEMENTED:** documentation and runnable QA re-execution only. **No provider/hosted changes.**
- **BLOCKED:** NEW multi-tenant Messenger/Zalo OA production bot promotion; current original Page/OA ownership/subscription readback; Store-level RLS; cross-channel customer confirmation; real order writer, image benchmark.  
- **Required for actual provider callback**: non-secret Page/OA identifier or owned test Page/OA URL and scoped approval (catalog read only vs actual sends), private original owner evidence, signed callback, rollback. Do NOT request tokens in chat.
- **Rollback:** Source-only PR close, retain existing published Messenger/Zalo routes unchanged; no hosted rollback needed.

References:
- Meta Page webhooks https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-pages/
- Meta Messenger quick start https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start
- Zalo OA App authorization https://oa.zalo.me/home/documents/guides/Khoi-tao-ung-dung-va-cap-quyen_117071366476220195
