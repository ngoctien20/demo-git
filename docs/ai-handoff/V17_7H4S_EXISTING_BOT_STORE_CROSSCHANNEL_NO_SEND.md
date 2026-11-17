# TIEN404 AI — V17.7H.4S Existing Zalo Bot Identity × Trusted Store Authority × Cross-Channel No-Send Admission

Checkpoint: 2026-11-18 JST.
Status: VERIFIED HOSTED READ-ONLY / IMPLEMENTED SOURCE-ONLY / REAL CROSS-CHANNEL COMMERCE NO-GO.

## 1. Lineage and reuse

- Direct parent: Draft PR #381 https://github.com/ngoctien20/demo-git/pull/381 pinned HEAD 66e3325e8a94ab6cbfc491023045b9ab2e8376c8. Its opt-in Windows Bot getMe/getWebhookInfo read-only operator code is already built; real operator use has not been independently verified. Do NOT duplicate or run it in this task.
- Historic Zalo evidence: Draft PR #373 https://github.com/ngoctien20/demo-git/pull/373 reconciles user's previous Bot Creator screenshots, TIEN404_TEST_08 accepted production-webhook QA marker and gateway getMe sanitized executions 3843,3854,3869,3875.
- Existing independent cross-channel PR #378 https://github.com/ngoctien20/demo-git/pull/378 keeps real same-Store JWT hosted no-go. Canonical schema/migration owner PR #247 https://github.com/ngoctien20/demo-git/pull/247, recovery #251, privileged RPC/security #246. No new competing schema migration in this PR.
- Messenger DEMO Tools/Products/Orders and existing Published workflows are preserved, not reused as Commerce multi-tenant database.

## 2. VERIFIED real connected evidence (metadata only)

Supabase staging ifxlvrhyjhbzbrkdsida:
- Public Commerce tables: products, orders, order_items, customers, conversations, messages. SIX RLS+FORCE RLS, six tenant_id, ZERO store_id. All six SELECT policies use tenant membership, not Store-level membership.
- Public stores, store_memberships and authenticated customer cross-channel identity links were not found. No accepted JWT Store A/B negative UAT.
- QA private map: 2 Tenants, MAX one Store per Tenant, ZERO QA tenants with same-Tenant Store A/B.
- tien404_r1_qa.shop_bots: two rows, BOTH identity_status synthetic_qa / enabled_mode dry_run. Both match QA tenant_identity_map.
- tien404_r1_qa.owner_bindings: two paired rows; QA pairing status alone is NOT an independently authenticated real Store Owner. Three owner pairing claims CONFIRMED and one pending; these are private QA workflow statuses, not hosted Store authority.
- Inspected private tables have RLS enabled (force_rls=false). This finding is not proof of a cross-store data leak; it BLOCKS claiming Store-scoped isolation.

n8n:
- TIEN404_R1_SHOP_BOT_REGISTRY_QA qLf19z9QjEaIHk00: 2 rows both synthetic_qa/dry_run.
- TIEN404_G05_QA_TRUSTED_INSTALLATION_REGISTRY_NO_SEND 3KfooDe1hXk3yN0r: 7 total, ALL qa_only with approval_scope QA_SYNTHETIC_NO_REAL_OWNER, including THREE active Messenger, ONE active Zalo Bot, ONE active Zalo OA, ONE active Website, ONE revoked Messenger. None is a real owner grant.
- TIEN404_V171C_QA_INSTALLATION_BOT_BINDINGS_NO_SEND cnSZ6hT7WCbNwGl5: three Messenger QA rows, owner_authority_verified false, including two QA_APPROVED and one REVOKED.
- Zalo private router sIPs6egzIwOY1GNv is Published and reads registry/allowlist. One allowlist row ALLOWED_STAGING_OWNER is not a native owner session proof.
- Zalo LAB yIJk8LvJoLF40Z62 is Published and has native header-auth webhook, no-send ACK, but ALSO two Data Table marker UPSERT nodes; cannot call it zero-write.
- Messenger TEST Z7FdV7uDvApfbURQ is Published with HTTP send reply and DEMO order tools; cannot safely invoke as absolute No-Send.
- Zalo/Website central-core shadow 4ycmVzaNzVRulBjQ and Messenger signed shadow dw1JOxWOEY8csTnm fail closed for unbound Store. Store/JWT reader p5OsIaB0NkMDFMw7 is inactive and its Auth QA is synthetic.
- Previously verified Gateway getMe execution outputs returned HTTP 200 and valid Bot Token, but bot_shop_binding_verified and owner_recipient_binding_verified were false. These historic real gateway receipts must be reused, not repeated.

Cloudflare:
- V17.7H inactive Worker tien404-v177h-provider-nosend-inactive-staging is preserved with 1 saved version, zero deployments, workers.dev/previews off and zero bindings. No public provider canary route.

## 3. Required real cross-channel authority chain (NOT ACTIVE)

Goal: one user asks Messenger to place an order, then asks Zalo Bot for its status; a DIFFERENT user or Store B must be denied.

A. Native ingress: independently verify Meta raw HMAC and exact Page OR Zalo Bot native header and exact Bot identity. Zalo OA is a SEPARATE OAuth channel; do not treat it as the created Bot.
B. Server-owned installation: from independently trusted registry resolve Page/Bot to canonical tenant_id, store_id, installation_id and real authorized owner/role. Do not trust customer-supplied tenant, Store, Bot Token, QR, phone or order code.
C. Customer link: Messenger PSID and Zalo user sender ID are two DIFFERENT people-identifiers. Link to ONE canonical customer in ONE Tenant and Store ONLY after explicit customer consent, trusted short-lived one-time challenge, durable replay prevention and revocation. Never link based on matching name, phone, screenshot or order number.
D. Order owner: resolve order via Store-scoped RLS and bound customer_id; tenant, Store, customer and exact order must ALL match. Provide status only, with no address/phone leakage. No service_role or BYPASSRLS shortcut.
E. Independent admission: before any real order read, approve signed external provider one-event canary, durable replay/rate, external edge denial, zero sends/writes verified from authoritative logs and real same-Tenant Store A/B JWT negative QA; then separately approve customer status UAT.

## 4. IMPLEMENTED in this source-only child

- qa/v17-7a-oa-independent/v17-7h4s-trusted-store-crosschannel-readonly.mjs: fail-closed authority metadata inspector and synthetic two-channel status-only customer-link fixture gate; no network, credential, DB client, real order read or permission-creating code. Even "all-green" caller metadata cannot authorize real access.
- qa/v17-7a-oa-independent/v17-7h4s-trusted-store-crosschannel-readonly.test.mjs: same-Tenant/Store/Customer fake QA fixture, extensive negative cases for cross-Store, cross-Tenant, wrong customer, wrong Bot/Page, expired and replayed consent, phone/order-code linking, payload store injection, missing no-send.
- qa/v17-7a-oa-independent/v17-7h4s-hosted-store-authority-metadata.sql: repeatable SELECT-only PostgreSQL metadata audit for six Commerce RLS tables, QA Bots, Tenant/Store fixture and owner pairing (no actual customer/order rows or identifiers).
- qa/v17-7a-oa-independent/v17-7h4s-grounded-hosted-authority-evidence.json: connected audit aggregates, real historic Zalo marker/gateway evidence, explicit no real owner/JWT/customer link approval.
- .github/workflows/v17-7h4s-existing-bot-store-crosschannel-nosend.yml: inherited A-H.4S QA and static no-side-effect + SQL read-only + evidence gates.
- This checkpoint.

## 5. GO/NO-GO, owner decisions, rollback

P1 Store: canonical six-surface Store ID, FK/index, membership/RLS review, authorized staging DB backup & restore, real same-Tenant Store A/B authenticated JWT negative test. Owned by PR #247/#251/#246; schema changes require separate owner approval.

P1 Provider owner: existing Bot UI and token gateway evidence do not establish independent Bot Creator admin rights. Use the already built private read-only option from PR #381 only with explicit scoped operator consent; never paste Bot Token or change current webhook.

P1 Customer identity: no real trusted customer Messenger ↔ Zalo link, one-time challenge, or order-owner proof. Store registry QA status ACTIVE/paired is insufficient.

P1 Hosted signed UAT: isolated callback, real native signed event, durable hosted replay/rate, operator authorization and independent zero-provider-send/zero-Commerce-write audit absent.

Current Release Decision: REAL_SAME_STORE_CUSTOMER_LINK_AND_CROSS_CHANNEL_NO_SEND_UAT_NO_GO.

VERIFIED: actual read-only Supabase/n8n/Cloudflare metadata and prior Zalo gateway evidence.
IMPLEMENTED: source-only Store/Customer/Order fail-closed gate, SQL read-only preflight, regression QA.
TESTED: only after exact final PR HEAD GitHub Actions passes. Green offline QA is not real UAT.
BLOCKED: owner authority, Store-scoped Auth/RLS, customer link, signed hosted one-event, real cross-channel status.
MUTATIONS: GitHub Draft PR only. No Supabase DDL/DML, n8n edits/executions, Cloudflare deployment, provider sends, actual customer data access, credential rotation or paid resources.
ROLLBACK: close child Draft PR; preserve parent #381 and other branches and all hosted resources.
NEXT: review canonical Store migration and owner/customer consent evidence, NOT another mock getMe or re-created Bot.

Checkpoint: V17_7H4S_REAL_CROSS_CHANNEL_NO_GO__READ_ONLY_AUDIT_AND_SOURCE_GUARD_TESTED_PENDING_CI.
