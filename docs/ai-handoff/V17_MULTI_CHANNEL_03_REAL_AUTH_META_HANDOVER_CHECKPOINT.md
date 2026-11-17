# TIEN404 AI — V17.MULTI-CHANNEL-03 Real Store A/B Staff Auth × Meta Page Authority × Private Signed Handover No-Send UAT

Date: 2026-11-17 JST. **Current status: VERIFIED read-only METADATA; IMPLEMENTED source-only; REAL UAT BLOCKED.**

Parent: [PR #298](https://github.com/ngoctien20/demo-git/pull/298), pinned HEAD \`75e622a835cbfda8c40bd384f4a734f8a2b521e0\`. Existing Messenger/Zalo workflows and customers untouched.

## 1. Current real evidence from hosted systems (read-only)

Supabase staging \`ifxlvrhyjhbzbrkdsida\` ACTIVE_HEALTHY PG17.11.

**The SQL from this PR was actually executed through the Supabase connector**, on 2026-11-17 JST, returns only totals, no user IDs, JWTs, Page IDs, PSIDs, customer messages or token values:

| Real observed read-only aggregate | Value | Interpretation |
| --- | ---: | --- |
| Core Commerce surfaces | 6 | Products, Orders, Customers, Order Items, Conversations, Messages |
| RLS enabled | 6/6 | This is Tenant-level safety, **not Store-level proof** |
| Core with \`store_id\` | 0/6 | P0 canonical Store scope incomplete |
| Core with Store-qualified RLS | 0/6 | P0 same-Tenant Store A/B isolation not proved |
| \`public.stores\`, \`public.store_memberships\`, \`public.commercial_staff_assignments\` | 0 / 0 / 0 | Staff authority not available in canonical hosted schema |
| Distinct users with active tenant membership | 3 | Does NOT prove individual Store ownership |
| Tenants with 2+ active distinct membership users | 1 | Useful progress since prior snapshots, but neither Store A/B nor JWT UAT |
| Tenants with 2+ distinct active member users AND joined DB session records satisfying \`not_after\` check | 0 | **No same-Tenant dual user session evidence in this aggregate** |
| \`auth.sessions\` rows satisfying not_after/null filter | 5 | Not a JWT signature, fresh browser sign-in or active device proof |

**Important nuance:** \`auth.sessions.not_after\` is not a complete proof of unrevoked, currently valid signed JWT. Recheck actual Auth SDK signed sessions via two separate private browser sessions and real PostgREST RLS readbacks after approved Store-schema migration. No JWT/refresh tokens may be shared through GitHub or chat.

n8n direct version snapshots (no workflow edits):
- Messenger \`Z7FdV7uDvApfbURQ\` Published \`1064b1b3-d3f1-4a6b-a367-2414ba691522\`, active.
- Zalo Bot \`yIJk8LvJoLF40Z62\` Published \`2d912cb0-007f-452f-9536-b92ba12a03e6\`, active.
- Zalo Private Router \`sIPs6egzIwOY1GNv\` Published \`8d91d23c-cd87-462f-a112-9cca2340bec8\`, active.

## 2. Reuse existing Meta and Store security tracks instead of rebuilding

- [PR #196](https://github.com/ngoctien20/demo-git/pull/196): **Already** contains native Meta Page/Admin/App read-only evidence SOP and private operator handoff checklist. Use it; do not create a second merchant approval registry.
- [PR #243](https://github.com/ngoctien20/demo-git/pull/243): V17.1E pinned source \`652010d33a96b3daf3892fb660099c196cef2cf5\`, actual module \`qa/v171e-meta-real-event/isolated-meta-no-send.mjs\`. Strict raw-body HMAC SHA256, isolated QA Page/App, tester, \`claimOnce\`; **accepts only signed text**. It is not a handover event handler.
- [PR #269](https://github.com/ngoctien20/demo-git/pull/269): integrates PR #243 source into private operator authority gate, still no real independent Page proof.
- [PR #272](https://github.com/ngoctien20/demo-git/pull/272): **historic actual signed Meta Messenger workflow exec #4431**; existing legacy bot also sent a reply, whereas shadow bridge exec #4432 did not send. This proves real signed shadow denial reached a silent bridge, **NOT** an independent QA Page/App No-Send native handover. The earlier published workflow version differs from the current pinned version; not a fresh current run.
- [PR #290](https://github.com/ngoctien20/demo-git/pull/290) and [PR #247](https://github.com/ngoctien20/demo-git/pull/247): separate ownership, six-surface Store-RLS and migration approvals. Do not duplicate or apply migrations here.
- [PR #298](https://github.com/ngoctien20/demo-git/pull/298): existing Staff/Meta ACK simulation and Unified Inbox, stays **QA fixtures only**.

## 3. Source-only incremental implementation

1. \`qa/v17-multichannel03/hosted-readonly-preflight.sql\`: a single repeatable **SELECT-only aggregate**. Captures 6 core RLS/Store columns, actual tenant member/session coverage and commercial Staff tables. It has been executed on the real staging database with no write.
2. \`qa/v17-multichannel03/actual-sanitized-hosted-evidence-20261117.json\`: metadata-only snapshot; all unpublished merchant/provider/private proofs set to false meaning **NOT independently observed**, not proof of absence of external rights.
3. \`qa/v17-multichannel03/readiness-evidence-audit.mjs\`: fail-closed audit of strictly sanitized metadata; identifies actual blockers. **Never grants real UAT** even if caller forges all proof flags green.
4. \`qa/v17-multichannel03/meta-pr243-handover-compat.test.mjs\`: **CI checks out exact PR #243 SHA** and imports existing actual \`handleIsolatedMeta\` (no copy). Shows HMAC signed text QA works in its intended fixture contract but HMAC signed \`pass_thread_control\`/\`take_thread_control\` event classes are rejected as \`SIGNED_EVENT_NOT_ELIGIBLE_FOR_QA\`. This is an expected compatibility gap; it does **not** mean real provider handover failed or succeeded.
5. CI runs tests source-only, existing 271 inherited tests and no-send static checks. Validate exact HEAD logs before claiming TESTED.

## 4. Real PRIVATE UAT conditions (strictly BLOCKED here)

Before even one real no-send handover:
- **Store/Staff:** privately prove the original two Store owners are in the **same Tenant** using actual authorized Supabase Auth sessions and independently reviewed real Store↔Owner mapping. Both must be distinct Store scopes. Complete approved backup/recovery then separately authorized Store migration with safe rollback, independently verify cross-Store read denies under user JWT and revocation. Do not assume tenant-only RLS is Store isolation. Staff assignment must come from merchant-backed Store authority, not Tester Staff.
- **Meta:** authorized Meta Admin and independent reviewer inspect **dedicated QA App/Page distinct from current production**, current app assignment, Page subscribed fields incl \`messaging_handovers\` if supported/required, Messenger receiver roles, permissions, QA tester and consent. Use private read-only helper in PR #243 if merchant specifically approves and supplies token privately; do not invoke automatically.
- **Provider raw event:** separate dedicated, access-protected **inactive** QA callback with managed App secret and verify token; ensure exact Page↔Store mapping from protected server registry. First allow one signed *inbound* event no-send and compare byte-exact HMAC, durable replay, rate limit, redacted logs and external browser evidence. **Do not use production Messenger callback**.
- **Actual handover:** A native transfer may require Meta \`POST /{page_id}/pass_thread_control\`, \`take_thread_control\`, or \`release_thread_control\`; even though no chat text is sent, these **change conversation ownership**. They need an **additional explicitly scoped approval** for exact QA Page/App and tester and a verified rollback. The existing PR #243 handler is text-only, so native handover event support and provider event schema must be audited separately first.
- **Independent operator:** merchant-approved scope/date/time, one QA tester, 0 paid AI, 0 customer Orders, 0 real outbound text, private access logging and kill-switch, dual-review in secure channel. Do not post Page IDs, PSIDs, email, signed payload, session ID, JWT or secret to GitHub.
- **Observability:** synthetic signed tests != native Meta webhook. A previous real signed Messenger DEMO with actual SEND != clean independent no-send handover. A passing source gate != production deployment permission.

Official sources:
- Meta HMAC: https://developers.facebook.com/docs/graph-api/webhooks/getting-started/
- Meta Handover API: https://developers.facebook.com/docs/graph-api/reference/page/pass_thread_control/
- Meta release: https://developers.facebook.com/docs/graph-api/reference/page/release_thread_control/
- Supabase current RLS: https://supabase.com/docs/guides/database/postgres/row-level-security

## 5. Release, rollback and ownership

All source changes on this branch only. **NO** credential, Meta API, Supabase DDL/GRANT, Store data mutation, n8n workflow execution/publish or paid model. No hosting deployment. NO-GO for actual handover and real customer inbox.

Rollback: close new Draft PR. Parent #298/#295/#294/#292/#291, Store Owner #290/#247 and existing Meta source #243/#269/#272 remain intact.

**Next meaningful human action:** private Page/App authority review with the already-approved existing SOP from PR #196; separately gather same-Tenant Store A/B current authenticated JWT read-only evidence following PR #290 (requires completion of canonical Store/recovery approvals). Only then issue isolated hosted NO-SEND authorization for exact QA App/Page and a single event, and separate actual thread ownership change approval. Do not assume an open Facebook home tab is Meta Business/Page role proof.
