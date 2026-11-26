# TIEN404 V17.21 — Zalo Bot Durable SQLite Replay V2, SOURCE acceptance

**Date:** 17/11/2026 JST. **Decision:** IMPLEMENTED_SOURCE_ONLY; TESTED Node22 real SQLite 32/32; CI SUCCESS; HOSTED_DO_NO_GO. No production webhook, credential, catalog, order or payment changes.

## Baseline checked

- Zalo Bot staging `yIJk8LvJoLF40Z62`: Published `2d912cb0-007f-452f-9536-b92ba12a03e6` (active).
- Customer Router `sIPs6egzIwOY1GNv`: Published `8d91d23c-cd87-462f-a112-9cca2340bec8`.
- Shared Zalo/Website Core shadow `4ycmVzaNzVRulBjQ`: Published `76bbb4e9-7ad2-45a6-8188-260523ced57a`.
- Previous V17.20 source-only `admitBotEvent` passed 54/54 Node tests and required a durable `claimAtomic` interface.
- Prior Cloudflare read-only audit: existing V17.5E.2 `ReplayBucket` uses a boolean 10-minute order-oriented claim contract; incompatible with new 3-state 24-hour Zalo Bot event replay contract. No existing Worker or namespace was edited.

## Changed (only unmerged GitHub PR #243)

- `qa/v1721-zalo-durable/zalo-sqlite-claim-v2.mjs`: versioned SQLite table `zalo_bot_replay_claims_v2`, hashed event key as unique primary key, HMAC body digest, `CLAIMED / DUPLICATE / CONFLICT`, expiry at most 24 hours, bounded GC 32 rows per claim, never raw chat content.
- `qa/v1721-zalo-durable/zalo-bot-replay-bucket-v2.worker.mjs`: **not-deployed** Durable Object class `ZaloBotReplayBucketV2`; schema setup via `blockConcurrencyWhile`, synchronous claim SQL with no await in critical path; no public fetch handler.
- `qa/v1721-zalo-durable/zalo-bot-replay-binding-v2.mjs`: server-owned deterministic per-installation DO key, validates hashed-only arguments, forwards private `claimHashedEvent` RPC; never accepts Store binding from provider text.
- `qa/v1721-zalo-durable/zalo-sqlite-claim-v2.test.mjs`: Node22 native SQLite unit and V17.20 integration test file.
- `.github/workflows/v1721-zalo-durable-nosend.yml`: PR-scoped no-send test CI; hosted release job disabled by design.

## Independent QA evidence

- [GitHub Actions run #44064898204](https://github.com/ngoctien20/demo-git/actions/runs/44064898204), commit `9cfcdab449dd7bed9291ca3ebedd33ac2997e5ba`: **SUCCESS**, source syntax, **32 tests / 32 passed / 0 failed**, static network/token/send prohibition PASS.
- Native SQLite verifies first claim, duplicate and conflicting digest, close/reopen persistent DB, two SQLite connections to same file, expired re-claim, bounded garbage collection, invalid/out-of-range TTL, storage outage and un-hashed IDs denied.
- One test issues 100 concurrent promises through a synchronous SQLite adapter: exactly one claim and 99 duplicates **inside one Node runtime**. This does NOT prove parallel distributed Cloudflare Workers/DO race safety.
- Full V17.20 admission -> V17.21 binding -> real SQLite test returns first `ACCEPTED_SHADOW_ONLY`, then `DUPLICATE_NOOP`, then `CONFLICTING_REPLAY` denial. No provider sends, catalogue or order writes.

## Blockers and risk assessment

1. **HOSTED DO BLOCKED**: Node SQLite tests do not replace Cloudflare runtime Vitest/Miniflare, cold start/eviction, concurrency, migrations, durable bindings and live cross-isolate tests. A new DO class/binding deployment requires specific owner approval.
2. **BOT PROVIDER AUTHORITY BLOCKED**: Bot `X-Bot-Api-Secret-Token` is a shared header secret, not cryptographic signature over event bytes. Native Zalo OA `X-ZEvent-Signature`, OAuth and merchant OA admin authority require an independent acceptance gate.
3. **DATE COMPATIBILITY BLOCKED**: V17.20 requires millisecond `message.date`. Existing V1 normalizer/PII-free markers do not prove current vendor events contain that field in a compatible form.
4. **TTL/GC cost risk**: 24h event keys consume durable storage. Bounded GC executes on new claims only; an idle DO may retain expired keys until the next operation. Design cleanup/alarm and cost bounds before hosted promotion.
5. **AT-MOST-ONCE LIMIT**: Event claim preceding business execution can lose work after a crash; future sends/order writes require transactional outbox and per-action idempotency. Nothing in V17.21 enables writes.

## Rollback / approval

Only GitHub source files were added; revert the V17.21 source-only files/CI or close PR #243 to roll back. No n8n, Messenger, Zalo, Cloudflare deployed Worker, DO namespace, credential, webhook or merchant data rollback is necessary. **Do not promote** EXPERIMENTAL->APPROVED/RELEASED without independent QA and owner approval.

**Next candidate:** read Cloudflare Durable Object Vitest guidance; stage local Workers runtime tests without deployment, then perform privately authorized hosted no-send UAT with cost and rollback controls.
