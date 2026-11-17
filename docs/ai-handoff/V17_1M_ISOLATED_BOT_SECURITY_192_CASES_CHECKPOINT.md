# TIEN404 AI — V17.1M Isolated Bot Security Staging and Store A/B 192-Case Acceptance

Date: 2026-11-17 JST.
Parent: V17.1L Draft PR #274, source HEAD 5a9afe239a57b41fc90d25289bf4e7b158def2b2.
Lifecycle before GitHub CI: IMPLEMENTED on isolated n8n QA / MANUAL SYNTHETIC TESTED / REAL LIVE HOSTED NO-GO.

## 1. Read-only live audit and change control

- Messenger TEST workflow Z7FdV7uDvApfbURQ remains Active/Published. Last inspected version 2b869035-fe39-46fb-a253-18fefe4ecbfd, 32 nodes including V17.15 routing, AI_SALES_DEMO order tools and Messenger Send Reply. No edits or executions to live Messenger were made during V17.1M.
- Parent V17.1L PR #274 was OPEN DRAFT at commit 5a9afe239a57b41fc90d25289bf4e7b158def2b2. No merge.
- n8n user preferences checked: keep AI_SALES_DEMO separate from Commerce Products/Orders and credentials; do not disrupt Published workflows.
- Personal project ID WW82YsCCaAxGC9dp; folder 90_QA - DIAGNOSTICS ID d3ZVrZ9cNiW2SJ1q was resolved and selected.

## 2. New isolated n8n workflow (verified)

Workflow URL: https://ngoctien20.app.n8n.cloud/workflow/dtyaL3RnuNQQwpMX
Workflow ID: dtyaL3RnuNQQwpMX
Workflow name: TIEN404_V171M_ISOLATED_BOT_SECURITY_STAGING_MANUAL_ONLY_NO_SEND
Latest accepted workflow version: 01fad246-5e17-4b58-a43a-63b4376d0296
Active: false. Active/published version: null.
Graph: exactly four nodes, Manual Trigger plus three Code nodes.
No credentials, no HTTP Request, no AI model, no Agent tool, no Data Table, no DB, no Google Sheets, no Commerce order tools, no Messenger or Zalo reply node.
Settings: callerPolicy none (cannot be invoked by another workflow); execution timeout 60 seconds.

This is deliberately a **simulated security admission workflow**, not a working clone of Messenger, native signed-provider ingress or a production Commerce tool gateway.

## 3. Actual manual QA execution history (n8n)

- Execution 4552: ERROR, 169/171 fixture matches. Cause confirmed: 2 cross-channel replay cases used the wrong initial event index in synthetic fixture generator (56 instead of 57 cases per channel). A non-replayed event was correctly admitted as a synthetic read-only plan, so the test expected result was wrong. No customer read/send, order or external API operation.
- QA generator corrected by updating only the new inactive workflow. Workflow version 995b5e83-7baa-417c-a2b4-9c86c74b3782.
- Execution 4553: SUCCESS with 171/171 synthetic tests; 156 denied, 12 simulated read plans, 3 proposal plans.
- Added trusted synthetic registry entries for Store B per channel. Both Store A and Store B share TENANT_A but have separately keyed Page/OA/site installation, SKU, order ID, customer grant, and unit prices (A 159000 VND; B 189000 VND). These are QA fixtures, NOT real store records.
- Final isolated workflow version 01fad246-5e17-4b58-a43a-63b4376d0296.
- Execution **4554 SUCCESS**, 192/192 cases passed, including 168 DENY, 18 SIMULATED_READ_ONLY, 6 SIMULATED_PROPOSAL; no assertion failure.

The 192 tests cover impersonated Page/OA/Store, fake auth claims, replay, echo and rate denial, fake admin/recipient, forbidden order/send/admin/API actions, cross-Store SKU and Order IDOR in both directions for the same Tenant, valid A and B read-only routes, wrong B quote based on A price, missing challenge and customer confirmation, image/catalog/RAG/website/tool-output prompt injection, oversized input and prohibited URL fetch.

Output flags: realPageOaOwnerVerified=false, realStoreJwtRlsVerified=false, liveReleaseAllowed=false, actualCustomerOrderReads=0, actualBotModelCalls=0, actualCustomerReplies=0, actualOrderWrites=0, actualStockWrites=0, actualPriceWrites=0, actualExternalHttpRequests=0, actualDataTableWrites=0, hostedStatus=HOSTED_NO_GO.

## 4. Versioned source and regression

- qa/v171m-bot-security/v171m-n8n-qa-snapshot.json contains only the synthetic Code node source and exact tested n8n workflow version, no Page secret, provider credential or PII.
- qa/v171m-bot-security/v171m-snapshot.test.cjs runs the same synthetic scripts with Node VM and applies additional adversarial mutations. This tests the captured code, not a new live n8n workflow release.
- Expected GitHub source QA: 48 new V17.1M tests + 582 inherited V17.1L through V17.1D = 630. Count PASS only when Actions logs confirm.
- CI release gate deliberately red for missing real provider/hosted Store/OrderAccessGrant.

## 5. Mandatory outstanding P0 controls

1. Verify genuine Meta Page and Zalo OA ownership and native signed webhook callbacks in an isolated authorized QA integration. A synthetic signature marker is NOT provider proof.
2. Test real PostgreSQL 17 / Supabase hosted JWT and Store RLS with independent Store A and Store B QA identities, including same-Tenant cross-Store attempts. This milestone only tests strings representing two shops.
3. Bind an independently enforced tool-authorization gateway to the actual Bot tool actions. Do not let untrusted messages/LLM/Media grant create/update/cancel/send or read other customer orders.
4. Prove durable atomic replay, rate/cost limits, customer challenge and OrderAccessGrant, order quote/stock version and idempotency through hosted authorized QA.
5. Complete V17.1K-S1 hosted malicious image sandbox, external AV, private storage and Staff MFA before allowing arbitrary merchant uploads.
6. Reconcile current Messenger V17.15 Published graph/owner and back up exact version before ANY proposed live cutover or modifying core bot.
7. No real customer data, credentials, external model, Meta/Zalo message, n8n Published change or production Commerce write was used.

## 6. Rollback

GitHub: close V17.1M Draft child PR; parent PR #274 unchanged.
n8n: new QA workflow is already INACTIVE and cannot be invoked by another workflow. Leave it disabled; any archival requires separate explicit approval. Only harmless QA execution history was added, no hosted data restore needed.

Status: V17.1M INACTIVE QA IMPLEMENTED / 192-CASE HOSTED SYNTHETIC TESTED / REAL PROVIDER AND RLS NO-GO.


## 7. VERIFIED source CI and hosted security gate (2026-11-17 JST)

- Tested implementation HEAD: ec128152dc332e1a302435ed652870dcdb7f8e41.
- GitHub Actions run: https://github.com/ngoctien20/demo-git/actions/runs/44021021637.
- Source job 133830275303 SUCCESS: exact n8n snapshot replay/Store A B/adversarial mutation Node tests **48/48 PASS**; inherited V17.1L through V17.1D **582/582 PASS**; total **630/630 OFFLINE PASS**, static code guard found no runtime network/credential/model/DB/send facilities in isolated QA source.
- Initial CI at previous commit 78360d5de7b077cc5e7b744eeb53a47164d30d27 failed one test (47/48) only because test case #10 counted the deliberately forged THIRD installation alongside the two registered A/B test installations. Test corrected to count registered QA-prefixed installations and independently assert that the forged installation is DENIED; no weakening of security evaluator. Retested 48/48 PASS.
- Hosted admission job 133830425600 FAILURE **by design**, overall run shows FAILURE. This is expected safety policy: real native providers, real Store JWT/RLS and order/customer identity still NO-GO.
- n8n hosted manual execution 4554 and workflow version 01fad246-5e17-4b58-a43a-63b4376d0296 reverified after CI: Inactive, 4 nodes with manual trigger and pure Code, no credential; 192/192 QA cases, no actual IO.
- No production Messenger, Zalo, Commerce, Supabase or user data was changed.

## 8. Additional VERIFIED Supabase staging read-only authorization metadata audit

Connected staging project: tien404-staging, ref ifxlvrhyjhbzbrkdsida, PostgreSQL 17, ACTIVE_HEALTHY. This was a read-only metadata audit, not a JWT impersonation attempt or tenant data export.

- The 20 examined public tables all have RLS enabled. Key legacy Commerce tables public.products, public.orders, public.customers, public.tenant_memberships, public.conversations and public.messages have relforcerowsecurity=true, and each has at least one policy.
- Crucial P0 release gap: actual public.products, public.orders and public.customers column metadata shows tenant_id but **no store_id**. Their RLS policy USING metadata references auth.uid and Tenant, not a direct Store predicate. This DOES NOT prove a cross-Store leak, but a SAME-TENANT MULTI-STORE JWT/RLS acceptance cannot be inferred from tenant-only tables; independent server-trusted Store mapping and/or schema migration must be reviewed and UAT-verified before commercial Core admission. Do not rewrite existing tables or reinterpret Tenant as Store.
- Security advisor finding: SECURITY DEFINER public.qa_shop_b_zalo_claim is callable by role anon. Independently checked pg_proc shows security_definer=true, anon_can_execute=true, authenticated_can_execute=false, function search_path locked empty, and no direct auth.uid text reference. The last finding does not prove absence of a valid challenge/secret validation; review challenge TTL, sender binding, replay and request authorization in function body PRIVATELY. Classify as P0 security review candidate, not confirmed exploitation.
- Additional advisor findings: SECURITY DEFINER public.qa_owner_pairing and public.save_merchant_product are callable by authenticated. Both contain auth.uid references and have an explicit empty search_path; still require privilege, ownership, price/stock and Store-scope audits under legitimate QA callers. Classify review P1 until independently tested.
- Auth leaked password protection is disabled, flagged P1. Do not change authentication settings without explicit user approval.
- Advisor also reported 22 RLS-enabled private-schema tables without policies (INFO). This can be an intentional default-deny boundary, not evidence of exposure. Do not auto-create broad ALLOW policies.

Supabase official remediation references:
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## 9. Release priority, approvals and checkpoint

P0 / BLOCKED: Actual same-Tenant Store JWT/RLS and verified Store Owner mapping; native Meta Page / Zalo OA signed provider authority; real OrderAccessGrant + customer two-step identity challenge; production tool gateway before any AI read/write/send; resolve externally callable privileged RPC review findings; V17.1K-S1 hosted image quarantine/AV isolation. No production cutover.
P1 / PROPOSED: independently audit two authenticated SECURITY DEFINER functions; review leaked-password protection; add bounded durable replay, rate and provider billing guards; issue audit and recovery evidence.

Approval required before any production RPC grant revocation, schema change, modifying Published n8n workflow, moving real customer data, credential or paid AI model use. This task performed **no such change**.

**Final classification:** V17.1M SOURCE IMPLEMENTED / OFFLINE TESTED 630/630 / HOSTED SYNTHETIC N8N TESTED 192/192 / SUPABASE RLS METADATA AUDITED / REAL SIGNED PROVIDER AND JWT STORE A B SECURITY NO-GO.
Checkpoint-only doc update triggers fresh GitHub CI; latest SHA must be checked independently.
