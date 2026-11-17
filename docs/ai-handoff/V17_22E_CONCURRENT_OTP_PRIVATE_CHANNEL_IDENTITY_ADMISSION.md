# TIEN404 V17.22E — Concurrent OTP Claim × Private Channel Identity Admission

**2026-11-17 JST | DRAFT / NO SEND / DISPOSABLE PG17 & SYNTHETIC QA ONLY.**

## Ownership and inherited gates

- Parent: [V17.22D #356](https://github.com/ngoctien20/demo-git/pull/356), exact pinned `3c716c9c09f7084ac70e6c61f2db13447fe19654`, which already checked PostgreSQL generated `is_consumed` and single-session conditional consume.
- Earlier SQL scope: [V17.22C #351](https://github.com/ngoctien20/demo-git/pull/351) composite Tenant/Store/Messenger/Zalo FK, 4 forced-RLS tables, zero public grants.
- Parallel PR [#352](https://github.com/ngoctien20/demo-git/pull/352) and [#354](https://github.com/ngoctien20/demo-git/pull/354) own canonical Store/merchant original evidence, M0–M5, dual real JWT. This PR MUST NOT duplicate their migrations or assert real ownership.
- User chose to **defer** local Windows backup preflight and advance source QA; this is NOT approval to skip full recovery before hosted deployment.

## E1 — Actual two-client PostgreSQL 17 contention

`qa/v1722-cross-channel-order/pg17-disposable-concurrent-otp-claim.sh` runs only on a GitHub Actions runner whose database name, user and PostgreSQL major version are independently checked. `GITHUB_ACTIONS`, `CI`, `PGDATABASE`, `PGUSER` and `RUNNER_TEMP` are mandatory; otherwise it denies before SQL.

The script uses **two independent OS `psql` processes / PostgreSQL connections** against the *same fake* challenge:
1. Session 1 begins a transaction, locks the row with `SELECT ... FOR UPDATE` and sleeps inside PostgreSQL with the lock held. The test checks `pg_stat_activity` for that specific sleeping session.
2. Session 2 concurrently issues the same **conditional** `UPDATE ... consumed_at IS NULL ... RETURNING`. It cannot update until the first transaction releases the row.
3. Exactly one claim must update one row; the other must update zero. The final generated consumption flag and linked identity scope are checked, then the disposable QA rows are cleaned.

This is real two-client PostgreSQL row lock/concurrency behavior, not just JavaScript promises. **Limit:** database row lock correctness for a synthetic challenge does not validate an actual OTP, delivery, consent, or that a future private writer has verified the native provider and issued only one authorization. Durable replay and retention across actual hosted workers remain untested.

## E2 — Out-of-band private synthetic channel identity receipt

`private-channel-identity-admission.mjs` reuses the exact V17.22B `createQaCommandRouter`; no duplicated Commerce engine or bot is created.

- Receipts are obtained through a separately injected `fetchPrivateReceipt` callback, **never** from raw customer-supplied webhook JSON. Each receipt is signed via Ed25519 by an internal **ephemeral CI QA issuer**; the verification key is independently injected, not obtained from the receipt. There is **no signing key**, provider credential or customer identifier committed to GitHub.
- Verifies exact schema, signature and issuer, 60-second maximum TTL, the specific channel/install route, sender digest and full message digest, a server-configured synthetic installation registry and matching Tenant/Store. Revoked or unknown installations reject.
- Receipts must explicitly be `scope=SYNTHETIC_ONLY`, `no_send=true`, `native_verified=false` and `owner_verified=false`; a forged claim of real Meta/Zalo/Store authorization is rejected. All outputs retain `provider_sends=0`, `commerce_writes=0`, `native_provider_verified=false` and `real_store_owner_verified=false`.
- The inherited router expects an internal boolean `provider_verified=true` **after this synthetic signature check only**. That is a QA fixture compatibility field, **NOT** a verified native Meta or Zalo provider signature. Never connect this bridge directly to a real bot callback or Commerce writer; production needs a separate native HMAC/header issuer and independently verified merchant installed Store registry.
- 19 negative/positive tests cover fake Page/Bot A, attacker accounts, wrong keys/issuers, replay/mismatch identity fields, unknown or revoked channel, TTL expiry, forced owner/native proof, malformed commands, no-send and denial of unauthorized Store claims.

**Important:** Event hash uses SHA-256 on synthetic event fields. Real PSID/Zalo actor privacy requires a server-held per-tenant secret/HMAC or equivalent, not raw IDs or unkeyed public hashes. Receipt lookup, key custody and revocation are represented by injected callbacks/registry, not a deployed service.

## Acceptance / release

- `IMPLEMENTED` means the source and CI tests exist. `TESTED` requires exact-head GitHub Actions PASS: independent V17.22 inherited tests, 75+ Node assertions, PG17 original FK/replay/OTP tests, and two-client lock race. Do not claim native signed provider proof from fake Ed25519 receipts.
- **NO-GO**: hosted Supabase migration, authentic Meta/Zalo App or OA owner proof, signed Page/Bot callback to this adapter, real two-person Store A/B Auth/JWT RLS, cross-channel customer identity, live provider sends, production Orders, payment/stock changes, backups or credentials.
- **Rollback:** close the child Draft PR. No n8n/Supabase/Cloudflare/Meta/Zalo hosted state touched and no customer data used. All CI DB data is disposable.

**Checkpoint:** `V17.22E_PG17_TWO_CLIENT_RACE_CANDIDATE · PRIVATE_SYNTHETIC_SIGNED_ADMISSION · REAL_IDENTITY_NO_GO · HOSTED_NO_GO`.
