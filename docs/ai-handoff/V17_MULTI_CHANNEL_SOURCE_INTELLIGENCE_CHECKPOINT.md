# TIEN404 AI — V17.MULTI-CHANNEL-SOURCE-INTELLIGENCE
## Meta Messenger × Zalo Bot/OA × Commerce (OFFLINE, NO SEND)

Date: 2026-11-17 JST
Stacked child branch based on **PR #294 HEAD `3c43bd03607a6b8f9d47084d733a27b0eadf9bb7`**.
Do not merge without the parent chain (#291 → #292 → #294) and independent approval.

### A. Evidence-based source review

| Source (pinned ref) | Scope and exact important file | License | Dependencies / risks | TIEN404 decision |
|---|---|---|---|---|
| [Meta `fbsamples/messenger-platform-samples`](https://github.com/fbsamples/messenger-platform-samples/tree/3c3853a84a5d87d2567e75e649655822f535fdf6) | `handover_protocol/index.js`, `handover_protocol/utils/handover-protocol.js`, root `LICENSE` | Facebook custom license: permitted with Facebook services/APIs only; subfolder package.json MIT label does **not** supersede root | Legacy Express 4.15.2, body-parser 1.17.1, request 2.80.0; index.js takes `entry[0]` and shown POST route omits raw webhook HMAC | CLEAN-ROOM BUILD only: state machine, no legacy copy |
| [`KaiyoDev/zalo-bot-js`](https://github.com/KaiyoDev/zalo-bot-js/tree/751d1f68d0b2f64fa87bebd755f630279fecd1f8) | `src/filters/index.ts`, `src/request/BaseRequest.ts`, `examples/webhook.ts` | MIT | SDK v0.2.3, zero runtime dependencies according to package; dev TypeScript 6 range, VitePress alpha; example webhook defaults `replace-me`, uses direct header comparison; request hooks may surface raw payload and tokens without care | REUSE CONCEPT, do not install into n8n Cloud |
| [`vkhangstack/go-zalo-bot`](https://github.com/vkhangstack/go-zalo-bot/tree/6842292eb2c5b186603823785d77d62586b85663) | `services/webhook.go`, `auth/auth.go`, `go.mod` | MIT | Go 1.22, yaml.v3 3.0.1; bot credential may appear in request URL; webhook header is **X-Bot-Api-Secret-Token** in code (README example mismatches) | REUSE CONCEPT, typed event and errors |
| [`yagizharman/Messenger-Repo`](https://github.com/yagizharman/Messenger-Repo/tree/bc6383f1d7370579d8759e6278813d2a506dcc9c) | `README.md`, `package.json`, Next.js/Pusher/Prisma UI | No root LICENSE found; package private | Next.js 13.4.7, Prisma 4.x, NextAuth 4.x, MongoDB, Pusher; `postinstall` prisma generate; older code and external services | UI INSPIRATION ONLY, NO CODE COPY |
| [PyPI `python-zalo-bot 0.1.9`](https://pypi.org/project/python-zalo-bot/) | Published description and webhook example; source archive download failed in this session | MIT claimed by PyPI metadata; not independently audited | Release Jan 27 2026, untrusted publisher provenance (Trusted Publishing: No), example does not check webhook secret; Python >=3.8 | STUDY DOCUMENTATION ONLY, BLOCKED INSTALL |
| [GitHub topic `facebook-messenger`](https://github.com/topics/facebook-messenger) | Uncurated discovery index, NOT a single codebase | Each repository independent | Variable ownership and maintenance; not audited as a group | RESEARCH ONLY, no automatic adoption |
| [Official Meta Messenger](https://developers.facebook.com/docs/messenger-platform/) | Webhook, Page permission, Handover and messaging policy | Official platform documentation | APIs and permitted sends depend on app/Page grants | Authoritative specification, require current provider UAT |
| [Official Zalo](https://developers.zalo.me/docs/) | Zalo OA/OpenAPI vs Zalo Bot API must remain distinct | Official platform documentation | Different auth/signatures, event fields, per-OA permissions and charges | Authoritative specification, require real OA approval |

The Python source tarball was NOT executed, downloaded successfully or dependency-audited, so no Python source code findings are claimed. GitHub topic was not treated as audited repository content.

### B. Existing TIEN404 reuse map

| Existing work | Pinned checkpoint and use | No duplicate |
|---|---|---|
| PR #124 V14.8 | `qa/v148/unified-identity-resolver.cjs` (synthetic signed identity), `identity-resolve-v1.schema.json` | Reuse contract; no new identity resolver |
| PR #248 V17 CBOT | `qa/v17-cbot/cbot-readonly-contract.cjs` | Reuse read-only context / Image-to-SKU candidate |
| PR #204 CBOT-UAT-02 | `qa/cbot-uat02/crosschannel-core.mjs` | Reuse verified-link challenge design |
| PR #291 / #292 / #294 | OA raw MAC, PKCE/owner, vault/registry (source-only) | Stack as separate Draft; no provider authorization claims |
| PR #258 / #260 / #263 | n8n inactive synthetic QA registry, channel signature shape and authority gate | Do not replicate fake provider/Store authority |

n8n workflows **not changed**: Messenger `Z7FdV7uDvApfbURQ`,
Zalo Bot Lab `yIJk8LvJoLF40Z62`,
Private Customer Router `sIPs6egzIwOY1GNv`.
Do not use AI_SALES_DEMO Orders/Products/credentials in SaaS.

### C. Two incremental, clean-room source-only modules

`qa/v17-multichannel-intelligence/handoff-planner.mjs`:
- Source-only decision engine for `BOT_ACTIVE → HANDOFF_PENDING → HUMAN_ACTIVE → RESUME_PENDING → BOT_ACTIVE`. Bot is suppressed **before** provider ACK; cannot auto-resume.
- A private authenticated actor, server-bound Tenant/Store/Binding, staff membership+Page Inbox permission (Messenger), exact revision/CAS and signed/trusted provider ACK are REQUIRED inputs. JavaScript fixture flags are NOT real authentication. Exact ACK must be verified in a dedicated private callback adapter.
- Messenger plans `PASS_THREAD_CONTROL` and return-to-bot but NEVER calls Graph API; Zalo Bot/OA use **internal staff assignment only** (no invented native handover).
- Return code is a proposal only; no persistent transaction, real staff assignment, provider event or model call. CAS/replay ledger must be hosted and real before use.

`qa/v17-multichannel-intelligence/outbound-eligibility.mjs`:
- Source-only eligibility: strict account, Tenant, Store, conversation binding + bot not muted, approved non-transactional text, cost budget and rate allowance.
- Meta normal 24h window; conditional up-to-7d Click-to-Messenger Ad only with independently verified entitlement and entry-point proof (Meta Sep 28 2026 update). No universal 7-day override.
- Zalo OA: ONLY verified account-specific send entitlement/window accepted (do not infer from a generic 7-day policy); Zalo Bot: its own token/capability proof; Website: private session only.
- All positive cases return `sendAuthorized:false`, `canCommitOutbox:false`, `noSend:true`. A hash is a proposed dedupe key, NOT a durable atomic reservation.
- Never send text/media, never write/confirm order, never classify prompt text as authorization.

### D. Threat model and test coverage

P0: forged webhook/ACK, Page/OA→Store mismatch, unauthorized staff, owner/JWT/RLS bypass, duplicate handover, replay, under-verified send entitlement, bot speaks while human active, transactional intent mistaken for text, unknown outbound charges.

P1: transition timeout deadlock, Meta provider ACK ambiguity, retry of non-idempotent sends, provider version/policy drift, malicious images/URLs, prompt injection, cross-channel identity linking, staff inbox privacy/role scoping, token leakage.

Synthetic QA tests cover handoff transitions and CAS proposals; Meta forged/wrong-page ACK; unauthorized staff and Store; bot suppression; Messenger policy windows (24h; conditional ad extension); independent Zalo OA/Bot/Website policies; cost/rate limits; content and outbox dedupe plan. Parent OA source suite remains runnable. **No live provider or hosted DB QA.**

### E. Priority / complexity / operating cost

P0 **Channel Trust / Store Isolation**: maintain existing PR #124/#291/#292/#294. Business value essential; complexity HIGH; hosted cost not estimable until deployment plan; blocked on real same-Tenant Store A/B Auth/RLS and provider ownership.

P0 **Outbound Policy Gate**: new source-only candidate. Business value HIGH; complexity MEDIUM; small offline runtime, hosted policy evidence and outbox can add cost.

P1 **Human Handoff Planner**: new source-only candidate. Business value HIGH; complexity MEDIUM-HIGH; durable staff assignment and API handover requires verified privileges.

P1 **Inbox view and staff RBAC**: PROPOSED contract; reuse current dashboard, do not copy unlicensed Next.js clone. Business value HIGH; complexity MEDIUM-HIGH; hosted realtime/storage cost requires budget.

P1 **Event handlers / media**: use MIT SDK patterns conceptually; leave provider parsing inside existing channel-specific gateway; PR #248 covers Vision read-only. Complexity MEDIUM; costs depend on media and AI inference.

### F. Independent release admission

1. Do NOT merge Draft, publish n8n, change RLS, deploy Worker, provision secrets or send messages without distinct approval.
2. Real authenticated Store A/B (same Tenant), staff membership/JWT, Page owner / OA admin, provider handover subscription and webhook authenticity must be independently verified.
3. Real hosted CAS+durable replay, staff inbox ownership handback, no-send canary and channel quota/price policy must be demonstrated.
4. Only after these gates, separately approve explicit real sends and read/write Commerce.
5. No credentials/customer data in GitHub, PR logs, test fixtures or Demo Sheets.

Rollback: close child Draft PR and leave parent and existing n8n/hosted untouched.

QA: `node --test qa/v17-multichannel-intelligence/*.test.mjs` plus inherited OA source tests; use exact HEAD GitHub Actions logs for TESTED count.
