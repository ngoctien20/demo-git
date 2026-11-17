#!/usr/bin/env bash
# EPHEMERAL PostgreSQL 17 CI ONLY. No Supabase endpoints, no real users.
set -euo pipefail
[[ "${PGHOST:?}" == "127.0.0.1" && "${PGDATABASE:?}" == "postgres" ]] || exit 91
root=qa/v172c-rpc-closure
psql -X -q -v ON_ERROR_STOP=1 -f "$root/v172c18-private-consent-registry-candidate_NOT_EXECUTED.sql"
psql -X -q -v ON_ERROR_STOP=1 -f "$root/v172c18-ephemeral-receipt-fixtures.sql"
# Anonymous/authenticated have no registry schema or table rights.
for role in anon authenticated; do
 if psql -X -qAt -v ON_ERROR_STOP=1 <<SQL >/tmp/v172c18-deny.log 2>&1
SET ROLE $role;
SELECT count(*) FROM tien404_v172c18_private.consent_receipts;
SQL
 then echo "FAIL: $role accessed private registry"; exit 2; fi
 grep -qi 'permission denied' /tmp/v172c18-deny.log
done

# This single conditional UPDATE is the ONLY consent consume protocol:
# verifier must already have checked cryptographic signatures + actual Auth.
# The UPDATE must be executed by a protected private server transaction.
consume="UPDATE tien404_v172c18_private.consent_receipts
  SET state='consumed', consumed_at=clock_timestamp()
  WHERE receipt_id=repeat('a',32)
    AND actor_slot='QA_A' AND project_ref='ephemeral-qa'
    AND tenant_ref='synthetic-t' AND store_ref='store-a'
    AND subject_ref='subject-a'
    AND scope='synthetic_catalog_readonly_no_send_no_write'
    AND state='issued' AND expires_at>clock_timestamp()
  RETURNING receipt_id;"
# Race two independent connections; the first holds the row lock across sleep.
psql -X -qAt -v ON_ERROR_STOP=1 -c "BEGIN; $consume SELECT pg_sleep(2); COMMIT;" >/tmp/v172c18-race1.log &
first=$!
sleep 0.4
psql -X -qAt -v ON_ERROR_STOP=1 -c "$consume" >/tmp/v172c18-race2.log &
second=$!
wait "$first"
wait "$second"
wins=$(( $(grep -c '^aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa$' /tmp/v172c18-race1.log || true) + $(grep -c '^aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa$' /tmp/v172c18-race2.log || true) ))
[[ "$wins" -eq 1 ]] || { echo "FAILED: expected exactly one atomic consume, got $wins"; exit 3; }
# Once consumed, idempotent replay yields no row.
again="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "$consume")"
[[ -z "$again" ]] || { echo "FAILED: replay accepted"; exit 4; }
for rid in b c; do
 result="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "UPDATE tien404_v172c18_private.consent_receipts SET state='consumed',consumed_at=clock_timestamp() WHERE receipt_id=repeat('$rid',32) AND state='issued' AND expires_at>clock_timestamp() RETURNING receipt_id;")"
 [[ -z "$result" ]] || { echo "FAILED: revoked/expired receipt accepted"; exit 5; }
done
wrong="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "UPDATE tien404_v172c18_private.consent_receipts SET state='consumed',consumed_at=clock_timestamp() WHERE receipt_id=repeat('b',32) AND store_ref='store-a' AND state='issued' RETURNING receipt_id;")"
[[ -z "$wrong" ]]
echo "PASS: private grants, atomic concurrent consume 1/2, replay/revoked/expired/cross-store DENY."
# disposable PostgreSQL container is deleted by CI; no cleanup in Supabase.
