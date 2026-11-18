import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createHash,generateKeyPairSync,randomBytes,randomUUID,sign as edSign
} from 'node:crypto';
import {CONTRACT,createPrivateIssuer,createPrivateVerifier,AuthorityDenied} from './signed-authority.mjs';

const T='qa-tenant-1',A='qa-store-a',B='qa-store-b',C='qa-store-c';
const memberKey=(sub,tenant,store)=>[sub,tenant,store].join('/');
const keyPair=()=>generateKeyPairSync('ed25519');
function fixture() {
  let now=1_800_000_000;
  const keys=keyPair(),otherKeys=keyPair(), bindingKey=randomBytes(32);
  const sessions=new Map();
  const membership=new Map();
  const subject=(sub,sessionId)=>({
    source:'trusted_supabase_server_adapter', verified:true,active:true,
    sub,sessionId,iss:CONTRACT.supabaseIssuer,aud:CONTRACT.supabaseAudience,
    exp:now+3600,
  });
  sessions.set('session-A',subject('owner-a','synthetic-session-only-A'));
  sessions.set('session-B',subject('owner-b','synthetic-session-only-B'));
  sessions.set('session-T',subject('tenant-owner','synthetic-session-only-T'));
  sessions.set('session-X',subject('other-tenant','synthetic-session-only-X'));
  const asMember=(userId,tenantId,storeId,revision='revision-1')=>({
    userId,tenantId,storeId,status:'active',storeStatus:'active',
    tenantMembershipActive:true,revokedAt:null,expiresAt:null,revision,
    capabilities:['CATALOG_READ','ORDER_READ'],
  });
  membership.set(memberKey('owner-a',T,A),asMember('owner-a',T,A));
  membership.set(memberKey('owner-b',T,B),asMember('owner-b',T,B));
  membership.set(memberKey('other-tenant','qa-tenant-2',C),
    asMember('other-tenant','qa-tenant-2',C));
  const used=new Set();
  const adapter={
    bindingKey,clock:()=>now*1000,
    verifySession:async handle=>sessions.get(handle),
    resolveMembership:async({userId,tenantId,storeId})=>membership.get(memberKey(userId,tenantId,storeId)),
    consumeNonce:async({jti})=>{if(used.has(jti))return false;used.add(jti);return true;},
  };
  const issue=createPrivateIssuer({...adapter,privateKey:keys.privateKey,kid:'qa-key-1'});
  const verifier=createPrivateVerifier({...adapter,trustedKeys:new Map([['qa-key-1',keys.publicKey]])});
  const make=async(handle='session-A',tenant=T,store=A,cap='CATALOG_READ')=>
    issue.issue({sessionHandle:handle,tenantId:tenant,storeId:store,capability:cap});
  const redeem=(token,handle='session-A',tenant=T,store=A,cap='CATALOG_READ')=>
    verifier.redeem({token,sessionHandle:handle,tenantId:tenant,storeId:store,capability:cap});
  const parse=token=>{
    const [h,p,s]=token.split('.');
    return {header:JSON.parse(Buffer.from(h,'base64url')),claims:JSON.parse(Buffer.from(p,'base64url')),signature:s};
  };
  const forge=(token,{header={},claims={}}={})=>{
    const parsed=parse(token);
    const h=Buffer.from(JSON.stringify({...parsed.header,...header})).toString('base64url');
    const p=Buffer.from(JSON.stringify({...parsed.claims,...claims})).toString('base64url');
    const signed=h+'.'+p;
    return signed+'.'+edSign(null,Buffer.from(signed),keys.privateKey).toString('base64url');
  };
  return {
    keys,otherKeys,bindingKey,sessions,membership,used,adapter,issue,verifier,
    make,redeem,parse,forge,T,A,B,C,
    advance(seconds){now+=seconds;},
    clock(){return now;},
  };
}
async function denied(callback,expected) {
  await assert.rejects(callback,err=>err instanceof AuthorityDenied && err.code===expected,
    'expected '+expected);
}

test('S01 Ed25519 signature and exact Store A scope redeem successfully',async()=>{
  const f=fixture(),token=await f.make();
  const result=await f.redeem(token);
  assert.equal(result.allowed,true);
  assert.equal(result.storeId,A);
  assert.equal(result.capability,'CATALOG_READ');
  assert.equal(result.proof,'synthetic_signed_authority');
});
test('S02 signed Store B under same Tenant is independently admitted',async()=>{
  const f=fixture(),token=await f.make('session-B',T,B);
  assert.equal((await f.redeem(token,'session-B',T,B)).storeId,B);
});
test('S03 signature bytes verify with pinned public Ed25519 key',async()=>{
  const f=fixture(),token=await f.make();
  const [h,p,s]=token.split('.');
  const {verify}=await import('node:crypto');
  assert.equal(verify(null,Buffer.from(h+'.'+p),f.keys.publicKey,Buffer.from(s,'base64url')),true);
});
test('S04 private key and raw session ID do not appear in signed payload',async()=>{
  const f=fixture(),token=await f.make(),claims=f.parse(token).claims;
  assert.equal(claims.sessionId,undefined);
  assert.equal(claims.session_id,undefined);
  assert.equal(token.includes('synthetic-session-only-A'),false);
  assert.equal(claims.actor_type,'human');
});
test('S05 immediate replay is rejected by atomic nonce store',async()=>{
  const f=fixture(),token=await f.make();await f.redeem(token);
  await denied(()=>f.redeem(token),'REPLAY');
});
test('S06 concurrent double redeem allows only one synthetic consumer',async()=>{
  const f=fixture(),token=await f.make();
  const out=await Promise.allSettled([f.redeem(token),f.redeem(token)]);
  assert.equal(out.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(out.filter(x=>x.status==='rejected'&&x.reason.code==='REPLAY').length,1);
});
test('S07 Owner A cannot issue authority for same-tenant Store B',async()=>{
  const f=fixture();await denied(()=>f.make('session-A',T,B),'MEMBERSHIP_NOT_ACTIVE_OR_SCOPED');
});
test('S08 Tenant Owner without Store membership cannot mint Store authority',async()=>{
  const f=fixture();await denied(()=>f.make('session-T',T,A),'MEMBERSHIP_NOT_ACTIVE_OR_SCOPED');
});
test('S09 cross-tenant actor cannot mint in Tenant T',async()=>{
  const f=fixture();await denied(()=>f.make('session-X',T,A),'MEMBERSHIP_NOT_ACTIVE_OR_SCOPED');
});
test('S10 cross-tenant actor can mint only in own Store C',async()=>{
  const f=fixture(),token=await f.make('session-X','qa-tenant-2',C);
  assert.equal((await f.redeem(token,'session-X','qa-tenant-2',C)).storeId,C);
});
test('S11 missing user session is not admitted',async()=>{
  const f=fixture();await denied(()=>f.make('missing'),'SESSION_NOT_VERIFIED');
});
test('S12 expired underlying session prevents issuance',async()=>{
  const f=fixture();f.sessions.get('session-A').exp=f.clock()-1;
  await denied(()=>f.make(),'SESSION_NOT_VERIFIED');
});
test('S13 unverified session boolean prevents issuance',async()=>{
  const f=fixture();f.sessions.get('session-A').verified=false;
  await denied(()=>f.make(),'SESSION_NOT_VERIFIED');
});
test('S14 session adapter source mismatch prevents issuance',async()=>{
  const f=fixture();f.sessions.get('session-A').source='browser_metadata';
  await denied(()=>f.make(),'SESSION_NOT_VERIFIED');
});
test('S15 wrong Supabase JWT issuer prevents issuance',async()=>{
  const f=fixture();f.sessions.get('session-A').iss='fake-auth';
  await denied(()=>f.make(),'SESSION_NOT_VERIFIED');
});
test('S16 wrong Supabase JWT audience prevents issuance',async()=>{
  const f=fixture();f.sessions.get('session-A').aud='anon';
  await denied(()=>f.make(),'SESSION_NOT_VERIFIED');
});
test('S17 revoked membership prevents issuance',async()=>{
  const f=fixture();f.membership.get(memberKey('owner-a',T,A)).status='revoked';
  await denied(()=>f.make(),'MEMBERSHIP_NOT_ACTIVE_OR_SCOPED');
});
test('S18 expired membership prevents issuance',async()=>{
  const f=fixture();f.membership.get(memberKey('owner-a',T,A)).expiresAt=f.clock()-1;
  await denied(()=>f.make(),'MEMBERSHIP_NOT_ACTIVE_OR_SCOPED');
});
test('S19 suspended Store prevents issuance',async()=>{
  const f=fixture();f.membership.get(memberKey('owner-a',T,A)).storeStatus='suspended';
  await denied(()=>f.make(),'MEMBERSHIP_NOT_ACTIVE_OR_SCOPED');
});
test('S20 inactive Tenant membership prevents issuance',async()=>{
  const f=fixture();f.membership.get(memberKey('owner-a',T,A)).tenantMembershipActive=false;
  await denied(()=>f.make(),'MEMBERSHIP_NOT_ACTIVE_OR_SCOPED');
});
test('S21 missing Store capability prevents issuance',async()=>{
  const f=fixture();f.membership.get(memberKey('owner-a',T,A)).capabilities=['CATALOG_READ'];
  await denied(()=>f.make('session-A',T,A,'ORDER_READ'),'MEMBERSHIP_NOT_ACTIVE_OR_SCOPED');
});
test('S22 write capability cannot be issued in this read-only preflight',async()=>{
  const f=fixture();await denied(()=>f.make('session-A',T,A,'ORDER_WRITE'),'REQUEST_SCOPE');
});
test('S23 receiver rejects wrong requested Store B',async()=>{
  const f=fixture(),token=await f.make();
  await denied(()=>f.redeem(token,'session-A',T,B),'REQUEST_MISMATCH');
});
test('S24 receiver rejects wrong requested capability',async()=>{
  const f=fixture(),token=await f.make();
  await denied(()=>f.redeem(token,'session-A',T,A,'ORDER_READ'),'REQUEST_MISMATCH');
});
test('S25 signed bearer cannot be redeemed using another human session',async()=>{
  const f=fixture(),token=await f.make();
  await denied(()=>f.redeem(token,'session-B',T,A),'MEMBERSHIP_NOT_ACTIVE_OR_SCOPED');
});
test('S26 same subject new session fails session binding',async()=>{
  const f=fixture(),token=await f.make();
  f.sessions.get('session-A').sessionId='new-relogged-session';
  await denied(()=>f.redeem(token),'SUBJECT_SESSION_OR_REVISION_CHANGED');
});
test('S27 membership revoked after signing fails redemption',async()=>{
  const f=fixture(),token=await f.make();
  f.membership.get(memberKey('owner-a',T,A)).status='revoked';
  await denied(()=>f.redeem(token),'MEMBERSHIP_NOT_ACTIVE_OR_SCOPED');
});
test('S28 membership revision changed after signing fails redemption',async()=>{
  const f=fixture(),token=await f.make();
  f.membership.get(memberKey('owner-a',T,A)).revision='revision-2';
  await denied(()=>f.redeem(token),'SUBJECT_SESSION_OR_REVISION_CHANGED');
});
test('S29 Store suspended after signing fails redemption',async()=>{
  const f=fixture(),token=await f.make();
  f.membership.get(memberKey('owner-a',T,A)).storeStatus='suspended';
  await denied(()=>f.redeem(token),'MEMBERSHIP_NOT_ACTIVE_OR_SCOPED');
});
test('S30 token expired after max 120 sec is rejected even if session active',async()=>{
  const f=fixture(),token=await f.make();f.advance(121);
  await denied(()=>f.redeem(token),'CLAIMS_INVALID_OR_EXPIRED');
});
test('S31 session revoked after issuance fails redemption',async()=>{
  const f=fixture(),token=await f.make();
  f.sessions.get('session-A').active=false;
  await denied(()=>f.redeem(token),'SESSION_NOT_VERIFIED');
});
test('S32 text appended to signature invalidates token',async()=>{
  const f=fixture(),token=await f.make();
  await denied(()=>f.redeem(token.slice(0,-2)+'AA'),'BAD_SIGNATURE');
});
test('S33 modified Store claim with old signature is rejected',async()=>{
  const f=fixture(),token=await f.make(),parts=token.split('.');
  const claims={...f.parse(token).claims,store_id:B};
  const forged=parts[0]+'.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.'+parts[2];
  await denied(()=>f.redeem(forged),'BAD_SIGNATURE');
});
test('S34 alg none rejected even with valid test signature',async()=>{
  const f=fixture(),token=await f.make();
  await denied(()=>f.redeem(f.forge(token,{header:{alg:'none'}})),'HEADER_REJECTED');
});
test('S35 alg HS256 rejected even with valid Ed25519 test signature',async()=>{
  const f=fixture(),token=await f.make();
  await denied(()=>f.redeem(f.forge(token,{header:{alg:'HS256'}})),'HEADER_REJECTED');
});
test('S36 attacker-controlled jku header is rejected',async()=>{
  const f=fixture(),token=await f.make();
  await denied(()=>f.redeem(f.forge(token,{header:{jku:'https://attacker.example.invalid/jwks'}})),'HEADER_REJECTED');
});
test('S37 wrong typ rejected as cross-JWT confusion',async()=>{
  const f=fixture(),token=await f.make();
  await denied(()=>f.redeem(f.forge(token,{header:{typ:'JWT'}})),'HEADER_REJECTED');
});
test('S38 untrusted kid rejected without remote fetching',async()=>{
  const f=fixture(),token=await f.make();
  await denied(()=>f.redeem(f.forge(token,{header:{kid:'unknown-key'}})),'UNTRUSTED_KID');
});
test('S39 wrong issuer rejected even when signed by test key',async()=>{
  const f=fixture(),token=await f.make();
  await denied(()=>f.redeem(f.forge(token,{claims:{iss:'other-issuer'}})),'CLAIMS_INVALID_OR_EXPIRED');
});
test('S40 wrong audience rejected even when signed by test key',async()=>{
  const f=fixture(),token=await f.make();
  await denied(()=>f.redeem(f.forge(token,{claims:{aud:'another-service'}})),'CLAIMS_INVALID_OR_EXPIRED');
});
test('S41 future nbf rejected',async()=>{
  const f=fixture(),token=await f.make();
  await denied(()=>f.redeem(f.forge(token,{claims:{nbf:f.clock()+5}})),'CLAIMS_INVALID_OR_EXPIRED');
});
test('S42 excessive TTL (>120 sec) rejected',async()=>{
  const f=fixture(),token=await f.make();
  await denied(()=>f.redeem(f.forge(token,{claims:{exp:f.clock()+400}})),'CLAIMS_INVALID_OR_EXPIRED');
});
test('S43 future iat rejected',async()=>{
  const f=fixture(),token=await f.make();
  await denied(()=>f.redeem(f.forge(token,{claims:{iat:f.clock()+9,nbf:f.clock()+9}})),'CLAIMS_INVALID_OR_EXPIRED');
});
test('S44 attacker-injected user_metadata claim rejected',async()=>{
  const f=fixture(),token=await f.make();
  await denied(()=>f.redeem(f.forge(token,{claims:{user_metadata:{is_admin:true}}})),'CLAIMS_REJECTED');
});
test('S45 malformed JWT segment count rejected',async()=>{
  const f=fixture(),token=await f.make();
  await denied(()=>f.redeem(token+'.extra'),'TOKEN_FORMAT');
});
test('S46 private nonce store failure is fail-closed',async()=>{
  const f=fixture(),token=await f.make();
  const v=createPrivateVerifier({...f.adapter,trustedKeys:new Map([['qa-key-1',f.keys.publicKey]]),
    consumeNonce:async()=>{throw new Error('offline')}}); 
  await denied(()=>v.redeem({token,sessionHandle:'session-A',tenantId:T,storeId:A,capability:'CATALOG_READ'}),'NONCE_STORE_UNAVAILABLE');
});
test('S47 missing server-side membership source is fail-closed',async()=>{
  const f=fixture(),token=await f.make();
  const v=createPrivateVerifier({...f.adapter,trustedKeys:new Map([['qa-key-1',f.keys.publicKey]]),
    resolveMembership:async()=>{throw new Error('DB down')}});
  await denied(()=>v.redeem({token,sessionHandle:'session-A',tenantId:T,storeId:A,capability:'CATALOG_READ'}),'SERVER_ATTESTATION_UNAVAILABLE');
});
test('S48 missing server-side session verifier is fail-closed',async()=>{
  const f=fixture(),token=await f.make();
  const v=createPrivateVerifier({...f.adapter,trustedKeys:new Map([['qa-key-1',f.keys.publicKey]]),
    verifySession:async()=>{throw new Error('Auth down')}});
  await denied(()=>v.redeem({token,sessionHandle:'session-A',tenantId:T,storeId:A,capability:'CATALOG_READ'}),'SERVER_ATTESTATION_UNAVAILABLE');
});
test('S49 wrong pinned public key rejects signature',async()=>{
  const f=fixture(),token=await f.make();
  const v=createPrivateVerifier({...f.adapter,trustedKeys:new Map([['qa-key-1',f.otherKeys.publicKey]])});
  await denied(()=>v.redeem({token,sessionHandle:'session-A',tenantId:T,storeId:A,capability:'CATALOG_READ'}),'BAD_SIGNATURE');
});
test('S50 key revocation by removing kid rejects previously signed receipt',async()=>{
  const f=fixture(),token=await f.make();
  const v=createPrivateVerifier({...f.adapter,trustedKeys:new Map()});
  await denied(()=>v.redeem({token,sessionHandle:'session-A',tenantId:T,storeId:A,capability:'CATALOG_READ'}),'UNTRUSTED_KID');
});
test('S51 current key may be rotated via pinned registry with two keys',async()=>{
  const f=fixture(),token=await f.make();
  const v=createPrivateVerifier({...f.adapter,
    trustedKeys:new Map([['qa-key-1',f.keys.publicKey],['qa-key-2',f.otherKeys.publicKey]])});
  assert.equal((await v.redeem({token,sessionHandle:'session-A',tenantId:T,storeId:A,capability:'CATALOG_READ'})).allowed,true);
});
test('S52 production-style issuer config refuses weak HMAC binding secret',()=>{
  const f=fixture();
  assert.throws(()=>createPrivateIssuer({...f.adapter,bindingKey:Buffer.from('short'),
    privateKey:f.keys.privateKey,kid:'qa-key-1'}),e=>e.code==='CONFIGURATION');
});
test('S53 verifier refuses signing private key in trusted key registry',()=>{
  const f=fixture();
  assert.throws(()=>createPrivateVerifier({...f.adapter,
    trustedKeys:new Map([['qa-key-1',f.keys.privateKey]]),consumeNonce:f.adapter.consumeNonce}),
    e=>e.code==='TRUSTED_KEY');
});
test('S54 request does not accept arbitrary operation write',async()=>{
  const f=fixture(),token=await f.make();
  await denied(()=>f.redeem(token,'session-A',T,A,'ORDER_WRITE'),'REQUEST_MISMATCH');
});
test('S55 signer rejects missing requested Store',async()=>{
  const f=fixture();await denied(()=>f.make('session-A',T,''),'REQUEST_SCOPE');
});
test('S56 signer rejects browser-defined fake session verifier output',async()=>{
  const f=fixture();f.sessions.get('session-A').source='user_supplied_claims';
  await denied(()=>f.make(),'SESSION_NOT_VERIFIED');
});
test('S57 token cannot be validated with unknown typ or crit fields',async()=>{
  const f=fixture(),token=await f.make();
  await denied(()=>f.redeem(f.forge(token,{header:{crit:['b64']}})),'HEADER_REJECTED');
});
test('S58 noncanonical header JSON with duplicate keys rejected',async()=>{
  const f=fixture(),token=await f.make(),parts=token.split('.');
  const dup='{"alg":"EdDSA","typ":"'+CONTRACT.typ+'","kid":"qa-key-1","kid":"qa-key-1"}';
  const h=Buffer.from(dup).toString('base64url');
  const input=h+'.'+parts[1];
  const invalid=input+'.'+edSign(null,Buffer.from(input),f.keys.privateKey).toString('base64url');
  await denied(()=>f.redeem(invalid),'TOKEN_NONCANONICAL');
});
test('S59 wrong signed subject rejected even with valid signature',async()=>{
  const f=fixture(),token=await f.make();
  await denied(()=>f.redeem(f.forge(token,{claims:{sub:'owner-b'}})),'SUBJECT_SESSION_OR_REVISION_CHANGED');
});
test('S60 cannot accept token minted in another key with same kid',async()=>{
  const f=fixture(),token=await f.make();
  const v=createPrivateVerifier({...f.adapter,trustedKeys:new Map([['qa-key-1',f.otherKeys.publicKey]])});
  await denied(()=>v.redeem({token,sessionHandle:'session-A',tenantId:T,storeId:A,capability:'CATALOG_READ'}),'BAD_SIGNATURE');
});
