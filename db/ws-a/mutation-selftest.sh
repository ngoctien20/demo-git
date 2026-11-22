#!/usr/bin/env bash
# Runs secdef-negative-suite.sh once per deliberate weakening; each run MUST fail (exit != 0),
# otherwise the suite would not catch that class of bug. LOCAL/DISPOSABLE PostgreSQL only.
set -uo pipefail; D="$(cd "$(dirname "$0")" && pwd)"; K=0
for m in store_manager_any_member faq_no_store_filter anon_grant_leak; do
  out=$(WSA_MUTATE=$m bash "$D/secdef-negative-suite.sh" 2>&1); rc=$?
  if [ $rc -ne 0 ]; then K=$((K+1)); echo "PASS_MUTANT_KILLED_$m -> $(echo "$out" | grep -m1 '^FAIL_')"; else echo "FAIL_MUTANT_SURVIVED_$m"; exit 1; fi
done
echo "WSA_MUTANTS_KILLED=$K/3"
