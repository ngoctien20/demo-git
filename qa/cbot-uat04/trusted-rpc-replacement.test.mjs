import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {createSyntheticCrossChannelLab,CONTRACT as LAB_CONTRACT} from '../cbot-uat02/crosschannel-core.mjs';
import {CONTRACT,AUDIENCE,createTrustedRpcCandidate,signableBytesForSyntheticTest,
 deployTrustedRpc,revokeLegacyAnonymousRpc,sendProviderResponse,writeCommerceOrder
} from './trusted-rpc-replacement.mjs';

const NOW=1800000000000;
const digest=x=>createHash('sha256').update(x).digest('hex');
const qaEv=(channel='MESSENGER',account_id='QA_META_A',participant_id='QA_PSID_A',event_id='QA-EVT-UAT04-01')=>
 ({contract:LAB_CONTRACT,channel,account_id,participant_id,event_id});
function fixture(){
 const kp=generateKeyPairSync('ed25519');
 const lab=createSyntheticCrossChannelLab({clock:()=>NOW,otp:()=> '123456'});
 const ctx=lab.mintSyntheticIngress(qaEv());
 const order=lab.createQaOrder({context:ctx,sku:'A002',quantity:2,confirmed:true,idempotency_key:'QA-REQ-UAT04-01'});
 const bindings=[
  {issuer:'QA_GATEWAY_1',channel:'MESSENGER',account_id:'QA_META_A',tenant_id:'QA_TENANT_1',store_id:'QA_STORE_A'},
  {issuer:'QA_GATEWAY_1',channel:'MESSENGER',account_id:'QA_META_B',tenant_id:'QA_TENANT_1',store_id:'QA_STORE_B'},
  {issuer:'QA_GATEWAY_1',channel:'ZALO_OA',account_id:'QA_ZALO_A',tenant_id:'QA_TENANT_1',store_id:'QA_STORE_A'},
  {issuer:'QA_GATEWAY_1',channel:'ZALO_OA',account_id:'QA_ZALO_B',tenant_id:'QA_TENANT_1',store_id:'QA_STORE_B'},
  {issuer:'QA_GATEWAY_1',channel:'ZALO_OA',account_id:'QA_ZALO_C',tenant_id:'QA_TENANT_2',store_id:'QA_STORE_C'}
 ];
 const seen=new Set(),nonceLedger=async k=>{if(seen.has(k))return false;seen.add(k);return true;};
 const anchors=[{issuer:'QA_GATEWAY_1',publicKey:kp.publicKey}];
 const candidate=createTrustedRpcCandidate({anchors,bindings,lab,now:()=>NOW,claimNonce:nonceLedger});
 let seq=0;
 function packet(patch={}){
  const payload={contract:CONTRACT,issuer:'QA_GATEWAY_1',audience:AUDIENCE,
   channel:'MESSENGER',account_id:'QA_META_A',participant_id:'QA_PSID_A',
   event_id:'QA-EVT-UAT04-01',action:'ORDER_LOOKUP_READ',
   order_id:order.order_id,issued_at_ms:NOW-1000,expires_at_ms:NOW+30000,
   nonce:digest('QA-nonce-'+(++seq)),...patch};
  return signPacket(payload);
 }
 function signPacket(payload){return {payload,signature:sign(null,signableBytesForSyntheticTest(payload),kp.privateKey).toString('base64url')};}
 function linkedZalo(){
  const p=lab.startLink({context:ctx,order_id:order.order_id});
  const z=lab.mintSyntheticIngress(qaEv('ZALO_OA','QA_ZALO_A','QA_UID_A','QA-EVT-UAT04-02'));
  assert.equal(lab.completeLink({context:z,proof_ref:p.proof_ref,code:p.code}).status,'IDENTITY_LINKED');
 }
 return {kp,lab,ctx,order,candidate,packet,signPacket,linkedZalo,bindings,anchors,nonceLedger};
}
const rejects=async(fn,code)=>assert.rejects(fn,{code});
const hard=fn=>assert.throws(fn);

test('01 contract is explicitly candidate not a hosted RPC',()=>assert.match(CONTRACT,/CANDIDATE/));
test('02 signed gateway accepts own synthetic Messenger order read',async()=>{
 const f=fixture(),r=await f.candidate.evaluate(f.packet());
 assert.equal(r.status,'FOUND_SYNTHETIC_ONLY');
 assert.equal(r.order.total_vnd,318000);
});
test('03 no PII in authorized response',async()=>{
 const f=fixture(),r=await f.candidate.evaluate(f.packet());
 for(const k of ['phone','address','customer_id','owner_identity','participant_id'])assert.equal(k in r.order,false);
});
test('04 diagnostics cannot certify provider signature or real RPC',()=>{
 const d=fixture().candidate.diagnostics();
 assert.equal(d.native_provider_signature_verified,false);
 assert.equal(d.real_rpc_replaced,false);
});
test('05 order code alone cannot authorize an unlinked Zalo account',async()=>{
 const f=fixture(),r=await f.candidate.evaluate(f.packet({
  channel:'ZALO_OA',account_id:'QA_ZALO_A',participant_id:'QA_UID_A'
 }));
 assert.equal(r.status,'NOT_FOUND_OR_UNAUTHORIZED');assert.equal(r.order,null);
});
test('06 linked Zalo account can read the same synthetic order',async()=>{
 const f=fixture();f.linkedZalo();
 const r=await f.candidate.evaluate(f.packet({
  channel:'ZALO_OA',account_id:'QA_ZALO_A',participant_id:'QA_UID_A'
 }));
 assert.equal(r.status,'FOUND_SYNTHETIC_ONLY');assert.equal(r.order.order_id,f.order.order_id);
});
test('07 same-tenant wrong Store B Zalo denies Shop A order',async()=>{
 const f=fixture(),r=await f.candidate.evaluate(f.packet({channel:'ZALO_OA',account_id:'QA_ZALO_B',participant_id:'QA_UID_B'}));
 assert.equal(r.status,'NOT_FOUND_OR_UNAUTHORIZED');
});
test('08 cross-tenant Store C Zalo denies Shop A order',async()=>{
 const f=fixture(),r=await f.candidate.evaluate(f.packet({channel:'ZALO_OA',account_id:'QA_ZALO_C',participant_id:'QA_UID_C'}));
 assert.equal(r.status,'NOT_FOUND_OR_UNAUTHORIZED');
});
test('09 different Messenger PSID denies Shop A order',async()=>{
 const f=fixture(),r=await f.candidate.evaluate(f.packet({participant_id:'QA_PSID_OTHER'}));
 assert.equal(r.status,'NOT_FOUND_OR_UNAUTHORIZED');
});
test('10 repeated nonce fails closed on second invocation',async()=>{
 const f=fixture(),p=f.packet();await f.candidate.evaluate(p);
 await rejects(()=>f.candidate.evaluate(p),'REPLAY_OR_NONCE_LEDGER_UNAVAILABLE');
});
test('11 same signature but modified order ID fails cryptographic verification',async()=>{
 const f=fixture(),p=f.packet();p.payload.order_id='QA-CBOT02-9999';
 await rejects(()=>f.candidate.evaluate(p),'INVALID_GATEWAY_SIGNATURE');
});
test('12 valid signature from independently unknown gateway denied',async()=>{
 const f=fixture(),p=f.packet({issuer:'QA_GATEWAY_2'});
 await rejects(()=>f.candidate.evaluate(p),'INVALID_CONTRACT_OR_AUDIENCE');
});
test('13 wrong audience denied',async()=>{
 const f=fixture();await rejects(()=>f.candidate.evaluate(f.packet({audience:'other'})),'INVALID_CONTRACT_OR_AUDIENCE');
});
test('14 expired signed packet denied',async()=>{
 const f=fixture();await rejects(()=>f.candidate.evaluate(f.packet({issued_at_ms:NOW-60000,expires_at_ms:NOW-1})),'ATTESTATION_EXPIRED_OR_INVALID_TTL');
});
test('15 too long TTL denied',async()=>{
 const f=fixture();await rejects(()=>f.candidate.evaluate(f.packet({expires_at_ms:NOW+200000})),'ATTESTATION_EXPIRED_OR_INVALID_TTL');
});
test('16 future issue date denied',async()=>{
 const f=fixture();await rejects(()=>f.candidate.evaluate(f.packet({issued_at_ms:NOW+10000})),'ATTESTATION_EXPIRED_OR_INVALID_TTL');
});
test('17 missing nonce rejected',async()=>{
 const f=fixture();await rejects(()=>f.candidate.evaluate(f.packet({nonce:''})),'INVALID_CONTRACT_OR_AUDIENCE');
});
test('18 extra client store_id field rejected even if signed',async()=>{
 const f=fixture(),p=f.packet({store_id:'QA_STORE_B'});
 await rejects(()=>f.candidate.evaluate(p),'STRICT_PACKET_SHAPE_REQUIRED');
});
test('19 extra injected customer_id field rejected even if signed',async()=>{
 const f=fixture(),p=f.packet({customer_id:'QA_FAKE'});
 await rejects(()=>f.candidate.evaluate(p),'STRICT_PACKET_SHAPE_REQUIRED');
});
test('20 unknown page/account mapping denied even under valid gateway signature',async()=>{
 const f=fixture();await rejects(()=>f.candidate.evaluate(f.packet({account_id:'QA_META_UNKNOWN'})),'GATEWAY_ACCOUNT_NOT_BOUND_TO_STORE');
});
test('21 mismatched real binding vs source lab denied',async()=>{
 const f=fixture(),b=f.bindings.map(x=>({...x}));
 b[0].store_id='QA_STORE_B';
 const c=createTrustedRpcCandidate({lab:f.lab,anchors:f.anchors,bindings:b,now:()=>NOW,claimNonce:async()=>true});
 await rejects(()=>c.evaluate(f.packet()),'TRUSTED_BINDING_SCOPE_CONFLICT');
});
test('22 malformed payload shape rejected',async()=>{
 const f=fixture();await rejects(()=>f.candidate.evaluate({payload:{},signature:'abc'}),'STRICT_PACKET_SHAPE_REQUIRED');
});
test('23 malformed signature canonical encoding denied',async()=>{
 const f=fixture(),p=f.packet();p.signature+='=';
 await rejects(()=>f.candidate.evaluate(p),'INVALID_GATEWAY_SIGNATURE');
});
test('24 wrong Ed25519 signer key denied',async()=>{
 const f=fixture(),alien=generateKeyPairSync('ed25519'),p=f.packet();
 p.signature=sign(null,signableBytesForSyntheticTest(p.payload),alien.privateKey).toString('base64url');
 await rejects(()=>f.candidate.evaluate(p),'INVALID_GATEWAY_SIGNATURE');
});
test('25 missing nonce ledger fails constructor',()=>{
 const f=fixture();hard(()=>createTrustedRpcCandidate({anchors:f.anchors,bindings:f.bindings,lab:f.lab,now:()=>NOW}));
});
test('26 unavailable external nonce ledger fails closed',async()=>{
 const f=fixture(),c=createTrustedRpcCandidate({anchors:f.anchors,bindings:f.bindings,lab:f.lab,now:()=>NOW,claimNonce:async()=>false});
 await rejects(()=>c.evaluate(f.packet()),'REPLAY_OR_NONCE_LEDGER_UNAVAILABLE');
});
test('27 duplicate account binding rejected at startup',()=>{
 const f=fixture();hard(()=>createTrustedRpcCandidate({anchors:f.anchors,bindings:[...f.bindings,f.bindings[0]],lab:f.lab,claimNonce:async()=>true}));
});
test('28 duplicate public signing key rejected even across two issuer names',()=>{
 const f=fixture();hard(()=>createTrustedRpcCandidate({anchors:[...f.anchors,{issuer:'QA_GATEWAY_2',publicKey:f.kp.publicKey}],bindings:f.bindings,lab:f.lab,claimNonce:async()=>true}));
});
test('29 fake security definer owner pairing claim never performs RPC',async()=>{
 const f=fixture(),r=await f.candidate.evaluate(f.packet({action:'OWNER_PAIRING_CLAIM',order_id:null}));
 assert.equal(r.status,'BLOCKED_PRIVATE_OWNER_PROOF');
 assert.equal(r.side_effects.hosted_writes,0);
});
test('30 legacy owner pairing claim cannot carry order data',async()=>{
 const f=fixture();await rejects(()=>f.candidate.evaluate(f.packet({action:'OWNER_PAIRING_CLAIM'})),'INVALID_ACTION_PAYLOAD');
});
test('31 unknown action is rejected rather than delegated to LLM',async()=>{
 const f=fixture();await rejects(()=>f.candidate.evaluate(f.packet({action:'UPDATE_ORDER'})),'INVALID_CONTRACT_OR_AUDIENCE');
});
test('32 invalid order id shape denied without DB access',async()=>{
 const f=fixture();await rejects(()=>f.candidate.evaluate(f.packet({order_id:'LIVE-123'})),'INVALID_ACTION_PAYLOAD');
});
test('33 no phone/address data in runtime diagnostics',()=>{
 const d=fixture().candidate.diagnostics();
 assert.equal(JSON.stringify(d).includes('QA_PSID'),false);
});
test('34 no provider send nor hosted write after successful read',async()=>{
 const f=fixture(),r=await f.candidate.evaluate(f.packet());
 assert.deepEqual(r.side_effects,{provider_sends:0,hosted_writes:0,paid_model_calls:0});
});
test('35 deploy RPC is hard blocked',()=>hard(deployTrustedRpc));
test('36 revoke legacy anon RPC is hard blocked',()=>hard(revokeLegacyAnonymousRpc));
test('37 real provider send is hard blocked',()=>hard(sendProviderResponse));
test('38 real Commerce order write is hard blocked',()=>hard(writeCommerceOrder));
