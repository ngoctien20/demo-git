# TIEN404 V16.8 — Merchant Setup Studio × Hybrid Integration × CSV/XLSX Preview × Store RLS Design

**Status (2026-11-16 JST): IMPLEMENTED SOURCE-ONLY / QA PENDING EXACT HEAD / NO SEND / NO PAID CALL / NO HOSTED WRITE / DRAFT PR.**
**Strategic direction:** One Shared AI Sales Core, merchant/version configs per Shop, gateway/owner verified identity, n8n Commerce orchestration only for required backend events. NO clone-per-Shop default.

## 1. Read-only audit: exact upstream and live systems
- Baseline PR #199: OPEN DRAFT, HEAD \`ecdc884fd90d5b7e2a23de6594dac8b0ff41eef3\`, child of V16.3 PR #194 and Hybrid V16 PR #190. This V16.8 branch is **stacked directly on PR #199**, no base branch rewrite or merge.
- V14.7 Custom Studio PR #117 remains separate Draft; do NOT merge divergent branches automatically. UI reuses its versioned Bot/Owner review concept while retaining the V16.7 actual mock Registry source; no second authorization core is added.
- n8n: 114 workflow previews in scope. Messenger \`Z7FdV7uDvApfbURQ\` Published \`d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92\` still includes Google Sheets and DEMO order tools; Zalo V1 staging \`yIJk8LvJoLF40Z62\` Published \`8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e\`. Tenant Resolver \`5Eeh8hbpsoNhuiVo\` Published \`a99c7350-7aea-446d-bdc5-4b10f52c3ad1\`, Catalog Query \`oOOXicKXGkBskKqh\` Published \`e0f1e345-8e6c-40cb-8e6a-d7ad2eb92696\`. Create Order DEMO \`KrSn4DNR9ALX5ng4\` Published \`4740251a-cd01-4f7f-b8e1-e300a8393151\` versus Draft \`af9ee686-2a9f-483e-9622-6e449500ac5e\`; do NOT connect new Shop orders to it.
- Supabase staging \`ifxlvrhyjhbzbrkdsida\` PG 17: public \`tenants/tenant_memberships/products/orders/customers\` exist, RLS enabled. NO \`stores\`, \`store_memberships\` or \`store_id\` in Products/Orders/Customers. Existing Products UNIQUE(tenant_id,sku) prevents same-tenant Shop A/Shop B using same SKU with distinct prices; existing policies check tenant_memberships, **not** same-tenant Store Membership. P0 no hosted independent Owner A/B proof; do not apply SQL.
- RPC advisor: anon EXECUTE of SECURITY DEFINER \`public.qa_shop_b_zalo_claim\`; authenticated EXECUTE of \`qa_owner_pairing\` and \`save_merchant_product\`; independent privilege review and caller inventory required, no automated REVOKE.
- Supabase reference docs: https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable .
- No production, Cloudflare account, n8n Published, Supabase, paid API or customer payload mutation in this PR.

## 2. Source-only new components
### Merchant Setup Studio: \`qa/v168-merchant/index.html\`, \`studio.css\`, \`studio-ui.mjs\`
- Vietnamese mobile-first local static HTML; \`connect-src 'none'\`, modules same-origin, no storage/cookies/network.
- Shop selector A/B same Tenant but different Store, C different Tenant.
- Shop A fixture has one granted TIEN404 support actor with draft privileges; a **separate Owner** may approve preview only. B/C have no cross-Shop staff grant; Owner self-approval forbidden.
- Bot profile fields: name, greeting, tone, business hours; drafts with optimistic version. Owner approval never promotes to Published. UI has no actual Auth/session/capability.
- "Tạo Shop" is a **proposal-only QA form**, returns WAIT_TRUSTED_ENROLLMENT, no tenant or store ID provisioning, no real PII.
- Five sections: Profile, Import, Runtime, Economy/Standard/Priority FinOps, Shop Proposal.
- All changes disappear on reload; no false real-tenant claims.

### File import: \`qa/v168-merchant/import-preview.mjs\`
- CSV UTF-8 with BOM, comma/semicolon/tab, escaped quotes, CRLF, local-only.
- XLSX preview **bounded subset only**: first worksheet, sharedStrings/inline text/numbers; max compressed file 2 MiB, total expanded ZIP 8 MiB, first worksheet XML 4 MiB, no formulas, macros, external links, encrypted workbook or arbitrary sheet mapping. Browser requires native DecompressionStream for deflate XLSX. **Not a production importer; not independently fuzzed.**
- QA-only required exact headers \`fixture_marker,sku,product_name,retail_price_vnd,wholesale_price_vnd,stock,unit\`, each row must have marker \`QA_V168_SYNTHETIC_ONLY\`. Arbitrary customer/PII columns rejected. VND amounts are integer digits only (no implicit parse of \`159.000\`), rejects negative stock, overlarge stock, duplicate SKU within batch, spreadsheet formula prefixes and wholesale price > retail.
- Preview only: CREATE/UPDATE difference vs selected Shop's verified mock catalog. No auto delete for missing rows, no silent price/stock write, no persistence, no real file upload to server. An actual merchant data import will require separately approved private object storage, MIME/AV, job transactions, Owner diff approval, durable rollback and version check.
- CSV template is QA synthetic only. Do NOT ask merchant to upload actual personal data or real catalog via this public/source-only studio.

### Hybrid / Studio Integration: \`qa/v168-merchant/integration.mjs\`
- Imports and calls **real source modules**: \`handleQaFetch\`, \`signQaHmac\`, \`handleQaBatch\` from \`qa/v16-hybrid/hybrid-core.mjs\`; \`createSyntheticMerchantRuntime\` from \`qa/v167-merchant/merchant-registry.mjs\`; FAQ/Queue UI contract + Cost Center/Handoff from V16.3 modules.
- Runs a local QA HMAC-signed event through the actual V16.1 synthetic gateway, mock Store channel registry/outbox/queue, maps its result to V16.7 Registry's fixed synthetic provider account mapping, calls \`route\`/read-only \`workflowEnvelope\`, then mock queue receipt. **No external fetch** and no genuine provider signature or real identity attestation.
- Same SKU \`SAME01\` produces Shop A price 159000, Shop B 209000, Shop C 259000 in synthetic ONLY; order request returns COMMERCE_BLOCKED. No model calls or n8n executions.
- Existing V16.3 Cost Center/Handoff are imported/reused as memory-only modules; NOT wired to a real billing/provider system. 132-case model A/B actual outputs remain NOT_RUN without paid authorization.

### Migration/RLS plan
- \`docs/ai-handoff/V16_8_STORE_JWT_RLS_MIGRATION_DO_NOT_APPLY.sql\` is **100% comments, 0 executable SQL**.
- Explicit six-stage plan: independent review/backup, schema expansion, mapping proof, composite FKs/SKU uniqueness changes, server JWT/Store RLS cutover, same-Tenant Store A/B negative testing and reversible canary.
- Do NOT infer all Tenant rows belong to one Store. Existing ORDER customer FK \`(tenant_id,customer_id)\` must be replaced carefully by \`(tenant_id,store_id,customer_id)\` constraints only after data mapping.
- Do NOT apply/revoke on staging/production without a reviewed migration generated through approved change workflow and proof of encrypted backup/restore.
- Current real RLS policies SELECT only for tenant-members; no Store policies. Need independent authenticated JWT testing with Owner A/B/C, not SQL Editor postgres.

## 3. Economy–Priority FinOps and scale
\`planCosts\` is an interactive **hypothetical** simulator, not price quote/measurement. Inputs: Shop count 1/5/20/50/100/500, messages/Shop, fraction requiring model, fraction invoking n8n, standard token assumptions (3,000 input+300 output; prices caller supplied). Outputs show total messages, AI calls, estimated n8n orchestration invocations and API model USD only, clone workflow counts. It lists omitted fixed and variable costs.

Baseline assumption: 1,000 messages/Shop/month, 30% model turns, 10% one n8n invocation each, input $0.10 / million and output $0.50 / million, no retries:
| Shops | Messages | Model turns | n8n invocation candidates | AI USD hypothetical |
|---:|---:|---:|---:|---:|
| 1 | 1000 | 300 | 100 | 0.135 |
| 5 | 5000 | 1500 | 500 | 0.675 |
| 20 | 20000 | 6000 | 2000 | 2.700 |
| 50 | 50000 | 15000 | 5000 | 6.750 |
| 100 | 100000 | 30000 | 10000 | 13.500 |
| 500 | 500000 | 150000 | 50000 | 67.500 |

**These are illustrative input prices only**; actual model/provider cost, n8n billable subworkflow rules, concurrency, Cloudflare/Queue/DO/DB, support, taxes, SLA and licensing not proven. Reusing one shared n8n workflow alone does not reduce execution count if the same number of events run. Only legitimately bypassing n8n for Fast FAQ/Catalog can lower volume.

Proposed synthetic quota weights: Economy 5 events/min, 1 in-flight AI; Standard 15 and 2; Priority 30 and 5. Real fair concurrency, durable budget reservation and per-Store hard cap **NOT DEPLOYED**; require transactionally enforced server state and real capacity measurements.

## 4. Acceptance / QA
Source-only Node test \`qa/v168-merchant/v168-merchant.test.mjs\` checks CSV/XLSX parse (including hostile cases), synthetic gateway→registry→queued preview, same-tenant two-Store prices, no Commerce send, cost 1–500 Shop, nonexecuting SQL and CSP. Playwright \`browser.test.cjs\` tests local Chromium 320/390/768/1280 including Shop switching, signed synthetic quote, blocked order, Owner preview, file safety and FinOps, ensuring no outbound requests. CI also reruns existing V16.7 (65), Hybrid (42), V16.3 Studios (75).

**CI MUST be checked on exact PR HEAD and run logs.** Local QA tests, even with Chrome, are not independent human security review nor hosted Shop JWT-RLS certification. Any Playwright failure is a blocker requiring fix and rerun.

## 5. Security/Commercial NO-GO
P0: real Store schema/Owner JWT-RLS same-tenant isolation, backup+restore, three privileged RPC per-caller authority, n8n SaaS license written permission, provider Page/OA ownership, precise consent/PII governance, transactional order writer and no dual writers. No production sends/model API or hosted DB allowed.

## 6. Rollback
Close V16.8 Draft PR (or revert only new \`qa/v168-merchant/**\` + V16.8 docs/CI). No hosted revert needed because no hosted data, queue, credential, production route or n8n Published was changed. PR #199, #194, #190, #117, #186 remain unmerged and untouched.

**Next proposed:** V16.9 — independent browser/QA evidence of staff workflows, private file onboarding with authentic Owner only AFTER verified Store/RLS, no-send provider adapter contracts; do not promote Merchant Studio before independent security and legal gates.
