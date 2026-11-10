# TIEN404 AI — V5 QA and release gates

Every PR must state scope, source SHA, test evidence, failure states, rollback, and whether it changes live customer data.

## Change classes
| Class | Examples | Autonomy | Release gate |
|---|---|---|---|
| READ_ONLY | audit, read execution history, analysis | Autonomous | Source reference, timestamp |
| STAGING_ONLY | mock tests, proposed code, docs, isolated QA | Autonomous on feature branch | Unit/CI and code review |
| REVERSIBLE_PUBLIC | navigation, copy, static display | Branch+PR first; release after QA | Responsive, accessibility, link and screenshot QA |
| PRODUCTION_SENSITIVE | Messenger send, real order write, stock, credentials, payment, tenant permission, live bot publish, Sites/D1 migration | Require explicit task-specific owner approval | Backup, review, live-safe canary, rollback, monitoring |

## Product QA matrix
| Area | Required checks | Block production if |
|---|---|---|
| Site navigation | All public pages expose six consistent menu links; legacy specialist pages accessible within solution flow | Duplicate main flows or broken links |
| Mobile widget | Android dark mode text/IME, iOS keyboard, send/receive, close/open, focus, scroll past popup, history, panel size | Input invisible, send fails, page scroll trapped |
| AI consultant | Knowledge accuracy, public privacy, quota, prompt injection, unknown-price honesty, multi-turn behavior, failover | Invented prices, secrets, false actions |
| Messenger | Verified Meta webhook signature, idempotent MID, ownership, retry, no unauthorized send | Duplicate real replies/order writes |
| Commerce | Tenant-resolution, RLS, cart totals, stock state, channel, order idempotency and isolation | Legacy sheets leakage or cross-tenant access |
| Super Admin | MFA, RBAC, CSRF, session revocation, audit, backups, tenant controls, negative access tests | Client-side role checks only or unverified Sites source |
| Billing | Provider-signed webhooks, pricing approval, idempotency, refunds, tenant entitlement, grace state | Test HMAC masquerading as real provider |
| Deployment | CI, version diff, staging preview, rollback and post-release monitoring | No auditable version or backup |

## Automatic checks available in this repository
\`\`\`sh
node scripts/check-site-navigation.mjs
node scripts/check-project-integrity.mjs
\`\`\`
New GitHub Action \`project-policy-qa.yml\` executes the checks on V5 branch and relevant PRs. These static tests cannot prove n8n API correctness or Android UI functionality.

## n8n safe QA
- Read n8n user preferences before mutation.
- Use \`get_workflow_details\` to distinguish draft vs published, read-only \`search_workflow_executions\` to inspect failures.
- Only execute isolated mock/read-only QA workflows with verified side effects. Do **not** trigger live Messenger, Create Order, Manage Order, Update Address, Revenue email or real customer channels during automated QA.
- Keep workflow registry snapshot separate from actual live state.

## Owner approval requests
Ask specifically before any production deployment, data migration, live order/message write, credential action, payment processor integration, paid service provisioning or irreversible operation. Avoid broad blanket approval requests for ordinary documentation/staging QA.

## Exit criteria
Status VERIFIED only with matched code SHA, successful tests, and real environment evidence. Otherwise label as CODE_READY, STAGE_QA_PASS, UNVERIFIED or BLOCKED. Don't turn stale results into a green production badge.
