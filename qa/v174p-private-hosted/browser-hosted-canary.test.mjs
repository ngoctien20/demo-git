import test from 'node:test';
import assert from 'node:assert/strict';
import {validateConfig} from './browser-hosted-canary.mjs';
const e={T404_V174P_ISSUER_ORIGIN:'https://tien404-private-qa.example.com',
 T404_V174P_CANARY_APPROVAL:'QA_NO_SEND_ONLY',
 T404_V174P_ACCESS_INDEPENDENTLY_VERIFIED:'YES',
 T404_V174P_OPERATOR_CONFIRMED:'YES',T404_V174P_NO_REAL_DATA:'YES',
 T404_V174P_OPERATOR_STORAGE_STATE_FILE:'/tmp/t404-operator-private.json'};
test('01 missing operator evidence denies',()=>assert.equal(validateConfig({}).ok,false));
test('02 per-run owner approval required',()=>assert(validateConfig({...e,T404_V174P_CANARY_APPROVAL:'NO'}).missing.includes('OWNER_APPROVAL')));
test('03 independent Access proof required',()=>assert(validateConfig({...e,T404_V174P_ACCESS_INDEPENDENTLY_VERIFIED:'NO'}).missing.includes('INDEPENDENT_EDGE_ACCESS_PROOF')));
test('04 must never claim personal BIO host',()=>assert.equal(validateConfig({...e,T404_V174P_ISSUER_ORIGIN:'https://ngoctien20.io.vn'}).ok,false));
test('05 reject local/non-TLS/Pages origins',()=>{
 for(const o of ['http://example.com','https://127.0.0.1','https://foo.pages.dev','https://fake.invalid'])
  assert.equal(validateConfig({...e,T404_V174P_ISSUER_ORIGIN:o}).ok,false);
});
test('06 no private state file blocks before network',()=>assert(validateConfig({...e,T404_V174P_OPERATOR_STORAGE_STATE_FILE:''}).missing.includes('PRIVATE_OPERATOR_BROWSER_STATE')));
test('07 valid offline configuration does not initiate external requests',()=>assert.equal(validateConfig(e).ok,true));
