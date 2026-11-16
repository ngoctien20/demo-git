# TIEN404 CBOT-UAT-01 — Cross-Channel Commerce Acceptance Checkpoint
Date: 2026-11-16 (JST) | Mode: SOURCE ONLY / NO SEND / NO HOSTED WRITE
Base: V16.7 Draft PR #199 HEAD ecdc884fd90d5b7e2a23de6594dac8b0ff41eef3
Branch: work/cbot-uat01-crosschannel-nosend-20261116
Release decision: NO-GO for cross-channel hosted ordering and order lookup.

## Evidence read directly (G0)
- n8n Messenger: Z7FdV7uDvApfbURQ active, 27 nodes, still invokes AI_SALES_DEMO Google Sheets order tools; NOT tenant/store-native Commerce.
- n8n Zalo ingress: yIJk8LvJoLF40Z62 active; protected, READ_ONLY; no outgoing Zalo messaging or Orders writes; synthetic Shop B route to sIPs6egzIwOY1GNv.
- n8n Order Status: 4DFFCk60exrzaIl6 active; resolves AI_SALES_DEMO Google Sheets Orders by order_id + phone. This is not the Commerce hosted cross-channel lookup API.
- Supabase staging: ifxlvrhyjhbzbrkdsida ACTIVE_HEALTHY. Public orders/products/customers have tenant_id but no store_id; public stores/store_memberships absent. Public RPC qa_shop_b_zalo_claim is SECURITY DEFINER callable by anon; security advisor warning.
- Independent existing Draft V14.7 Custom Bot Studio PR #118, V16.3B Browser QA PR #197, V16.7 Merchant Registry PR #199 remain unmerged at time of audit.
- V16.7 PR #199 HEAD ecdc884fd90d5b7e2a23de6594dac8b0ff41eef3 GitHub CI run 43847923128 completed SUCCESS; source-only contract.
- Real Meta/Zalo OA authority evidence and account binding must be separately verified, not inferred from workflow active state.

## Actual QA executions (new, 2026-11-16)
- Catalog / Cart 17/17 PASSED: workflow ZVmMlwe2g0bPjVEq, execution #4044, Assert Catalog QA 7/7; Assert Cart QA 10/10.
- Business Core 22/22 PASSED: workflow tjsVobfjKLnv0o6b, execution #4045, Assert V3 Business Results 22/22.
- Extension 25/25 PASSED: workflow QR7aYMpLfKDLVgyH, execution #4054, Assert V3 QA 25/25.
- All three are manual sandbox/read-only logic suites; they cannot prove any real Messenger to Zalo order persistence, receipt, or identity correlation.
- Dedicated CBOT-UAT01 22 source-only readiness assertions in qa/v167-merchant/cbot-uat01-readiness.test.mjs, run via GitHub Actions. Record actual CI run URL and result separately before calling these TESTED.

## Six E2E acceptance gates (not conflated with synthetic passes)
| Test | Hosted status | Missing required evidence |
|---|---|---|
| XCH-01 Messenger QA creates persisted Commerce order | BLOCKED | secure trusted store identity + hosted QA writer + durable receipt |
| XCH-02 Zalo OA authorized lookup of same order | BLOCKED | OA ownership + verified channel-to-store binding + read-only authorized lookup API |
| XCH-03 PSID to Zalo user identity link | BLOCKED | one-time proof with replay / expiry / revocation; independently audited |
| XCH-04 Messenger follow-up reads same authorized order | BLOCKED | unified customer identity and store-aware order read |
| XCH-05 Zalo order update | BLOCKED | verified identity, expected_total, checkout + store-scoped atomic writer |
| XCH-06 cross-store denial on hosted Supabase | BLOCKED | same-tenant two-store Owner JWT RLS and privileged RPC remediation evidence |

## Security gates
- Public SECURITY DEFINER RPC cannot be treated as safe from linter warning alone; investigate actual caller before any GRANT/REVOKE. No DB permissions changed in this checkpoint.
- Exact same-tenant Store separation cannot be proven on hosted RLS until store_id, ownership and store membership policy are safely migrated and independently verified after backup/recovery acceptance.
- Never treat order code alone as authorization. Do not infer PSID=Zalo ID or phone ownership.
- Preserve AI_SALES_DEMO Orders/Products and credentials in a separate boundary; do not point commercial Commerce at them.
- Live provider sends, hosted writes, paid model requests and production merge remain forbidden here.

## Recommended staged path
1. Complete private native Meta Page and Zalo OA ownership proof, permitted message scopes and provider channel mapping.
2. Resolve privileged RPC caller inventory + backup/restore and independently approve Store schema migration.
3. Implement audited channel-specific trusted gateway, per-Store tokenized identity binding, and secure read-only order lookup in an isolated environment; record IDs but no secrets.
4. Prove Shop A/B same-tenant separation under real Owner JWT, wrong owner, wrong provider account, unlinked guest, expired/replayed challenge.
5. After separate authorization for QA writes, make ONE synthetic Commerce order through the permitted QA channel, persist durable order receipt, perform authorized Zalo read-only lookup and compare total/status against DB. Only then attempt modification.
6. Human Owner UAT and release review after independent hosted evidence.

## Rollback / checkpoint
Source-only branch may be closed without changing V16.7 PR #199, any n8n published workflow, Supabase hosted rows or grants, or real customer data.
No credentials, customer PII, or tokens are included in the code or report.
