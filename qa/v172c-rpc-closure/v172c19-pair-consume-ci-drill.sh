#!/usr/bin/env bash
# Ephemeral CI PostgreSQL 17 ONLY; never touch Supabase or real Auth users.
set -euo pipefail
[[ "${PGHOST:?}" == "127.0.0.1" && "${PGDATABASE:?}" == "postgres" ]] || exit 91
root=qa/v172c-rpc-closure
psql -X -q -v ON_ERROR_STOP=1 -f "$root/v172c19-private-pair-consume-candidate_NOT_EXECUTED.sql"
# Assert no exposed role can EXECUTE the private function.
for role in anon authenticated; do
 granted="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT has_function_privilege('$role','tien404_v172c18_private.consume_pair(text,text,text,text,text,text,text,text,text)','EXECUTE');")"
 [[ "$granted" == "f" ]] || { echo "FAIL: $role can execute pair consume"; exit 2; }
done
# Dedicated unexpired synthetic pair; actor refs are deliberately fake.
psql -X -q -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO tien404_v172c18_private.consent_receipts
(receipt_id,actor_slot,project_ref,tenant_ref,store_ref,subject_ref,scope,reviewer_ref,auth_evidence_ref,issued_at,expires_at)
VALUES
(repeat('d',32),'QA_A','ephemeral-qa','synthetic-t','store-a','subject-a','synthetic_catalog_readonly_no_send_no_write','reviewer','fake-a',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '10 minutes'),
(repeat('e',32),'QA_B','ephemeral-qa','synthetic-t','store-b','subject-b','synthetic_catalog_readonly_no_send_no_write','reviewer','fake-b',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '10 minutes'),
(repeat('f',32),'QA_A','ephemeral-qa','synthetic-t','store-a','subject-a','synthetic_catalog_readonly_no_send_no_write','reviewer','fake-a2',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '10 minutes'),
(repeat('1',32),'QA_A','ephemeral-qa','synthetic-t','store-a','subject-a','synthetic_catalog_readonly_no_send_no_write','reviewer','fake-a3',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '10 minutes'),
(repeat('2',32),'QA_B','ephemeral-qa','synthetic-t','store-b','subject-b','synthetic_catalog_readonly_no_send_no_write','reviewer','fake-b3',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '10 minutes');
SQL
call="SELECT tien404_v172c18_private.consume_pair(repeat('d',32),repeat('e',32),'ephemeral-qa','synthetic-t','store-a','store-b','subject-a','subject-b','reviewer');"
# Two independent transactions contend for exactly the same two rows.
psql -X -qAt -v ON_ERROR_STOP=1 -c "BEGIN; $call SELECT pg_sleep(2); COMMIT;" >/tmp/v172c19-pair-race1.log 2>&1 &
first=$!
sleep 0.4
# Second invocation must fail (raise) without partial mutation.
if psql -X -qAt -v ON_ERROR_STOP=1 -c "$call" >/tmp/v172c19-pair-race2.log 2>&1; then
 echo "FAIL: replayed pair was consumed"; exit 3
fi
wait "$first"
grep -qx '2' /tmp/v172c19-pair-race1.log
grep -q 'PAIR_ADMISSION_DENIED' /tmp/v172c19-pair-race2.log
count="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM tien404_v172c18_private.consent_receipts WHERE receipt_id IN (repeat('d',32),repeat('e',32)) AND state='consumed';")"
[[ "$count" == "2" ]] || { echo "FAIL: pair did not both commit"; exit 4; }
# A valid A paired with a revoked B fails; A stays issued.
if psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT tien404_v172c18_private.consume_pair(repeat('f',32),repeat('b',32),'ephemeral-qa','synthetic-t','store-a','store-b','subject-a','subject-b','reviewer');" >/tmp/v172c19-pair-invalid.log 2>&1; then
 echo "FAIL: revoked B admitted"; exit 5
fi
state="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT state FROM tien404_v172c18_private.consent_receipts WHERE receipt_id=repeat('f',32);")"
[[ "$state" == "issued" ]] || { echo "FAIL: partial pair consumption"; exit 6; }
# Wrong Store fail closed for both receipts; followed by normal successful use.
if psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT tien404_v172c18_private.consume_pair(repeat('1',32),repeat('2',32),'ephemeral-qa','synthetic-t','store-a','WRONG','subject-a','subject-b','reviewer');" >/tmp/v172c19-pair-store.log 2>&1; then
 echo "FAIL: mismatched Store admitted"; exit 7
fi
remaining="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM tien404_v172c18_private.consent_receipts WHERE receipt_id IN (repeat('1',32),repeat('2',32)) AND state='issued';")"
[[ "$remaining" == "2" ]] || { echo "FAIL: partial update after Store mismatch"; exit 8; }
success="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT tien404_v172c18_private.consume_pair(repeat('1',32),repeat('2',32),'ephemeral-qa','synthetic-t','store-a','store-b','subject-a','subject-b','reviewer');")"
[[ "$success" == "2" ]] || { echo "FAIL: valid pair not consumed"; exit 9; }
echo "PASS: private grants; pair atomic 2/2; concurrent replay DENIED; revoked B and Store mismatch leave A untouched."
