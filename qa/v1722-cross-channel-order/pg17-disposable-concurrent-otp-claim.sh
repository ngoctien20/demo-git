#!/usr/bin/env bash
# TIEN404 V17.22E - TWO REAL PostgreSQL 17 CLIENTS, SYNTHETIC DATA ONLY.
# Dedicated disposable GitHub Actions postgres:17 service, never hosted Supabase.
set -euo pipefail
if [[ "$GITHUB_ACTIONS" != "true" || "$CI" != "true" ||
      "$PGDATABASE" != "t404_v1722_ci" || "$PGUSER" != "postgres" ||
      -z "$RUNNER_TEMP" ]]; then
  echo 'BLOCKED_CI_DISPOSABLE_PG17_ONLY'; exit 4
fi
identity=$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT current_database()||':'||current_user||':'||(current_setting('server_version_num')::int/10000)")
if [[ "$identity" != "t404_v1722_ci:postgres:17" ]]; then
  echo 'BLOCKED_UNTRUSTED_DB_TARGET'; exit 4
fi

tmp=$(mktemp -d "$RUNNER_TEMP/t404-v1722e-concurrent.XXXXXX")
trap 'rm -f "$tmp/first.log"; rmdir "$tmp"' EXIT
psql -X -q -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO tien404_v1722_qa.link_challenges
 (link_ref,order_ref,tenant_key,store_key,messenger_actor_hmac,messenger_otp_hmac,
  zalo_actor_hmac,zalo_otp_hmac,expires_at)
VALUES
 ('QA-LINK-00010','QA-ORD-00001','QA_TENANT_1','QA_STORE_A',
  repeat('a',64),repeat('d',64),repeat('c',64),repeat('f',64),now()+interval '5 min');
SQL

# Session 1 locks the exact row and holds it through a real PostgreSQL sleep.
# Session 2 begins only after pg_stat_activity proves session 1 sleeps
# WITH THE ROW LOCK HELD, then blocks until session 1 commits its update.
psql -X -A -t -v ON_ERROR_STOP=1 >"$tmp/first.log" 2>&1 <<'SQL' &
BEGIN;
SET LOCAL application_name='t404_v1722e_holder';
SELECT link_ref FROM tien404_v1722_qa.link_challenges
 WHERE link_ref='QA-LINK-00010' FOR UPDATE;
SELECT pg_sleep(5);
WITH won AS (
 UPDATE tien404_v1722_qa.link_challenges SET consumed_at=clock_timestamp()
 WHERE link_ref='QA-LINK-00010'
   AND tenant_key='QA_TENANT_1' AND store_key='QA_STORE_A'
   AND messenger_actor_hmac=repeat('a',64) AND zalo_actor_hmac=repeat('c',64)
   AND consumed_at IS NULL AND expires_at>clock_timestamp() AND attempts<3
 RETURNING link_ref
) SELECT count(*) FROM won;
COMMIT;
SQL
first_pid=$!

saw_lock_sleep=0
for i in $(seq 1 70); do
  sleep 0.05
  observed=$(psql -X -A -t -v ON_ERROR_STOP=1 -c "
     SELECT count(*) FROM pg_stat_activity
      WHERE datname='t404_v1722_ci'
        AND application_name='t404_v1722e_holder'
        AND wait_event='PgSleep'")
  if [[ "$observed" = 1 ]]; then saw_lock_sleep=1; break; fi
done
if [[ "$saw_lock_sleep" != 1 ]]; then
  wait "$first_pid" || true
  echo 'BLOCKED_FIRST_LOCK_NOT_WITNESSED'; exit 5
fi

# A second psql process/connection, started during the first transaction.
second=$(psql -X -A -t -v ON_ERROR_STOP=1 -c "
WITH won AS (
 UPDATE tien404_v1722_qa.link_challenges SET consumed_at=clock_timestamp()
 WHERE link_ref='QA-LINK-00010'
   AND tenant_key='QA_TENANT_1' AND store_key='QA_STORE_A'
   AND messenger_actor_hmac=repeat('a',64) AND zalo_actor_hmac=repeat('c',64)
   AND consumed_at IS NULL AND expires_at>clock_timestamp() AND attempts<3
 RETURNING link_ref
) SELECT count(*) FROM won;")
if ! wait "$first_pid"; then
  echo 'BLOCKED_FIRST_TRANSACTION_ERROR'; exit 5
fi
if [[ "$second" != 0 ]] || ! grep -qx '1' "$tmp/first.log"; then
  echo 'BLOCKED_DUPLICATE_OR_MISSING_OTP_CLAIM'; exit 5
fi

psql -X -q -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n
 FROM tien404_v1722_qa.link_challenges
 WHERE link_ref='QA-LINK-00010' AND is_consumed=true;
 IF n<>1 THEN RAISE EXCEPTION 'CONCURRENT_OTP_CLAIM_NOT_PERSISTED'; END IF;
END $$;
INSERT INTO tien404_v1722_qa.channel_links
 (tenant_key,store_key,messenger_actor_hmac,zalo_actor_hmac,verified_challenge_ref)
VALUES ('QA_TENANT_1','QA_STORE_A',repeat('a',64),repeat('c',64),'QA-LINK-00010');
DELETE FROM tien404_v1722_qa.channel_links
 WHERE tenant_key='QA_TENANT_1' AND store_key='QA_STORE_A' AND zalo_actor_hmac=repeat('c',64);
DELETE FROM tien404_v1722_qa.link_challenges
 WHERE link_ref='QA-LINK-00010';
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM tien404_v1722_qa.link_challenges
 WHERE link_ref='QA-LINK-00010';
 IF n<>0 THEN RAISE EXCEPTION 'DISPOSABLE_OTP_RACE_FIXTURE_NOT_CLEANED'; END IF;
 RAISE NOTICE 'PASS_TWO_CLIENTS_ONE_OTP_CLAIM_LOCK_AND_ROLLBACK_CLEAN';
END $$;
SQL
echo 'PASS_REAL_TWO_PG17_CLIENTS_SINGLE_CONSUME_NO_SEND'
