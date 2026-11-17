# TIEN404 AI — V17.7E: Private Store Owner Authority and Inactive Hosted Manual QA

Date: 2026-11-17 JST. Status: VERIFIED HOSTED MANUAL QA 12/12; REAL PROVIDER & STORE JWT UAT NO-GO.

## Lineage and isolation

Parent Draft PR #330 SHA 73d2ca410158af25ae1d9e278709d91b607efc55. Its ancestor PRs #326, #321, #317 remain Draft.
Canonical Store migration/testing is still PR #247, RPC security reviewer PR #246, Products/Recovery PR #251, Zalo OA private admission PR #309. No competing Store/RLS migration created in this branch.
Do not reuse AI_SALES_DEMO Orders/Products, credential or channel metadata as commercial Commerce data.

## VERIFIED: newly created n8n-hosted manual QA

Workflow: TIEN404_V177E_MANUAL_CHANNEL_STORE_QA_INACTIVE_NO_SEND
URL: https://ngoctien20.app.n8n.cloud/workflow/MQcbjLWZ5QUTJW0k
ID: MQcbjLWZ5QUTJW0k
Workflow version: b8aaf94c-def1-472c-bd92-fccea1d946b8
Target: existing n8n Personal project, folder 90_QA - DIAGNOSTICS.
Confirmed Inactive with no published version. Only 2 connected nodes:
  Manual QA Gate (manualTrigger) -> Offline Store Channel Gate No Send (Code)
There are zero webhook, HTTP Request, database, model or provider send nodes, and no assigned credential.

The new workflow was manually run ONCE, execution 5026, status SUCCESS.
Connector readback of Code output: status QA_PASS; total 12, passed 12, failed 0.
Cases are hardcoded SYNTHETIC: Zalo Bot, Messenger, Website as shadow-only; NO-OA owner, missing Store, wrong provider proof type, client Tenant/Store spoofing, send attempt, order write attempt, replay and Telegram-as-chat all denied.
Execution output records actualProviderEvents=0, outboundMessages=0, commerceReads=0, commerceWrites=0, ordersWritten=0, stockWritten=0, modelCalls=0; realProviderSignatureVerified=false, realStoreOwnerVerified=false, realJwtRlsVerified=false, canPublish=false.
The tested workflow shape and static code support the absence of network/send/write operations in THIS workflow; output booleans alone are not independently verified external delivery logs.

This is REAL HOSTED MANUAL EXECUTION of SYNTHETIC fixtures, NOT a real native Meta/Zalo/Website webhook, NOT real merchant owner proof, and NOT hosted Store JWT/RLS evidence.

## VERIFIED: read-only Supabase staging metadata

Project ifxlvrhyjhbzbrkdsida PG17.11 ACTIVE_HEALTHY. Six public Commerce tables Products/Orders/OrderItems/Customers/Conversations/Messages have RLS and FORCE RLS but NO store_id, and prior policy audit found only Tenant-wide SELECT policies. Public canonical stores/store_memberships absent. QA tenant_identity_map has 2 Tenants, max 1 Store per Tenant, zero same-Tenant Store A/B. Three active Tenant memberships across 2 Tenants cannot prove original Store ownership.
Private QA tables owner_bindings, owner_pairing_claims_v3, shop_bots, tenant_identity_map, auth_customer_binding and channel_identity have Store-related fields but are NOT automatically authoritative for real merchant ownership.
No production customer/order row data, auth JWT, provider token or Merchant PII was read.

## SOURCE IMPLEMENTED in current V17.7E child

- qa/v17-7a-oa-independent/v17-7e-owner-private-manual-canary-offline.mjs
  Pure offline gate requiring exact four original Store row aliases T1_PRODUCT_1, T1_ORDER_1, T2_PRODUCT_1, T2_ORDER_1. Checks redacted SHA digests, owner/reviewer separation, freshness and scope; never authenticates actual people from JSON. It separately checks shape of exact inactive n8n manual QA workflow/receipt and returns REAL HOSTED NO-GO on self-reported all-green proof.
- qa/v17-7a-oa-independent/v17-7e-owner-private-manual-canary-offline.test.mjs
  Negative tests of source gaps, identity-reuse, PII injection, expired proof, unauthorized published webhook activation, provider sends, fake JWT and release claims.
- qa/v17-7a-oa-independent/v17-7e-hosted-manual-no-send-redacted-evidence.json
  Redacted actual workflow ID/version, 2-node graph and n8n execution 5026 result.
- .github/workflows/v17-7e-private-owner-manual-canary-nosend.yml
  Full inherited V17.7A/B/C/D tests and V17.7E safety regressions. CI exact-head result must be inspected before calling CI TESTED.

## Required private REAL UAT plan, NOT EXECUTED

G0: real merchant and independent reviewer must attest exactly four original Product/Order record→Store claims through private authenticated service and compare original underlying source, effective Store membership and legal consent. Never share JWT, source records, tokens, merchant PII, secrets or raw webhook data in public GitHub or chat. Offline hashes are not cryptographic authentication.

M0: approve the actual hosted recovery/restore scope under #247/#251 including Auth, Storage and cross-service integrations, no repeat of previously deferred local backup ceremony. Test isolated restore first.

G1/M1/M3/M2M4: use existing disposable PG17 migration plan in #247 ONLY. Explicitly approve scoped staging Store schema, composite FK, caller compatibility, atomic replacement of legacy permissive Tenant SELECT policies and rollback.

G3: independently obtain two real Supabase Auth JWT sessions for Store A/B of SAME Tenant; prove own-Store access allowed and cross-Store access denied across six Commerce surfaces and privileged RPCs; audit hosted DB and session source. Synthetic tests do not count.

Real provider NO-SEND canary: dedicated QA owner authorizes a Zalo Bot or Meta QA Page and operator; separately approve a private isolated signed ingress + Access/Worker deploy, secured credentials, native raw-body HMAC/header verification, durable replay guard and outbound/write hard lock. One real test event only with consent, then independently audit zero sends, orders and stock changes. Existing Messenger TEST has a HTTP send node; existing Zalo Bot upserts QA markers, so neither is an automatic absolute no-send/no-write canary.

Zalo OA is deferred until valid OA Admin OAuth, native signed webhook and getoa profile readback. Bot token is not OA authorization.

## Security and operational declaration

- VERIFIED: actual new n8n manual-only workflow created inactive and manually executed 12/12, actual read-only staging Supabase metadata.
- IMPLEMENTED: redacted evidence, private owner intake source gate, manual QA evidence gate, CI, documentation.
- TESTED: n8n manual 12/12; GitHub CI only after exact HEAD success.
- BLOCKED: real four-row owner proof, M0 recovery, current Store SQL cutover, same-Tenant real JWT UAT, native Meta/Zalo real provider canary, independent edge denial, Zalo OA OAuth.
- NEEDS APPROVAL: any real private evidence intake using Merchant information, new Cloudflare/Access/Webhook provision, actual user QA message, schema/privileges or new costs.
- ROLLBACK: GitHub source change can be abandoned by closing Draft PR. The new n8n workflow remains Inactive and should NOT be deleted without separate approval and preserving execution 5026; no other workflows modified.

Suggested next phase: V17.7F Private Merchant Evidence Consent × Dedicated Inactive Signed Provider Canary Approval.
