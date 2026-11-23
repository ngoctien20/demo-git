#!/usr/bin/env bash
# TIEN404 WS-A shared harness: LOCAL/DISPOSABLE PostgreSQL only. Sourced by the WS-A scripts.
# Simulates Supabase API roles (anon/authenticated/service_role) + request.jwt.claims, exactly like
# qa/v20-store-authority, qa/v23-web and qa/config-core. Refuses any non-local host or hosted credentials.
set -euo pipefail
WSA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; ROOT="$(cd "$WSA_DIR/../.." && pwd)"
: "${PGHOST:?set PGHOST (local only)}"; : "${PGPORT:=5432}"; : "${PGUSER:=postgres}"
case "$PGHOST" in /*|127.0.0.1|localhost) ;; *) echo "REFUSE_NON_LOCAL_HOST"; exit 2;; esac
[ -z "${SUPABASE_DB_URL:-}${SUPABASE_ACCESS_TOKEN:-}${DATABASE_URL:-}${STAGING_DB_PASSWORD:-}${RESTORE_DB_PASSWORD:-}" ] || { echo "REFUSE_HOSTED_ENV"; exit 2; }
export PGHOST PGPORT PGUSER

# V23 web + Config Core SQL live in db/ on PR #489 (Config Core) / #496, not yet on develop.
# Until they merge, read them from this pinned commit (same bytes as hosted staging: see
# function fingerprint check). After the merge the working-tree copy is used automatically.
WSA_SRC_SHA="${WSA_SRC_SHA:-886f1f2e1931a2cc0089618a6f90619727d2ecee}"
src(){ # src <repo path> -> prints a local file path holding that file
  local p="$1"
  if [ -f "$ROOT/$p" ]; then echo "$ROOT/$p"; return; fi
  local out="${WSA_TMP:-/tmp}/wsa-src/$p"; mkdir -p "$(dirname "$out")"
  if [ ! -s "$out" ]; then
    git -C "$ROOT" cat-file -e "$WSA_SRC_SHA^{commit}" 2>/dev/null || git -C "$ROOT" fetch -q --depth=1 origin "$WSA_SRC_SHA"
    git -C "$ROOT" show "$WSA_SRC_SHA:$p" > "$out"
  fi
  echo "$out"; }

PASS=0; PSQL=(psql -X -q -v ON_ERROR_STOP=1 -At)
admin(){ "${PSQL[@]}" -d "$PGDATABASE" -c "$1"; }
as(){ local who="$1" sql="$2" role=authenticated claims
  case "$who" in
   anon) role=anon; claims='{"role":"anon"}';;
   service) role=service_role; claims='{"role":"service_role"}';;
   nosub) claims='{"role":"authenticated"}';;
   *) claims="{\"sub\":\"$who\",\"role\":\"authenticated\"}";;
  esac
  "${PSQL[@]}" -d "$PGDATABASE" -c "SET ROLE $role" -c "SELECT set_config('request.jwt.claims','$claims',false)" -c "$sql" | tail -n 1; }
ok(){ if [ "$1" = "$2" ]; then PASS=$((PASS+1)); echo "PASS_$3"; else echo "FAIL_$3 expected=[$2] got=[$1]"; exit 1; fi; }
deny(){ local tag=$1 re=$2; shift 2; local out
  if out=$("$@" 2>&1); then echo "FAIL_${tag} unexpectedly accepted: $out"; exit 1; fi
  if echo "$out" | grep -Eq "$re"; then PASS=$((PASS+1)); echo "PASS_DENY_${tag}"; else echo "FAIL_${tag} wrong error: $out"; exit 1; fi; }
runfile(){ local out; out=$("${PSQL[@]}" -d "$PGDATABASE" -f "$1" 2>&1) || { echo "$out"; echo "FAIL_RUN_$2"; exit 1; }
  echo "$out" | grep -q "$2" || { echo "$out"; echo "FAIL_MARKER_$2"; exit 1; }; PASS=$((PASS+1)); echo "PASS_$2"; }

# Builds the "staging-equivalent" stack in a fresh database, in the order staging received it:
# V20 replica 00 -> V20 10/20/30/40 -> V23 10/20/30 -> Config Core 10/20.
build_stack(){
  "${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $PGDATABASE" -c "CREATE DATABASE $PGDATABASE" >/dev/null
  local V20=qa/v20-store-authority
  "${PSQL[@]}" -d "$PGDATABASE" -f "$ROOT/$V20/00_hosted_baseline_replica.sql" >/dev/null
  admin "ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz; UPDATE auth.users SET email_confirmed_at=now();" >/dev/null
  runfile "$ROOT/$V20/10_store_authority_expand.sql" T404_V20_STORE_AUTHORITY_EXPAND_OK
  runfile "$ROOT/$V20/20_store_aware_writer.sql" T404_V20_STORE_AWARE_WRITER_OK
  runfile "$ROOT/$V20/30_store_admin_rpcs.sql" T404_V20_STORE_ADMIN_RPCS_OK
  runfile "$ROOT/$V20/40_store_sku_contract.sql" T404_V20_STORE_SKU_CONTRACT_OK
  runfile "$(src db/v23-web/10_leads.sql)" T404_V23_LEADS_OK
  runfile "$(src db/v23-web/20_self_serve_shop.sql)" T404_V23_SELF_SERVE_OK
  runfile "$(src db/v23-web/30_store_bot_settings.sql)" T404_V23_BOT_SETTINGS_OK
  runfile "$(src db/config-core/10_config_core.sql)" T404_CC_CONFIG_CORE_OK
  runfile "$(src db/config-core/20_channel_menu_read.sql)" T404_CC20_CHANNEL_MENU_READ_OK
}
