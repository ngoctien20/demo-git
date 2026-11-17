import test from 'node:test';
import assert from 'node:assert/strict';
import {validateHostedDoConfig,MAX_QA_REQUESTS,PROBE_CONTRACT} from './hosted2-real-do-behavioral-probe.mjs';
const e={T404_V174P_ISSUER_ORIGIN:'https://tien404-qa.example.com',
 T404_V174P_CANARY_APPROVAL:'QA_NO_SEND_ONLY',
 T404_V174P_ACCESS_INDEPENDENTLY_VERIFIED:'YES',
 T404_V174P_OPERATOR_CONFIRMED:'YES',T404_V174P_NO_REAL_DATA:'YES',
 T404_V174P_OPERATOR_STORAGE_STATE_FILE:'/tmp/t404-operator-state-qa.json',
 T404_V174P_DO_ACCEPTANCE_APPROVAL:'BOUNDED_REAL_DO_NO_SEND',
 T404_V174P_QA_MAX_REQUESTS:'96',
 T404_V174P_REAL_DO_HOSTED_BINDING_ATTESTED:'YES',
 T404_V174P_QA_ROLLBACK_VERIFIED:'YES'};
const check=mut=>validateHostedDoConfig({...e,...mut});
test('01 real-hosted probe is a passive code file, not hosted runner',()=>assert.match(PROBE_CONTRACT,/REAL_DO/));
test('02 max budget is hardcoded at 96',()=>assert.equal(MAX_QA_REQUESTS,96));
test('03 default config fails before network',()=>assert.equal(validateHostedDoConfig({}).ok,false));
test('04 explicit extra DO permission is required',()=>assert(check({T404_V174P_DO_ACCEPTANCE_APPROVAL:'NO'}).missing.includes('EXPLICIT_REAL_DO_OPERATOR_ACCEPTANCE')));
test('05 request budget must match hardcap',()=>assert(check({T404_V174P_QA_MAX_REQUESTS:'120'}).missing.includes('EXACT_NETWORK_REQUEST_BUDGET')));
test('06 Access app must already be independently attested',()=>assert(check({T404_V174P_ACCESS_INDEPENDENTLY_VERIFIED:'NO'}).missing.includes('INDEPENDENT_EDGE_ACCESS_PROOF')));
test('07 real DO binding cannot be inferred from local mock',()=>assert(check({T404_V174P_REAL_DO_HOSTED_BINDING_ATTESTED:'NO'}).missing.includes('INDEPENDENT_CLOUDFLARE_DO_BINDING_EVIDENCE')));
test('08 prior rollback verification is mandatory',()=>assert(check({T404_V174P_QA_ROLLBACK_VERIFIED:'NO'}).missing.includes('PROVEN_HOSTED_ROLLBACK')));
test('09 operator private browser session state required',()=>assert(check({T404_V174P_OPERATOR_STORAGE_STATE_FILE:''}).missing.includes('PRIVATE_OPERATOR_BROWSER_STATE')));
test('10 staging origin cannot be personal BIO domain',()=>assert(check({T404_V174P_ISSUER_ORIGIN:'https://ngoctien20.io.vn'}).missing.includes('DEDICATED_HTTPS_QA_HOST')));
test('11 synthetic signed-in test may be run only after independent approval',()=>{
 const r=check({});
 assert.equal(r.ok,true);
 assert.equal(r.hostedAlarmCleanupProvenByProbe,false);
});
test('12 missing per-run canary approval blocks real traffic',()=>assert(check({T404_V174P_CANARY_APPROVAL:'NO'}).missing.includes('OWNER_APPROVAL')));
