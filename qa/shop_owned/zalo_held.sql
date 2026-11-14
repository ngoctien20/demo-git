-- Isolated QA Postgres only. No public grants, credentials or delivery function.
BEGIN;
CREATE FUNCTION tien404_r1_qa.issue_owner_challenge(p_tenant text,p_store text,p_bot text)
RETURNS TABLE(challenge uuid,code text) LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NOT tien404_r1_qa.owner_authorized_qa(p_tenant,p_store,p_bot) THEN
   RAISE EXCEPTION 'owner required' USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM tien404_r1_qa.shop_bots WHERE (tenant_key,store_key,bot_key)=(p_tenant,p_store,p_bot) FOR UPDATE;
 IF EXISTS(SELECT FROM tien404_r1_qa.owner_pairing_challenges
     WHERE (tenant_key,store_key,bot_key)=(p_tenant,p_store,p_bot)
     AND expires_at>now() AND used_at IS NULL) THEN
   RAISE EXCEPTION 'challenge already pending' USING ERRCODE='55000';
 END IF;
 challenge:=gen_random_uuid();
 code:=encode(extensions.gen_random_bytes(16),'hex');
 INSERT INTO tien404_r1_qa.owner_pairing_challenges
   (tenant_key,store_key,bot_key,challenge_id,owner_ref,requester_user_id,code_hash,expires_at)
 VALUES(p_tenant,p_store,p_bot,challenge,auth.uid()::text,auth.uid(),encode(extensions.digest(code,'sha256'),'hex'),now()+interval '5 minutes');
 RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION tien404_r1_qa.issue_owner_challenge(text,text,text)
 FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE notification_private.notification_outbox
 DROP CONSTRAINT notification_outbox_channel_check,
 DROP CONSTRAINT notification_outbox_status_check,
 ADD CHECK (channel IN ('zalo','zalo_bot','telegram','gmail','messenger','dashboard')),
 ADD CHECK (status IN ('held','queued','sending','accepted','failed','needs_review','blocked','cancelled')),
 ADD CHECK (channel <> 'zalo_bot' OR (status='held' AND attempts=0 AND destination_id IS NOT NULL
   AND accepted_at IS NULL AND claim_token IS NULL AND provider_message_id IS NULL));

CREATE FUNCTION notification_private.hold_shop_bot_notice() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 INSERT INTO notification_private.notification_outbox
   (tenant_id,event_id,channel,recipient_verified,destination_id,status,last_error_code)
 SELECT NEW.tenant_id,NEW.id,'zalo_bot',true,c.challenge_id,'held','SEND_DISABLED'
 FROM tien404_r1_qa.tenant_identity_map m
 JOIN tien404_r1_qa.shop_bots b USING (tenant_key,store_key,bot_key)
 JOIN tien404_r1_qa.owner_bindings o USING (tenant_key,store_key,bot_key)
 JOIN tien404_r1_qa.owner_pairing_claims_v3 p ON
   (p.tenant_key,p.store_key,p.bot_key,p.challenge_id,p.recipient_ref)=
   (o.tenant_key,o.store_key,o.bot_key,o.confirmed_challenge_id,o.recipient_ref)
 JOIN tien404_r1_qa.owner_pairing_challenges c ON (c.tenant_key,c.store_key,c.bot_key,c.challenge_id)=(p.tenant_key,p.store_key,p.bot_key,p.challenge_id)
 JOIN public.tenant_memberships tm ON tm.tenant_id=m.auth_tenant_id AND tm.user_id=c.requester_user_id
 WHERE m.auth_tenant_id=NEW.tenant_id AND NEW.saved_order_verified AND NEW.event_type='order_created'
   AND b.enabled_mode='dry_run' AND b.identity_status='synthetic_qa'
   AND o.status='paired' AND o.expires_at>now() AND p.status='CONFIRMED' AND c.used_at IS NOT NULL
   AND tm.active AND tm.role='owner'
 ON CONFLICT (tenant_id,event_id,channel) DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION notification_private.hold_shop_bot_notice() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER hold_shop_bot_notice AFTER INSERT ON notification_private.notification_events
 FOR EACH ROW EXECUTE FUNCTION notification_private.hold_shop_bot_notice();
COMMIT;
