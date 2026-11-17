#!/usr/bin/env bash
# G0.12: 24 competing SQL sessions for ONE operator case, disposable PG17 only.
set -euo pipefail
cid="$1"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
# simpler: claim one at an old timestamp, then enqueue at a newer one
docker exec "$cid" psql -X -q -v ON_ERROR_STOP=1 -U qa -d qa -c "
SELECT disposition FROM t404_g11_disposable_qa.acquire_nosend(
 'MESSENGER',decode(repeat('aa',32),'hex'),decode(repeat('ab',32),'hex'),
 decode(repeat('ac',32),'hex'),'2026-11-17 00:00:00+00'::timestamptz,10);
SELECT * FROM t404_g12_disposable_qa.enqueue_timeout_and_uncertain(
 '2026-11-17 00:00:11+00'::timestamptz,100);" >/dev/null
case_id="$(docker exec "$cid" psql -X -qAt -v ON_ERROR_STOP=1 -U qa -d qa -c "
 SELECT case_id FROM t404_g12_disposable_qa.review_cases
 WHERE installation_digest=decode(repeat('aa',32),'hex')
 AND event_digest=decode(repeat('ab',32),'hex');" | tr -d '[:space:]')"
[[ "$case_id" =~ ^[0-9a-f-]{36}$ ]] || { echo "G12_DISPOSABLE_CASE_ID_INVALID" >&2;exit 1; }
pids=""
for n in $(seq 1 24); do
 actor="qaop_worker_$(printf '%02d' "$n")"
 docker exec "$cid" psql -X -qAt -v ON_ERROR_STOP=1 -U qa -d qa -c "
 SELECT result FROM t404_g12_disposable_qa.take_for_review(
 '$case_id'::uuid,'$actor',clock_timestamp(),120);" \
 >"$tmp/out-$n" 2>"$tmp/err-$n" &
 pids="$pids $!"
done
failed=0
for pid in $pids; do wait "$pid" || failed=1;done
[[ "$failed" = 0 ]] || { echo "G12_PARALLEL_SQL_ERROR" >&2;exit 1; }
claimed=0
busy=0
for n in $(seq 1 24); do
 result="$(tr -d '[:space:]' <"$tmp/out-$n")"
 case "$result" in
  claimed) claimed=$((claimed+1));;
  busy) busy=$((busy+1));;
  *) echo "G12_UNEXPECTED_OPERATOR_REVIEW_OUTCOME" >&2; exit 1;;
 esac
done
[[ "$claimed" = 1 && "$busy" = 23 ]] || {
 echo "G12_OPERATOR_QUEUE_NOT_ATOMIC" >&2;exit 1; }
count="$(docker exec "$cid" psql -X -qAt -v ON_ERROR_STOP=1 -U qa -d qa -c "
 SELECT count(*) FROM t404_g12_disposable_qa.review_cases
 WHERE case_id='$case_id'::uuid;" | tr -d '[:space:]')"
[[ "$count" = 1 ]] || { echo "G12_QUEUE_DUPLICATE_CASE_CREATED" >&2;exit 1; }
echo "PASS G12: 24 PostgreSQL sessions => 1 operator claimed, 23 busy, one immutable case"
