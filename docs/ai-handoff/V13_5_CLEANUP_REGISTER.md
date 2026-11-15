# TIEN404 V13.5 — NON-DESTRUCTIVE CLEANUP REGISTER

**No archive, delete, unpublish or branch closure executed.** All entries below are review candidates only.

| Component | Decision | Rationale / dependency condition |
|---|---|---|
| Render Supabase Auth, `login.html`, `merchant-portal.html` | KEEP / CONSOLIDATE | Canonical staging identity and account surface; verify public 302 to Auth |
| Existing authenticated read-only Orders/Products/Customers data modules | KEEP backend / SPLIT UI | Preserve Order/CRM functionality. Customer sees minimal order view; Staff operations require grants |
| Legacy `assets/merchant-portal.js` V12.2 technical merchant UI | CONSOLIDATE | Retain for rollback; prevent customer-facing Bot/Stock editor without staff RBAC |
| Sales Lite V13.3 Account (Cloudflare QA), PR #72 Render shortcut, PR #73 Auth account | CONSOLIDATE | One canonical Merchant account on Render; avoid multiple customer portals |
| Internal AI Studio, menu designer, rich message, Agent Factory | FUTURE — PRESERVED | Retain code/test evidence, do not expose to Lite/Plus users or delete |
| Old demo-login fixtures `#saas-auth` (browser QA) | REMOVE CANDIDATE as *public flow* | PR #74 merged Auth redirect; replace obsolete login fixtures only after regression review |
| Demo billing / invoice public pages | REMOVE CANDIDATE from active navigation | Audit links and payment/legal requirements first; no deletion |
| Tester QA sandbox and 96-case data | KEEP QA / SEPARATE | Protected experimental Tester domain; not production Staff/Admin |
| n8n 63 inactive workflows | INVENTORY / FUTURE or ARCHIVE CANDIDATE | Many are QA backup; inspect callers, version, executions and credentials before any unpublish/delete |
| n8n 19 active workflows | KEEP until proven redundant | Active includes sandbox/lab; audit webhook and cross-workflow dependencies |
| PR #66, #67–#73, #75–#76 | KEEP DRAFT / RATIONALIZE LATER | Different bases; no cross-merge, no forced close without source review |
| Customer direct Catalog/Stock/Bot Designer menus | EXCLUDE FROM CUSTOMER UI | Keep backend business capability and staff admin safely |
| Separate standalone Owner Admin website | PROPOSED CONSOLIDATION | Prefer Owner elevated role inside one Admin Platform with fresh MFA/audit |

**Checks before any ARCHIVED / REMOVE:** proof no runtime imports/webhook callers, snapshot/rollback SHA, no customer records, replacement feature parity, QA affected flows, owner approval. The cleanup itself is **BLOCKED** until dependency graph and release gates.
