#!/usr/bin/env bash
# Run against GitHub Actions postgres:17 disposable service container ONLY.
# Does not contact hosted Supabase or production Messenger.
set -euo pipefail
cid="$1"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
claim_sql="SELECT disposition FROM t404_g11_disposable_qa.acquire_nosend(
 'MESSENGER',decode(repeat('aa',32),'hex'),
 decode(repeat('bb',32),'hex'),decode(repeat('cc',32),'hex'),
 clock_timestamp(),120);"
pids=""
for n in $(seq 1 24);do
 docker exec "$cid" psql -X -qAt -v ON_ERROR_STOP=1 -U qa -d qa \
   -c "$claim_sql" >"$tmp/result-$n" 2>"$tmp/stderr-$n" &
 pids="$pids $!"
done
failed=0
for pid in $pids;do
 wait "$pid" || failed=1
done
[[ "$failed" = 0 ]] || {
 echo "G11 PG17 parallel claimant failed, investigate private stderr" >&2
 exit 1
}
claimed=0
leased=0
for n in $(seq 1 24);do
 value="$(tr -d '[:space:]' <"$tmp/result-$n")"
 case "$value" in
  claimed) claimed=$((claimed+1));;
  leased) leased=$((leased+1));;
  *) echo "G11 UNEXPECTED CANDIDATE OUTCOME" >&2;exit 1;;
 esac
done
[[ "$claimed" = 1 && "$leased" = 23 ]] || {
 echo "G11 24-session serialization did not yield 1 claimed + 23 leased" >&2
 exit 1
}
n="$(docker exec "$cid" psql -X -qAt -v ON_ERROR_STOP=1 -U qa -d qa -c "
 SELECT count(*) FROM t404_g11_disposable_qa.event_ledger
 WHERE installation_digest=decode(repeat('aa',32),'hex')
 AND event_digest=decode(repeat('bb',32),'hex');" | tr -d '[:space:]')"
[[ "$n" = 1 ]] || { echo "G11 duplicate ledger rows" >&2;exit 1; }
result="$(docker exec "$cid" psql -X -qAt -v ON_ERROR_STOP=1 -U qa -d qa -c "
 SELECT t404_g11_disposable_qa.complete_nosend(
 'MESSENGER',decode(repeat('aa',32),'hex'),decode(repeat('bb',32),'hex'),
 (SELECT lease_token FROM t404_g11_disposable_qa.event_ledger
  WHERE installation_digest=decode(repeat('aa',32),'hex')
  AND event_digest=decode(repeat('bb',32),'hex')),
 clock_timestamp());" | tr -d '[:space:]')"
[[ "$result" = completed ]] || { echo "G11 winning worker not finalized" >&2;exit 1; }
again="$(docker exec "$cid" psql -X -qAt -v ON_ERROR_STOP=1 -U qa -d qa -c "$claim_sql" | tr -d '[:space:]')"
[[ "$again" = done ]] || { echo "G11 completed event reprocessed" >&2;exit 1; }
altered="$(docker exec "$cid" psql -X -qAt -v ON_ERROR_STOP=1 -U qa -d qa -c "
 SELECT disposition FROM t404_g11_disposable_qa.acquire_nosend(
 'MESSENGER',decode(repeat('aa',32),'hex'),
 decode(repeat('bb',32),'hex'),decode(repeat('dd',32),'hex'),
 clock_timestamp(),120);" | tr -d '[:space:]')"
[[ "$altered" = conflict ]] || { echo "G11 payload conflict was not denied" >&2;exit 1; }
echo "PASS G11 PG17: 24 DB sessions => 1 claimed / 23 leased / 1 row; finalized then done, changed payload conflict"
