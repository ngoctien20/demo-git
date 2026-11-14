# TIEN404 AI — Uploaded QA fixture review (read-only)
Date: 2026-11-14 JST

## Sources reviewed from conversation attachments
| File | Rows | Unique case IDs | Output/status |
|---|---:|---:|---|
| AI_SALES_QA_CASES.csv | 97 | 96 | 97 nonempty actual_output; QA01 appears twice |
| AI_SALES_QA_96_SINGLE_TURN.csv | 96 | 96 | actual_output empty in all 96 |
| AI_SALES_QA_96_SINGLE_TURN (1).csv | 96 | 96 | byte-identical candidate duplicate; actual_output empty |
| AI_SALES_36_MULTI_TURN_FOR_LATER.csv | 36 | 36 | 36 NOT_RUN |

These are QA fixture and/or recorded response data. They are **not** 132 verified successful tests.
No customer or production secrets copied to this repository.

## Safe ingestion strategy — proposed, not applied
1. Confirm dataset license/ownership and input field sanitization.
2. Hash/checksum both 96-case files and choose one canonical file.
3. Deduplicate QA01 in the historical 97-response file *without erasing evidence*.
4. Import read-only prompts/expectations as **candidate guidance only** to a private QA store; do not attach raw actual_outputs to a tester's PASS.
5. Use new identifiers (e.g. SALES-SINGLE-0001 and SALES-MULTI-0001) if importing to avoid existing module/case conflicts.
6. Multi-turn tests remain NOT_RUN until each controlled sandbox turn is executed and verified.
7. Block create/update/cancel/order tests until isolated writing sandbox and transaction rollback are proven.
8. Run automated policy tests, authenticated RLS tests, and review test-case instructions with the owner before opening to friends.
9. Avoid publishing files to static site; provide only backend-filtered cases to authorized testers.

## Current application scope
There are five seed tester cases and six module definitions. Only the synthetic Sheets learning module is READY. Genuine Messenger, Telegram, Zalo, AI Sales and Commerce channels require separate permission and verification.
