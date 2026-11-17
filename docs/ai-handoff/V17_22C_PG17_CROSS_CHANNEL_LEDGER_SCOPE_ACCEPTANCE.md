# TIEN404 V17.22C — Shared Messenger → Zalo Bot QA Order Ledger: Composite Store/Actor Foreign Keys

**2026-11-17 JST — SOURCE-ONLY / DISPOSABLE PG17 ONLY / HOSTED AND CHANNEL RELEASE NO-GO**

## Purpose and parent ownership

This is a narrowly scoped child of [V17.22B PR #243](https://github.com/ngoctien20/demo-git/pull/243), exact pinned parent HEAD `bb930d6483a571b7606c4d7fb9330df74682a4af`, retaining its 74-case fake-provider cross-channel order core and existing approved provider/staff research. **Not a new Messenger/Zalo bot**, and not a hosted schema migration.

The end-user acceptance remains: account A places an opted-in **synthetic** QA order through Messenger, then after explicit two-channel linkage queries the **same** QA order through Zalo Bot; unrelated Messenger/Zalo account B or a different Store/Tenant must receive the same generic DENY. Real customer/order/payment/stock writes are out of scope.

## Direct integration observations (read-only audit)

- Published n8n Messenger workflow `Z7FdV7uDvApfbURQ`: **32 nodes** at version `1064b1b3-d3f1-4a6b-a367-2414ba691522`; separate `QA_CORE:` Commerce read-only path is already added. Default Legacy agent still has write-capable `create_order`, `manage_order` and other tools, and a Meta send node. **DO NOT test new QA orders through ordinary unprefixed messages.**
- Published n8n Zalo Bot ingress `yIJk8LvJoLF40Z62`: **12 nodes** at version `2d912cb0-007f-452f-9536-b92ba12a03e6`; ingress has an isolated Core Shadow no-OA-send path. Zalo V2 Shadow `OgDZNSAvKEvhnAvn` retains a potentially side-effecting POST to legacy `qa_shop_b_zalo_claim` and is not suitable for generalized customer order reads. **Do not modify/remove overlapping V17.15 nodes or old RPC clients without independent caller inventory.**
- Existing V17.22B [source runbook](../../qa/v1722-cross-channel-order/README.md) has 74/74 inherited source acceptance, no private ledger deployed, no authenticated cross-provider customer link; canonical Commerce Store RLS is not ready.

## Concrete source-level deficiency and fix

The former **unapplied** candidate `qa/v1722-cross-channel-order/PRIVATE_STAGING_SCHEMA_CANDIDATE.DO_NOT_APPLY.sql` related `link_challenges.order_ref` to `orders.order_ref` alone, and `channel_links.verified_challenge_ref` to `link_challenges.link_ref` alone. These FKs did not verify that the referenced Tenant/Store/Messenger actor/Zalo actor matched the child row. An incorrectly scoped future writer could create false cross-Store account-order linkage.

**V17.22C** changes this **unapplied draft SQL** to:
1. Fail closed if `tien404_v1722_qa` already exists, rather than masking schema drift with `IF NOT EXISTS`.
2. Add a unique exact order scope on `(order_ref,tenant_key,store_key,messenger_actor_hmac)`; every link challenge references **the same four values**.
3. Require `channel_links` to match the specific verified challenge by `(link_ref,tenant_key,store_key,messenger_actor_hmac,zalo_actor_hmac)`.
4. Check basic non-expired-after-created timestamps and consumed timestamp bounds.
5. Preserve `FORCE ROW LEVEL SECURITY` and zero **client/provider role grants and policies** for all four tables. This candidate cannot be safely connected to real users until a new least-privilege writer, real ownership and independently reviewed RLS policy/service contract are designed.

**New actual disposable SQL:** `qa/v1722-cross-channel-order/pg17-disposable-scope-fk-security.sql` checks these relationships with two fake Stores under the same fake Tenant, fake actor hash strings and fake OTP, intentionally attempts wrong Store/Tenant/Messenger actor/Zalo actor links, and verifies replay-key uniqueness, forced RLS and denied role access. Data/roles are created **only in a fresh GitHub Actions `postgres:17` service container**, never in connected Supabase, any local Windows Docker, real Orders, or the V17.21 Cloudflare replay Durable Object.

**Caveat:** A composite FK establishes referential integrity, not that a Meta PSID or Zalo actor owns a legitimate channel account, nor that the OTP was independently delivered/consumed, nor durable auth/concurrency/replay across workers. It does NOT authorize inserting a new order just because `tenant_key`/ `store_key` have a QA prefix, and does not implement a live PostgREST endpoint or send messages.

## Release gates and safe rollback

- **SOURCE QA:** verify at exact-head GitHub Actions run of `.github/workflows/v1722c-pg17-disposable-ledger-security.yml`; test IDs and CI logs required before `TESTED` label.
- **BLOCKED:** independently verified Page/Bot→Store ownership; two confirmed Auth JWT users for Store A/B; new approved private order & link ledger with narrow writer, row access and durable replay; real 2-provider callback compatibility; real signed operator review; Store RLS and rollback readiness.
- **Actual Messenger→Zalo test:** no action until separately approved opt-in QA canary using consenting test accounts, synthetic-only order, a private and registered Store and no stock/payment changes. Unprefixed Messenger may still invoke AI_SALES_DEMO tools.
- **NO** changes to Supabase hosted DB, n8n Published graph, actual Meta/Zalo OA, Cloudflare Workers/R2/DO, real backup or credentials; no production deploy.
- **Rollback:** close the child Draft PR, which only contains source + synthetic PostgreSQL CI test; do not delete/reclassify old P1/P2/O1/O2 rows.

**Checkpoint:** `V17.22C_PG17_COMPOSITE_FOREIGN_KEYS_SOURCE_ONLY · MESSENGER_ZALO_LIVE_NO_GO · PRIVATE_M0_DEFERRED_NOT_WAIVED`.

## First real disposable PostgreSQL 17 CI evidence

[GitHub Actions run 44090797301](https://github.com/ngoctien20/demo-git/actions/runs/44090797301) on source commit `a103b37755b6e39b57159a39df4dd92021c7ff93`: **successful PG17 job**, 74/74 inherited Node cases PASS and direct PostgreSQL fixture acceptance. CI logs produced explicit pass evidence for:
- Forced RLS and zero client/provider grants or policies across all four QA tables
- Cross-Store, cross-Tenant and wrong-Messenger-owner challenge rejection
- Cross-Store, cross-Tenant, wrong Messenger/Zalo actor confirmed-link rejection
- Duplicate and conflicting provider replay key rejection
- Exactly two QA orders, one QA challenge, one QA link and one replay entry persisted in the disposable service

Hosted/provider release job intentionally **SKIPPED** by a static `if: false` condition. This is **not** a real Supabase, Redis, durable Cloudflare DO or real two-channel UAT result. Since this checkpoint adds documentation to a later commit, verify the newer exact HEAD CI separately before promotion.
