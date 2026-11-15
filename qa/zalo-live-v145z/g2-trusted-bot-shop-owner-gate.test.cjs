'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {generateKeyPairSync,sign,createHash}=require('node:crypto');
const {ISSUER}=require('./live03-identity-budget-gate.cjs');
const {assessG2,ROLES,distinctPinnedRoots}=require('./g2-trusted-bot-shop-owner-gate.cjs');
const now=Date.now();
const hash=s=>createHash('sha256').update('SYNTHETIC_G2_TEST_ONLY:'+s).digest('hex');
const nonce='a'.repeat(64);
const g={bot_digest:hash('fictional_bot_b'),tenant_digest:hash('fictional_tenant_b'),
  store_digest:hash('fictional_store_b'),owner_digest:hash('fictional_owner_b'),challenge_nonce:nonce};
const keypairs=Object.fromEntries(ROLES.map(role=>[role,generateKeyPairSync('ec',{namedCurve:'prime256v1'})]));
const keys=Object.fromEntries(ROLES.map(role=>[ISSUER[role],keypairs[role].publicKey.export({format:'pem',type:'spki'})]));
const base={
 provider:{...g,provider:'zalo_bot_creator',source:'SERVER_HTTPS_ZALO_GETME',api_method:'POST',getme_http_status:200,getme_result_id_string:true,id_is_official_provider_result:true,actual_api_call_readonly:true},
 registry:{...g,bot_provider:'zalo_bot_creator',server_side_lookup:true,match_count:1,identity_status:'verified_provider_id',registry_mode:'limited_qa',synthetic_fixture:false,store_scope:'SHOP_B_STAGING_ONLY'},
 owner:{...g,owner_allowlist_matches:true,provider_owner_pair_verified:true,consent_explicit_for_qa:true,consent_source:'INDEPENDENT_PROVIDER_OWNER_ATTESTOR',provider_checked_ms:now,owner_allowlist_exp_ms:now+300000},
 hosted:{...g,readonly_ingress_verified:true,protected_webhook_verified:true,webhook_matches_staging:true,trusted_bot_scope:'SINGLE_REAL_BOT_TO_SHOP_B',synthetic_binding_removed:true,no_send_kill_switch:true,real_orders_disabled:true},
};
function proof(role,claims,signingKey=keypairs[role].privateKey,issuer=ISSUER[role]){
 const payload=JSON.stringify({issuer,purpose:'TIEN404_V145Z_LIVE03_CERTIFICATION_ONLY',
    evidence_id:'QA_G2_'+role,issued_ms:now-1000,expires_ms:now+120000,claims});
 const signature=sign('sha256',Buffer.from(payload),{key:signingKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 return {payload,signature};
}
function inputs(patches={}){
 return {evidence:Object.fromEntries(ROLES.map(role=>[role,proof(role,{...base[role],...(patches[role]||{})})]))};
}
function trusted(override={}){
 const consumed=new Set();
 return {pinnedKeys:keys,scope:'SHOP_B_STAGING_ONLY',expectedTenantDigest:g.tenant_digest,expectedStoreDigest:g.store_digest,
  consumeNonceOnce:async({nonce,scope,ttlMs})=>{if(scope!=='G2_SHOP_B_QA'||ttlMs>120000||consumed.has(nonce))return false;consumed.add(nonce);return true;},...override};
}
const expectBlocked=async (patches,reason,server=trusted())=>{
 const x=await assessG2(inputs(patches),server,now);
 assert.equal(x.status,'BLOCKED');
 assert.equal(x.can_send,false);
 assert.equal(x.client_qa_can_promote_registry,false);
 assert.ok(x.blocked_reasons.includes(reason),JSON.stringify(x.blocked_reasons));
};
test('distinct independent pinned P256 roots validated',()=>assert.equal(distinctPinnedRoots(keys),true));
test('no roots always blocks',async()=>{const x=await assessG2(inputs(),{},now);assert.equal(x.status,'BLOCKED');assert.equal(x.can_send,false);});
test('happy synthetic fixture can only reach private human review NO SEND',async()=>{
 const x=await assessG2(inputs(),trusted(),now);
 assert.equal(x.status,'ELIGIBLE_FOR_PRIVATE_OWNER_REVIEW_ONLY');
 assert.equal(x.trusted_signatures_verified,4);
 assert.equal(x.can_send,false);assert.equal(x.real_provider_bot_shop_owner_certified,false);
 assert.equal(x.client_qa_can_promote_registry,false);
 assert.equal(x.provider_sends,0);assert.equal(x.credential_mutations,0);
 assert.equal(x.challenge_consumed,true);
 assert.equal(x.identity_digest_ref,g.bot_digest);
 assert.ok(!JSON.stringify(x).includes('fictional_bot_b'));
});
test('duplicate pinned issuer keys denied',async()=>{
 const roots={...keys,[ISSUER.owner]:keys[ISSUER.provider]};
 const x=await assessG2(inputs(),trusted({pinnedKeys:roots}),now);
 assert.ok(x.blocked_reasons.includes('TRUSTED_ISSUER_KEYS_OR_NONCE_STORE_NOT_CONFIGURED'));
});
test('no durable consumeNonceOnce store denies',async()=>{
 const x=await assessG2(inputs(),trusted({consumeNonceOnce:null}),now);
 assert.equal(x.status,'BLOCKED');
});
test('caller-supplied trust roots ignored',async()=>{
 const i=inputs();i.pinnedKeys=keys;
 const x=await assessG2(i,{},now);
 assert.equal(x.status,'BLOCKED');
});
test('caller-supplied verified booleans ignored',async()=>{
 const i=inputs();i.verified=true;i.can_send=true;
 const x=await assessG2(i,trusted(),now);
 assert.equal(x.can_send,false);
});
test('remove provider evidence blocked',async()=>{const x=inputs();delete x.evidence.provider;const r=await assessG2(x,trusted(),now);assert.ok(r.blocked_reasons.includes('MISSING_SIGNED_PROVIDER_PROOF'));});
test('remove registry evidence blocked',async()=>{const x=inputs();delete x.evidence.registry;const r=await assessG2(x,trusted(),now);assert.ok(r.blocked_reasons.includes('MISSING_SIGNED_REGISTRY_PROOF'));});
test('remove owner evidence blocked',async()=>{const x=inputs();delete x.evidence.owner;const r=await assessG2(x,trusted(),now);assert.ok(r.blocked_reasons.includes('MISSING_SIGNED_OWNER_PROOF'));});
test('remove hosted ingress evidence blocked',async()=>{const x=inputs();delete x.evidence.hosted;const r=await assessG2(x,trusted(),now);assert.ok(r.blocked_reasons.includes('MISSING_SIGNED_HOSTED_PROOF'));});
test('tamper signed payload blocked',async()=>{const x=inputs();x.evidence.registry.payload=x.evidence.registry.payload.replace('verified_provider_id','synthetic_qa');const r=await assessG2(x,trusted(),now);assert.ok(r.blocked_reasons.includes('MISSING_SIGNED_REGISTRY_PROOF'));});
test('invalid issuer wrong role blocked',async()=>{const x=inputs();x.evidence.provider=proof('provider',base.provider,keypairs.provider.privateKey,ISSUER.owner);const r=await assessG2(x,trusted(),now);assert.ok(r.blocked_reasons.includes('MISSING_SIGNED_PROVIDER_PROOF'));});
test('mixed nonce pack rejected',async()=>expectBlocked({owner:{challenge_nonce:'b'.repeat(64)}},'CHALLENGE_NONCE_UNBOUND_OR_MISMATCHED'));
test('invalid nonce blocked',async()=>expectBlocked({provider:{challenge_nonce:'not-a-nonce'}},'CHALLENGE_NONCE_UNBOUND_OR_MISMATCHED'));
test('different bot provider ID digest blocked',async()=>expectBlocked({provider:{bot_digest:hash('different_bot')}},'IDENTITY_BOT_DIGEST_MISMATCH'));
test('different tenant digest blocked',async()=>expectBlocked({registry:{tenant_digest:hash('other_tenant')}},'IDENTITY_TENANT_DIGEST_MISMATCH'));
test('different store digest blocked',async()=>expectBlocked({owner:{store_digest:hash('other_shop')}},'IDENTITY_STORE_DIGEST_MISMATCH'));
test('different owner digest blocked',async()=>expectBlocked({hosted:{owner_digest:hash('other_owner')}},'IDENTITY_OWNER_DIGEST_MISMATCH'));
test('untrusted Shop A server expected context denied',async()=>{
 await expectBlocked({},'SERVER_PINNED_TENANT_STORE_MISMATCH',trusted({expectedStoreDigest:hash('shop_a')}));
});
test('provider only token valid boolean denied',async()=>expectBlocked({provider:{getme_result_id_string:false}},'OFFICIAL_GETME_PROVIDER_ID_NOT_ATTESTED'));
test('provider HTTP result not 200 denied',async()=>expectBlocked({provider:{getme_http_status:403}},'OFFICIAL_GETME_PROVIDER_ID_NOT_ATTESTED'));
test('provider source not trusted HTTPS denied',async()=>expectBlocked({provider:{source:'USER_SUBMITTED_SCREENSHOT'}},'OFFICIAL_GETME_PROVIDER_ID_NOT_ATTESTED'));
test('provider method wrong denied',async()=>expectBlocked({provider:{api_method:'GET'}},'OFFICIAL_GETME_PROVIDER_ID_NOT_ATTESTED'));
test('registry synthetic fixture rejected',async()=>expectBlocked({registry:{synthetic_fixture:true}},'SHOP_B_TRUSTED_RESOLVER_NOT_ATTESTED'));
test('registry two conflicting rows rejected',async()=>expectBlocked({registry:{match_count:2}},'SHOP_B_TRUSTED_RESOLVER_NOT_ATTESTED'));
test('registry dry_run rejected',async()=>expectBlocked({registry:{registry_mode:'dry_run'}},'SHOP_B_TRUSTED_RESOLVER_NOT_ATTESTED'));
test('registry wrong provider rejected',async()=>expectBlocked({registry:{bot_provider:'zalo_bot_fixture'}},'SHOP_B_TRUSTED_RESOLVER_NOT_ATTESTED'));
test('owner missing independent confirmation rejected',async()=>expectBlocked({owner:{provider_owner_pair_verified:false}},'INDEPENDENT_OWNER_PAIR_OR_CONSENT_MISSING'));
test('owner missing explicit consent rejected',async()=>expectBlocked({owner:{consent_explicit_for_qa:false}},'INDEPENDENT_OWNER_PAIR_OR_CONSENT_MISSING'));
test('owner consent source untrusted rejected',async()=>expectBlocked({owner:{consent_source:'CLIENT_BOOLEAN'}},'INDEPENDENT_OWNER_PAIR_OR_CONSENT_MISSING'));
test('expired owner allowlist rejected',async()=>expectBlocked({owner:{owner_allowlist_exp_ms:now-1}},'INDEPENDENT_OWNER_PAIR_OR_CONSENT_MISSING'));
test('stale provider owner check rejected',async()=>expectBlocked({owner:{provider_checked_ms:now-130000}},'INDEPENDENT_OWNER_PAIR_OR_CONSENT_MISSING'));
test('hosted synthetic shop link rejected',async()=>expectBlocked({hosted:{synthetic_binding_removed:false}},'REAL_HOSTED_INGRESS_NOT_ATTESTED'));
test('hosted ingress without signature protection rejected',async()=>expectBlocked({hosted:{protected_webhook_verified:false}},'REAL_HOSTED_INGRESS_NOT_ATTESTED'));
test('hosted ingress with send enabled rejected',async()=>expectBlocked({hosted:{no_send_kill_switch:false}},'REAL_HOSTED_INGRESS_NOT_ATTESTED'));
test('hosted ingress store wrong rejected',async()=>expectBlocked({hosted:{trusted_bot_scope:'SHOP_A'}},'REAL_HOSTED_INGRESS_NOT_ATTESTED'));
test('replay same evidence pack rejected via durable verifier store',async()=>{
 const store=trusted();
 const a=await assessG2(inputs(),store,now),b=await assessG2(inputs(),store,now);
 assert.equal(a.status,'ELIGIBLE_FOR_PRIVATE_OWNER_REVIEW_ONLY');
 assert.equal(b.status,'BLOCKED');assert.ok(b.blocked_reasons.includes('CHALLENGE_REPLAY_OR_STORE_UNAVAILABLE'));
});
test('fail closed if durable store unavailable',async()=>expectBlocked({},'CHALLENGE_REPLAY_OR_STORE_UNAVAILABLE',trusted({consumeNonceOnce:async()=>{throw Error('DB_UNAVAILABLE')}})));
test('invalid server clock blocks',async()=>{const x=await assessG2(inputs(),trusted(),-1);assert.ok(x.blocked_reasons.includes('INVALID_TRUSTED_SERVER_CLOCK'))});
test('untrusted caller cannot add send permission',async()=>{
 const x=await assessG2({...inputs(),authorize_real_sends:true,sendMessage:{chat_id:'fake'}},trusted(),now);
 assert.equal(x.can_send,false);assert.equal(x.provider_request,null);
});
test('wrong provider signature key blocked',async()=>{const x=inputs();x.evidence.provider=proof('provider',base.provider,keypairs.owner.privateKey);const r=await assessG2(x,trusted(),now);assert.ok(r.blocked_reasons.includes('MISSING_SIGNED_PROVIDER_PROOF'));});
test('missing trusted issuer public key blocked',async()=>{const t=trusted({pinnedKeys:{...keys}});delete t.pinnedKeys[ISSUER.hosted];const x=await assessG2(inputs(),t,now);assert.equal(x.status,'BLOCKED')});
test('duplicate evidence signature never used for another issuer',async()=>{const x=inputs();x.evidence.owner=x.evidence.provider;const r=await assessG2(x,trusted(),now);assert.equal(r.status,'BLOCKED');});
test('raw provider IDs never exposed in any fail-closed response',async()=>{
 const x=await assessG2({},trusted(),now);
 assert.equal(JSON.stringify(x).includes('1459232241454765289'),false);
 assert.equal(x.can_send,false);
});
