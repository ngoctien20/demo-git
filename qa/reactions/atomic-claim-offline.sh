#!/usr/bin/env bash
# TIEN404 — Disposable PG17 only. Never point this at hosted PostgreSQL.
set -euo pipefail
if [[ "${TIEN404_DISPOSABLE_PG17_QA:-}" != "YES" ]]; then
  echo "Refusing PostgreSQL operation without TIEN404_DISPOSABLE_PG17_QA=YES" >&2
  exit 2
fi
if [[ "${PGHOST:-}" != "127.0.0.1" || "${PGDATABASE:-}" != "t404qa" || "${PGUSER:-}" != "t404qa" ]]; then
  echo "Refusing non-disposable connection target" >&2
  exit 2
fi
psql --no-psqlrc -X -v ON_ERROR_STOP=1 -f qa/reactions/atomic-claim-offline.sql >/dev/null
query() { psql --no-psqlrc -X -v ON_ERROR_STOP=1 -A -t -c "$1"; }
require() {
  local got="$1" expected="$2" label="$3"
  if [[ "$got" != "$expected" ]]; then
    echo "FAIL $label: expected=$expected actual=$got" >&2
    exit 1
  fi
  echo "PASS $label"
}
psql --no-psqlrc -X -v ON_ERROR_STOP=1 -c "TRUNCATE t404_reaction_qa.claims" >/dev/null
require "$(query "select t404_reaction_qa.try_claim('tenant-A','page-A','sender-A','mid-1001',60,2)")" t first_claim
require "$(query "select t404_reaction_qa.try_claim('tenant-A','page-A','sender-A','mid-1001',60,2)")" f duplicate_mid
require "$(query "select t404_reaction_qa.try_claim('tenant-A','page-A','sender-A','mid-1002',60,2)")" f same_thread_cooldown
require "$(query "select t404_reaction_qa.try_claim('tenant-A','page-B','sender-A','mid-1001',60,2)")" t cross_page_isolated
require "$(query "select t404_reaction_qa.try_claim('tenant-B','page-A','sender-A','mid-1001',60,2)")" t cross_tenant_isolated
require "$(query "select t404_reaction_qa.try_claim('tenant-A','page-A','sender-B','mid-1001',60,2)")" t cross_sender_isolated
require "$(query "select t404_reaction_qa.try_claim('tenant-A','page-A','sender-A','mid-1003',0,2)")" f invalid_cooldown
require "$(query "select t404_reaction_qa.try_claim('tenant-A','page-A','sender-A','mid-1003',60,0)")" f invalid_hourly_limit
# Synthetic clock manipulation in disposable DB only.
psql --no-psqlrc -X -v ON_ERROR_STOP=1 -c "TRUNCATE t404_reaction_qa.claims" >/dev/null
require "$(query "select t404_reaction_qa.try_claim('hourly-A','page-A','sender-A','mid-2001',60,2)")" t hourly_first
psql --no-psqlrc -X -v ON_ERROR_STOP=1 -c \
  "UPDATE t404_reaction_qa.claims SET claimed_at=clock_timestamp()-interval '70 seconds'" >/dev/null
require "$(query "select t404_reaction_qa.try_claim('hourly-A','page-A','sender-A','mid-2002',60,2)")" t hourly_second
psql --no-psqlrc -X -v ON_ERROR_STOP=1 -c \
  "UPDATE t404_reaction_qa.claims SET claimed_at=clock_timestamp()-interval '70 seconds'" >/dev/null
require "$(query "select t404_reaction_qa.try_claim('hourly-A','page-A','sender-A','mid-2003',60,2)")" f hourly_third_denied
# Parallel transaction race: SAME sender and MID must have exactly one winner.
psql --no-psqlrc -X -v ON_ERROR_STOP=1 -c "TRUNCATE t404_reaction_qa.claims" >/dev/null
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
for i in $(seq 1 10); do
  (query "select t404_reaction_qa.try_claim('race-A','page-A','sender-A','mid-3001',60,2)" > "$tmp/race-$i") &
done
wait
successes="$(grep -l '^t$' "$tmp"/race-* | wc -l | tr -d ' ')"
require "$successes" 1 concurrency_one_winner
require "$(query "SELECT count(*) FROM t404_reaction_qa.claims WHERE tenant_id='race-A' AND page_id='page-A' AND sender_id='sender-A' AND message_id='mid-3001'")" 1 concurrency_one_row
# Parallel different MIDs but same Page + sender: cooldown still allows only one.
psql --no-psqlrc -X -v ON_ERROR_STOP=1 -c "TRUNCATE t404_reaction_qa.claims" >/dev/null
for i in $(seq 1 10); do
  (query "select t404_reaction_qa.try_claim('race-B','page-B','sender-B','mid-4$i-01',60,2)" > "$tmp/cooldown-$i") &
done
wait
successes="$(grep -l '^t$' "$tmp"/cooldown-* | wc -l | tr -d ' ')"
require "$successes" 1 concurrency_cooldown_one_winner
require "$(query "SELECT count(*) FROM t404_reaction_qa.claims WHERE tenant_id='race-B' AND page_id='page-B' AND sender_id='sender-B'")" 1 concurrency_one_record_across_different_mids
echo "PASS: disposable PostgreSQL 17 atomic reaction ledger (no hosted access)"
