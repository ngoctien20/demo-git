#!/usr/bin/env bash
# Offline test of the Option A migration on a disposable PostgreSQL 17 container (no network, no secrets).
# Usage: bash qa/rpc-anon-revoke-option-a/run-offline-test.sh   (needs Docker and image postgres:17)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../.."
MIG="supabase/migrations/20261121120000_revoke_anon_only_qa_shop_b_zalo_claim.sql"
IMG="${PG_IMAGE:-postgres:17}"; NAME="t404-optA-$$"
cleanup(){ docker rm -f "$NAME" >/dev/null 2>&1 || true; }; trap cleanup EXIT
docker run -d --name "$NAME" --network none -e POSTGRES_HOST_AUTH_METHOD=trust -v "$ROOT":/repo:ro "$IMG" >/dev/null
for _ in $(seq 60); do docker exec "$NAME" pg_isready -U postgres -q 2>/dev/null && break; sleep 1; done
sleep 2
P(){ docker exec -i "$NAME" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"; }
pass=0; fail=0
ok(){ echo "PASS  $1"; pass=$((pass+1)); }; ko(){ echo "FAIL  $1"; fail=$((fail+1)); }
GOOD="{\"x-tien404-pairing\":\"$(printf 'k%.0s' $(seq 48))\"}"
call(){ # role header -> prints result or error
  P -At -v VERBOSITY=terse -c "SET ROLE $1; SELECT set_config('request.headers', '$2', false);" \
        -c "SELECT public.qa_shop_b_zalo_claim('00000000-0000-0000-0000-000000000001','0123456789abcdef0123456789abcdef','qa-owner','qa-one')" 2>&1 | tail -1
}
expect(){ local name="$1" want="$2" got="$3"; if [[ "$got" == *"$want"* ]]; then ok "$name"; else ko "$name (got: $got)"; fi; }
acl(){ P -At -c "SELECT proacl::text FROM pg_proc WHERE oid='public.qa_shop_b_zalo_claim(uuid,text,text,text)'::regprocedure"; }

echo "server: $(P -At -c 'SHOW server_version')"
P < "$HERE/fixture.sql" >/dev/null
echo "== Before migration (live ACL) =="
expect "live ACL reproduced" "{postgres=X/postgres,anon=X/postgres}" "$(acl)"
expect "anon with valid header can execute (finding reproduced)" "t" "$(call anon "$GOOD")"
expect "anon with bad header blocked by in-function gate" "insufficient_privilege" "$(call anon '{"x-tien404-pairing":"nope"}')"

echo "== Apply Option A migration =="
P -f "/repo/$MIG" >/dev/null && ok "migration applies cleanly" || ko "migration apply"
expect "anon denied even with valid header" "permission denied for function qa_shop_b_zalo_claim" "$(call anon "$GOOD")"
expect "authenticated denied" "permission denied for function qa_shop_b_zalo_claim" "$(call authenticated "$GOOD")"
expect "service_role NOT granted (no RLS-bypass key needed)" "permission denied for function qa_shop_b_zalo_claim" "$(call service_role "$GOOD")"
expect "ACL after migration is owner-only" "{postgres=X/postgres}" "$(acl)"
expect "still SECURITY DEFINER, body untouched" "t|t" "$(P -At -c "SELECT prosecdef, prosrc LIKE '%x-tien404-pairing%' FROM pg_proc WHERE oid='public.qa_shop_b_zalo_claim(uuid,text,text,text)'::regprocedure")"
P -f "/repo/$MIG" >/dev/null 2>&1 && ok "migration is idempotent (re-run)" || ko "re-run"

echo "== Drift guards =="
P -c "GRANT EXECUTE ON FUNCTION public.qa_shop_b_zalo_claim(uuid,text,text,text) TO service_role" >/dev/null
if P -f "/repo/$MIG" >/dev/null 2>&1; then ko "guard aborts if service_role has EXECUTE"; else ok "guard aborts if service_role has EXECUTE"; fi
P -c "REVOKE EXECUTE ON FUNCTION public.qa_shop_b_zalo_claim(uuid,text,text,text) FROM service_role" >/dev/null
P -c "ALTER FUNCTION public.qa_shop_b_zalo_claim(uuid,text,text,text) SECURITY INVOKER" >/dev/null
if P -f "/repo/$MIG" >/dev/null 2>&1; then ko "guard aborts if no longer SECURITY DEFINER"; else ok "guard aborts if no longer SECURITY DEFINER"; fi
P -c "ALTER FUNCTION public.qa_shop_b_zalo_claim(uuid,text,text,text) SECURITY DEFINER" >/dev/null

echo "== Rollback =="
P < "$HERE/rollback.sql" >/dev/null && ok "rollback applies"
expect "ACL restored to live value" "{postgres=X/postgres,anon=X/postgres}" "$(acl)"
expect "anon works again after rollback" "t" "$(call anon "$GOOD")"
echo "== $pass passed, $fail failed =="
[[ $fail -eq 0 ]]
