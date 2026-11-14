# TIEN404 V12.3 — Real two-session PostgreSQL lock QA

**NOT EXECUTED SUCCESSFULLY.** This script must run using **two independent persistent PostgreSQL connections** against Supabase staging `ifxlvrhyjhbzbrkdsida`, never browser/client exposed keys. Use a trusted QA connection with only explicitly reviewed privileges. Do not modify production. All data below is synthetic.

## Preconditions

- Confirm 0 rows in private sessions/receipts. Current migration `20261114144917_v12_3_shop_b_private_session_qa` applied, RLS enabled and only trusted PostgreSQL owner role able to read private schema.
- Open **two separate physical database connections** (A and B). Avoid running via a connector that serializes all calls; prior MCP parallel attempt reported **no observed wait**.
- Insert exactly one synthetic fixture from a privileged staging QA console:

```sql
INSERT INTO tien404_dialogue_private.shop_b_sessions
 (scope_key,tenant_key,store_key,bot_key,binding_fingerprint,expires_at)
VALUES (repeat('d',64),'qa-tenant-b','qa-store-b','qa-bot-b',
        'V12_3_concurrency_qa_fixture',now()+interval '10 minutes')
ON CONFLICT DO NOTHING;
```

## Session A (start first, hold)

```sql
BEGIN;
SET LOCAL statement_timeout = '12s';
SELECT scope_key FROM tien404_dialogue_private.shop_b_sessions
WHERE scope_key=repeat('d',64) FOR UPDATE;
SELECT pg_sleep(5);
ROLLBACK;
```

## Session B (start while A is sleeping)

```sql
BEGIN;
SET LOCAL statement_timeout = '12s';
SELECT pg_sleep(0.5);
SELECT clock_timestamp() AS before_lock;
SELECT scope_key FROM tien404_dialogue_private.shop_b_sessions
WHERE scope_key=repeat('d',64) FOR UPDATE;
SELECT clock_timestamp() AS after_lock;
ROLLBACK;
```

**Expected:** B's FOR UPDATE waits until A releases the row lock, with `after_lock - before_lock` around several seconds if true overlap. Record session IDs `pg_backend_pid()`, timings and `pg_stat_activity.wait_event_type='Lock'` while blocked. Verify A/B backend PIDs differ. A near-zero wait is **not enough evidence**.

## Cleanup (QA fixture only)

```sql
DELETE FROM tien404_dialogue_private.shop_b_sessions
WHERE scope_key=repeat('d',64)
  AND binding_fingerprint='V12_3_concurrency_qa_fixture';
SELECT count(*) FROM tien404_dialogue_private.shop_b_sessions;
SELECT count(*) FROM tien404_dialogue_private.shop_b_receipts;
```

Both counts must be zero. Never `DELETE` other rows. Next, independently test duplicate event hashes across two workers and rollback injection before approving webhook integration.
