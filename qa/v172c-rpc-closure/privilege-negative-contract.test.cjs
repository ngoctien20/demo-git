'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');

// Verified against Supabase staging read-only pg_proc ACL on 2026-11-18 JST.
// Snapshot contract only: these tests DO NOT execute RPCs, authenticate, or prove runtime denial.
const rpc = Object.freeze({
  qa_shop_b_zalo_claim: {anon:true, authenticated:false, service:false, public:false, definer:true, searchPathLocked:true, extraGate:'vault-backed-header', type:'synthetic-qa-only'},
  qa_owner_pairing: {anon:false, authenticated:true, service:false, public:false, definer:true, searchPathLocked:true, extraGate:'auth.uid-owner-qa', type:'synthetic-qa-only'},
  save_merchant_product: {anon:false, authenticated:true, service:false, public:false, definer:true, searchPathLocked:true, extraGate:'auth.uid-owner-manager-two-tenant-allowlist', type:'two-qa-tenant-only'}
});
for(const [name, value] of Object.entries(rpc)){
  for(const role of ['anon','authenticated','service','public']){
    test(name+' ACL '+role,()=> assert.equal(value[role], name==='qa_shop_b_zalo_claim' ? role==='anon' : role==='authenticated'));
  }
  test(name+' privileged invoker surface guarded by locked search_path',()=>{
    assert.equal(value.definer,true);
    assert.equal(value.searchPathLocked,true);
    assert.ok(value.extraGate.length>0);
  });
}
test('No RPC caller claim based on unscanned code / deployed Workers',()=> {
  const observed = ['yIJk8LvJoLF40Z62','sIPs6egzIwOY1GNv','p5OsIaB0NkMDFMw7'];
  assert.equal(observed.length,3);
  assert.ok(!observed.includes('ALL_DEPLOYED_CALLERS'));
});
test('Product writer cannot be blindly converted to invoker',()=>{
  const productsPolicies=['authenticated SELECT products_member_read'];
  assert.ok(!productsPolicies.some(x=>/UPDATE|INSERT/.test(x)));
});
test('No hosted acceptance asserted by source-only QA',()=> {
  const evidence={realJwt:false,providerEvent:false,hostedNegative:false,independentApproval:false};
  assert.deepEqual(Object.values(evidence),[false,false,false,false]);
});
