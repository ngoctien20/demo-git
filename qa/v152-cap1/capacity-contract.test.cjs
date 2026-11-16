'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const C=require('./capacity-contract.cjs');
test('planned concurrency and RPM gates are exact, not production certificates',()=>{
 assert.deepEqual(C.LEVELS,[1,5,10,25,50]);assert.deepEqual(C.RATE_LEVELS,[1,10,30,60]);});
test('cross-store and order writes fail closed',()=>{
 assert.equal(C.authorizeSynthetic({store_id:'A',tenant_id:C.STORES.B,intent:'catalog'}).http_status,403);
 assert.equal(C.authorizeSynthetic({store_id:'A',tenant_id:C.STORES.A,intent:'create_order',confirm:true}).http_status,409);
 assert.equal(C.authorizeSynthetic({store_id:'B',tenant_id:C.STORES.B,intent:'catalog'}).http_status,200);
});
test('mock acceptance does not imply real delivery or charged inference',()=>{
 let r=C.deliveryEvidence('MOCK');
 assert.equal(r.provider_mock_accepted,true);assert.equal(r.provider_delivery_verified,false);
 assert.equal(r.customer_reply_e2e_ms,null);assert.equal(r.ai_cost_actual,null);
});
test('empty or unlinked actual output never becomes PASS',()=>{
 assert.equal(C.qualityDisposition({actual_output:''}),'NOT_RUN');
 assert.equal(C.qualityDisposition({actual_output:'historical',full_execution_linked:false}),'BLOCKED');
 assert.equal(C.qualityDisposition({actual_output:'historical',full_execution_linked:true}),'BLOCKED');
});
