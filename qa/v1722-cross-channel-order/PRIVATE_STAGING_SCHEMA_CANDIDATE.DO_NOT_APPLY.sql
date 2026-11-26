-- TIEN404 V17.22 — PROPOSED / DO NOT APPLY TO HOSTED DATABASE YET.
-- Separate schema for opt-in Messenger→Zalo Bot QA Order / Link / Replay.
-- Neither an existing public Commerce migration nor an AI_SALES_DEMO table.
-- All event IDs and actor references MUST be server-produced HMAC hex, not raw PSID/Zalo ID.
-- No API grants, no runtime principal, no security definer RPC, no real customer data.

begin;
create schema if not exists tien404_v1722_qa;
revoke all on schema tien404_v1722_qa from public, anon, authenticated, service_role;

create table if not exists tien404_v1722_qa.orders (
  order_ref text primary key check(order_ref ~ '^QA-ORD-[0-9]{5,12}$'),
  tenant_key text not null check(tenant_key ~ '^QA_[A-Z0-9_]+$'),
  store_key text not null check(store_key ~ '^QA_[A-Z0-9_]+$'),
  messenger_actor_hmac text not null check(messenger_actor_hmac ~ '^[0-9a-f]{64}$'),
  sku text not null check(sku ~ '^QA_SKU_[A-Z0-9_]+$'),
  quantity integer not null check(quantity between 1 and 50),
  unit_price_vnd bigint not null check(unit_price_vnd > 0),
  total_vnd bigint not null check(total_vnd = quantity * unit_price_vnd),
  status text not null default 'qa_pending' check(status in ('qa_pending','qa_cancelled','qa_completed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists v1722_qa_orders_scope
 on tien404_v1722_qa.orders(tenant_key,store_key,messenger_actor_hmac);

create table if not exists tien404_v1722_qa.link_challenges (
  link_ref text primary key check(link_ref ~ '^QA-LINK-[0-9]{5,12}$'),
  order_ref text not null references tien404_v1722_qa.orders(order_ref),
  tenant_key text not null,
  store_key text not null,
  messenger_actor_hmac text not null check(messenger_actor_hmac ~ '^[0-9a-f]{64}$'),
  messenger_otp_hmac text not null check(messenger_otp_hmac ~ '^[0-9a-f]{64}$'),
  zalo_actor_hmac text check(zalo_actor_hmac ~ '^[0-9a-f]{64}$'),
  zalo_otp_hmac text check(zalo_otp_hmac ~ '^[0-9a-f]{64}$'),
  attempts integer not null default 0 check(attempts between 0 and 3),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((zalo_actor_hmac is null) = (zalo_otp_hmac is null))
);
create index if not exists v1722_qa_challenge_expiry
 on tien404_v1722_qa.link_challenges(expires_at);

create table if not exists tien404_v1722_qa.channel_links (
  tenant_key text not null,
  store_key text not null,
  messenger_actor_hmac text not null check(messenger_actor_hmac ~ '^[0-9a-f]{64}$'),
  zalo_actor_hmac text not null check(zalo_actor_hmac ~ '^[0-9a-f]{64}$'),
  verified_at timestamptz not null default now(),
  revoked_at timestamptz,
  verified_challenge_ref text not null references tien404_v1722_qa.link_challenges(link_ref),
  primary key(tenant_key,store_key,zalo_actor_hmac)
);
create index if not exists v1722_qa_links_messenger_scope
 on tien404_v1722_qa.channel_links(tenant_key,store_key,messenger_actor_hmac)
 where revoked_at is null;

create table if not exists tien404_v1722_qa.provider_replay (
  provider_key_hmac text primary key check(provider_key_hmac ~ '^[0-9a-f]{64}$'),
  payload_digest_hmac text not null check(payload_digest_hmac ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  received_at timestamptz not null default now()
);
create index if not exists v1722_qa_replay_expiry
 on tien404_v1722_qa.provider_replay(expires_at);

alter table tien404_v1722_qa.orders enable row level security;
alter table tien404_v1722_qa.orders force row level security;
alter table tien404_v1722_qa.link_challenges enable row level security;
alter table tien404_v1722_qa.link_challenges force row level security;
alter table tien404_v1722_qa.channel_links enable row level security;
alter table tien404_v1722_qa.channel_links force row level security;
alter table tien404_v1722_qa.provider_replay enable row level security;
alter table tien404_v1722_qa.provider_replay force row level security;

-- NO policies or public/client/service role grants. Later service role requires
-- *separate owner approval*, least-privilege dedicated DB identity and hosted JWT/RLS UAT.
revoke all on all tables in schema tien404_v1722_qa
 from public, anon, authenticated, service_role;
revoke all on all sequences in schema tien404_v1722_qa
 from public, anon, authenticated, service_role;
commit;
