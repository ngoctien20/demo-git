async()=>{
const WORKER_SOURCE=__SOURCE_JSON__;
const W='tien404-zalo-live02-nosend-gate-staging',DB='d6604745-8f8a-4eac-95a3-83f6e4df0d39';
const p='/accounts/'+accountId,base='https://'+W+'.tienmobi208.workers.dev';
const cf=async(method,path,body)=>cloudflare.request({method,path:p+path,...(body?{body}:{})});
const db=await cf('GET','/d1/database/'+DB);
if(db.result?.name!=='tien404-zalo-live01-security-qa-staging')throw Error('WRONG_DATABASE');
const out=await cf('GET','/workers/scripts/tien404-zalo-outbound-v1-staging/settings');
if((out.result?.bindings||[]).find(x=>x.name==='ZALO_SEND_ENABLED')?.text!=='false')throw Error('OLD_OUTBOUND_NOT_LOCKED');
const scripts=await cf('GET','/workers/scripts');
if((scripts.result||[]).some(x=>(x.id||x.name)===W))return {blocked:true,reason:'ALREADY_EXISTS_STOP_REUPLOAD',worker:W};
const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const pub=await crypto.subtle.exportKey('jwk',pair.publicKey);
const content=WORKER_SOURCE.replace('__QA_PUBLIC_JWK__',JSON.stringify(pub));
if(content.includes('__QA_PUBLIC_JWK__')||content.includes('sendMessage(')||content.includes('await fetch('))throw Error('NO_SEND_SOURCE_GUARD');
const meta={main_module:'worker.mjs',compatibility_date:new Date().toISOString().slice(0,10),bindings:[{type:'d1',name:'LIVE02_DB',id:DB}]};
const form=new FormData();form.append('metadata',new Blob([JSON.stringify(meta)],{type:'application/json'}));form.append('worker.mjs',new Blob([content],{type:'application/javascript+module'}),'worker.mjs');
const uploaded=await cf('PUT','/workers/scripts/'+W,form);if(!uploaded.success)return {stage:'UPLOAD',errors:uploaded.errors};
const enabled=await cf('POST','/workers/scripts/'+W+'/subdomain',{enabled:true,previews_enabled:false});
if(!enabled.success)return {stage:'SUBDOMAIN',created:true,errors:enabled.errors};
const q=async(sql,params=[])=>{const v=await cf('POST','/d1/database/'+DB+'/query',{sql,params:params.map(String)});const r=v.result?.[0]||{};if(!v.success||r.success===false)throw Error('D1_QA:'+String(r.error||v.errors?.[0]?.message||'unknown').slice(0,120));return r.results||[]};
const sha=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('TIEN404_SYNTHETIC_LIVE02_'+s)))).map(b=>b.toString(16).padStart(2,'0')).join('');
const random=crypto.randomUUID().replace(/-/g,'').slice(0,12);
const grant='qa_live02_b_'+random,now=Date.now();
const scope={tenant_hash:await sha('tenantB'),store_hash:await sha('storeB'),bot_hash:await sha('botB'),recipient_hash:await sha('ownerB'),session_hash:await sha('sessionB'+random)};
await q("INSERT INTO z145z_live01_grants(grant_id,tenant_hash,store_hash,bot_hash,recipient_hash,issued_ms,expires_ms,status) VALUES(?,?,?,?,?,?,?,'QA_ARMED')",[grant,scope.tenant_hash,scope.store_hash,scope.bot_hash,scope.recipient_hash,now-1000,now+599000]);
await q('INSERT INTO z145z_live01_quotas(grant_id) VALUES(?)',[grant]);
await q('INSERT INTO z145z_live01_sessions(grant_id,session_hash,updated_ms) VALUES(?,?,?)',[grant,scope.session_hash,now]);
const test=[];function record(name,got,expected,extra={}){test.push({name,got,expected,pass:got===expected,...extra})}
let response;try{response=await fetch(base+'/health',{method:'GET',redirect:'manual'});}catch(e){return {created:true,worker:W,subdomain:true,hosted_http:'UNAVAILABLE',error:String(e).slice(0,140),private_signer_discarded:true};}
const health=await response.json().catch(()=>({}));record('health',response.status,200,{d1_bound:health.d1_bound===true,no_sends:health.sends===0});
const enc=new TextEncoder(),route='/v1/qa/claim';
async function sign(raw){const sig=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,enc.encode('TIEN404-LIVE02-QA-V1\nPOST\n'+route+'\n'+raw)));return btoa(String.fromCharCode(...sig)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function claim(name,rev,seq,tok,options={}){const body={kind:'TIEN404_LIVE02_QA_V1',grant_id:grant,...scope,...options.change,event_hash:await sha(name),ts_ms:Date.now(),expected_revision:rev,sequence:seq,reserve_tokens:tok};const raw=JSON.stringify(body),headers={'content-type':'application/json'};if(!options.noSig)headers['x-tien404-qa-signature']=options.badSig?'A'.repeat(86):await sign(raw);const r=await fetch(base+route,{method:'POST',body:raw,headers,redirect:'manual'});return {status:r.status,body:await r.json().catch(()=>({}))}}
let x=await claim('no-sign',0,1,2,{noSig:true});record('missing signature denied',x.status,401);
x=await claim('bad-sign',0,1,2,{badSig:true});record('bad signature denied',x.status,401);
x=await claim('wrong-store',0,1,2,{change:{store_hash:await sha('FORGED')}});record('wrong store denied',x.status,403);
x=await claim('valid1',0,1,1000);record('claim 1 accepted',x.status,200,{quota:x.body?.quota||null});
x=await claim('valid1',0,1,1000);record('duplicate event denied',x.status,409);
x=await claim('stale',0,2,1);record('stale CAS denied',x.status,409);
x=await claim('valid2',1,2,1000);record('claim 2 accepted',x.status,200,{quota:x.body?.quota||null});
x=await claim('over',2,3,501);record('over cap denied',x.status,409);
x=await claim('valid3',2,3,500);record('claim 3 at exactly 2500',x.status,200,{quota:x.body?.quota||null});
x=await claim('fourth',3,4,1);record('fourth message denied',x.status,422);
const blocked=await fetch(base+'/v1/send',{method:'POST',headers:{'content-type':'application/json'},body:'{}',redirect:'manual'});record('provider route blocked',blocked.status,423);
const quota=(await q('SELECT replies_claimed,model_calls_claimed,tokens_reserved FROM z145z_live01_quotas WHERE grant_id=?',[grant]))[0];
const state=(await q('SELECT revision,last_sequence FROM z145z_live01_sessions WHERE grant_id=?',[grant]))[0];
const total=(await q('SELECT COUNT(*) AS n FROM z145z_live01_atomic_claims WHERE grant_id=?',[grant]))[0]?.n;
return {created:true,worker:W,workerUrl:base,qa_db:DB,auth:'ephemeral QA ECDSA public key only; private key discarded',tests:test,passed:test.filter(t=>t.pass).length,failed:test.filter(t=>!t.pass).length,quota,session:state,claims:total,real_zalo_sends:0,real_model_calls:0,credential_changes:0,old_worker_flag:'false'};
}