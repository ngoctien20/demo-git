# TIEN404 AI V17.21H.2 — Real Hosted Private SQLite Replay × Data Rollback Acceptance

**Date:** 2026-11-17 JST. **Scope approved in chat:** create a separate limited staging Worker+Durable Object; test hosted replay persistence and rollback without changing Zalo webhooks, sending messages or using customer data.

**VERDICT:** `IMPLEMENTED_HOSTED_PRIVATE_WORKER` × `VERIFIED_HOSTED_SQLITE_REPLAY` × `TESTED_QA_DATA_ROLLBACK`. **NOT** `HOSTED_DO_RPC_ACCEPTED`, `NATIVE_ZALO_SIGNATURE_VERIFIED`, `ZALO_OA_LIVE`, or `COMMERCE_RELEASED`.

## 1. Previous verified baseline / scope

- GitHub [PR #243](https://github.com/ngoctien20/demo-git/pull/243) **OPEN DRAFT**, branch `work/v171a-channel-store-bot-vertical-slice-nosend-20261117`.
- Pre-existing Cloudflare: **29 Workers / 2 Durable Object namespaces** (including existing `tien404-v175e2-durable-replay-nosend-staging`, class `ReplayBucket`).
- Actual Zalo Bot staging n8n `yIJk8LvJoLF40Z62` Published `2d912cb0-007f-452f-9536-b92ba12a03e6`, Customer Router `sIPs6egzIwOY1GNv` Published `8d91d23c-cd87-462f-a112-9cca2340bec8`, Zalo/Web technical Core Shadow `4ycmVzaNzVRulBjQ` Published `76bbb4e9-7ad2-45a6-8188-260523ced57a`. Unchanged before and after.
- Staging private preflight previously passed **10/10** plus Wrangler dry-run [CI #44072985338](https://github.com/ngoctien20/demo-git/actions/runs/44072985338). Local SQLite 32/32 + local Workerd 4/4 passed [CI #44066458265](https://github.com/ngoctien20/demo-git/actions/runs/44066458265).
- User-provided Cloudflare Dashboard screenshot showed **Workers Free** and **Durable Objects Free**. Connector billing read returns 403, so current invoices/spend limits were not independently read by API; do not claim a verified $0 bill or account-wide hard spending cap.

## 2. Hosted resource creation — VERIFIED

**Only newly created Worker:**

`tien404-v1721h2-zalo-replay-private-nosend-staging`

- Created via Cloudflare **Create Worker** API with `subdomain.enabled=false`, `subdomain.previews_enabled=false`, `observability.enabled=false`, `logpush=false`; no public route/custom domain, no outbound fetch handler, no provider secrets.
- Original version-upload attempt with a `ZALO_REPLAY_V2` binding correctly failed **before deployment**: binding referenced a new unprovisioned class. Cloudflare directed use of declarative `exports` without a premature binding.
- Successfully uploaded immutable **version `3c8d979f-cee2-48d5-8118-91ae872a52e6`**: code from GitHub `qa/v1721-zalo-durable/zalo-bot-replay-bucket-v2.worker.mjs` and `zalo-sqlite-claim-v2.mjs`; binding list empty, declarative `ZaloBotReplayBucketV2` export with SQLite storage. Original GitHub source blobs `456ad2956269216d986154fc7efc224d8903f9e9` and `21f47db315afc1a3932309f0424db9a90dfc2452`.
- Deployed only this single version via **deployment `75332af9-7ea7-4683-8e07-e7a59de4adb2`**, `2026-11-17T11:38:12.128569Z`. No versions of existing Workers touched.
- Cloudflare readback confirmed `subdomain.enabled=false` and `previews_enabled=false` through both Worker metadata **and** separate subdomain API, with **no script bindings** and **one** deployment. This Worker has no public HTTP fetch route.
- New isolated Durable Object namespace: `tien404-v1721h2-zalo-replay-private-nosend-staging_ZaloBotReplayBucketV2`, class `ZaloBotReplayBucketV2`; old namespace `ReplayBucket` still exists independently.
- After deployment: **30 Workers / 3 DO namespaces**. These are the expected additive, isolated changes. No real Zalo Bot webhook, n8n workflow, Messenger, credential, owner allowlist, orders, inventory or subscription changes.

## 3. Actual hosted SQLite storage QA — TESTED

All requests were made only through **authenticated Cloudflare account-level Durable Object SQL Query API**, using two fresh isolated synthetic names:

- `T404_V1721H2_SYNTHETIC_A`
- `T404_V1721H2_SYNTHETIC_B`

These do **not** contain customer data. The event key and payload digests used only 64-char lowercase hex QA patterns with no raw message, chat ID, phone or personal identifier. No Bot webhook or third-party endpoint was called.

**Bounded total SQL statements: 19, within the 25-statement QA envelope.** Counting by phase: schema inspection 1; fresh-instance row-count queries 2; first/duplicate/conflict + independent second Object 6; separate-call persistence and expired-row GC 4; synthetic cleanup and readback 6.

| Acceptance case | Observed result |
| --- | --- |
| Fresh hosted SQL class initializes V2 replay table and indexes | **PASS** `zalo_bot_replay_claims_v2`, unique primary key, expiry index visible |
| Two distinct synthetic Durable Objects start empty | **PASS**, both count 0 |
| First hashed-key insert in Object A | **PASS**, one `CLAIMED` row |
| Identical key and digest retried in A | **PASS**, `ON CONFLICT DO NOTHING` inserted 0 rows; stored digest equal: `DUPLICATE_NOOP` |
| Identical key with conflicting digest in A | **PASS**, inserted 0 rows, stored digest differs: `CONFLICT` |
| Same event key in independent Object B with second digest | **PASS**, independently inserted one row; A persisted first digest unchanged |
| Separate authenticated API call reads existing A state | **PASS**, hashed claim persisted across Cloudflare API requests |
| Expired synthetic row inserted then bounded GC SQL executed | **PASS**, removed one expired row and preserved active A claim |
| Rollback of synthetic A and B rows with exact key + digest | **PASS**, deleted exactly 1 row per Object; subsequent count **0 and 0** |

**Important precision:** SQL account API operations verified hosted SQLite schema/uniqueness/persistence/cleanup. They DID NOT invoke the Worker Durable Object RPC method `claimHashedEvent`. Thus `HOSTED_SQLITE_DATA_ACCEPTED` is true, but `HOSTED_RPC_ACCEPTED` remains unverified and must NOT be conflated with this result. The local Workerd RPC contract was tested in CI separately.

## 4. Rollback verification and retained stage

- **Actually tested:** QA *data* rollback: both isolated Object SQL tables returned to **0 rows**, with exact 1-record deletions and readback; no actual customer or merchant data existed in those Objects.
- **Not executed:** deleting Worker deployment or new DO namespace. The user asked to create a separate staging replica and test it, so the private, no-route Worker is **left deployed** for future authenticated internal RPC verification. Its exposed surfaces remain disabled.
- **Infrastructure rollback plan:** verify exact Worker name, deployment ID and two disabled URL controls; confirm no other service binding references; independently review DO namespace data/retention and billing; then, with scoped owner approval, remove only this isolated Worker and its disposable DO namespace as supported by Cloudflare, and verify return to the original **29 Workers / 2 DO namespaces**. Do not touch `tien404-v175e2-durable-replay-nosend-staging` or `ReplayBucket`; do not assume deleting Worker automatically deletes its DO data.
- **Safety and QA:** provider sends 0; model calls 0; Commerce writes 0; no n8n workflow or real customer data changed. Billing amount cannot be independently attested by Billing API permission.

## 5. Remaining NO-GO gates and next stage

1. **HOSTED RPC UNVERIFIED:** no private service-binding invoker currently attached; direct DO SQL Query API is **not equivalent** to actual `claimHashedEvent` RPC. Design a versioned, separately authenticated internal invoker with a strict ≤25 synthetic-call cap, verify replay/parallelism/crash behavior, and keep both Workers nonpublic. Do not repurpose the existing A/B Gateway or Zalo webhook.
2. **PROVIDER AND REAL BOT DATE UNVERIFIED:** Zalo Bot shared header secret is not per-body signature; no independent `message.date` compatibility record is in current private evidence.
3. **STORE AUTH NO-GO:** Zalo OA owner/admin OAuth/signature and Supabase tenant/Store RLS proof remain separate.
4. **RELEASE NO-GO:** customer sends, Orders/stock writes, payments and production credential updates remain disallowed. Do not use `EXPERIMENTAL/CANDIDATE` as `APPROVED/RELEASED`.

**Checkpoint decision:** `V17.21H.2 HOSTED PRIVATE SQLITE QA PASS / SYNTHETIC DATA ROLLBACK PASS / NO PUBLIC ROUTES`. The staging Worker is retained with zero synthetic rows for next safe private-RPC acceptance. GitHub PR #243 stays DRAFT.
