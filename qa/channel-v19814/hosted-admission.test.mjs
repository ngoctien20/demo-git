import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {evaluateHostedAdmission,requiredEvidence,READ_SCOPE} from './hosted-admission.mjs';
const valid=()=>({...Object.fromEntries(requiredEvidence.map(k=>[k,true])),scope:READ_SCOPE,evidenceOrigin:'trusted_server_verified',installationRef:'QA_INSTALL_A',boundStoreRef:'QA_STORE_A',requestedStoreRef:'QA_STORE_A',registryVersion:3,consentVersion:3});
test('complete trusted evidence limits rights to catalog read',()=>assert.deepEqual(evaluateHostedAdmission(valid()),{decision:'READ_ONLY_QA_ADMITTED',missing:[],canReadCatalog:true,canSend:false,canWriteOrders:false}));
for(const key of requiredEvidence) test('fail closed '+key,()=>{const v=valid();v[key]=false;const r=evaluateHostedAdmission(v);assert.equal(r.decision,'NO_GO');assert.equal(r.canReadCatalog,false);assert.equal(r.canSend,false);assert.equal(r.canWriteOrders,false)});
for(const [name,change] of [['cross-store',{requestedStoreRef:'QA_STORE_B'}],['version drift',{consentVersion:2}],['untrusted provenance',{evidenceOrigin:'client'}],['bad scope',{scope:'orders_write'}],['bad installation',{installationRef:'PROD'}],['bad store',{boundStoreRef:'REAL',requestedStoreRef:'REAL'}],['non-boolean proof',{providerGetMeMatched:'true'}]])test('fail closed '+name,()=>{const r=evaluateHostedAdmission({...valid(),...change});assert.equal(r.decision,'NO_GO');assert.equal(r.canReadCatalog,false)});
test('missing aggregate',()=>assert.equal(evaluateHostedAdmission(null).decision,'NO_GO'));
