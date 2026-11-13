-- TIEN404 V12 R1 / candidate only: extracted from deployed Supabase STAGING at 2026-11-14 JST.
-- NOT AN AUTOMATIC MIGRATION. Requires security review and owner approval before merge/apply.
-- Project reference: ifxlvrhyjhbzbrkdsida. Schema: tien404_r1_qa.
-- NO real customer data, tokens, chat IDs, public HTTP APIs or Zalo send mechanisms.
-- No backend JWT verification yet; do not grant frontend API roles access.
BEGIN;
CREATE SCHEMA IF NOT EXISTS tien404_r1_qa;
REVOKE ALL ON SCHEMA tien404_r1_qa FROM public, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS tien404_r1_qa.shop_bots (
  tenant_key text NOT NULL,
  store_key text NOT NULL,
  bot_key text NOT NULL,
  credential_ref text NOT NULL,
  catalog_source_ref text NOT NULL,
  enabled_mode text NOT NULL DEFAULT 'dry_run'::text,
  identity_status text NOT NULL DEFAULT 'synthetic_qa'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT shop_bots_check CHECK (((tenant_key ~ '^qa-[a-z0-9-]+$'::text) AND (store_key ~ '^qa-[a-z0-9-]+$'::text) AND (bot_key ~ '^qa-[a-z0-9-]+$'::text))),
  CONSTRAINT shop_bots_credential_ref_check CHECK ((credential_ref ~~ 'fixture-%'::text)),
  CONSTRAINT shop_bots_enabled_mode_check CHECK ((enabled_mode = ANY (ARRAY['dry_run'::text, 'disabled'::text]))),
  CONSTRAINT shop_bots_identity_status_check CHECK ((identity_status = 'synthetic_qa'::text)),
  CONSTRAINT shop_bots_pkey PRIMARY KEY (tenant_key, store_key, bot_key)
);

CREATE TABLE IF NOT EXISTS tien404_r1_qa.catalog (
  tenant_key text NOT NULL,
  store_key text NOT NULL,
  bot_key text NOT NULL,
  sku text NOT NULL,
  product_name text NOT NULL,
  price_vnd bigint NOT NULL,
  stock integer NOT NULL,
  CONSTRAINT catalog_price_vnd_check CHECK ((price_vnd > 0)),
  CONSTRAINT catalog_stock_check CHECK ((stock >= 0)),
  CONSTRAINT catalog_tenant_key_store_key_bot_key_fkey FOREIGN KEY (tenant_key, store_key, bot_key) REFERENCES tien404_r1_qa.shop_bots(tenant_key, store_key, bot_key),
  CONSTRAINT catalog_pkey PRIMARY KEY (tenant_key, store_key, bot_key, sku)
);

CREATE TABLE IF NOT EXISTS tien404_r1_qa.owner_pairing_challenges (
  tenant_key text NOT NULL,
  store_key text NOT NULL,
  bot_key text NOT NULL,
  challenge_id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_ref text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  failed_attempts integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT owner_pairing_challenges_code_hash_check CHECK ((code_hash ~ '^[a-f0-9]{64}$'::text)),
  CONSTRAINT owner_pairing_challenges_failed_attempts_check CHECK (((failed_attempts >= 0) AND (failed_attempts <= 5))),
  CONSTRAINT owner_pairing_challenges_tenant_key_store_key_bot_key_fkey FOREIGN KEY (tenant_key, store_key, bot_key) REFERENCES tien404_r1_qa.shop_bots(tenant_key, store_key, bot_key),
  CONSTRAINT owner_pairing_challenges_pkey PRIMARY KEY (tenant_key, store_key, bot_key, challenge_id)
);

CREATE TABLE IF NOT EXISTS tien404_r1_qa.owner_bindings (
  tenant_key text NOT NULL,
  store_key text NOT NULL,
  bot_key text NOT NULL,
  owner_ref text NOT NULL,
  recipient_ref text NOT NULL,
  status text NOT NULL DEFAULT 'paired'::text,
  paired_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  CONSTRAINT owner_bindings_recipient_ref_check CHECK ((recipient_ref ~~ 'qa-recipient-%'::text)),
  CONSTRAINT owner_bindings_status_check CHECK ((status = ANY (ARRAY['paired'::text, 'revoked'::text]))),
  CONSTRAINT owner_bindings_tenant_key_store_key_bot_key_fkey FOREIGN KEY (tenant_key, store_key, bot_key) REFERENCES tien404_r1_qa.shop_bots(tenant_key, store_key, bot_key),
  CONSTRAINT owner_bindings_pkey PRIMARY KEY (tenant_key, store_key, bot_key)
);

CREATE TABLE IF NOT EXISTS tien404_r1_qa.sandbox_orders (
  tenant_key text NOT NULL,
  store_key text NOT NULL,
  bot_key text NOT NULL,
  order_key text NOT NULL,
  session_ref text NOT NULL,
  sku text NOT NULL,
  quantity integer NOT NULL,
  unit_price_vnd bigint NOT NULL,
  total_vnd bigint NOT NULL,
  confirmation_key text NOT NULL,
  idempotency_key text NOT NULL,
  data_origin text NOT NULL DEFAULT 'synthetic_qa'::text,
  status text NOT NULL DEFAULT 'pending_sandbox'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sandbox_orders_data_origin_check CHECK ((data_origin = 'synthetic_qa'::text)),
  CONSTRAINT sandbox_orders_order_key_check CHECK ((order_key ~ '^QA-[A-Z0-9-]{5,60}$'::text)),
  CONSTRAINT sandbox_orders_quantity_check CHECK (((quantity >= 1) AND (quantity <= 100))),
  CONSTRAINT sandbox_orders_session_ref_check CHECK ((session_ref ~~ 'qa-session-%'::text)),
  CONSTRAINT sandbox_orders_status_check CHECK ((status = 'pending_sandbox'::text)),
  CONSTRAINT sandbox_orders_total_vnd_check CHECK ((total_vnd > 0)),
  CONSTRAINT sandbox_orders_unit_price_vnd_check CHECK ((unit_price_vnd > 0)),
  CONSTRAINT sandbox_orders_tenant_key_store_key_bot_key_sku_fkey FOREIGN KEY (tenant_key, store_key, bot_key, sku) REFERENCES tien404_r1_qa.catalog(tenant_key, store_key, bot_key, sku),
  CONSTRAINT sandbox_orders_pkey PRIMARY KEY (tenant_key, store_key, bot_key, order_key),
  CONSTRAINT sandbox_orders_tenant_key_store_key_bot_key_confirmation_ke_key UNIQUE (tenant_key, store_key, bot_key, confirmation_key),
  CONSTRAINT sandbox_orders_tenant_key_store_key_bot_key_idempotency_key_key UNIQUE (tenant_key, store_key, bot_key, idempotency_key)
);

CREATE TABLE IF NOT EXISTS tien404_r1_qa.owner_outbox (
  tenant_key text NOT NULL,
  store_key text NOT NULL,
  bot_key text NOT NULL,
  order_key text NOT NULL,
  event_key text NOT NULL,
  recipient_owner_ref text NOT NULL,
  recipient_ref text NOT NULL,
  channel text NOT NULL DEFAULT 'zalo_bot'::text,
  state text NOT NULL DEFAULT 'HELD'::text,
  message_preview text NOT NULL,
  hold_reason text NOT NULL DEFAULT 'SEND_DISABLED'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT owner_outbox_channel_check CHECK ((channel = 'zalo_bot'::text)),
  CONSTRAINT owner_outbox_hold_reason_check CHECK ((hold_reason = 'SEND_DISABLED'::text)),
  CONSTRAINT owner_outbox_message_preview_check CHECK (starts_with(message_preview, '[SANDBOX-ONLY] '::text)),
  CONSTRAINT owner_outbox_state_check CHECK ((state = 'HELD'::text)),
  CONSTRAINT owner_outbox_tenant_key_store_key_bot_key_fkey FOREIGN KEY (tenant_key, store_key, bot_key) REFERENCES tien404_r1_qa.owner_bindings(tenant_key, store_key, bot_key),
  CONSTRAINT owner_outbox_tenant_key_store_key_bot_key_order_key_fkey FOREIGN KEY (tenant_key, store_key, bot_key, order_key) REFERENCES tien404_r1_qa.sandbox_orders(tenant_key, store_key, bot_key, order_key),
  CONSTRAINT owner_outbox_pkey PRIMARY KEY (tenant_key, store_key, bot_key, event_key),
  CONSTRAINT owner_outbox_tenant_key_store_key_bot_key_order_key_key UNIQUE (tenant_key, store_key, bot_key, order_key)
);

DO $r1$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['shop_bots','catalog','owner_pairing_challenges','owner_bindings','sandbox_orders','owner_outbox'] LOOP EXECUTE format('ALTER TABLE tien404_r1_qa.%I ENABLE ROW LEVEL SECURITY', t); END LOOP; END $r1$;
REVOKE ALL ON ALL TABLES IN SCHEMA tien404_r1_qa FROM public, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA tien404_r1_qa FROM public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION tien404_r1_qa.commit_order_qa(p_tenant text, p_store text, p_bot text, p_order text, p_session text, p_sku text, p_quantity integer, p_expected_total bigint, p_confirmation text, p_idempotency text, p_confirmed boolean)
 RETURNS TABLE(outcome text, order_ref text, outbox_ref text)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'tien404_r1_qa'
AS $function$
declare v_price bigint;v_stock int;v_owner text;v_recipient text;v_total bigint;
        v_prior tien404_r1_qa.sandbox_orders%rowtype;v_created text;v_event text;
begin
  if p_confirmed is distinct from true then raise exception 'CONFIRMATION_REQUIRED';end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 100
     or p_session not like 'qa-session-%'
     or p_order !~ '^QA-[A-Z0-9-]{5,60}$'
     or p_confirmation is null or length(p_confirmation)<8
     or p_idempotency is null or length(p_idempotency)<8
  then raise exception 'INVALID_QA_ORDER_INPUT';end if;
  perform 1 from tien404_r1_qa.shop_bots b
    where b.tenant_key=p_tenant and b.store_key=p_store and b.bot_key=p_bot
    and b.enabled_mode='dry_run' and b.identity_status='synthetic_qa' for share;
  if not found then raise exception 'BOT_NOT_AUTHORIZED_FOR_QA';end if;
  select c.price_vnd,c.stock into v_price,v_stock from tien404_r1_qa.catalog c
    where c.tenant_key=p_tenant and c.store_key=p_store and c.bot_key=p_bot and c.sku=p_sku
    for share;
  if not found then raise exception 'CATALOG_SCOPE_DENIED';end if;
  if p_quantity>v_stock then raise exception 'STOCK_INSUFFICIENT';end if;
  if v_price>9223372036854775807/p_quantity then raise exception 'TOTAL_OVERFLOW';end if;
  v_total:=v_price*p_quantity;
  if p_expected_total is distinct from v_total then raise exception 'PRICE_MISMATCH';end if;
  select o.owner_ref,o.recipient_ref into v_owner,v_recipient
    from tien404_r1_qa.owner_bindings o
    where o.tenant_key=p_tenant and o.store_key=p_store and o.bot_key=p_bot
      and o.status='paired' and o.expires_at>now() for share;
  if not found then raise exception 'OWNER_NOT_PAIRED';end if;
  insert into tien404_r1_qa.sandbox_orders(
    tenant_key,store_key,bot_key,order_key,session_ref,sku,quantity,
    unit_price_vnd,total_vnd,confirmation_key,idempotency_key
  ) values (
    p_tenant,p_store,p_bot,p_order,p_session,p_sku,p_quantity,
    v_price,v_total,p_confirmation,p_idempotency
  ) on conflict do nothing returning order_key into v_created;
  if v_created is null then
    select * into v_prior from tien404_r1_qa.sandbox_orders e
     where e.tenant_key=p_tenant and e.store_key=p_store and e.bot_key=p_bot
     and e.idempotency_key=p_idempotency;
    if not found then raise exception 'ORDER_OR_CONFIRMATION_CONFLICT';end if;
    if v_prior.sku<>p_sku or v_prior.quantity<>p_quantity
       or v_prior.total_vnd<>v_total or v_prior.session_ref<>p_session
       or v_prior.confirmation_key<>p_confirmation
    then raise exception 'IDEMPOTENCY_PAYLOAD_CONFLICT';end if;
    v_event:='order_sandbox_saved:'||p_tenant||':'||p_store||':'||p_bot||':'||v_prior.order_key;
    return query select 'DUPLICATE'::text,v_prior.order_key,v_event;
    return;
  end if;
  v_event:='order_sandbox_saved:'||p_tenant||':'||p_store||':'||p_bot||':'||p_order;
  insert into tien404_r1_qa.owner_outbox(
     tenant_key,store_key,bot_key,order_key,event_key,recipient_owner_ref,recipient_ref,message_preview
  ) values (p_tenant,p_store,p_bot,p_order,v_event,v_owner,v_recipient,
   '[SANDBOX-ONLY] Đơn '||p_order||' / '||p_sku||' / SL '||p_quantity||
   ' / '||v_total::text||' VND / CHỜ CHỦ SHOP XỬ LÝ');
  return query select 'CREATED'::text,p_order,v_event;
end;
$function$


CREATE OR REPLACE FUNCTION tien404_r1_qa.pair_owner_qa(p_tenant text, p_store text, p_bot text, p_challenge uuid, p_owner text, p_recipient text, p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'tien404_r1_qa'
AS $function$
declare v_used uuid;
begin
  if p_code is null or length(p_code) < 8 or p_recipient not like 'qa-recipient-%' then return false; end if;
  update tien404_r1_qa.owner_pairing_challenges c
  set used_at=now()
  where c.tenant_key=p_tenant and c.store_key=p_store and c.bot_key=p_bot
    and c.challenge_id=p_challenge and c.owner_ref=p_owner
    and c.code_hash=encode(extensions.digest(p_code,'sha256'),'hex')
    and c.used_at is null and c.expires_at>now() and c.failed_attempts<5
    and exists(select 1 from tien404_r1_qa.shop_bots b
      where b.tenant_key=p_tenant and b.store_key=p_store and b.bot_key=p_bot
      and b.enabled_mode='dry_run' and b.identity_status='synthetic_qa')
  returning c.challenge_id into v_used;
  if v_used is null then
    update tien404_r1_qa.owner_pairing_challenges c
    set failed_attempts=least(5,c.failed_attempts+1)
    where c.tenant_key=p_tenant and c.store_key=p_store and c.bot_key=p_bot
      and c.challenge_id=p_challenge and c.owner_ref=p_owner
      and c.used_at is null and c.expires_at>now() and c.failed_attempts<5;
    return false;
  end if;
  insert into tien404_r1_qa.owner_bindings(
    tenant_key,store_key,bot_key,owner_ref,recipient_ref,status,paired_at,expires_at
  ) values (p_tenant,p_store,p_bot,p_owner,p_recipient,'paired',now(),now()+interval '7 days')
  on conflict(tenant_key,store_key,bot_key) do update
    set owner_ref=excluded.owner_ref,recipient_ref=excluded.recipient_ref,status='paired',
        paired_at=now(),expires_at=excluded.expires_at;
  return true;
end;
$function$

REVOKE ALL ON FUNCTION tien404_r1_qa.pair_owner_qa(text,text,text,uuid,text,text,text) FROM public,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION tien404_r1_qa.commit_order_qa(text,text,text,text,text,text,integer,bigint,text,text,boolean) FROM public,anon,authenticated,service_role;
COMMIT;
-- QA fixture rows intentionally omitted. Never include real user PII or provider secrets.
-- Any cleanup requires approval: DROP SCHEMA tien404_r1_qa CASCADE; (NOT executed)
