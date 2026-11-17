# TIEN404 AI — V17.7B Unified Channels × Trusted Store Isolation
Date: 2026-11-17 JST. Stage: IMPLEMENTED SOURCE-ONLY; REAL UAT NO-GO.

Parent V17.7A: Draft PR #317 HEAD 0208fff09405f6c78ab9d63db77a2194ca2d5701 (92/92 offline tests, CI 2/2).
This checkpoint is an independent child Draft PR. Previous Zalo OA #300/#305/#309 Draft remains unchanged. No hosted deployment / no production workflow updates / no credential change / no Zalo OAuth / no provider send / no customer data access / no Commerce writes / no cost incurred.

## Real read-only n8n state audit

| Lane | Channel/role | Workflow | n8n state | Release evidence |
|---|---|---|---|---|
| Customer ingress | ZALO_BOT | yIJk8LvJoLF40Z62 | ACTIVE (published) | protected POST bot webhook, QA markers upsert and shared no-send Core shadow. No recent real provider signed UAT observed in the limited execution metadata read |
| Customer ingress | MESSENGER | Z7FdV7uDvApfbURQ | ACTIVE (published) | Messenger TEST 32 nodes, includes HMAC step and HTTP reply send node. Execution metadata shows webhook successes but not independent Page->Store ownership and send/no-send result for each test |
| Customer ingress | WEBSITE | wgkkmT7q4lm4HyuA | ACTIVE (published) | DEMO/MARKETING QA ISOLATED. Does not prove signed real customer session + production Commerce |
| Core staging | ZALO + WEBSITE shadow | 4ycmVzaNzVRulBjQ | ACTIVE | shared Commerce core no-send, intentionally denies unbound Store |
| Core staging | Messenger signed shadow | dw1JOxWOEY8csTnm | ACTIVE | intentionally denies unbound/unauthorized operations |
| Core staging | Commerce Agent Sandbox | iyfGUiEsZlNTBWOR | ACTIVE | sandbox, not live Store A/B Commerce writer |
| Customer ingress | ZALO_OA | no real OA; PR #317 source | BLOCKED REAL | OA OpenAPI 92/92 offline, no OAuth token, native signed callback/getoa |
| Owner notifications | TELEGRAM | spk9Cs62YidlQ1vu | INACTIVE | AI_SALES_DEMO V4.5 notification dispatcher (cannot copy creds/data to Commerce) |
| Owner notifications | GMAIL | Zswbbml4W1WkkxYe | INACTIVE | AI_SALES_DEMO V4.5 notification dispatcher (cannot copy creds/data to Commerce) |
| Future | LINE | no relevant independently verified active adapter | PROPOSED | do not assume availability |

Note: ACTIVE is a workflow deployment flag, NOT proof of successful end-to-end customer message exchange, independently verified provider ownership, proper tenant isolation or production availability.

## Trust boundaries

1. Dedicated provider ingress per sales channel. ZALO_BOT token header != ZALO_OA native MAC != Messenger raw-body HMAC != Website session assertion. Do not transpose one proof to another.
2. Private server-owned installation registry resolves *channel + installationRef* to tenant/store/bot/policy versions. Customer/provider event payload is never authoritative for tenant, store, SKU, price, stock or owner role.
3. Server-side identity is scoped to channel+installation+Tenant+Store+providerActor. Same identifier on a different channel or Store does not prove the same person. Explicit customer account linking is a separate consent and verification process.
4. Trusted Commerce Catalog Reader receives a validated installed-store context, returns data restricted by Store RLS. Source-only synthetic QA cannot authorize real reads; hosted real Supabase Auth JWT and same-Tenant Store A/B negative tests still required.
5. AI Commerce Core produces a proposed answer; an independent outbound policy decides if provider reply can be sent. NO-SEND until provider-owned page/OA/bot, sender scope, idempotency and delivery evidence are approved.
6. Telegram/Gmail are OWNER_NOTIFICATION, not customer ingress. Trigger only from durable, saved Commerce order events; DEMO V4.5 staging credentials and Orders/Products must remain isolated and NOT be copied into Commerce.
7. Zalo OA never falls back to Zalo Bot; waiting for a legitimate OA OAuth grant does not block existing independent ingress.

## New V17.7B source-only files

- qa/v17-7a-oa-independent/unified-channel-registry-offline.mjs
  * separate SALES vs OWNER_NOTIFICATION directories; ZALO_OA gated.
  * reject event-supplied authority and provider receipt injection; exact provider-specific proof shape.
  * require read-only synthetic installation with server registry owner binding and bot/policy version.
  * create store+tenant+channel scoped synthetic conversation digest (never raw identity in output).
  * test-double replay reserve fail-closed and deliberately deny ALL hosted provider/Commerce effects.
  * owner notification preview only for synthetic saved order, no DEMO credential reuse, no actual send.
- qa/v17-7a-oa-independent/unified-channel-registry-offline.test.mjs
  * positive offline fixtures for three ingress channels and two owner notifications; adversarial cases for Store injection, cross-store/cross-channel identity mixing, replay, wrong proof, unsolicited customer->notification promotion, DEMO credential reuse.
- .github/workflows/v17-7b-unified-channels-no-send.yml
  * inherited V17.7A OpenAPI QA + new channel tests, syntax checks and independent no-network/no-send/Commerce guard.

No published workflow was edited, created, or executed. This is a pure offline comparison against read-only inventories and baseline historic QA.

## Acceptance matrix and next UAT gates

A. Zalo Bot: QA-only user sends a labeled test message; independently capture original provider update receipt, webhook auth, correct bot installation/store, no-send shadow and no order write. Do not use customer data; require owner consent before any actual provider send.
B. Messenger: QA dedicated Page owner authenticates Page -> exact Store, verify real native HMAC over raw bytes, sender recipient, status-only or one-shot approved reply. Existing published TEST send node means no blind execution.
C. Website: verify real authenticated website session / signed application context, separate shop page across same Tenant; no cross-store product leaks; pause mode; no full production commerce approval.
D. Commerce Store A/B: two real Supabase Auth sessions from stores sharing one Tenant, signed trusted reader, RLS and negative cross-store reads, real ownership evidence, independent reviewer. Existing QA tenant_identity_map aggregate had max one Store per Tenant at the earlier read-only checkpoint; synthetic stores do not satisfy UAT.
E. Zalo OA: keep PR #317 offline verified 92/92; when legitimate OAuth grant exists do read-only getoa and native webhook no-send; token vault and one-time refresh verified; never substitute Zalo Bot header.
F. Merchant notifications: create isolated Commerce outbox only after separate approval, no DEMO credential reuse, delivery retries/dedup and supported channels; no order/customer data until approved.
G. Independent security: signed immutable installation binding, durable replay/rate limits, least-privilege operator, no prompt injection to action tools, audit receipts/rollback and no surprise subscriptions.

## Outcome

- VERIFIED: channel workflow names, IDs, active flags, limited execution metadata and NO-SEND branches; original PR #317 still Draft.
- IMPLEMENTED: source-only unified-channel registry, negative QA, CI.
- TESTED: only when new GitHub Actions at exact child HEAD returns SUCCESS.
- BLOCKED: real provider-signed ingress for each channel, merchant authority, same-Tenant Store A/B JWT/RLS, Commerce reads/writes, live sends, OA OAuth, durable hosted notification outbox.
- ROLLBACK: close child Draft PR. No hosted state changed.
