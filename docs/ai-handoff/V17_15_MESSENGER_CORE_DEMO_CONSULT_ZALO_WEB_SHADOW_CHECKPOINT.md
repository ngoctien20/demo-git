# TIEN404 V17.15 — Messenger Core Read-Only Pilot × Zalo Bot / Website Shared Core Integration

**Checkpoint:** 2026-11-17 JST. Owner explicitly requested to add central Core for Messenger product advice and connect Zalo and Website to the same Core, without enabling real order or stock writes. **Release scope:** limited DEMO read-only pilot and protected technical no-send integrations. Real merchant Store, real Zalo OA, authenticated merchant Website session and Commerce writes remain NO-GO.

## 1. Actual CURRENT published versions verified

| Runtime | ID | Published version | Behavior |
| --- | --- | --- | --- |
| Existing Messenger LIVE | `Z7FdV7uDvApfbURQ` | **`2b869035-fe39-46fb-a253-18fefe4ecbfd`** | New `QA_CORE:` message route to central Core sandbox catalog, **one existing Meta Send Reply node**. Non-prefixed messages keep legacy Messenger AI Agent, including DEMO tools. Existing HMAC, Page allowlist, dedupe and V17.13 shadow remain. |
| Actual Commerce Core | `iyfGUiEsZlNTBWOR` | **`3d3905a4-0d26-4253-8a1d-57fd73b043c2`** | Four new nodes for readonly `QA_CORE:` catalog-only consultation on **`demo_tien404`** only. Actual existing Resolver + Catalog, neither paid model nor write tool in new route. Allowed internal callers now include trusted Messenger, previous bridge, original QA, and Zalo/Web technical bridge. |
| Existing Messenger technical shadow | `dw1JOxWOEY8csTnm` | `450f2693-aad9-47d8-aaba-ac7a94abe644` | Unchanged, one signed-event/no PII shadow; deliberate deny, no duplicate send. |
| New Zalo/Web shared bridge | `4ycmVzaNzVRulBjQ` | **`76bbb4e9-7ad2-45a6-8188-260523ced57a`** | Private internal only, caller allowlist **only** Zalo Bot staging `yIJk8LvJoLF40Z62` and Website Demo `wgkkmT7q4lm4HyuA`. Receives four literal channel fields, not sender/customer text. Calls actual Core with **reserved unregistered** account ID; requires fail-closed deny and no send/model/write. |
| Zalo Bot staging | `yIJk8LvJoLF40Z62` | **`776486b2-092f-49ec-a7c4-f74ec8b60f07`** | Adds two nodes after validated, header-protected private text events. Original Zalo ACK, no-send and owner QA router paths untouched. **Zalo Bot staging is not the merchant Zalo OA**; no native OA customer reply. |
| Website public MARKETING demo | `wgkkmT7q4lm4HyuA` | **`c81929d4-ab55-4c24-8659-795842739e24`** | Adds private zero-PII Core-deny probe **after** existing `Format demo reply` and a final Code node returning exactly the original `output`. Preserves ChatTrigger `responseMode=lastNode`, quota, Knowledge Router, existing OpenAI answer. Does NOT disclose an unverified merchant Store, bot config or customer text to Core. |
| Existing Commerce Catalog | `oOOXicKXGkBskKqh` | `e0f1e345-8e6c-40cb-8e6a-d7ad2eb92696` | Unchanged existing Tenant-scoped sandbox catalog with only sample products `F-101` and `F-102` mapped to current Messenger Page. |

### Messenger pilot operation

- Message **MUST** start with the explicit opt-in prefix **`QA_CORE:`** (for example `QA_CORE: F-101` or `QA_CORE: F-102`) and come from the **existing signed/authorized Messenger Page path**. The legacy standard Messenger replies are unchanged for all non-prefixed messages.
- Read-only pilot route strips actual Page sender ID, message ID and raw customer text before calling Core, forwards **only sanitized sample SKU or generic catalog intention**. The normal Messenger Send Reply path remains **single** (no parallel Core reply send), with the normal `Prepare Messenger Reply` and Meta response verification.
- Core's preview reply requires `tenantId=demo_tien404`, `environment=sandbox`, `canWrite=false`, SKU strictly `F-101`/`F-102`, product names with `(MẪU)`, safe integral price/stock, and a conspicuous header **`[TIEN404 CORE — DEMO CHỈ ĐỌC]`**. The published Messenger pilot validates these fields **before sending**.
- Core outputs source sample price `F-101=159000 VND`, `F-102=289000 VND`, with explicit `giá/danh mục mô phỏng, không phải báo giá hay tồn kho thực tế`. It **never confirms orders, reserves stock or triggers a tool to write commercial state** in the pilot branch.
- **This is deterministic Core Catalog consultation**, not a new multi-turn LLM-powered merchant Store consultant and not a merchant-facing product guarantee. The original Messenger Agent remains the model-based advisor for nonpilot messages, retaining its pre-existing legacy DEMO order tools; this task **did not activate new Commerce order/stock writes**, but does not claim the entire legacy DEMO platform cannot write. A later independent approval is required to retire/disable old DEMO order tools.

## 2. Actual QA and test evidence

- **n8n `#4453` SUCCESS**: Manual test of actual central Core (initial V17.15 Core draft), 10 direct integrated subworkflow invocations: **8 unknown/unauthorized channel inputs DENIED**, **2 legitimate DEMO queries** returned F-101 and F-102 with exact sample prices, disclosure, no Core model, no sends or order/stock writes.
- **n8n `#4508` SUCCESS**, same 10/10 core preflight **after published Core change**; negative 8, positive sandbox 2; output `V1715_ACTUAL_CENTRAL_CORE_NEGATIVE_8_AND_READONLY_2_PASS`. These are simulated caller inputs; do not treat as a real Messenger post-deploy message.
- **n8n `#4488` SUCCESS**: new Zalo/Web shared bridge with two manual non-personal fixtures → **two integrated calls to the same actual central Core**, both DENIED (no Store/OA/Website issuer binding); zero provider sends, zero models, zero customer/stock/orders.
- **n8n `#4525` SUCCESS**, repeated 2/2 bridge after publication; output `V1715_ZALO_AND_WEBSITE_CENTRAL_CORE_SHADOW_DENIED`.
- **n8n `#4538` SUCCESS**: negative Messenger GET verify token after publication, nodes `Webhook`, `If`, `Respond to Webhook1` only; no AI/Meta send/Core call. This verifies invalid GET behavior, not positive signed POST.
- **n8n `#4540` SUCCESS**: Website ChatTrigger manual empty input (negative), only `Validate input and demo quotas` → `Allowed demo call?` → `Quota reached response`, no model and no bridge. This does **NOT** prove positive public Website answer + Core shadow end-to-end.
- V17.13R actual signed Messenger POST `#4431` with private shadow `#4432` and central Core denial `#4433` previously VERIFIED (before this new read-only customer reply route was published). **There is NO new genuine `QA_CORE:` signed Facebook post-response acceptance in this release yet**.

## 3. Website last-node regression catch and immediate rollback

- First draft with parallel Website Core-bridge branch was published temporarily as `60b40ecd-f38f-4922-8ed6-788867ad96ee`.
- Found that `Website Chat Trigger (QA only)` uses **`responseMode=lastNode`**: a parallel Core branch could replace the user-facing answer.
- **Immediately republished original known-good Website version `fcda12f3-35c6-473e-bc9d-2359ada3989c` and verified it**, before continuing. Temporary flawed version did not receive an independently confirmed customer UAT.
- Refactored new Website draft to **linear** `Website Knowledge Router` → `OpenAI text response` → `Format demo reply` → `V17.15 Website Demo → Shared Core NO SEND` → `V17.15 Preserve Website AI Reply as Last Node`. New terminal node retrieves exact `Format demo reply.output` and returns the original `{output}`. No unchanged original node definitions were modified, and n8n diff verified **two added nodes, zero removed/modified original nodes, zero removed original edges**. Published safe version `c81929d4-ab55-4c24-8659-795842739e24`. **Positive real web chat UAT remains PENDING.**
- Caveat: Core shadow adds execution latency; sample throughput, replay and failure isolation under actual public chat are not yet verified.

## 4. Store authority, Zalo OA, site ownership: strictly separate release gates

- V17.14 verified real Messenger Page ID `2379295362359912` maps in Commerce Data Tables to `demo_tien404` **SANDBOX** Tenant, not a merchant-owned Store independently verified in the private Meta operator account.
- n8n catalog returns **sample-only** F-101, F-102; V17.9 native four-tab employee Commerce Sheet tab `SAN_PHAM` still contained header only in latest verification; no merchant-approved real product catalog. Supabase hosted currently lacks canonical `stores`, `store_memberships`, Store-qualified Products/Orders/Customers/etc RLS; two hosted synthetic QA Tenants cannot be a real Store source.
- Zalo **Bot** staging header-protected ingress does not establish merchant **Zalo OA App/OA authorization**, signed native OA callback, OA outbound send-policy, Store ownership or actual customer reply. New Zalo technical branch explicitly calls Core with unregistered account and cannot send.
- Public Website MARKETING bot is **not** a merchant Store website session issuer: no approved domain-to-Store mapping and no signed authenticated Store session. Its Core branch intentionally denies, does not read Store/Orders or change existing Website knowledge.
- No user credentials, Meta App Secret, Zalo bot token or private customer identifiers were recorded in this document.

## 5. Rollback and next validation

- Messenger: republish previous known-good `ff7a57d2-519a-4283-933c-37a854df92d2` if the `QA_CORE:` opt-in path affects legacy replies. Keep V17.13R signed shadow as preserved earlier baseline. Do **not** alter Meta subscriptions or callback URL.
- Core: after retiring Messenger pilot branch, republish `ddc3ce5b-365e-47e2-a06d-08daffceb9a8` if catalog-pilot regression occurs (manage caller allowlist according to live integrations).
- Zalo staging: republish `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e` if any webhook ACK/router regression occurs.
- Website marketing: republish `fcda12f3-35c6-473e-bc9d-2359ada3989c` if last-node response, cost or latency regressions are observed. This rollback was independently exercised once during this task.
- Bridge: leave internal and uncalled until native inbound; no public route and no sends. No Supabase, Google Sheets, provider credentials, callback or real order/stock data changed.
- **NEXT OWNER UAT:** send `QA_CORE: F-101` and `QA_CORE: F-102` to the existing connected Facebook Page from a QA chat account; then inspect new Messenger n8n execution for signed HMAC, Page→Demo Tenant, explicit Core output and **one** Meta send MID, while ensuring old Agent not executed for prefixed messages, no stock/order writes, and original non-prefixed conversations still work.
- **NEXT WEBSITE UAT:** one approved small public Website demo chat from a valid session; inspect existing answer, final response exact equality and new private Core deny. No real product advice from merchant Store yet.
- **NEXT ZALO UAT:** verify one real Bot Creator private message in staging (not OA), protected webhook, no-send ACK and Core DENY; OA merchant integration requires separate official OA installation and owner proof.

**Outcome:** `IMPLEMENTED_PUBLISHED_READONLY_MESSENGER_DEMO_CANARY` + `IMPLEMENTED_PUBLISHED_ZALO_BOT_AND_WEBSITE_TECH_SHADOW`; **`NO_GO_REAL_STORE_COMMERCIAL_CORE_ADVICE_OR_ORDER_STOCK`**. Real postdeployment positive inbound/send UAT pending.


## 6. Additional actual Messenger live regression — legacy DEMO remains a writer

Post-publication `Z7FdV7uDvApfbURQ` real signed POST executions (native HMAC verified):
- **#4503 SUCCESS**: `V17.15 Route QA_CORE Only?` false branch → existing `Messenger AI Agent` → exactly one `Send Messenger Reply` with accepted Meta message ID. **No V17.15 Core pilot** executed for this ordinary non-prefixed customer chat. This independently supports existing reply path continuity.
- **#4493 SUCCESS** included an invocation of legacy `create_order` tool but returned a rejection (no successful order ID).
- **#4498 SUCCESS** included an invocation of the SAME existing legacy `create_order` tool with **`action=created`** and an order identifier (which is deliberately omitted here). This tool is bound to **`KrSn4DNR9ALX5ng4` Create Order Tool (AI_SALES_DEMO)**, NOT to central Commerce Core.
- **IMPORTANT SECURITY/RELEASE QUALIFICATION:** `NO NEW COMMERCE WRITES` and `NEW QA_CORE PILOT IS READ-ONLY` are proven, but **the full Messenger Page is NOT globally write-disabled** because its original DEMO AI Agent still exposes legacy create/update/manage order tools. Do **not** market the Page as commercial read-only globally. Do not silently remove longstanding DEMO tools without scoped owner approval; if Page-wide read-only is the desired new policy, explicitly isolate/disable legacy DEMO write tools and run a separate rollback-backed regression.
- No new real `QA_CORE:` customer message was observed in these executions. The first positive LIVE pilot reply UAT remains pending.
