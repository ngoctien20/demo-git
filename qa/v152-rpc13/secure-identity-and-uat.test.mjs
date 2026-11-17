import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createSign} from 'node:crypto';
import {verifyAccessToken,verifySupabaseUser,requireDualIdentity} from './dual-verified-identity.mjs';
import {createPrivateIntake,INTAKE_NOT_DEPLOYED} from './private-intake-core.mjs';
import {inspectEvidencePacket} from './owner-evidence-admission.mjs';
import {runUat,readPrivateToken} from './live-auth-uat.mjs';
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'qa-key',alg:'RS256',use:'sig'};
const TEAM='https://shop.cloudfare-example.cloudflareaccess.com'.replace('cloudfare-example','cloudflare-example');
const AUD='merchant-intake-audience';
const PUB='public-nonsecret-publishable-key';
const PROJ='https://ifxlvrhyjhbzbrkdsida.supabase.co';
const UID_A='aaaaaaaa-0000-4000-8000-000000000001';
const UID_B='bbbbbbbb-0000-4000-8000-000000000002';
const TENANT='11111111-1111-4111-8111-111111111111';
const STORE_A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STORE_B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const jwtEnc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
function sign(payload,header={alg:'RS256',kid:'qa-key',typ:'JWT'}){const data=jwtEnc(header)+'.'+jwtEnc(payload);return data+'.'+createSign('RSA-SHA256').update(data).sign(privateKey,'base64url');}
const now=Math.floor(Date.now()/1000);
const goodPayload={iss:TEAM,sub:'access-test-subject',email:'OWNER@EXAMPLE.COM',aud:AUD,iat:now-5,exp:now+600};
const accessToken=sign(goodPayload);
const authToken='xxx.'+'y'.repeat(145)+'.zzz';
function identityFetch(url,opts){
 if(url.endsWith('/cdn-cgi/access/certs'))return Promise.resolve(new Response(JSON.stringify({keys:[jwk]}),{status:200}));
 if(url.endsWith('/auth/v1/user'))return Promise.resolve(new Response(JSON.stringify({id:UID_A,email:'owner@example.com',role:'authenticated',email_confirmed_at:'2026-01-01T00:00:00Z'}),{status:200}));
 throw Error('UNEXPECTED_EXTERNAL_REQUEST');
}
function opts(extra={}){return {teamDomain:TEAM,audience:AUD,supabaseUrl:PROJ,publishableKey:PUB,fetcher:identityFetch,now,...extra};}
for(const [name,tok,exception] of [
 ['valid_signature',accessToken,null],
 ['unsigned_alg_none',sign(goodPayload,{alg:'none',kid:'qa-key'}),'UNSAFE_ACCESS_JWT_ALGORITHM'],
 ['wrong_audience',sign({...goodPayload,aud:'other'}),'ACCESS_JWT_CLAIMS_DENIED'],
 ['wrong_issuer',sign({...goodPayload,iss:'https://other.cloudflareaccess.com'}),'ACCESS_JWT_CLAIMS_DENIED'],
 ['expired',sign({...goodPayload,exp:now-1}),'ACCESS_JWT_CLAIMS_DENIED'],
 ['future_nbf',sign({...goodPayload,nbf:now+600}),'ACCESS_JWT_CLAIMS_DENIED'],
 ['bad_signature',sign(goodPayload).slice(0,-5)+'AAAAA','ACCESS_SIGNATURE_INVALID'],
 ['wrong_kid',sign(goodPayload,{alg:'RS256',kid:'unknown'}),'ACCESS_SIGNING_KEY_NOT_FOUND'],
 ['injected_jku',sign(goodPayload,{alg:'RS256',kid:'qa-key',jku:'https://attacker.invalid/jwks'}),'UNSAFE_ACCESS_JWT_ALGORITHM']
])test('Access '+name,async()=>{if(!exception)assert.equal((await verifyAccessToken(tok,opts())).email,'owner@example.com');else await assert.rejects(verifyAccessToken(tok,opts()),e=>e.code===exception);});
test('Access attacker cannot dictate JWKS location',async()=>{const r=await verifyAccessToken(accessToken,opts());assert.equal(r.accessSubject,'access-test-subject');});
test('Access refused invalid team domain',async()=>{await assert.rejects(verifyAccessToken(accessToken,opts({teamDomain:'http://evil.com'})),/INVALID_ACCESS_ISSUER/);});
test('Supabase auth validates user via provider user endpoint',async()=>{const r=await verifySupabaseUser(authToken,opts());assert.equal(r.userId,UID_A);});
test('Supabase API rejects bearer failures',async()=>{await assert.rejects(verifySupabaseUser(authToken,opts({fetcher:()=>Promise.resolve(new Response('',{status:401}))})),/SUPABASE_USER_TOKEN_INVALID/);});
test('Supabase API refuses anonymous user',async()=>{await assert.rejects(verifySupabaseUser(authToken,opts({fetcher:()=>Promise.resolve(new Response(JSON.stringify({id:UID_A,email:'owner@example.com',role:'authenticated',is_anonymous:true,email_confirmed_at:'x'}),{status:200}))})),/SUPABASE_USER_UNQUALIFIED/);});
test('Supabase refuses user_metadata-only account',async()=>{await assert.rejects(verifySupabaseUser(authToken,opts({fetcher:()=>Promise.resolve(new Response(JSON.stringify({id:UID_A,email:'owner@example.com',user_metadata:{role:'owner'}}),{status:200}))})),/SUPABASE_USER_UNQUALIFIED/);});
test('Dual identity requires verified matching email',async()=>{const request=new Request('https://private.example/v1/private/evidence',{method:'POST',headers:{'cf-access-jwt-assertion':accessToken,authorization:'Bearer '+authToken}});const r=await requireDualIdentity(request,opts());assert.equal(r.authUserId,UID_A);});
test('Dual identity refuses mismatched emails',async()=>{const req=new Request('https://private.example/',{headers:{'cf-access-jwt-assertion':sign({...goodPayload,email:'attacker@example.com'}),authorization:'Bearer '+authToken}});await assert.rejects(requireDualIdentity(req,opts()),/TWO_IDENTITY_EMAIL_MISMATCH/);});
test('Dual identity ignores spoofed cf-access-authenticated-user-email',async()=>{const req=new Request('https://private.example/',{headers:{'cf-access-authenticated-user-email':'owner@example.com',authorization:'Bearer '+authToken}});await assert.rejects(requireDualIdentity(req,opts()));});
test('Merchant intake defaults closed without registry',async()=>{assert.equal(INTAKE_NOT_DEPLOYED,true);const fn=createPrivateIntake({identityConfig:opts()});const r=await fn(new Request('https://private.example/v1/private/evidence',{method:'POST'}));assert.equal(r.status,503);});
test('Merchant intake refuses absent dual auth',async()=>{const fn=createPrivateIntake({identityConfig:opts(),authority:{},quarantine:{},fetcher:identityFetch});const r=await fn(new Request('https://private.example/v1/private/evidence',{method:'POST'}));assert.equal(r.status,403);});
test('Merchant intake refuses unsupported methods',async()=>{const fn=createPrivateIntake({identityConfig:opts(),authority:{},quarantine:{},fetcher:identityFetch});const r=await fn(new Request('https://private.example/v1/private/evidence',{method:'GET'}));assert.equal(r.status,404);});
test('Merchant intake refuses spoofed invitation absent registry',async()=>{const fn=createPrivateIntake({identityConfig:opts(),authority:{getInvitation:async()=>null},quarantine:{put:async()=>{throw Error('should not upload')}},fetcher:identityFetch});const form=new FormData();form.set('slot','P1');form.set('source_type','MERCHANT_ORIGINAL_CATALOG');form.set('source',new Blob([new TextEncoder().encode('%PDF-1.7\n'+'.'.repeat(100))],{type:'application/pdf'}),'proof.pdf');const request=new Request('https://private.example/v1/private/evidence',{method:'POST',headers:{'cf-access-jwt-assertion':accessToken,authorization:'Bearer '+authToken},body:form});const r=await fn(request);assert.equal(r.status,403);});
test('Merchant intake quarantines verified invited proof, not marked accepted',async()=>{const objects=[];const actor={accessSubject:'access-test-subject'};const authority={getInvitation:async()=>({id:'invited',status:'ISSUED',expiresAt:Date.now()+900000,operatorSourceVerified:true,authUserId:UID_A,slot:'P1',...actor}),reserve:async()=>true,finalize:async x=>{objects.push(x)}};const quarantine={put:async(key,bytes,opts)=>objects.push({key,bytes,opts})};const fn=createPrivateIntake({identityConfig:opts(),authority,quarantine,fetcher:identityFetch});const form=new FormData();form.set('slot','P1');form.set('source_type','MERCHANT_ORIGINAL_CATALOG');form.set('source',new Blob([new TextEncoder().encode('%PDF-1.7\n'+'.'.repeat(100))],{type:'application/pdf'}),'proof.pdf');const req=new Request('https://private.example/v1/private/evidence',{method:'POST',headers:{'cf-access-jwt-assertion':accessToken,authorization:'Bearer '+authToken},body:form});const r=await fn(req);assert.equal(r.status,202);const body=await r.json();assert.equal(body.status,'QUARANTINED_PENDING_SCAN_AND_REVIEW');assert.equal(objects.length,2);assert.equal(objects[1].status,'PENDING_MALWARE_SCAN');});
for(const example of [undefined,{records:[]},{records:[{slot:'P1',kind:'PRODUCT',stage:'REVIEWED',malwareScan:'CLEAN',sourceAuthenticity:'VERIFIED',merchantUserVerified:true,merchantOwnerApproved:true,reviewerUserVerified:true,reviewerApproved:true,merchantAuthUserId:'x',reviewerAuthUserId:'x',canonicalStoreVerifiedByRegistry:true}]}])test('four-row owner gate always NO_GO',()=>{const r=inspectEvidencePacket(example);assert.equal(r.status,'FOUR_ROW_OWNER_HOSTED_NO_GO');assert.equal(r.canRelease,false);assert.equal(r.canMigrate,false);});
const canaries={};for(let i=1;i<=6;i++){const n=['products','orders','customers','order_items','conversations','messages'][i-1];canaries[n]={A:`aaaaaaa${i}-1111-4111-8111-aaaaaaaaaaaa`,B:`bbbbbbb${i}-1111-4111-8111-bbbbbbbbbbbb`};}
const A_TOKEN='AAA.'+'a'.repeat(145)+'.zzz',B_TOKEN='BBB.'+'b'.repeat(145)+'.zzz';
function makeFetch({leak=false,ownerBAuth=true,secondTenant=false,noStore=false}={}){
 const ledger=new Map();for(const [table,pair] of Object.entries(canaries)){ledger.set(pair.A,{id:pair.A,tenant_id:TENANT,store_id:STORE_A});ledger.set(pair.B,{id:pair.B,tenant_id:TENANT,store_id:STORE_B});}
 return async (url,options)=>{
  assert.equal(options.method,'GET');const who=options.headers.authorization.includes(A_TOKEN)?'A':'B';const p=new URL(url);
  if(p.pathname==='/auth/v1/user')return new Response(JSON.stringify({id:who==='A'?UID_A:UID_B,role:'authenticated',email_confirmed_at:who==='B'&&!ownerBAuth?null:'2026-01-01'}),{status:200});
  if(p.pathname.endsWith('/tenant_memberships'))return new Response(JSON.stringify([{tenant_id:who==='B'&&secondTenant?'22222222-2222-4222-8222-222222222222':TENANT,active:true,role:'owner'}]),{status:200});
  if(p.pathname.endsWith('/store_memberships'))return noStore?new Response(JSON.stringify({message:'not found'}),{status:404}):new Response(JSON.stringify([{tenant_id:TENANT,store_id:who==='A'?STORE_A:STORE_B,role:'owner',active:true}]),{status:200});
  const id=p.searchParams.get('id')?.replace(/^eq\./,'');const r=ledger.get(id);return new Response(JSON.stringify(r && (leak || r.store_id===(who==='A'?STORE_A:STORE_B))?[r]:[]),{status:200});
 };
}
const good={projectUrl:PROJ,publishableKey:PUB,tokenA:A_TOKEN,tokenB:B_TOKEN,canaries};
test('actual online UAT workflow with mock fetch proves 6-surface GET-only checks',async()=>{const r=await runUat({...good,fetcher:makeFetch()});assert.equal(r.status,'REAL_JWT_TWO_STORE_READ_ONLY_UAT_PASS');assert.equal(r.assertions,24);assert.equal(r.requests,30);});
test('actual UAT hard-stops on same token',async()=>await assert.rejects(runUat({...good,tokenB:A_TOKEN,fetcher:makeFetch()}),/DISTINCT_REAL_TOKENS_REQUIRED/));
test('actual UAT hard-stops on missing canary',async()=>await assert.rejects(runUat({...good,canaries:{...canaries,messages:{A:null,B:null}},fetcher:makeFetch()}),/SIX_SURFACE_CANARIES_REQUIRED/));
test('actual UAT hard-stops on absent store membership schema',async()=>await assert.rejects(runUat({...good,fetcher:makeFetch({noStore:true})}),/HOSTED_AUTH_OR_RLS_NOT_READY/));
test('actual UAT hard-stops if B has never authenticated',async()=>await assert.rejects(runUat({...good,fetcher:makeFetch({ownerBAuth:false})}),/SIGNED_IN_VERIFIED_USER_REQUIRED/));
test('actual UAT hard-stops different tenant',async()=>await assert.rejects(runUat({...good,fetcher:makeFetch({secondTenant:true})}),/ONE_SHARED_TENANT_REQUIRED/));
test('actual UAT detects cross-store row leakage',async()=>await assert.rejects(runUat({...good,fetcher:makeFetch({leak:true})}),/CROSS_STORE_RLS_EXPOSURE/));
test('actual UAT rejects public unpinned URL',async()=>await assert.rejects(runUat({...good,projectUrl:'http://untrusted.local',fetcher:makeFetch()}),/UNTRUSTED_SUPABASE_ORIGIN/));
test('actual UAT token file nonexistent fail closed',async()=>await assert.rejects(readPrivateToken('/tmp/t404-rpc13-nonexistent.jwt')));
test('Access JWT with missing email cannot create Merchant identity',async()=>{await assert.rejects(verifyAccessToken(sign({...goodPayload,email:undefined}),opts()),/INVALID_EMAIL/);});
test('Supabase provider URL may not be HTTP',async()=>{await assert.rejects(verifySupabaseUser(authToken,opts({supabaseUrl:'http://ifxlvrhyjhbzbrkdsida.supabase.co'})),/SUPABASE_ORIGIN_DENIED/);});
test('Supabase provider rejects unconfirmed email',async()=>{await assert.rejects(verifySupabaseUser(authToken,opts({fetcher:()=>Promise.resolve(new Response(JSON.stringify({id:UID_A,email:'owner@example.com',role:'authenticated',email_confirmed_at:null}),{status:200}))})),/SUPABASE_USER_UNQUALIFIED/);});
test('Merchant invite atomic replay is rejected',async()=>{const fn=createPrivateIntake({identityConfig:opts(),fetcher:identityFetch,authority:{getInvitation:async()=>({id:'invited',status:'ISSUED',expiresAt:Date.now()+50000,operatorSourceVerified:true,authUserId:UID_A,slot:'O1',accessSubject:'access-test-subject'}),reserve:async()=>false},quarantine:{put:()=>{throw Error('NO_UPLOAD_WHEN_REPLAY')}}});const f=new FormData();f.set('slot','O1');f.set('source_type','SIGNED_EXTERNAL_ORDER_SOURCE');f.set('source',new Blob([new TextEncoder().encode('%PDF-1.7\n'+'.'.repeat(100))],{type:'application/pdf'}),'proof.pdf');const r=await fn(new Request('https://private.example/v1/private/evidence',{method:'POST',headers:{'cf-access-jwt-assertion':accessToken,authorization:'Bearer '+authToken},body:f}));assert.equal(r.status,409);});
test('Merchant original file rejects HTML even when disguised as PDF',async()=>{const fn=createPrivateIntake({identityConfig:opts(),fetcher:identityFetch,authority:{getInvitation:async()=>({id:'invited',status:'ISSUED',expiresAt:Date.now()+50000,operatorSourceVerified:true,authUserId:UID_A,slot:'P2',accessSubject:'access-test-subject'}),reserve:()=>{throw Error('SHOULD_NOT_RESERVE')}},quarantine:{put:()=>{throw Error('SHOULD_NOT_STORE')}}});const f=new FormData();f.set('slot','P2');f.set('source_type','MERCHANT_ORIGINAL_CATALOG');f.set('source',new Blob([new TextEncoder().encode('<html><script>attack</script></html>')],{type:'application/pdf'}),'spoof.pdf');const r=await fn(new Request('https://private.example/v1/private/evidence',{method:'POST',headers:{'cf-access-jwt-assertion':accessToken,authorization:'Bearer '+authToken},body:f}));assert.equal(r.status,415);});
test('All green self-reported original owner packet remains NO_GO',()=>{const records=Object.entries({P1:'PRODUCT',P2:'PRODUCT',O1:'ORDER',O2:'ORDER'}).map(([slot,kind])=>({slot,kind,stage:'REVIEWED',malwareScan:'CLEAN',sourceAuthenticity:'VERIFIED',merchantUserVerified:true,merchantOwnerApproved:true,reviewerUserVerified:true,reviewerApproved:true,merchantAuthUserId:'merchant1',reviewerAuthUserId:'reviewer2',canonicalStoreVerifiedByRegistry:true}));const r=inspectEvidencePacket({records});assert.equal(r.status,'FOUR_ROW_OWNER_HOSTED_NO_GO');assert.equal(r.canBackfill,false);assert.ok(r.reasons.includes('ORIGINAL_SOURCE_EVIDENCE_NOT_INDEPENDENTLY_VERIFIED_HERE'));});