#!/usr/bin/env bash
set -euo pipefail
URL='https://tien404-meta-messenger-qa-canary-v1876cm3.tienmobi208.workers.dev/meta-qa/webhook'
phase="${1:-locked}"
case "$phase" in
  locked) get_expected=503; post_expected=503 ;;
  enabled) get_expected=403; post_expected=401 ;;
  *) echo 'Unknown phase; no live requests'; exit 2 ;;
esac
request_code() {
  local method="$1"
  local code='000'
  for attempt in 1 2 3 4; do
    if [[ "$method" == 'GET' ]]; then
      code=$(curl --silent --show-error --max-time 20 --connect-timeout 10 --location-trusted --max-redirs 0 --output /dev/null --write-out '%{http_code}' "$URL?hub.mode=subscribe&hub.verify_token=INVALID_QA_ONLY&hub.challenge=12345") && break || true
    else
      code=$(curl --silent --show-error --max-time 20 --connect-timeout 10 --max-redirs 0 --output /dev/null --write-out '%{http_code}' --request POST --header 'Content-Type: application/json' --header 'X-Hub-Signature-256: sha256=0000000000000000000000000000000000000000000000000000000000000000' --data '{"object":"page","entry":[{"messaging":[{"message":{"text":"SYNTHETIC_NO_SEND"}}]}]}' "$URL") && break || true
    fi
    if [[ "$attempt" != 4 ]]; then sleep 4; fi
  done
  echo "$code"
}
get_code=$(request_code GET)
post_code=$(request_code POST)
echo "Phase: $phase; Wrong-token GET HTTP: $get_code (expected $get_expected); Bad-signature POST HTTP: $post_code (expected $post_expected)"
[[ "$get_code" == "$get_expected" ]] || { echo 'FAIL: GET status mismatch; do not advance'; exit 1; }
[[ "$post_code" == "$post_expected" ]] || { echo 'FAIL: POST status mismatch; do not advance'; exit 1; }
echo 'PASS: no credentials, provider send, AI call or order write'
