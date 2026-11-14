-- Two existing QA merchants only. Private tables remain inaccessible.
CREATE FUNCTION public.qa_owner_pairing(p_shop uuid,p_action text,p_challenge uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 m tien404_r1_qa.tenant_identity_map%ROWTYPE;
 c tien404_r1_qa.owner_pairing_challenges%ROWTYPE;
 claim tien404_r1_qa.owner_pairing_claims_v3%ROWTYPE;
 code text;
BEGIN
 SELECT i.* INTO m FROM tien404_r1_qa.tenant_identity_map i
 JOIN tien404_r1_qa.shop_bots b USING(tenant_key,store_key,bot_key)
 JOIN public.tenant_memberships tm ON tm.tenant_id=i.auth_tenant_id
 WHERE i.auth_tenant_id=p_shop AND tm.user_id=auth.uid() AND tm.active AND tm.role='owner'
 AND (i.tenant_key,i.store_key,i.bot_key) IN (('qa-tenant-a','qa-store-a','qa-bot-a'),('qa-tenant-b','qa-store-b','qa-bot-b'))
 AND b.enabled_mode='dry_run' AND b.identity_status='synthetic_qa'
 FOR SHARE OF tm,b;
 IF NOT FOUND THEN RAISE insufficient_privilege; END IF;
 IF p_action='issue' AND p_challenge IS NULL THEN
   SELECT v.challenge,v.code INTO c.challenge_id,code
     FROM tien404_r1_qa.issue_owner_challenge(m.tenant_key,m.store_key,m.bot_key) v;
   SELECT * INTO STRICT c FROM tien404_r1_qa.owner_pairing_challenges h
    WHERE h.tenant_key=m.tenant_key AND h.store_key=m.store_key AND h.bot_key=m.bot_key AND h.challenge_id=c.challenge_id;
   RETURN jsonb_build_object('state','WAITING_FOR_BOT','challengeId',c.challenge_id,'code',code,'expiresAt',c.expires_at,'bot',m.bot_key);
 END IF;
 IF p_action IS NULL OR p_action NOT IN ('status','confirm') OR (p_action='confirm' AND p_challenge IS NULL) THEN RAISE EXCEPTION 'unsupported action' USING ERRCODE='22023'; END IF;
 SELECT * INTO c FROM tien404_r1_qa.owner_pairing_challenges WHERE
   (tenant_key,store_key,bot_key)=(m.tenant_key,m.store_key,m.bot_key)
   AND requester_user_id=auth.uid() AND expires_at>now() AND failed_attempts<5
   AND (p_challenge IS NULL OR challenge_id=p_challenge) ORDER BY created_at DESC LIMIT 1;
 IF NOT FOUND THEN RETURN jsonb_build_object('state','NO_CURRENT_CHALLENGE'); END IF;
 IF p_action='confirm' THEN
   IF c.used_at IS NULL AND tien404_r1_qa.confirm_owner_pairing_v3_qa(m.tenant_key,m.store_key,m.bot_key,c.challenge_id) THEN
     RETURN jsonb_build_object('status','PAIRED','challengeId',c.challenge_id);
   END IF;
   RAISE EXCEPTION 'claim unavailable' USING ERRCODE='PT409';
 END IF;
 SELECT * INTO claim FROM tien404_r1_qa.owner_pairing_claims_v3 WHERE (tenant_key,store_key,bot_key,challenge_id)=(m.tenant_key,m.store_key,m.bot_key,c.challenge_id);
 RETURN jsonb_build_object('state',CASE WHEN c.used_at IS NOT NULL THEN 'CLOSED' WHEN claim.status='PENDING_OWNER_CONFIRMATION' THEN 'PENDING_OWNER_CONFIRMATION' ELSE 'WAITING_FOR_BOT' END,
 'challengeId',c.challenge_id,'expiresAt',c.expires_at,'bot',m.bot_key,
 'recipientFingerprint',left(encode(extensions.digest(claim.recipient_ref,'sha256'),'hex'),12));
END $$;
REVOKE ALL ON FUNCTION public.qa_owner_pairing(uuid,text,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.qa_owner_pairing(uuid,text,uuid) TO authenticated;
