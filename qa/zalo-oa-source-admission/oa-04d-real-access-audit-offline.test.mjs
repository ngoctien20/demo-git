import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectActualCloudflareWorkerAccess} from './oa-04d-real-access-audit-offline.mjs';

function fixture(){
 const workerId='c81a2d22c29840ed9d61681a3270dbff';
 const expected={workerId,accessName:'TIEN404 QA OA PRIVATE OPERATOR',
  aud:'737646a56ab1df6ec9bddc7e5ca84eaf3b0768850f3ffb5d74f1534911fe3893',
  exactOperatorEmails:['operator@qa.invalid']};
 const app={id:'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',name:expected.accessName,
  aud:expected.aud,type:'self_hosted',session_duration:'1h',
  destinations:[{type:'worker',worker_id:workerId}],
  policies:[{name:'owner-only',decision:'allow',
    include:[{email:{email:'operator@qa.invalid'}}]}]};
 return {app,expected};
}
function check(expectedReason,mutator){
 const f=fixture();mutator(f);const r=inspectActualCloudflareWorkerAccess(f.app,f.expected);
 assert.equal(r.configurationCandidate,false,JSON.stringify(r));
 assert.equal(r.reason,expectedReason);
 assert.equal(r.canDeploy,false);assert.equal(r.canSend,false);
 assert.equal(r.accessAdmissionProved,false);
}
test('real Cloudflare-shaped candidate is NOT edge admission proof',()=>{
 const f=fixture();const r=inspectActualCloudflareWorkerAccess(f.app,f.expected);
 assert.equal(r.configurationCandidate,true);
 assert.equal(r.accessAdmissionProved,false);
 assert.equal(r.canDeploy,false);assert.equal(r.canSend,false);
});
test('exactly pinned Worker ID required',()=>check('WORKER_DESTINATION_NOT_PRIVATE_EXACT_MATCH',f=>{f.app.destinations[0].worker_id='other-worker'}));
test('Pages destination not accepted for OA',()=>check('WORKER_DESTINATION_NOT_PRIVATE_EXACT_MATCH',f=>{f.app.destinations=[{type:'public',uri:'*.tien404-ai-git-staging.pages.dev'}]}));
test('global Worker policy not accepted',()=>check('WORKER_DESTINATION_NOT_PRIVATE_EXACT_MATCH',f=>{f.app.destinations=[{type:'all_workers'}]}));
test('preview-only does not cover production endpoint',()=>check('WORKER_DESTINATION_NOT_PRIVATE_EXACT_MATCH',f=>{f.app.destinations[0].type='preview_worker'}));
test('public path override rejected',()=>check('WORKER_DESTINATION_NOT_PRIVATE_EXACT_MATCH',f=>{f.app.destinations[0].overrides=[{behavior:'public',path_pattern:'/*'}]}));
test('multiple destinations rejected',()=>check('WORKER_DESTINATION_NOT_PRIVATE_EXACT_MATCH',f=>{f.app.destinations.push({type:'public',uri:'test.example.com'})}));
test('wrong Access aud rejected',()=>check('DEDICATED_WORKER_APPLICATION_NOT_MATCHED',f=>{f.app.aud='other-audience'}));
test('wrong Access app name rejected',()=>check('DEDICATED_WORKER_APPLICATION_NOT_MATCHED',f=>{f.app.name='Other App'}));
test('wildcard hostname rejected',()=>check('BROAD_OR_UNRELATED_HOSTNAME',f=>{f.app.domain='*.workers.dev'}));
test('Pages hostname rejected',()=>check('BROAD_OR_UNRELATED_HOSTNAME',f=>{f.app.domain='*.pages.dev'}));
test('long Access session rejected',()=>check('ACCESS_SESSION_POLICY_TOO_BROAD_OR_UNSET',f=>{f.app.session_duration='24h'}));
test('missing Access session duration rejected',()=>check('ACCESS_SESSION_POLICY_TOO_BROAD_OR_UNSET',f=>{delete f.app.session_duration}));
test('anonymous bypass policy rejected',()=>check('NON_ALLOW_OR_MALFORMED_POLICY',f=>{f.app.policies[0].decision='bypass'}));
test('Everyone selector rejected',()=>check('BROAD_OR_NON_IDENTITY_SELECTOR_FORBIDDEN',f=>{f.app.policies[0].include=[{everyone:{}}]}));
test('email domain selector rejected',()=>check('BROAD_OR_NON_IDENTITY_SELECTOR_FORBIDDEN',f=>{f.app.policies[0].include=[{email_domain:{domain:'example.com'}}]}));
test('service auth selector rejected for human operator',()=>check('BROAD_OR_NON_IDENTITY_SELECTOR_FORBIDDEN',f=>{f.app.policies[0].include=[{service_token:{token_id:'fixture'}}]}));
test('wrong operator email rejected',()=>check('OPERATOR_EMAIL_ALLOWLIST_MISMATCH',f=>{f.app.policies[0].include=[{email:{email:'other@qa.invalid'}}]}));
test('extra operator rejected',()=>check('OPERATOR_EMAIL_ALLOWLIST_MISMATCH',f=>{f.app.policies[0].include.push({email:{email:'extra@qa.invalid'}})}));
test('duplicate operator rejected',()=>check('OPERATOR_EMAIL_ALLOWLIST_MISMATCH',f=>{f.app.policies[0].include.push({email:{email:'operator@qa.invalid'}})}));
test('extra allow policy rejected',()=>check('SINGLE_EXPLICIT_ALLOW_POLICY_REQUIRED',f=>{f.app.policies.push({decision:'allow',include:[{everyone:{}}]})}));
test('unconfigured API metadata denied',()=>{const r=inspectActualCloudflareWorkerAccess(null,null);assert.equal(r.configurationCandidate,false)});
test('hypothetical actual Pages Access app never passes OA worker audit',()=>{
 const f=fixture();f.app={id:'6644c8db-2b38-4b96-a887-2aaebc34df14',name:'tien404-ai-git-staging - Cloudflare Pages',
   type:'self_hosted',aud:'existing-pages-aud',
   destinations:[{type:'public',uri:'*.tien404-ai-git-staging.pages.dev'}],
   domain:'*.tien404-ai-git-staging.pages.dev',session_duration:'24h',
   policies:[{decision:'allow',include:[{email:{email:'existing@qa.invalid'}}]}]};
 const r=inspectActualCloudflareWorkerAccess(f.app,f.expected);
 assert.equal(r.configurationCandidate,false);assert.equal(r.canDeploy,false);
});
