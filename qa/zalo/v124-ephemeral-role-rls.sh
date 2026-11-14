#!/usr/bin/env bash
# TIEN404 V12.4 — isolated PostgreSQL 17 role/RLS smoke test.
# Never connects to Supabase, never uses project credentials.
set -Eeuo pipefail
set +x
[ "$TIEN404_EPHEMERAL_PG_QA" = "yes" ] || exit 2
[ "$PGHOST" = "127.0.0.1" ] && [ "$PGPORT" = "5432" ] &&
[ "$PGDATABASE" = "tien404_ephemeral_qa" ] || { echo "EPHEMERAL_ONLY"; exit 2; }
command -v psql >/dev/null || exit 2

# Stub ONLY the four Shop B QA readback tables, with two synthetic shops.
psql -w -X -q -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA tien404_r1_qa;
CREATE TABLE tien404_r1_qa.catalog (
 tenant_key text, store_key text, bot_key text, sku text,
 product_name text, price_vnd bigint, stock integer);
CREATE TABLE tien404_r1_qa.owner_bindings (
 tenant_key text, store_key text, bot_key text, recipient_ref text,
 status text, expires_at timestamptz, confirmed_challenge_id uuid);
CREATE TABLE tien404_r1_qa.owner_pairing_claims_v3 (
 tenant_key text, store_key text, bot_key text, recipient_ref text,
 status text, challenge_id uuid);
CREATE TABLE tien404_r1_qa.shop_bots (
 tenant_key text, store_key text, bot_key text, enabled_mode text, identity_status text);
CREATE TABLE tien404_r1_qa.sandbox_orders (order_key text primary key);
ALTER TABLE tien404_r1_qa.catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_r1_qa.owner_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_r1_qa.owner_pairing_claims_v3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_r1_qa.shop_bots ENABLE ROW LEVEL SECURITY;
INSERT INTO tien404_r1_qa.catalog VALUES
('qa-tenant-a','qa-store-a','qa-bot-a','F01','QA Shop A',159000,3),
('qa-tenant-b','qa-store-b','qa-bot-b','F01','QA Shop B',199000,5);
INSERT INTO tien404_r1_qa.owner_bindings VALUES
('qa-tenant-a','qa-store-a','qa-bot-a','qa-ref-a','paired',now()+interval '1 day','11111111-1111-4111-8111-111111111111'),
('qa-tenant-b','qa-store-b','qa-bot-b','qa-ref-b','paired',now()+interval '1 day','22222222-2222-4222-8222-222222222222');
INSERT INTO tien404_r1_qa.owner_pairing_claims_v3 VALUES
('qa-tenant-a','qa-store-a','qa-bot-a','qa-ref-a','CONFIRMED','11111111-1111-4111-8111-111111111111'),
('qa-tenant-b','qa-store-b','qa-bot-b','qa-ref-b','CONFIRMED','22222222-2222-4222-8222-222222222222');
INSERT INTO tien404_r1_qa.shop_bots VALUES
('qa-tenant-a','qa-store-a','qa-bot-a','dry_run','synthetic_qa'),
('qa-tenant-b','qa-store-b','qa-bot-b','dry_run','synthetic_qa');
SQL

psql -w -X -q -v ON_ERROR_STOP=1 -f docs/ai-handoff/V12_3_SHOP_B_PRIVATE_SESSIONS_APPLY.sql
psql -w -X -q -v ON_ERROR_STOP=1 -f docs/ai-handoff/V12_4_REVIEW_ONLY_SHOP_B_ROLE_RLS.sql

# This is an NOLOGIN role, available only via local superuser SET ROLE in isolated CI.
psql -w -X -q -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
SET LOCAL ROLE tien404_shop_b_qa_backend;
DO $$
DECLARE n integer; p bigint; inserted integer; denied boolean;
BEGIN
 SELECT count(*),max(price_vnd) INTO n,p FROM tien404_r1_qa.catalog;
 IF n<>1 OR p<>199000 THEN RAISE EXCEPTION 'CROSS_SHOP_CATALOG_EXPOSED'; END IF;
 SELECT count(*) INTO n FROM tien404_r1_qa.owner_bindings;
 IF n<>1 THEN RAISE EXCEPTION 'CROSS_SHOP_OWNER_EXPOSED'; END IF;
 SELECT count(*) INTO n FROM tien404_r1_qa.owner_pairing_claims_v3;
 IF n<>1 THEN RAISE EXCEPTION 'CROSS_SHOP_CLAIMS_EXPOSED'; END IF;
 SELECT count(*) INTO n FROM tien404_r1_qa.shop_bots;
 IF n<>1 THEN RAISE EXCEPTION 'CROSS_SHOP_BOT_EXPOSED'; END IF;
 denied:=false;
 BEGIN
   PERFORM count(*) FROM tien404_r1_qa.sandbox_orders;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'ORDERS_READ_NOT_DENIED'; END IF;
 denied:=false;
 BEGIN
   INSERT INTO tien404_r1_qa.catalog VALUES ('qa-tenant-b','qa-store-b','qa-bot-b','X','test',1,1);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'CATALOG_WRITE_NOT_DENIED'; END IF;
END $$;
INSERT INTO tien404_dialogue_private.shop_b_sessions (
 scope_key,tenant_key,store_key,bot_key,binding_fingerprint,expires_at)
VALUES (repeat('a',64),'qa-tenant-b','qa-store-b','qa-bot-b','ci_owner_b',now()+interval '15 minutes');
UPDATE tien404_dialogue_private.shop_b_sessions SET revision=revision+1
 WHERE scope_key=repeat('a',64);
INSERT INTO tien404_dialogue_private.shop_b_receipts(scope_key,event_hash)
 VALUES(repeat('a',64),repeat('b',64));
INSERT INTO tien404_dialogue_private.shop_b_receipts(scope_key,event_hash)
 VALUES(repeat('a',64),repeat('b',64)) ON CONFLICT DO NOTHING;
DO $$
DECLARE n integer; denied boolean;
BEGIN
 SELECT count(*) INTO n FROM tien404_dialogue_private.shop_b_receipts;
 IF n<>1 THEN RAISE EXCEPTION 'IDEMPOTENT_RECEIPT_FAILED'; END IF;
 denied:=false;
 BEGIN
 INSERT INTO tien404_dialogue_private.shop_b_sessions(
 scope_key,tenant_key,store_key,bot_key,binding_fingerprint,expires_at)
 VALUES (repeat('c',64),'qa-tenant-a','qa-store-a','qa-bot-a','forbidden',now()+interval '15 minutes');
 EXCEPTION WHEN insufficient_privilege OR check_violation THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'CROSS_TENANT_INSERT_NOT_DENIED'; END IF;
END $$;
ROLLBACK;
SQL

# Role users with no grants cannot SELECT private sessions.
for role in anon authenticated service_role; do
  if psql -w -X -qAt -v ON_ERROR_STOP=1 -c "BEGIN; SET LOCAL ROLE $role; SELECT count(*) FROM tien404_dialogue_private.shop_b_sessions; ROLLBACK;" >/dev/null 2>&1; then
    echo "FAILED: $role accessed private QA schema" >&2
    exit 1
  fi
done
readonly="$(psql -w -X -qAt -v ON_ERROR_STOP=1 -c "
SELECT rolcanlogin::text||':'||rolbypassrls::text FROM pg_roles
WHERE rolname='tien404_shop_b_qa_backend';")"
[ "$readonly" = "false:false" ] || { echo "BAD_ROLE_FLAGS" >&2; exit 1; }
rows="$(psql -w -X -qAt -v ON_ERROR_STOP=1 -c "
SELECT (SELECT count(*) FROM tien404_dialogue_private.shop_b_sessions)::text
 ||':'|| (SELECT count(*) FROM tien404_dialogue_private.shop_b_receipts)::text;")"
[ "$rows" = "0:0" ] || { echo "ROLLBACK_FAILED" >&2; exit 1; }
echo "PASS V12.4 ISOLATED ROLE/RLS: Shop B only, Owner/catalog read-only, sessions write, receipts unique, anon/auth/service denied, Orders inaccessible, rollback 0:0"
