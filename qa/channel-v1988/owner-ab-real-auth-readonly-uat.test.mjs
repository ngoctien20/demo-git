import assert from 'node:assert/strict';
import {validateTarget,evaluateRows,TABLES} from './owner-ab-real-auth-readonly-uat.mjs';
const REF='aaaaaaaaaaaaaaaaaaaa';
const KEY='sb_publishable_test_qa_only';
const anonJwt=['xx',Buffer.from(JSON.stringify({role:'anon'})).toString('base64url'),'xx'].join('.');
const serviceJwt=['xx',Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url'),'xx'].join('.');
let passed=0;
function blocked(name,payload,expectedCode) {
 try{validateTarget(payload);throw Error(name+': incorrectly admitted');}
 catch(e){assert.equal(e.code,expectedCode,name);passed++;}
}
function accepted(name,payload){
 assert.equal(validateTarget(payload),'https://'+REF+'.supabase.co',name);passed++;
}
const defaultTarget={projectRef:REF,explicit:'APPROVED_ISOLATED_READONLY',publishableKey:KEY};
accepted('isolated publishable key is only a configured candidate',defaultTarget);
accepted('legacy public anon JWT', {...defaultTarget,publishableKey:anonJwt});
blocked('approval missing',{...defaultTarget,explicit:''},'EXPLICIT_UAT_APPROVAL_GATE_REQUIRED');
blocked('staging blocked',{...defaultTarget,projectRef:'ifxlvrhyjhbzbrkdsida'},'BLOCKED_OR_INVALID_SUPABASE_PROJECT');
blocked('BIO blocked',{...defaultTarget,projectRef:'svxkwpmxgnfvewzwsbdt'},'BLOCKED_OR_INVALID_SUPABASE_PROJECT');
blocked('malformed ref',{...defaultTarget,projectRef:'https://example.com'},'BLOCKED_OR_INVALID_SUPABASE_PROJECT');
blocked('missing public key',{...defaultTarget,publishableKey:''},'PUBLIC_API_KEY_REQUIRED');
blocked('service secret blocked',{...defaultTarget,publishableKey:'sb_secret_FAKE'},'SECRET_API_KEY_NOT_ALLOWED');
blocked('service_role jwt blocked',{...defaultTarget,publishableKey:serviceJwt},'ONLY_ANON_PUBLISHABLE_KEY_ALLOWED');
blocked('random key blocked',{...defaultTarget,publishableKey:'abcd'},'ONLY_ANON_PUBLISHABLE_KEY_ALLOWED');
blocked('malformed jwt blocked',{...defaultTarget,publishableKey:'xx.notvalidbase64.zz'},'ONLY_ANON_PUBLISHABLE_KEY_ALLOWED');
blocked('incorrect case ref',{...defaultTarget,projectRef:'AAAAAAAAAAAAAAAAAAAA'},'BLOCKED_OR_INVALID_SUPABASE_PROJECT');
const pA={store_code:'A',fixture_tag:'V1988_SYNTHETIC_ONLY',sku:'F01',price_vnd:159000,stock_on_hand:5};
const pB={...pA,store_code:'B',price_vnd:189000,stock_on_hand:9};
const oA={store_code:'A',fixture_tag:'V1988_SYNTHETIC_ONLY',order_ref:'V1988_A_01'};
const cA={store_code:'A',fixture_tag:'V1988_SYNTHETIC_ONLY',conversation_ref:'V1988_A_01'};
function rows(name,table,owner,values,expected) {
 const r=evaluateRows(table,owner,values);
 assert.equal(r.pass,expected,name+' / '+r.reason);passed++;
}
rows('Store A exact product','products','A',[pA],true);
rows('Store B exact product','products','B',[pB],true);
rows('Store A cannot see B product','products','A',[pB],false);
rows('price mismatch','products','A',[{...pA,price_vnd:0}],false);
rows('stock mismatch','products','A',[{...pA,stock_on_hand:4}],false);
rows('SKU mismatch','products','A',[{...pA,sku:'F02'}],false);
rows('multiple rows leak','products','A',[pA,pB],false);
rows('empty query is NOT sufficient to pass','products','A',[],false);
rows('invalid fixture tag','products','A',[{...pA,fixture_tag:'REAL_CUSTOMER'}],false);
rows('Store A exact order','orders','A',[oA],true);
rows('Store A cross-store order','orders','A',[{...oA,store_code:'B'}],false);
rows('Store B exact order','orders','B',[{...oA,store_code:'B',order_ref:'V1988_B_01'}],true);
rows('wrong order reference','orders','A',[{...oA,order_ref:'OTHER'}],false);
rows('Store A exact conversation','conversations','A',[cA],true);
rows('Store B conversation cross-store','conversations','B',[cA],false);
rows('Store B exact conversation','conversations','B',[{...cA,store_code:'B',conversation_ref:'V1988_B_01'}],true);
rows('unknown table','inventory','A',[pA],false);
rows('invalid owner scope','products','ADMIN',[pA],false);
rows('not array','products','A',{},false);
rows('null item','products','A',[null],false);
assert.deepEqual(TABLES,['products','orders','conversations']);
passed++;
console.log('TIEN404_V1988_LOCAL_READONLY_RUNNER_SAFETY_PASS='+passed);
console.log('REAL_SIGNED_JWT_UAT=NOT_RUN');
console.log('HOSTED_PROJECT_PROVISIONING=NOT_RUN');
