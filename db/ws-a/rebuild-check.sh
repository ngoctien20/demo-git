#!/usr/bin/env bash
# B-P0-08 — Can the repo rebuild the hosted staging database? LOCAL/DISPOSABLE PostgreSQL only.
# Builds the staging-equivalent stack from repo SQL and compares every public/app_private function
# (SECURITY DEFINER flag, anon/authenticated EXECUTE, pinned search_path, md5 of the full definition)
# with the read-only snapshot taken from staging on 2026-11-22 (staging-function-fingerprint-*.txt).
# The service_role column is ignored: plain PostgreSQL has no Supabase default privileges.
# Result classes: MATCH, DRIFT (same signature, different body/ACL -> FAIL), EXTRA_IN_REPO (-> FAIL),
# MISSING_IN_REPO (hosted-only; must equal the KNOWN_GAP list below or the run FAILs).
PGDATABASE=t404_wsa_rebuild; source "$(dirname "$0")/lib.sh"
EXPECTED="${1:-$WSA_DIR/staging-function-fingerprint-2026-11-22.txt}"
KNOWN_GAP="public.merchant_paid_orders_daily(p_tenant uuid, p_days integer)
public.merchant_revenue_v3(p_shop uuid, p_start date, p_end date)
public.qa_owner_pairing(p_shop uuid, p_action text, p_challenge uuid)
public.qa_shop_b_zalo_claim(p_challenge uuid, p_code text, p_sender text, p_event text)
public.tien404_qa_sandbox_order_guard()
public.tien404_qa_sandbox_product_guard()
public.tien404_tester_track_change()"
build_stack
T="${WSA_TMP:-/tmp}"; mkdir -p "$T"
"${PSQL[@]}" -d "$PGDATABASE" -f "$WSA_DIR/function-fingerprint.sql" | cut -d'|' -f1-4,6- | sort > "$T/local.fp"
cut -d'|' -f1-4,6- "$EXPECTED" | sort > "$T/hosted.fp"
MATCH=$(comm -12 "$T/local.fp" "$T/hosted.fp" | wc -l)
cut -d'|' -f1 "$T/local.fp" | sort > "$T/local.sig"; cut -d'|' -f1 "$T/hosted.fp" | sort > "$T/hosted.sig"
MISSING=$(comm -13 "$T/local.sig" "$T/hosted.sig"); EXTRA=$(comm -23 "$T/local.sig" "$T/hosted.sig")
DRIFT=$(comm -12 "$T/local.sig" "$T/hosted.sig" | while read -r s; do
  [ "$(grep -F "$s|" "$T/local.fp")" = "$(grep -F "$s|" "$T/hosted.fp")" ] || echo "$s"; done)
echo "FUNCTIONS_HOSTED=$(wc -l < "$T/hosted.sig") FUNCTIONS_REPO=$(wc -l < "$T/local.sig") MATCH=$MATCH"
[ -z "$DRIFT" ] || { echo "FAIL_DRIFT:"; echo "$DRIFT"; exit 1; }; PASS=$((PASS+1)); echo PASS_NO_DRIFT
[ -z "$EXTRA" ] || { echo "FAIL_EXTRA_IN_REPO:"; echo "$EXTRA"; exit 1; }; PASS=$((PASS+1)); echo PASS_NO_EXTRA_IN_REPO
echo "MISSING_IN_REPO (hosted-only, from supabase_migrations rows never committed):"; echo "$MISSING" | sed 's/^/  - /'
[ "$MISSING" = "$(echo "$KNOWN_GAP" | sort)" ] || { echo "FAIL_GAP_CHANGED (update KNOWN_GAP + MIGRATION_HISTORY_AUDIT.md)"; exit 1; }
PASS=$((PASS+1)); echo PASS_GAP_EQUALS_KNOWN_LIST
echo "WSA_REBUILD_CHECK_PASS=$PASS"
