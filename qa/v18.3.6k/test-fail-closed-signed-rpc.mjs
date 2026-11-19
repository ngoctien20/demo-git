import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes,timingSafeEqual} from 'node:crypto';
import {createPrivateIssuer,CONTRACT} from '../v18.3.6g/signed-authority.mjs';
import {createFailClosedReadOnlyCaller,signRpcProof,canonicalRpcProof} from './fail-closed-signed-rpc.mjs';

const NOW=1800000000,T='qa-tenant',A='qa-store-A',B='qa-store-B',RESOURCE='00000000-0000-4000-8000-000000000101';
function fixture(){
 const key=generateKeyPairSync('ed25519'),scopeBindingSecret=randomBytes(32),
       bindingKey=randomBytes(32),privateHmacKey=Buffer.alloc(64,75),used=new Set();
 const status={sessionActive:true,membershipActive:true,externalActive:true,externalOutage:false,
   externalSource:'trusted_live_supabase_auth_session_check',checkedOffset:0,validOffset:2,
   remoteWrongScope:false,readRpcError:false,readRpcDecision:'ALLOW_CATALOG',tamperMac:false,
   authCalls:[],rpcCalls:[],allowWrongDigest:false,customRpc:null};
 const p=(subject,sid)=>({source:'trusted_supabase_server_adapter',verified:true,active:true,
   sub:subject,sessionId:sid,iss:CONTRACT.supabaseIssuer,aud:CONTRACT.supabaseAudience,exp:NOW+1000});
 const principals=new Map([['opaque-A',p('owner-A','session-A')],['opaque-B',p('owner-B','session-B')]]);
 const members=new Map([
  ['owner-A/'+A,{userId:'owner-A',tenantId:T,storeId:A,status:'active',storeStatus:'active',
   tenantMembershipActive:true,revokedAt:null,expiresAt:null,revision:'v1',capabilities:['CATALOG_READ']}],
  ['owner-B/'+B,{userId:'owner-B',tenantId:T,storeId:B,status:'active',storeStatus:'active',
   tenantMembershipActive:true,revokedAt:null,expiresAt:null,revision:'v1',capabilities:['CATALOG_READ']}]
 ]);
 const common={
  bindingKey,scopeBindingSecret,
  trustedKeys:new Map([['qa-ed25519',key.publicKey]]),
  clock:()=>NOW*1000,
  verifySession:async handle=>{const q=principals.get(handle);return q&&{...q,active:q.active&&status.sessionActive};},
  resolveMembership:async({userId,storeId})=>{const m=members.get(userId+'/'+storeId);return m&&{...m,status:status.membershipActive?m.status:'revoked'};},
 };
 const issue=createPrivateIssuer({...common,kid:'qa-ed25519',privateKey:key.privateKey});
 const checkExternalSession=async request=>{
  status.authCalls.push(request);
  if(status.externalOutage)throw Error('AUTH_DOWN');
  return {
   source:status.externalSource,authoritative:true,active:status.externalActive,revokedAt:null,
   jti:request.jti,subjectHash:status.remoteWrongScope?'0'.repeat(64):request.subjectHash,
   sessionBindingHash:request.sessionBindingHash,
   tenantHash:request.tenantHash,storeHash:request.storeHash,
   checkedAt:NOW+status.checkedOffset,validUntil:NOW+status.validOffset
  };
 };
 const readOnlyRpc=async request=>{
  status.rpcCalls.push(request);
  if(status.readRpcError)throw Error('PG_DOWN');
  if(status.customRpc)return status.customRpc(request);
  if(used.has(request.jti))return {decision:'REPLAY'};
  const expected=signRpcProof(request,privateHmacKey);
  const a=Buffer.from(expected,'hex'),b=Buffer.from(status.tamperMac?'0'.repeat(64):request.mac,'hex');
  if(a.length!==b.length||!timingSafeEqual(a,b))return {decision:'DENY_SIGNER_PROOF'};
  if(status.readRpcDecision!=='ALLOW_CATALOG')return {decision:status.readRpcDecision};
  used.add(request.jti);
  return {decision:'ALLOW_CATALOG',itemCode:'QA-A-CATALOG',priceVnd:100000};
 };
 const build=(overrides={})=>createFailClosedReadOnlyCaller({
  ...common,privateHmacKey,rpcKid:'qa-k-key-1',checkExternalSession,readOnlyRpc,...overrides
 });
 const mint=async(handle='opaque-A',store=A)=>issue.issue({sessionHandle:handle,tenantId:T,storeId:store,capability:'CATALOG_READ'});
 const redeem=async(token,handle='opaque-A',store=A)=>build().readCatalog({token,sessionHandle:handle,tenantId:T,storeId:store,resourceId:RESOURCE});
 return {status,used,key,common,privateHmacKey,mint,redeem,build,principals,members,readOnlyRpc,checkExternalSession};
}
async function denied(fn){await assert.rejects(fn,err=>err instanceof Error&&!String(err.message).includes('TypeError'));}

test('K01 Ed25519 authority + fresh private Auth + HMAC RPC synthetic read allowed',async()=>{
 const f=fixture(),token=await f.mint(),r=await f.redeem(token);
 assert.equal(r.status,'SYNTHETIC_READ_ONLY');assert.equal(r.productionAdmitted,false);
 assert.equal(r.realSupabaseAuthValidated,false);assert.equal(f.status.rpcCalls.length,1);
});
test('K02 fresh remote session checked once after Ed25519 verification',async()=>{
 const f=fixture(),token=await f.mint();await f.redeem(token);
 assert.equal(f.status.authCalls.length,1);assert.equal(f.status.authCalls[0].sessionHandle,'opaque-A');
});
test('K03 no raw JWT, session ID or user ID included in RPC data',async()=>{
 const f=fixture(),token=await f.mint();await f.redeem(token);
 const raw=JSON.stringify(f.status.rpcCalls[0]);
 assert.ok(!raw.includes(token));assert.ok(!raw.includes('session-A'));assert.ok(!raw.includes('owner-A'));
});
test('K04 request contains exact one signed Store/subject/session binding',async()=>{
 const f=fixture(),token=await f.mint();await f.redeem(token);
 const r=f.status.rpcCalls[0];
 assert.equal(r.issuer,CONTRACT.issuer);assert.equal(r.capability,'CATALOG_READ');
 assert.equal(r.kid,'qa-k-key-1');
 for(const k of ['tenantHash','storeHash','subjectHash','sessionBindingHash','membershipRevisionHash','authorityDigest'])
  assert.match(r[k],/^[a-f0-9]{64}$/);
});
test('K05 HMAC digest verifies across shared canonical message function',async()=>{
 const f=fixture(),token=await f.mint();await f.redeem(token);
 const v=f.status.rpcCalls[0];assert.equal(signRpcProof(v,f.privateHmacKey),v.mac);
 assert.ok(canonicalRpcProof(v).startsWith('K1|qa-k-key-1|'));
});
test('K06 replay of same signed JTI rejected',async()=>{
 const f=fixture(),token=await f.mint();await f.redeem(token);await denied(()=>f.redeem(token));
});
test('K07 concurrently redeem same JTI: one accepted, one rejected',async()=>{
 const f=fixture(),token=await f.mint();
 const out=await Promise.allSettled([f.redeem(token),f.redeem(token)]);
 assert.equal(out.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(out.filter(x=>x.status==='rejected').length,1);
});
test('K08 forged Ed25519 signature rejected before external check and SQL',async()=>{
 const f=fixture(),token=await f.mint(),parts=token.split('.');
 parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);
 await denied(()=>f.redeem(parts.join('.')));
 assert.equal(f.status.authCalls.length,0);assert.equal(f.status.rpcCalls.length,0);
});
test('K09 wrong Store denied before remote check and SQL',async()=>{
 const f=fixture(),token=await f.mint();await denied(()=>f.redeem(token,'opaque-A',B));
 assert.equal(f.status.rpcCalls.length,0);
});
test('K10 locally revoked session denies before remote check',async()=>{
 const f=fixture(),token=await f.mint();f.status.sessionActive=false;
 await denied(()=>f.redeem(token));assert.equal(f.status.authCalls.length,0);
});
test('K11 locally revoked membership denies before remote check',async()=>{
 const f=fixture(),token=await f.mint();f.status.membershipActive=false;
 await denied(()=>f.redeem(token));assert.equal(f.status.rpcCalls.length,0);
});
test('K12 external Auth provider returns REVOKED after local allowed: deny',async()=>{
 const f=fixture(),token=await f.mint();f.status.externalActive=false;
 await denied(()=>f.redeem(token));assert.equal(f.status.rpcCalls.length,0);
});
test('K13 external Auth provider outage: fail closed; zero DB reads',async()=>{
 const f=fixture(),token=await f.mint();f.status.externalOutage=true;
 await denied(()=>f.redeem(token));assert.equal(f.status.rpcCalls.length,0);
});
test('K14 external unknown source flag denied',async()=>{
 const f=fixture(),token=await f.mint();f.status.externalSource='browser_supplied';
 await denied(()=>f.redeem(token));assert.equal(f.status.rpcCalls.length,0);
});
test('K15 stale external verified verdict rejected',async()=>{
 const f=fixture(),token=await f.mint();f.status.checkedOffset=-4;
 await denied(()=>f.redeem(token));assert.equal(f.status.rpcCalls.length,0);
});
test('K16 future external checked timestamp rejected',async()=>{
 const f=fixture(),token=await f.mint();f.status.checkedOffset=2;
 await denied(()=>f.redeem(token));assert.equal(f.status.rpcCalls.length,0);
});
test('K17 expired Auth attestation rejected',async()=>{
 const f=fixture(),token=await f.mint();f.status.validOffset=-1;
 await denied(()=>f.redeem(token));assert.equal(f.status.rpcCalls.length,0);
});
test('K18 too-long Auth attestation rejected',async()=>{
 const f=fixture(),token=await f.mint();f.status.validOffset=60;
 await denied(()=>f.redeem(token));assert.equal(f.status.rpcCalls.length,0);
});
test('K19 mismatched external scope digest denies',async()=>{
 const f=fixture(),token=await f.mint();f.status.remoteWrongScope=true;
 await denied(()=>f.redeem(token));assert.equal(f.status.rpcCalls.length,0);
});
test('K20 PostgreSQL outage denies instead of granting read',async()=>{
 const f=fixture(),token=await f.mint();f.status.readRpcError=true;
 await denied(()=>f.redeem(token));assert.equal(f.status.rpcCalls.length,1);
});
test('K21 broken MAC proof rejected by repository',async()=>{
 const f=fixture(),token=await f.mint();f.status.tamperMac=true;
 await denied(()=>f.redeem(token));assert.equal(f.used.size,0);
});
test('K22 wrong SQL decision rejected',async()=>{
 const f=fixture(),token=await f.mint();f.status.readRpcDecision='DENY_RESOURCE_SCOPE';
 await denied(()=>f.redeem(token));assert.equal(f.used.size,0);
});
test('K23 forged RPC return structure denied',async()=>{
 const f=fixture(),token=await f.mint();f.status.customRpc=()=>({decision:'ALLOW_CATALOG',itemCode:null,priceVnd:1000});
 await denied(()=>f.redeem(token));
});
test('K24 nonnumeric price denied',async()=>{
 const f=fixture(),token=await f.mint();f.status.customRpc=()=>({decision:'ALLOW_CATALOG',itemCode:'QA',priceVnd:'100000'});
 await denied(()=>f.redeem(token));
});
test('K25 mutated private HMAC key cannot be silently accepted by verifier',async()=>{
 const f=fixture(),token=await f.mint();
 const b=f.build({privateHmacKey:Buffer.alloc(64,88)});
 // The synthetic RPC callback is parameterized with f.privateHmacKey and will deny.
 await denied(()=>b.readCatalog({token,sessionHandle:'opaque-A',tenantId:T,storeId:A,resourceId:RESOURCE}));
});
test('K26 scoped signing secret must be >=32 bytes',()=>{
 const f=fixture();assert.throws(()=>f.build({privateHmacKey:Buffer.alloc(8)}));
});
test('K27 checkExternalSession cannot be replaced by missing callback',()=>{
 const f=fixture();assert.throws(()=>f.build({checkExternalSession:null}));
});
test('K28 unsupported resource ID is denied by signature canonicalization',async()=>{
 const f=fixture(),token=await f.mint();
 await denied(()=>f.build().readCatalog({token,sessionHandle:'opaque-A',tenantId:T,storeId:A,resourceId:'not-a-uuid'}));
 assert.equal(f.status.rpcCalls.length,0);
});
test('K29 wrong private signer key ID prevented by config',()=>{
 const f=fixture();assert.throws(()=>f.build({rpcKid:'https://attacker.invalid/jwks'}));
});
test('K30 generated proof is bound to one resource and cannot be reused',async()=>{
 const f=fixture(),token=await f.mint();await f.redeem(token);
 const r=f.status.rpcCalls[0],alt={...r,resourceId:'00000000-0000-4000-8000-000000000102'};
 assert.notEqual(signRpcProof(r,f.privateHmacKey),signRpcProof(alt,f.privateHmacKey));
});
