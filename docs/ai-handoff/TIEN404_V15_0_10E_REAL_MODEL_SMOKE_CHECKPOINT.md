# TIEN404 V15.0-10E — Real AI One-Case QA Smoke (NO SEND)

Date: 2026-11-16 JST. Parent: V15.0-10D PR #161. Source-only GitHub Draft. Commercial NO-GO.

## VERIFIED real n8n QA execution
- User approved one overall USD 1 budget for 132 cases/167 customer turns and using remaining free Gateway credit without a wallet or paid upgrade.
- Screenshot PRIOR to testing showed USD 0.57 Gateway credit, 0 Assistant credit, 19 active workflows. This is not updated balance evidence.
- Official n8n docs: free trial credits may be used without upgrading, top-up and auto-top-up require paid plan, but in-flight requests can make balance negative to be deducted from next top-up. No guaranteed per-workflow hard cap is available in inspected connector.
- Created one manual-only INACTIVE workflow PPJpr1bd9LxhOI6U in Personal/90_QA - DIAGNOSTICS, https://ngoctien20.app.n8n.cloud/workflow/PPJpr1bd9LxhOI6U . Uses existing n8n managed Gateway OpenAI credit, gpt-5-nano maxTokens=350 maxRetries=0 timeout=30s, agent 3 max iterations, one synthetic Catalog Tool QA_Catalog_Read_Only. NO Meta/Zalo send, HTTP request, hosted DB/Orders/Products, credential changes, webhook or Published edits.
- Execution #4024: ERROR, real model node ran twice, schema rejected toolCallId and agent exhausted 2 iterations. The only new QA workflow was safely updated: tool inputSchema.additionalProperties=true, agent maxIterations=3.
- Execution #4025: SUCCESS, 2026-11-16T05:15:53.156Z to 05:15:59.971Z, 6.815 seconds end-to-end. Model node ran twice, Catalog Tool once. Native n8n intermediateSteps confirms tool QA_Catalog_Read_Only query A002|2, response synthetic SKU A002 qty2 price159000 total318000 stock25, providerSends0 hostedWrites0. Output begins [QA MÔ PHỎNG], gives correct 159,000 VND each and 318,000 total, stock25 and no order. Verdict: toolTraceObserved true, quoteTextObserved true, actualGatewayCostUsd null.
- The smoke test SMOKE_QA_A002_2 is BESPOKE and NOT scored as any of the 132 full benchmark cases. The two runs showed four successful model node executions total but REAL CREDIT DEBIT, token usage and billing are not independently available. Do not claim zero charge.
- n8n workflow remains INACTIVE after test. No further paid model invocation until updated Gateway Spend/balance by workflow is reconciled.

## Source-only deliverables
- qa/v15010e-real-smoke/one-case-receipt-gate.cjs: strictly sanitized evidence, do not certify live runtime based on untrusted source-only fixture.
- qa/v15010e-real-smoke/one-case-receipt-gate.test.cjs: wrong Shop, wrong price/SKU, forged Order/send, first FAIL, raw output and unknown billing cannot become 132 benchmark pass.
- .github/workflows/v15010e-one-case-smoke-receipt-no-send.yml: source-only Node CI and inherited 10D/10C negative QA. CI exact commit must be verified before claiming TESTED.
- Detailed local file TIEN404_V15_0_10E_REAL_MODEL_SMOKE_CHECKPOINT_2026-11-16.md (in user-visible conversation).

## Gates/rollback
VERIFIED: one real GPT-5 Nano Catalog QA Tool call and correct synthetic answer (#4025). IMPLEMENTED: safe isolated Tool schema fix. BLOCKED: actual Gateway credit spent, updated balance, full 132-case benchmark, 36-case stateful tool sandbox, real provider and hosted signed Shop RLS. NO-GO: Commerce Production, Owner G2.3, hosted backup authorization/recovery, Messenger/Zalo live, real Orders.
Rollback: Close Draft 10E PR, keep new manual workflow INACTIVE. Existing Published workflows, customer data, credentials and billing unchanged. No top-up/upgrade.
