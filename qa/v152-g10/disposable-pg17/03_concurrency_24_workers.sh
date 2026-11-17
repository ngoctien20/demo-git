#!/usr/bin/env bash
# G0.10 disposable PostgreSQL 17 ONLY.
# 24 independent DB sessions compete to atomically claim the same event.
set -euo pipefail
cid="$1"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
sql="SELECT t404_g10_disposable_qa.claim_once('MESSENGER',
 decode(repeat('aa',32),'hex'),decode(repeat('bb',32),'hex'),
 decode(repeat('cc',32),'hex'));"
pids=""
for n in $(seq 1 24); do
  docker exec "$cid" psql -X -qAt -v ON_ERROR_STOP=1 \
    -U qa -d qa -c "$sql" >"$tmp/out-$n" 2>"$tmp/err-$n" &
  pids="$pids $!"
done
fail=0
for pid in $pids; do
  wait "$pid" || fail=1
done
if [[ "$fail" -ne 0 ]]; then
  echo "G10_ERROR: a disposable PostgreSQL claimant failed" >&2
  exit 1
fi
claimed=0
duplicate=0
for n in $(seq 1 24); do
  value="$(tr -d '[:space:]' <"$tmp/out-$n")"
  case "$value" in
    claimed) claimed=$((claimed+1));;
    duplicate) duplicate=$((duplicate+1));;
    *) echo "G10_UNKNOWN_PG_CLAIM_OUTCOME" >&2;exit 1;;
  esac
done
[[ "$claimed" -eq 1 && "$duplicate" -eq 23 ]] || {
  echo "G10 FAIL: require exactly 1 claimed and 23 duplicate" >&2
  exit 1
}
count="$(docker exec "$cid" psql -X -qAt -v ON_ERROR_STOP=1 -U qa -d qa -c "
 SELECT count(*) FROM t404_g10_disposable_qa.event_claims
 WHERE provider='MESSENGER'
   AND installation_digest=decode(repeat('aa',32),'hex')
   AND event_digest=decode(repeat('bb',32),'hex');" | tr -d '[:space:]')"
[[ "$count" = 1 ]] || { echo "G10 UNIQUE ROW ASSERTION FAILED" >&2;exit 1; }
conflict="$(docker exec "$cid" psql -X -qAt -v ON_ERROR_STOP=1 -U qa -d qa -c "
 SELECT t404_g10_disposable_qa.claim_once('MESSENGER',
 decode(repeat('aa',32),'hex'),decode(repeat('bb',32),'hex'),
 decode(repeat('dd',32),'hex'));" | tr -d '[:space:]')"
[[ "$conflict" = conflict ]] || { echo "G10 SAME_MID_DIFFERENT_BODY_NOT_DENIED" >&2;exit 1; }
echo "PASS G10 disposable PG17: 24 independent SQL sessions => 1 claimed, 23 duplicate, 1 row, altered payload conflict"
