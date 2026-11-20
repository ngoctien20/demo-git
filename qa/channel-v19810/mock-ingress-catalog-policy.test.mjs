import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {MOCK_SOURCE,signMockProvider,verifyMockProvider,validateCatalogRow} from './mock-ingress-catalog-policy.mjs';
const secret=randomBytes(32),wrong=randomBytes(32);
const now=Date.parse('2026-11-20T11:00:00.000Z');
const event=()=>({endpointRef:'QA_ENDPOINT_A',eventRef:'EVT_A001',
 kind:'message.text.received',chatType:'PRIVATE',isEcho:false,
 issuedAtMs:now-1000,sku:'F01',quantity:1,credentialEpoch:2});
const good=()=>signMockProvider(event(),secret);
let n=0;
function expect(name,p,accepted,reason){
 const result=verifyMockProvider(p,secret,now);
 assert.equal(result.accepted,accepted,name);
 if(reason)assert.equal(result.reason,reason,name);
 assert.equal(result.canReadHosted,false,name);
 assert.equal(result.canSend,false,name);
 assert.equal(result.canWrite,false,name);
 assert.equal(result.realProviderVerified,false,name);
 assert.equal(result.realOwnerVerified,false,name);n++;
}
expect('valid signed mock',good(),true);
for(const [name,mutate,reason] of [
 ['missing source',p=>delete p.source,'UNSUPPORTED_PROVIDER_SOURCE'],
 ['fake live source',p=>p.source='ZALO_LIVE_VERIFIED','UNSUPPORTED_PROVIDER_SOURCE'],
 ['user injected store',p=>p.event.storeId='B','INVALID_OR_PRIVILEGED_EVENT'],
 ['user injected tenant',p=>p.event.tenantId='x','INVALID_OR_PRIVILEGED_EVENT'],
 ['user injected Owner',p=>p.event.isOwner=true,'INVALID_OR_PRIVILEGED_EVENT'],
 ['user injected credential',p=>p.event.token='secret','INVALID_OR_PRIVILEGED_EVENT'],
 ['user injected order write',p=>p.event.commitOrder=true,'INVALID_OR_PRIVILEGED_EVENT'],
 ['group message',p=>p.event.chatType='GROUP','INVALID_OR_PRIVILEGED_EVENT'],
 ['bot echo',p=>p.event.isEcho=true,'INVALID_OR_PRIVILEGED_EVENT'],
 ['photo message',p=>p.event.kind='message.photo.received','INVALID_OR_PRIVILEGED_EVENT'],
 ['SQL injection SKU',p=>p.event.sku="F01' OR 1=1",'INVALID_OR_PRIVILEGED_EVENT'],
 ['quantity 0',p=>p.event.quantity=0,'INVALID_OR_PRIVILEGED_EVENT'],
 ['quantity too high',p=>p.event.quantity=101,'INVALID_OR_PRIVILEGED_EVENT'],
 ['quantity float',p=>p.event.quantity=1.5,'INVALID_OR_PRIVILEGED_EVENT'],
 ['invalid endpoint',p=>p.event.endpointRef='OTHER','INVALID_OR_PRIVILEGED_EVENT'],
 ['invalid event ref',p=>p.event.eventRef='../bad','INVALID_OR_PRIVILEGED_EVENT'],
 ['missing credential epoch',p=>delete p.event.credentialEpoch,'INVALID_OR_PRIVILEGED_EVENT'],
 ['invalid credential epoch',p=>p.event.credentialEpoch=-1,'INVALID_OR_PRIVILEGED_EVENT'],
 ['missing signature',p=>delete p.signature,'UNSUPPORTED_PROVIDER_SOURCE'],
 ['invalid signature encoding',p=>p.signature='NOT_HEX','UNTRUSTED_MOCK_SIGNATURE'],
 ['tamper signed quantity',p=>p.event.quantity=2,'SIGNATURE_MISMATCH'],
 ['tamper signed endpoint',p=>p.event.endpointRef='QA_ENDPOINT_B','SIGNATURE_MISMATCH'],
 ['tamper signed epoch',p=>p.event.credentialEpoch=3,'SIGNATURE_MISMATCH'],
 ['unsupported event source field',p=>p.from='client','UNSUPPORTED_PROVIDER_SOURCE'],
 ['future too far',p=>p.event.issuedAtMs=now+7000,'EVENT_EXPIRED_OR_FUTURE'],
 ['stale event',p=>p.event.issuedAtMs=now-301000,'EVENT_EXPIRED_OR_FUTURE'],
 ]){const p=good();mutate(p);expect(name,p,false,reason);}
const w=verifyMockProvider(good(),wrong,now);
assert.equal(w.accepted,false);assert.equal(w.reason,'SIGNATURE_MISMATCH');n++;
const own={store_code:'A',sku:'F01',price_vnd:159000,stock_on_hand:5,fixture_tag:'SYNTHETIC_V1989'};
function row(name,x,store,sku,qty,accept){
 const out=validateCatalogRow(x,store,sku,qty);
 assert.equal(!!out,accept,name);
 if(out){assert.equal(out.canReadHosted,false);assert.equal(out.canSend,false);
 assert.equal(out.canWrite,false);assert.equal(out.orderCreated,false);
 assert.equal(out.currency,'VND');}n++;
}
row('valid A local catalog',own,'A','F01',1,true);
row('valid B different price',{...own,store_code:'B',price_vnd:189000,stock_on_hand:9},'B','F01',9,true);
row('A B cross scope',own,'B','F01',1,false);
row('zero price rejected',{...own,price_vnd:0},'A','F01',1,false);
row('mismatched price rejected',{...own,price_vnd:189000},'A','F01',1,false);
row('negative stock rejected',{...own,stock_on_hand:-1},'A','F01',1,false);
row('wrong SKU rejected',own,'A','F02',1,false);
row('external fixture rejected',{...own,fixture_tag:'REAL_DATA'},'A','F01',1,false);
row('quantity zero rejected',own,'A','F01',0,false);
row('missing catalog rejected',null,'A','F01',1,false);
console.log('TIEN404_V19810_OFFLINE_INGRESS_CATALOG_POLICY_PASS='+n);
console.log('V19810_REAL_ZALO_PROVIDER_VERIFIED=false');
