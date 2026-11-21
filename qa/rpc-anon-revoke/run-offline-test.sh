#!/usr/bin/env bash
# Offline test on a disposable local PostgreSQL. Usage: run-offline-test.sh  (needs initdb/pg_ctl)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../.."
MIG="$ROOT/supabase/migrations/20261121100000_revoke_anon_qa_shop_b_zalo_claim.sql"
BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin | tail -1)}"
D="$(mktemp -d)"; PORT=55439
cleanup(){ "$BIN/pg_ctl" -D "$D/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$D"; }; trap cleanup EXIT
"$BIN/initdb" -D "$D/data" -U postgres -A trust >/dev/null
"$BIN/pg_ctl" -D "$D/data" -o "-p $PORT -k $D -c listen_addresses=''" -l "$D/log" -w start >/dev/null
P(){ psql -X -q -v ON_ERROR_STOP=1 -h "$D" -p $PORT -U postgres -d postgres "$@"; }
pass=0; fail=0
ok(){ echo "PASS  $1"; pass=$((pass+1)); }; ko(){ echo "FAIL  $1"; fail=$((fail+1)); }
GOOD="{\"x-tien404-pairing\":\"$(printf 'k%.0s' $(seq 48))\"}"
call(){ # role header -> prints result or SQLSTATE
  P -At -v VERBOSITY=terse -c "SET ROLE $1; SELECT set_config('request.headers', '$2', false);" \
        -c "SELECT public.qa_shop_b_zalo_claim('00000000-0000-0000-0000-000000000001','0123456789abcdef0123456789abcdef','qa-owner','qa-one')" 2>&1 | tail -1
}
expect(){ local name="$1" want="$2" got="$3"; if [[ "$got" == *"$want"* ]]; then ok "$name"; else ko "$name (got: $got)"; fi; }

P -f "$HERE/fixture.sql" >/dev/null
echo "== Before migration (live ACL) =="
expect "anon with valid header can execute (reproduces finding)" "t" "$(call anon "$GOOD")"
expect "anon with bad header blocked by in-function gate" "insufficient_privilege" "$(call anon '{"x-tien404-pairing":"nope"}')"

echo "== Apply migration =="
P -f "$MIG" >/dev/null && ok "migration applies cleanly" || ko "migration apply"
expect "anon denied even with valid header" "permission denied for function qa_shop_b_zalo_claim" "$(call anon "$GOOD")"
expect "authenticated denied" "permission denied for function qa_shop_b_zalo_claim" "$(call authenticated "$GOOD")"
expect "service_role with valid header succeeds" "t" "$(call service_role "$GOOD")"
expect "service_role without header still blocked by gate" "insufficient_privilege" "$(call service_role '{}')"
expect "service_role wrong header blocked by gate" "insufficient_privilege" "$(call service_role '{"x-tien404-pairing":"nope"}')"
expect "ACL after migration" "{postgres=X/postgres,service_role=X/postgres}" "$(P -At -c "select proacl::text from pg_proc where proname='qa_shop_b_zalo_claim'")"
expect "still SECURITY DEFINER, body untouched" "t" "$(P -At -c "select prosecdef from pg_proc where proname='qa_shop_b_zalo_claim'")"
P -f "$MIG" >/dev/null && ok "migration is idempotent (re-run)" || ko "re-run"

echo "== Drift guard =="
P -c "ALTER FUNCTION public.qa_shop_b_zalo_claim(uuid,text,text,text) SECURITY INVOKER" >/dev/null
out="$(P -f "$MIG" 2>&1 || true)"; expect "guard aborts if function drifted" "re-audit" "$out"
P -c "ALTER FUNCTION public.qa_shop_b_zalo_claim(uuid,text,text,text) SECURITY DEFINER" >/dev/null

echo "== Rollback =="
P -f "$HERE/rollback.sql" >/dev/null
expect "ACL restored to live value" "{postgres=X/postgres,anon=X/postgres}" "$(P -At -c "select proacl::text from pg_proc where proname='qa_shop_b_zalo_claim'")"
expect "anon works again after rollback" "t" "$(call anon "$GOOD")"

echo "== $pass passed, $fail failed =="; [ $fail -eq 0 ]
