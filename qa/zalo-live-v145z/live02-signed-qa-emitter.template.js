async()=>{
const template=__SOURCE_JSON__;
const W='tien404-zalo-live02-nosend-gate-staging',DB='d6604745-8f8a-4eac-95a3-83f6e4df0d39',p='/accounts/'+accountId;
const cf=async(method,path,body)=>cloudflare.request({method,path:p+path,...(body?{body}:{})});
const d=await cf('GET','/d1/database/'+DB);if(d.result?.name!=='tien404-zalo-live01-security-qa-staging')throw Error('WRONG_QA_DB');
const old=await cf('GET','/workers/scripts/tien404-zalo-outbound-v1-staging/settings');if((old.result?.bindings||[]).find(x=>x.name==='ZALO_SEND_ENABLED')?.text!=='false')throw Error('OLD_SEND_ENABLED_ABORT');
const prev=await cf('GET','/workers/scripts/'+W+'/settings');if(!prev.success||(prev.result?.bindings||[]).length!==1||(prev.result?.bindings||[])[0]?.id!==DB)throw Error('NEW_WORKER_OWNERSHIP_BINDING_MISMATCH');
const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const pub=await crypto.subtle.exportKey('jwk',pair.publicKey);
const source=template.replace('__QA_PUBLIC_JWK__',JSON.stringify(pub));
if(source.includes('__QA_PUBLIC_JWK__')||source.includes('sendMessage(')||source.includes('await fetch('))throw Error('SEND_CAPABILITY_FORBIDDEN');
const form=new FormData();
form.append('metadata',new Blob([JSON.stringify({main_module:'worker.mjs',compatibility_date:new Date().toISOString().slice(0,10),bindings:[{type:'d1',name:'LIVE02_DB',id:DB}]})],{type:'application/json'}));
form.append('worker.mjs',new Blob([source],{type:'application/javascript+module'}),'worker.mjs');
const up=await cf('PUT','/workers/scripts/'+W,form);if(!up.success)throw Error('QA_WORKER_DEPLOY_FAILED');
const q=async(sql,params=[])=>{const x=await cf('POST','/d1/database/'+DB+'/query',{sql,params:params.map(String)});const y=x.result?.[0]||{};if(!x.success||y.success===false)throw Error('D1_QA_FIXTURE_ERROR');return y.results||[]};
const sha=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('TIEN404-LIVE02-NONREAL-'+s)))).map(b=>b.toString(16).padStart(2,'0')).join('');
const suffix=crypto.randomUUID().replace(/-/g,'').slice(0,12),grant='qa_live02_b_'+suffix,now=Date.now();
const scope={tenant_hash:await sha('tenantB'),store_hash:await sha('storeB'),bot_hash:await sha('botB'),recipient_hash:await sha('ownerB'),session_hash:await sha('sessionB'+suffix)};
await q("INSERT INTO z145z_live01_grants(grant_id,tenant_hash,store_hash,bot_hash,recipient_hash,issued_ms,expires_ms,status) VALUES(?,?,?,?,?,?,?,'QA_ARMED')",[grant,scope.tenant_hash,scope.store_hash,scope.bot_hash,scope.recipient_hash,now-1000,now+599000]);
await q('INSERT INTO z145z_live01_quotas(grant_id) VALUES(?)',[grant]);
await q('INSERT INTO z145z_live01_sessions(grant_id,session_hash,updated_ms) VALUES(?,?,?)',[grant,scope.session_hash,now]);
const path='/v1/qa/claim',enc=new TextEncoder();
async function signature(raw){const s=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,enc.encode('TIEN404-LIVE02-QA-V1\nPOST\n'+path+'\n'+raw)));return btoa(String.fromCharCode(...s)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
async function signed(label,expected,event,rev,seq,tokens,override={},badSig=false){
 const body={kind:'TIEN404_LIVE02_QA_V1',grant_id:grant,...scope,...override,event_hash:await sha(event),ts_ms:Date.now(),expected_revision:rev,sequence:seq,reserve_tokens:tokens};
 const raw=JSON.stringify(body);return {label,expected,raw,signature:badSig?'A'.repeat(86):await signature(raw)};
}
const requests=[
 await signed('bad signature rejected',401,'bad_sig',0,1,10,{},true),
 await signed('signed wrong shop rejected',403,'fake_shop',0,1,10,{store_hash:await sha('forged_shop')}),
 await signed('first claim 1000 accepted',200,'event1',0,1,1000),
 await signed('duplicate replay blocked',409,'event1',0,1,1000),
 await signed('stale CAS blocked',409,'stale_event',0,2,1),
 await signed('second claim 1000 accepted',200,'event2',1,2,1000),
 await signed('overage 501 blocked with rollback',409,'overage',2,3,501),
 await signed('third claim 500 accepted',200,'event3',2,3,500),
 await signed('fourth claim blocked',422,'fourth',3,4,1)
];
return {created:true,worker:W,grant,requests,safe:true,signature_type:'P256_QA_TEMP_ONLY',expires_ms:now+599000,no_private_key_exported:true};
}