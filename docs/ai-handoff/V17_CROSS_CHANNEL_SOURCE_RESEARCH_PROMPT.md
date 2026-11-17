# TIEN404 AI — V17 MULTI-CHANNEL OPEN-SOURCE INTELLIGENCE
## SOURCE REVIEW & EXECUTION PROMPT (NO CODE IMPORT BY DEFAULT)

Date: 2026-11-17 JST
Scope: Research references only; preserve existing TIEN404 production/n8n and PR chains.

### Verified source matrix

| Reference | Source class | License / status | Recommended learning | Decision |
| --- | --- | --- | --- | --- |
| https://github.com/fbsamples/messenger-platform-samples | Meta official samples | Facebook specific-use copyright license (not general MIT) | Webhook event/Send API, Handover Protocol, postbacks, Webview, Postman | HIGH for protocol patterns; no direct old code import |
| https://github.com/yagizharman/Messenger-Repo | Independent real-time Messenger-like web app | No LICENSE at checked repo root | Inbox UI, read receipts, uploads, notifications, mobile-first chat | UI ideas only; DO NOT COPY without license |
| https://github.com/KaiyoDev/zalo-bot-js | Community TypeScript SDK for **Zalo Bot API** | MIT | Event handlers, filters, polling/webhook, retry/timeouts, transport hooks | HIGH for architecture; keep OA separate |
| https://github.com/vkhangstack/go-zalo-bot | Community Go SDK for **Zalo Bot API** | MIT | Typed events, webhook secret header, retry strategy, error handling | MEDIUM; verify actual code vs README |
| https://pypi.org/project/python-zalo-bot/ | Community Python Zalo Bot SDK | MIT claimed, 0.1.9 released 2026-01-27, PyPI publish provenance absent; homepage placeholder | Async handlers and filters | Study only; DO NOT INSTALL into SaaS |
| https://github.com/topics/facebook-messenger | Uncurated GitHub topic | Each repo separate license | Research only | No automatic adoption |

### High-signal findings / traps
- Meta official Messenger webhook guidance signs event payload with `X-Hub-Signature-256`; old Handover Protocol demo parses only `entry[0]` and lacks observed POST raw-body signature verification. Learn transitions, not production security.
- Meta graph `pass_thread_control` and `release_thread_control` current documented endpoints; Page handover permissions and webhook handover event must be checked per Page before sending. Never reuse a demo app's hardcoded IDs.
- Messenger window: general 24h; Meta changelog 2026-09-28 documents up-to-7-days after Click-to-Messenger/Direct ads, conditional. Do not generalize 7d to every conversation. Check current policy before send.
- Go Zalo Bot README uses an illustrative `X-Zalo-Signature` field but source `services/webhook.go` actually checks `X-Bot-Api-Secret-Token` header; not Zalo OA MAC. SDK's `auth/auth.go` embeds bot token in URL: protect all logging, tracing, error reports.
- Kaiyo Zalo Bot example defaults webhook secret to `replace-me` if unset and uses direct string comparison; not acceptable for production as written.
- PyPI `python-zalo-bot` webhook README example processes JSON without checking secret header; package homepage URL points to a placeholder GitHub repo. Prefer concepts, not runtime code.
- `yagizharman/Messenger-Repo` is a Pusher/NextAuth/Prisma real-time chat clone, not an authorized Messenger Platform API adapter; no LICENSE file seen. UI inspiration only.
- **Zalo Bot API != Zalo OA OpenAPI != Messenger Platform**. Token/secret/signature/recipient/reply policy differ. Never use personal account automation or undocumented bypass.

### Current TIEN404 checkpoint
- Prior source-only Draft PRs: #291 (OA MAC), #292 (OAuth PKCE and owner Store admission); source03 branch is based on exact #292 SHA.
- Related non-overlapping PRs: #258 synthetic QA registry; #260/#263 fake provider/authority gates; #290 Store ownership; #248 multi-channel vision/context; #79 Zalo button lab.
- n8n unchanged: Zalo Bot Lab `yIJk8LvJoLF40Z62`, Private Router `sIPs6egzIwOY1GNv`, Messenger `Z7FdV7uDvApfbURQ`. Reconfirm their live versions before further write.
- Supabase staging `ifxlvrhyjhbzbrkdsida`: real same-Tenant multi-Store JWT/RLS acceptance still NO-GO. No new DDL or customer mutation.

### What TIEN404 should evaluate (in priority order)
P0: Messenger raw-body HMAC + Page binding; Zalo OA MAC and grant binding; Bot secret header; event normalization; tenant/store ownership; atomic replay; outbound send policy and n8n credential isolation.
P1: Messenger handover/standby/suspended-bot control; Agent ↔ Staff takeover and audit; typed events, retry and backoff with per-channel quota and retry-safety; sender windows; image/document quarantine; conversational context with identity challenge.
P2: Inbox mobile UX/read receipts/attachments, friendly button/quick reply, templates and storefront UI, additional channels.

### Copyable execution prompt

You are the TIEN404 AI CTO, cross-channel engineer, open-source license reviewer and independent security/QA auditor. Continue strictly from the latest checkpoint.

Objective: evaluate official Meta Messenger samples, community Messenger UI, three Zalo Bot SDKs, and official Zalo OA docs. Produce a module-by-module evidence matrix for TIEN404 AI (webhook, verified installation, staff handover, image/vision, session, retry, message templates, policy, multi-tenant Commerce) with source path, commit SHA, license, provider conformity, vulnerabilities, dependencies, expected maintenance cost, and adoption decision: REUSE CONCEPT / CLEAN-ROOM BUILD / LICENSE-PERMITTED ADAPT / REJECT / BLOCKED.

Perform:
1. Read current branch and Draft PR #291/#292/source03 and overlapping PR #258/#260/#263/#290/#248; inspect exact GitHub head SHA and n8n versions; never reset or overwrite.
2. Audit raw official docs: Meta Messenger Send, Webhooks HMAC, pass/release/take thread control, messaging windows and policy, Page permission; Zalo OA OpenAPI and Zalo Bot distinct signature/auth schemas, message capabilities and policy.
3. Review exact source, tests, license and dependency manifest for: fbsamples/messenger-platform-samples, yagizharman/Messenger-Repo, KaiyoDev/zalo-bot-js, vkhangstack/go-zalo-bot, python-zalo-bot (PyPI sdist/wheel, with hash pin), GitHub topic candidates. Do not execute untrusted package lifecycle scripts; use isolated static audit first.
4. Prioritize incremental modules: channel event adapter, deterministic canonical event contract, Messenger handover state machine, staff inbox integration concept, Zalo Bot handler/retry design, safe outbound policy, media quarantine; no duplicate Store registry/Commerce core.
5. For each proposed module specify trust boundary and tenant/store dependency; test forged signature, sender injection, duplicate/replayed messages, race, revoked owner, wrong Store, 24h/7d window, staff takeover, malicious media/URL, prompt injection, wrong price/stock, data exfiltration.
6. Implement only independently safe offline source/tests in Draft PR, with SHA, comprehensive synthetic/negative QA and exact-head CI. No publish, no credentials, no live messages, no n8n production edits, no Supabase RLS migrations or paid calls without separately scoped approval.
7. Keep source-only, hosted no-send, real provider UAT and production release gates distinct. Actual OA/Page ownership and hosted Store-level JWT/RLS must be evidenced privately before any real traffic.
8. Report VERIFIED vs IMPLEMENTED vs TESTED vs PROPOSED vs BLOCKED, GO/NO-GO, rollback, QA evidence and next highest-value action. Do not claim production ready from synthetic fixtures.

Deliverables: prioritized component matrix, P0/P1 risk report, versioned architecture contracts, source-level Draft PR if safe, CI log evidence and actionable next checkpoint.
