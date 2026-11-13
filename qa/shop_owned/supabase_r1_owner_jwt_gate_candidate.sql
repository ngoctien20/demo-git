-- TIEN404 V12 R1 / isolated JWT-context QA candidate, 2026-11-14.
-- NOT A MIGRATION. Must NOT be applied automatically.
-- Public API remains closed. Test JWT claims are simulated in PostgreSQL and are NOT signed HTTP JWTs.
-- QA data only. No real users, tokens, Zalo recipients or Orders.
BEGIN;
CREATE TABLE IF NOT EXISTS tien404_r1_qa.tenant_identity_map(
 tenant_key text PRIMARY KEY,
 store_key text NOT NULL,
 bot_key text NOT NULL,
 auth_tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 FOREIGN KEY (tenant_key,store_key,bot_key)
 REFERENCES tien404_r1_qa.shop_bots(tenant_key,store_key,bot_key),
 UNIQUE(store_key,bot_key), UNIQUE(auth_tenant_id)
);
ALTER TABLE tien404_r1_qa.tenant_identity_map ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tien404_r1_qa.tenant_identity_map FROM public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION tien404_r1_qa.owner_authorized_qa(p_tenant_key text, p_store_key text, p_bot_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'auth', 'tien404_r1_qa'
AS $function$
 select coalesce(
   current_setting('request.jwt.claim.role',true)='authenticated'
   and auth.uid() is not null
   and exists(
     select 1 from tien404_r1_qa.tenant_identity_map m
     join tien404_r1_qa.shop_bots b
       on b.tenant_key=m.tenant_key and b.store_key=m.store_key and b.bot_key=m.bot_key
     join public.tenant_memberships tm
       on tm.tenant_id=m.auth_tenant_id
     where m.tenant_key=p_tenant_key and m.store_key=p_store_key and m.bot_key=p_bot_key
       and tm.user_id=auth.uid() and tm.role='owner' and tm.active=true
       and b.identity_status='synthetic_qa' and b.enabled_mode='dry_run'
   ),false
 )
$function$


CREATE OR REPLACE FUNCTION tien404_r1_qa.pair_owner_authorized_qa(p_tenant text, p_store text, p_bot text, p_challenge uuid, p_recipient text, p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'tien404_r1_qa', 'auth'
AS $function$
declare v_owner_ref text;
begin
 if not tien404_r1_qa.owner_authorized_qa(p_tenant,p_store,p_bot) then return false;end if;
 select c.owner_ref into v_owner_ref
 from tien404_r1_qa.owner_pairing_challenges c
 where c.tenant_key=p_tenant and c.store_key=p_store and c.bot_key=p_bot
   and c.challenge_id=p_challenge and c.used_at is null and c.expires_at>now()
   and c.failed_attempts<5;
 if v_owner_ref is null then return false;end if;
 return tien404_r1_qa.pair_owner_qa(p_tenant,p_store,p_bot,p_challenge,v_owner_ref,p_recipient,p_code);
end $function$

REVOKE ALL ON FUNCTION tien404_r1_qa.owner_authorized_qa(text,text,text)
  FROM public,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION tien404_r1_qa.pair_owner_authorized_qa(text,text,text,uuid,text,text)
  FROM public,anon,authenticated,service_role;
COMMIT;
-- NOTE: PostgreSQL omits SECURITY INVOKER from pg_get_functiondef because it is the default.
-- Both routines were verified pg_proc.prosecdef=false. No SECURITY DEFINER.
-- Only bind QA tenants after verification; intentionally no tenant/user IDs in this candidate.
