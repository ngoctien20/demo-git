import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {scannerVerdict,createVolatileLedger,offlineAdmission,hostedAdmission} from './atomic-admission.mjs';
const makeKeys=()=>{const {publicKey,privateKey}=generateKeyPairSync('ed25519');return {privateKey,pub:publicKey.export({format:'pem',type:'spki'})}};
const issuer=makeKeys(),scannerKey=makeKeys(),evil=makeKeys();
const ts=2000000000;
const identity={issuer:'tien404-private-broker',tenant_id:'tenant-qa',store_id:'store-A',operator_sub:'operator-A'};
const fileContent=Buffer.from('%PDF-1.7\nmock content NOT A REAL MERCHANT FILE');
const file={name:'qa.pdf',mime:'application/pdf',size:fileContent.length,head:fileContent.subarray(0,10),content:fileContent};
const baseInvite={aud:'tien404-rpc17-offline-qa',exp:ts+100,iat:ts,invitation_id:'invite-0001',issuer:identity.issuer,nonce:'nonce-00001',operator_sub:identity.operator_sub,scope:'merchant.evidence.preflight',store_id:identity.store_id,tenant_id:identity.tenant_id};
const baseScan={aud:'tien404-rpc171-offline-qa',digest:createHash('sha256').update(fileContent).digest('hex'),exp:ts+80,iat:ts,object_id:'object-qa-01',scanner_id:'scanner-qa',status:'CLEAN',store_id:identity.store_id,tenant_id:identity.tenant_id};
const packet=(payload,key,kid)=>{const encoded=Buffer.from(JSON.stringify(payload)).toString('base64url');return {kid,payload:encoded,signature:sign(null,Buffer.from(encoded,'base64url'),key).toString('base64url')}};
const opts=()=>({invitation:packet(baseInvite,issuer.privateKey,'I1'),identity,invitePins:{I1:issuer.pub},file,scanner:packet(baseScan,scannerKey.privateKey,'S1'),scanPins:{S1:scannerKey.pub},object_id:'object-qa-01',ledger:createVolatileLedger(),now:ts});
test('signed scanner clean receipt is still offline only',()=>{const r=scannerVerdict(packet(baseScan,scannerKey.privateKey,'S1'),baseScan,{S1:scannerKey.pub},ts);assert.equal(r.accepted,true);assert.equal(r.can_upload,false)});
for(const [name,mutate] of [
 ['malware detected',v=>({...v,status:'MALWARE'})],
 ['pending scan',v=>({...v,status:'PENDING'})],
 ['wrong object',v=>({...v,object_id:'object-qa-02'})],
 ['wrong store',v=>({...v,store_id:'store-B'})],
 ['wrong tenant',v=>({...v,tenant_id:'tenant-B'})],
 ['wrong hash',v=>({...v,digest:'0'.repeat(64)})],
 ['wrong scanner',v=>({...v,scanner_id:'scanner-B'})],
 ['wrong audience',v=>({...v,aud:'other-qa'})],
 ['stale receipt',v=>({...v,exp:ts})],
 ['overlong TTL',v=>({...v,exp:ts+121})],
 ['future iat',v=>({...v,iat:ts+1})],
 ['extra admin claim',v=>({...v,admin:true})]
])test('scanner denies '+name,()=>{const result=scannerVerdict(packet(mutate(baseScan),scannerKey.privateKey,'S1'),baseScan,{S1:scannerKey.pub},ts);assert.equal(result.accepted,false);assert.equal(result.can_upload,false)});
test('scanner denies forged signature',()=>assert.equal(scannerVerdict(packet(baseScan,evil.privateKey,'S1'),baseScan,{S1:scannerKey.pub},ts).accepted,false));
test('scanner denies unknown key',()=>assert.equal(scannerVerdict(packet(baseScan,scannerKey.privateKey,'UNKNOWN'),baseScan,{S1:scannerKey.pub},ts).accepted,false));
test('scanner denies empty and malformed',()=>{assert.equal(scannerVerdict(null,baseScan,{S1:scannerKey.pub},ts).accepted,false);assert.equal(scannerVerdict({kid:'S1',payload:'@@',signature:'x'},baseScan,{S1:scannerKey.pub},ts).accepted,false)});
test('mock atomic ledger 40 concurrent claims exactly one succeeds',async()=>{const ledger=createVolatileLedger();const r=await Promise.all(Array.from({length:40},()=>ledger.claimAtomic({nonce:'nonce-unique',tenant_id:'tenant-qa',store_id:'store-A',operator_sub:'operator-A',now:1000})));assert.equal(r.filter(x=>x.ok).length,1);assert.equal(r.filter(x=>x.reason==='REPLAY').length,39)});
test('mock ledger separate store identity limit',async()=>{const ledger=createVolatileLedger({limit:1});const q=(nonce,store_id)=>ledger.claimAtomic({nonce,tenant_id:'tenant-qa',store_id,operator_sub:'operator-A',now:1000});assert.equal((await q('nonce-001','store-A')).ok,true);assert.equal((await q('nonce-002','store-A')).reason,'RATE_LIMIT');assert.equal((await q('nonce-003','store-B')).ok,true)});
test('mock nonce remains rejected after window expiry',async()=>{const l=createVolatileLedger({limit:1});const a={nonce:'nonce-123',tenant_id:'tenant-qa',store_id:'store-A',operator_sub:'operator-A',now:1};assert.equal((await l.claimAtomic(a)).ok,true);assert.equal((await l.claimAtomic({...a,now:80000})).reason,'REPLAY')});
test('mock ledger declares non-durable',()=>assert.equal(createVolatileLedger().isDurable,false));
test('offline admission valid prerequisites still NO UPLOAD',async()=>{const x=await offlineAdmission(opts());assert.equal(x.accepted,true);assert.equal(x.can_upload,false);assert.equal(x.can_send,false);assert.equal(x.can_open_access,false)});
test('offline admission no ledger failclosed',async()=>{const x=opts();delete x.ledger;assert.equal((await offlineAdmission(x)).reason,'LEDGER_UNAVAILABLE')});
test('offline admission ledger throws failclosed',async()=>{const x=opts();x.ledger={claimAtomic:async()=>{throw Error('offline')}};assert.equal((await offlineAdmission(x)).accepted,false)});
test('offline admission rejects byte mismatch',async()=>{const x=opts();x.file={...file,content:Buffer.from('%PDF-evil')};assert.equal((await offlineAdmission(x)).reason,'FILE_BYTES_UNAVAILABLE')});
test('offline admission rejects tampered scanner object',async()=>{const x=opts();x.object_id='object-other';assert.equal((await offlineAdmission(x)).accepted,false)});
test('offline admission rejects wrong invite store',async()=>{const x=opts();x.identity={...identity,store_id:'store-B'};assert.equal((await offlineAdmission(x)).accepted,false)});
test('offline admission rejects malicious scanner verdict',async()=>{const x=opts();x.scanner=packet({...baseScan,status:'MALWARE'},scannerKey.privateKey,'S1');assert.equal((await offlineAdmission(x)).accepted,false)});
test('offline admission nonce replay rejects second request',async()=>{const x=opts();assert.equal((await offlineAdmission(x)).accepted,true);assert.equal((await offlineAdmission(x)).accepted,false)});
test('hosted hard NO GO',()=>{const r=hostedAdmission();assert.equal(r.accepted,false);assert.equal(r.can_upload,false);assert.equal(r.can_open_access,false);assert.equal(r.can_send,false)});
