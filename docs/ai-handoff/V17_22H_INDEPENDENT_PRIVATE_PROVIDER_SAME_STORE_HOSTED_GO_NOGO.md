# TIEN404 AI — V17.22H: Independent Provider Ownership × Real Same-Store Binding × Hosted No-Send GO/NO-GO

**17/11/2026 JST · VERIFIED READ-ONLY AUDIT · REAL HOSTED CANARY NO-GO**

Parent: [V17.22G PR #376](https://github.com/ngoctien20/demo-git/pull/376) pinned HEAD `57e697ab9661cc78512c01e5b959e13a1c76012b`. This is an independent evidence **review and decision**, not another counterfeit live provider approval or an additional bot implementation.

## 1. Read-only hosted facts checked now

Supabase staging `ifxlvrhyjhbzbrkdsida`, aggregate SQL at **2026-11-17 14:39:04 UTC**, customer/credential/JWT rows not accessed:

| Catalog evidence | Actual |
| --- | --- |
| `public.stores` | ABSENT |
| `public.store_memberships` | ABSENT |
| `public.channel_identity_links` | ABSENT |
| `tien404_v1722_qa.orders` | ABSENT |
| `store_id` on Products, Orders, Customers, Order Items, Conversations, Messages | **0 of 6** |
| Permissive SELECT policies on `public.orders` | **1** |

No verified Store-qualified Orders SELECT/RLS cross-Store UAT follows from this metadata. The presence of a permissive policy is not by itself an observed exploit.

Published n8n inspected without edits:
- Messenger `Z7FdV7uDvApfbURQ`, active version `1064b1b3-d3f1-4a6b-a367-2414ba691522`, 32 nodes. Latest listed webhook-mode success on 17 Nov execution 4965 (07:09:46 UTC). An n8n success is **not** independent Meta HMAC, owner Page authorization, or provider no-send certification.
- Zalo Bot `yIJk8LvJoLF40Z62`, version `2d912cb0-007f-452f-9536-b92ba12a03e6`, 12 nodes. Recent listed executions 2832–2839 (13 Nov) were **manual**. No native Bot webhook proof was established by this limited list; do not generalize to all history.
- `MQcbjLWZ5QUTJW0k` had manual QA executions 5026/5027 on 17 Nov. Manual no-send fixture ≠ native provider proof.

## 2. Primary project source evidence — classes, not invented upgrades

| Evidence track | Exact existing source | Verified evidence level | Actual blocker |
| --- | --- | --- | --- |
| Meta QA Page/App | [PR #310](https://github.com/ngoctien20/demo-git/pull/310), `V17_MULTI_CHANNEL_03B_INDEPENDENT_OWNER_AUTH_META_GATE_CHECKPOINT.md` | Two-key **offline opaque metadata** signature review, not original evidence | Native Business Admin/Page/App owner, dedicated QA permission and real signed incoming event independently unverified |
| Zalo Bot owner | [PR #360](https://github.com/ngoctien20/demo-git/pull/360), `V17_7H2_OWNER_SCREENSHOT_PRIVATE_GETME_CHECKPOINT.md` | User-confirmed Bot Creator list screenshot; **not** provider-authorized Bot ID/readback | Real private `getMe` and `getWebhookInfo` not executed, current Bot→n8n→Store unknown |
| Store identity & JWT | [PR #354](https://github.com/ngoctien20/demo-git/pull/354), `private-owner-provenance-gate.mjs` | Source-only four-row metadata contract | No canonical Store/membership, same-Store A/B JWT RLS signed UAT |
| Independent M0 recovery | [PR #372](https://github.com/ngoctien20/demo-git/pull/372), `T404_RPC178D_STAGING_RECOVERY_OWNER_GO_NO_GO.md` | Source-only backup readback/signing plan, independent synthetic restore tests | Current actual backup inventory, Auth/Storage scope and independent off-host restoration unaccepted |
| Private signed synthetic QA | [PR #376](https://github.com/ngoctien20/demo-git/pull/376) | 150/150 Node and PG17 source tests PASS, offline one-event NO-SEND | Does not provide real credential, provider ownership or authorized hosted callback |

Meta native raw-body HMAC and Zalo **Bot** shared header are different mechanisms; Zalo Bot shared header is **not** an individual-message HMAC and not Zalo OA OAuth. A true signature over an applicant-authored statement does not make the applicant a verified owner.

## 3. Actual PRIVATE unblocker sequence (no keys in GitHub/ChatGPT)

**P1: Native Meta QA Page/App owner proof.** A properly authorized owner/operator and independent technical reviewer inspect Meta Business/Developers for dedicated QA Page/App vs production, installed app, Page permissions, QA tester consent, existing webhook and single-responder isolation. If narrowly approved, execute only read-only native metadata checks with a managed private credential and receive exactly one native signed QA receipt into a separate controlled no-send service. The caller must preserve no provider token/PSID/raw body in public logs. No Graph POST, Thread Control change, callback reassignment or legacy DEMO interference.

**P2: Zalo Bot owner evidence.** Authenticate the current Bot Creator admin privately and independently establish that the Bot listing is the same Bot wired to active `yIJk8LvJoLF40Z62`. With separate scoped approval, a trusted vault-backed runner performs **at most one** private `getMe` and **one** `getWebhookInfo`. Record only hashed identifier match, configured webhook match, UTC time and reviewer ticket. Never log Bot Token, token-bearing URL or raw customer webhook. If webhook already exists: **STOP**; never overwrite/delete/repoint it or sendMessage. A new disposable QA Bot requires separate approval.

**S: Real same-Store owner + Auth.** Verify both channels map to a *server-controlled canonical Store*, never a claim from webhook JSON or `user_metadata`. After independently accepted current backup/restore and separately approved Store schema/RLS migration, two real separately authenticated QA users must pass same-Tenant Store A/B **own-visible / cross-Store-denied** JWT UAT using disposable test sentinel rows. Never use service role as a user RLS proof.

**C: Hosted one-event NO-SEND.** Requires separate operation-specific authorization: dedicated inactive access-protected callback, verified Meta/Zalo native ingress and installed Store owner, isolated one-event cap, durable replay/rate limiter, bounded log retention and cost, kill switch, independently audited zero provider sends, zero Commerce/stock/payment writes and rollback. Do not reuse the currently Published Messenger DEMO sender or Zalo Bot webhook. A positive synthetic CI outcome is not canary permission.

**Solo founder note:** independence means **primary source verification plus independently checkable technical proof**, not a requirement to hire four employees. Owner consent alone cannot replace native readback, different real Auth sessions, genuine Store RLS and independent restore.

## 4. Machine-readable public-safe decision and release state

The companion `qa/v1722-cross-channel-order/v1722h-public-safe-hosted-go-nogo-20261117.json` contains only verified aggregate structural facts, source PR references, sanitized n8n execution classes, explicit unmet gates and **`decision=NO_GO`**. It is historical evidence, **NOT an authorization ledger**. Changing a false field to true in GitHub MUST NOT permit hosted operations. Any fresh evidence requires a new independently signed private review and a new versioned snapshot; never rewrite historical data as if it were re-verified.

**VERIFIED:** live catalog and n8n execution metadata, existing exact-source evidence classes.
**IMPLEMENTED:** public-safe decision manifest and private operator runbook on a child Draft PR.
**TESTED:** previous PR #376 offline QA; this phase does not assert a real provider event test.
**BLOCKED:** real provider admin and same-Store ownership, Auth/JWT Store RLS, complete M0 off-host restoration, hosted callback scope/approval.
**NEEDS APPROVAL:** any real credential readback, Page/Bot or callback change, backup action, migration, paid resource, customer data access or one-event provider test.

**Decision:** `V17.22H_READ_ONLY_OWNER_PROVIDER_AUDIT_VERIFIED · SAME_STORE_AUTH_NO_GO · HOSTED_ONE_EVENT_NOT_EXECUTED · PRODUCTION_UNCHANGED`.

**Rollback:** close child Draft PR. This phase changed no n8n/Supabase/Meta/Zalo/Cloudflare production or staging resource and wrote no customer data.
