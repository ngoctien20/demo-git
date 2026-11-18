\set ON_ERROR_STOP on
\echo V18_3_6F_ADMIN_SCHEMA_START
DO $guard$ BEGIN
 IF current_database()<>'tien404_v1836e_disposable' OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 THEN RAISE EXCEPTION 'NOT_DISPOSABLE_PG17'; END IF;
END $guard$;
ALTER TABLE public.stores ADD COLUMN slug text;
CREATE UNIQUE INDEX f_store_tenant_slug ON public.stores(tenant_id,slug);
ALTER TABLE public.store_memberships
 ADD COLUMN invited_by uuid,
 ADD COLUMN invited_at timestamptz,
 ADD COLUMN accepted_at timestamptz,
 ADD COLUMN approved_by uuid,
 ADD COLUMN approved_at timestamptz;
ALTER TABLE public.store_memberships ADD CONSTRAINT f_owner_not_expiring
 CHECK (role<>'store_owner' OR expires_at IS NULL);
CREATE TABLE qa_private.membership_audit(
 event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id uuid NOT NULL,store_id uuid NOT NULL,subject_user_id uuid NOT NULL,
 actor_user_id uuid NOT NULL,event_type text NOT NULL,old_status text,new_status text,
 event_at timestamptz NOT NULL DEFAULT clock_timestamp());
REVOKE ALL ON qa_private.membership_audit FROM PUBLIC,tien404_e_actor;

-- The database constraint checks privileged direct writes as well as approved command paths.
CREATE FUNCTION qa_private.guard_owner_removal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE st text; n int; withdrawing boolean;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.tenant_id,NEW.store_id,NEW.user_id)
    IS DISTINCT FROM (OLD.tenant_id,OLD.store_id,OLD.user_id)
 THEN RAISE EXCEPTION 'IMMUTABLE_MEMBERSHIP_SCOPE' USING ERRCODE='23514'; END IF;
 withdrawing := OLD.role='store_owner' AND OLD.status='active' AND OLD.revoked_at IS NULL
  AND (TG_OP='DELETE' OR NEW.role<>'store_owner' OR NEW.status<>'active' OR NEW.revoked_at IS NOT NULL);
 IF withdrawing THEN
  -- Store row lock serializes competing owner changes within a Store.
  SELECT status INTO st FROM public.stores WHERE tenant_id=OLD.tenant_id AND id=OLD.store_id FOR UPDATE;
  IF st='active' THEN
   SELECT count(*) INTO n FROM public.store_memberships sm
   WHERE sm.tenant_id=OLD.tenant_id AND sm.store_id=OLD.store_id AND sm.user_id<>OLD.user_id
    AND sm.role='store_owner' AND sm.status='active' AND sm.revoked_at IS NULL
    AND (sm.expires_at IS NULL OR sm.expires_at>now());
   IF n=0 THEN RAISE EXCEPTION 'LAST_ACTIVE_STORE_OWNER' USING ERRCODE='23514'; END IF;
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER f_guard_last_owner
BEFORE UPDATE OR DELETE ON public.store_memberships
FOR EACH ROW EXECUTE FUNCTION qa_private.guard_owner_removal();

CREATE FUNCTION qa_private.guard_store_activation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
 THEN RAISE EXCEPTION 'IMMUTABLE_STORE_ID' USING ERRCODE='23514'; END IF;
 IF NEW.status='active' AND OLD.status<>'active'
   AND NOT EXISTS(
     SELECT 1 FROM public.store_memberships m
     WHERE m.tenant_id=NEW.tenant_id AND m.store_id=NEW.id
       AND m.role='store_owner' AND m.status='active' AND m.revoked_at IS NULL
       AND m.expires_at IS NULL
   )
 THEN RAISE EXCEPTION 'ACTIVE_STORE_REQUIRES_OWNER' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER f_store_activation
BEFORE UPDATE ON public.stores
FOR EACH ROW EXECUTE FUNCTION qa_private.guard_store_activation();

-- Protected admin commands. Inputs are target resources; identity comes only from auth.uid().
-- In production auth.uid() must come from a server-verified session, not from SQL SET.
CREATE FUNCTION qa_private.admin_invite(p_tenant uuid,p_store uuid,p_target uuid,p_role text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE actor uuid:=auth.uid(); tenant_owner boolean; store_owner boolean; st text; existing text;
BEGIN
 IF actor IS NULL OR p_role NOT IN ('store_owner','manager','staff') THEN RETURN 'DENY_IDENTITY_OR_ROLE'; END IF;
 SELECT status INTO st FROM public.stores WHERE tenant_id=p_tenant AND id=p_store FOR UPDATE;
 IF st IS NULL OR st IN ('suspended','archived') THEN RETURN 'DENY_STORE'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id=p_tenant
  AND m.user_id=actor AND m.active AND m.role='owner') INTO tenant_owner;
 SELECT EXISTS(SELECT 1 FROM public.store_memberships m WHERE m.tenant_id=p_tenant AND m.store_id=p_store
  AND m.user_id=actor AND m.role='store_owner' AND m.status='active' AND m.revoked_at IS NULL
  AND m.expires_at IS NULL AND st='active') INTO store_owner;
 IF NOT (tenant_owner OR (store_owner AND p_role IN ('manager','staff'))) THEN RETURN 'DENY_ACTOR_SCOPE'; END IF;
 IF p_role='store_owner' AND NOT tenant_owner THEN RETURN 'DENY_OWNER_GRANT'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id=p_tenant AND m.user_id=p_target AND m.active)
 THEN RETURN 'DENY_TARGET_TENANT'; END IF;
 SELECT status INTO existing FROM public.store_memberships
 WHERE tenant_id=p_tenant AND store_id=p_store AND user_id=p_target FOR UPDATE;
 IF existing IS NOT NULL AND existing NOT IN ('revoked','expired') THEN RETURN 'DENY_MEMBERSHIP_EXISTS'; END IF;
 IF existing IS NULL THEN
  INSERT INTO public.store_memberships(tenant_id,store_id,user_id,role,status,invited_by,invited_at,approved_by,approved_at)
  VALUES(p_tenant,p_store,p_target,p_role,'invited',actor,clock_timestamp(),actor,clock_timestamp());
 ELSE
  UPDATE public.store_memberships SET role=p_role,status='invited',revoked_at=NULL,
     expires_at=NULL,accepted_at=NULL,invited_by=actor,invited_at=clock_timestamp(),
     approved_by=actor,approved_at=clock_timestamp()
  WHERE tenant_id=p_tenant AND store_id=p_store AND user_id=p_target;
 END IF;
 INSERT INTO qa_private.membership_audit(tenant_id,store_id,subject_user_id,actor_user_id,event_type,old_status,new_status)
 VALUES(p_tenant,p_store,p_target,actor,'INVITE',existing,'invited');
 RETURN 'INVITED';
END $fn$;

CREATE FUNCTION qa_private.admin_accept(p_tenant uuid,p_store uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE actor uuid:=auth.uid(); st text; n int;
BEGIN
 IF actor IS NULL THEN RETURN 'DENY_IDENTITY'; END IF;
 SELECT status INTO st FROM public.stores WHERE tenant_id=p_tenant AND id=p_store FOR UPDATE;
 IF st NOT IN ('provisioning','active') OR st IS NULL THEN RETURN 'DENY_STORE'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id=p_tenant AND m.user_id=actor AND m.active)
 THEN RETURN 'DENY_TENANT_MEMBERSHIP'; END IF;
 UPDATE public.store_memberships SET status='active',accepted_at=clock_timestamp()
 WHERE tenant_id=p_tenant AND store_id=p_store AND user_id=actor AND status='invited'
  AND approved_at IS NOT NULL AND invited_at>clock_timestamp()-interval '1 day';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RETURN 'DENY_NO_FRESH_INVITE'; END IF;
 INSERT INTO qa_private.membership_audit(tenant_id,store_id,subject_user_id,actor_user_id,event_type,old_status,new_status)
 VALUES(p_tenant,p_store,actor,actor,'ACCEPT','invited','active');
 RETURN 'ACCEPTED';
END $fn$;

CREATE FUNCTION qa_private.admin_revoke(p_tenant uuid,p_store uuid,p_target uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE actor uuid:=auth.uid(); tenant_owner boolean; store_owner boolean; target_role text; target_status text; st text;
BEGIN
 IF actor IS NULL THEN RETURN 'DENY_IDENTITY'; END IF;
 SELECT status INTO st FROM public.stores WHERE tenant_id=p_tenant AND id=p_store FOR UPDATE;
 IF st IS NULL THEN RETURN 'DENY_STORE'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id=p_tenant
  AND m.user_id=actor AND m.active AND m.role='owner') INTO tenant_owner;
 SELECT EXISTS(SELECT 1 FROM public.store_memberships m WHERE m.tenant_id=p_tenant
  AND m.store_id=p_store AND m.user_id=actor AND m.role='store_owner'
  AND m.status='active' AND m.revoked_at IS NULL AND m.expires_at IS NULL) INTO store_owner;
 SELECT role,status INTO target_role,target_status FROM public.store_memberships
 WHERE tenant_id=p_tenant AND store_id=p_store AND user_id=p_target FOR UPDATE;
 IF target_role IS NULL OR target_status<>'active' THEN RETURN 'DENY_TARGET'; END IF;
 IF NOT tenant_owner AND NOT (store_owner AND target_role IN ('manager','staff'))
 THEN RETURN 'DENY_ACTOR_SCOPE'; END IF;
 -- A DB trigger rejects attempts to remove the final active Store Owner.
 UPDATE public.store_memberships SET status='revoked',revoked_at=clock_timestamp()
 WHERE tenant_id=p_tenant AND store_id=p_store AND user_id=p_target;
 INSERT INTO qa_private.membership_audit(tenant_id,store_id,subject_user_id,actor_user_id,event_type,old_status,new_status)
 VALUES(p_tenant,p_store,p_target,actor,'REVOKE',target_status,'revoked');
 RETURN 'REVOKED';
END $fn$;

CREATE FUNCTION qa_private.admin_create_store(p_tenant uuid,p_slug text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL OR p_slug IS NULL OR p_slug !~ '^[a-z][a-z0-9-]{2,30}$'
 THEN RETURN 'DENY_IDENTITY_OR_SLUG'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.tenant_memberships
    WHERE tenant_id=p_tenant AND user_id=actor AND active AND role='owner')
 THEN RETURN 'DENY_TENANT_OWNER'; END IF;
 INSERT INTO public.stores(id,tenant_id,status,slug) VALUES(gen_random_uuid(),p_tenant,'provisioning',p_slug);
 RETURN 'CREATED_PROVISIONING';
END $fn$;
CREATE FUNCTION qa_private.admin_activate_store(p_tenant uuid,p_store uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE actor uuid:=auth.uid(); st text;
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.tenant_memberships
 WHERE tenant_id=p_tenant AND user_id=actor AND active AND role='owner')
 THEN RETURN 'DENY_TENANT_OWNER'; END IF;
 SELECT status INTO st FROM public.stores WHERE tenant_id=p_tenant AND id=p_store FOR UPDATE;
 IF st<>'provisioning' THEN RETURN 'DENY_LIFECYCLE'; END IF;
 UPDATE public.stores SET status='active' WHERE tenant_id=p_tenant AND id=p_store;
 RETURN 'ACTIVATED';
END $fn$;

REVOKE ALL ON FUNCTION qa_private.admin_invite(uuid,uuid,uuid,text),
 qa_private.admin_accept(uuid,uuid),
 qa_private.admin_revoke(uuid,uuid,uuid),
 qa_private.admin_create_store(uuid,text),
 qa_private.admin_activate_store(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qa_private.admin_invite(uuid,uuid,uuid,text),
 qa_private.admin_accept(uuid,uuid),
 qa_private.admin_revoke(uuid,uuid,uuid),
 qa_private.admin_create_store(uuid,text),
 qa_private.admin_activate_store(uuid,uuid) TO tien404_e_actor;
-- Additional synthetic Tenant Owner T2 for last-Owner tests; does not grant Store membership.
INSERT INTO public.tenant_memberships(tenant_id,user_id,role,active)
VALUES('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000001011','owner',true);
\echo V18_3_6F_ADMIN_SCHEMA_READY
