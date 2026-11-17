import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewHostedAdmission,requiredHostedEvidence} from './independent-hosted-gate.mjs';
const assertNoRelease=x=>{for(const key of ['can_upload','can_open_access','can_send','can_release'])assert.equal(x[key],false)};
test('missing all hosted evidence is blocked',()=>{const x=reviewHostedAdmission();assert.equal(x.status,'BLOCKED');assert.equal(x.missing.length,requiredHostedEvidence.length+1);assertNoRelease(x)});
for(const field of requiredHostedEvidence)test('missing '+field+' blocks hosted admission',()=>{const all=Object.fromEntries(requiredHostedEvidence.map(x=>[x,true]));delete all[field];const result=reviewHostedAdmission({...all,mode:'INDEPENDENT_HOSTED_NO_SEND'});assert.ok(result.missing.includes(field));assert.equal(result.status,'BLOCKED');assertNoRelease(result)});
test('even full synthetic checklist cannot grant hosted upload',()=>{const all=Object.fromEntries(requiredHostedEvidence.map(x=>[x,true]));const x=reviewHostedAdmission({...all,mode:'INDEPENDENT_HOSTED_NO_SEND'});assert.equal(x.prerequisites_complete,true);assert.equal(x.status,'REVIEW_READY_NOT_AUTHORIZED');assertNoRelease(x)});
test('wrong mode blocks even full synthetic checklist',()=>{const all=Object.fromEntries(requiredHostedEvidence.map(x=>[x,true]));const x=reviewHostedAdmission({...all,mode:'PUBLIC'});assert.ok(x.missing.includes('independent_mode'));assertNoRelease(x)});
test('string true cannot spoof verified proof',()=>{const x=reviewHostedAdmission({...Object.fromEntries(requiredHostedEvidence.map(x=>[x,'true'])),mode:'INDEPENDENT_HOSTED_NO_SEND'});assert.equal(x.status,'BLOCKED');assertNoRelease(x)});
