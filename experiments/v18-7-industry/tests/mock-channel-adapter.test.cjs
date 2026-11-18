"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {mockChannelPreview:run,INSTALLATIONS}=require("../src/mock-channel-adapter.cjs");
const grocery=require("../profiles/grocery.v1.json"),materials=require("../profiles/building-materials.v1.json");
const actors={a:{actor:"qa_owner_a",tenant:"qa_tenant_a",store:"qa_store_a",profile:grocery},
 b:{actor:"qa_owner_b",tenant:"qa_tenant_b",store:"qa_store_b",profile:materials},
 c:{actor:"qa_owner_c",tenant:"qa_tenant_a",store:"qa_store_c",profile:grocery}};
const source={a:{messenger:"qa_fb_a",zalo_oa:"qa_zalo_a",website:"qa_web_a"},
 b:{messenger:"qa_fb_b",zalo_oa:"qa_zalo_b",website:"qa_web_b"},
 c:{messenger:"qa_fb_c",zalo_oa:"qa_zalo_c",website:"qa_web_c"}};
function request(who="a",channel="messenger",operation="greeting_preview",payload={}){
 const a=actors[who],p=a.profile;
 return {actor_key:a.actor,installation_key:source[who][channel],channel,profile:p,
  override:{tenant_key:a.tenant,store_key:a.store,profile_id:p.id,profile_version:p.version,
    greeting:"Xin chào cửa hàng QA",tone:"friendly",faq:[],requested_tools:["preview_quote"]},operation,payload};
}
test("mock installation registry includes 3 stores x 3 channels and 2 disabled",()=>assert.equal(Object.keys(INSTALLATIONS).length,11));
for(const channel of ["messenger","zalo_oa","website"]){
 test("Store A "+channel+" has no send ability",()=>{
 const x=run(request("a",channel));assert.equal(x.ok,true);assert.equal(x.tenant_key,"qa_tenant_a");
 assert.equal(x.store_key,"qa_store_a");assert.equal(x.preview.sendable,false);assert.equal(x.canWrite,false);
 assert.equal(x.canSend,false);assert.equal(x.providerVerified,false);
 });
 test("Store B "+channel+" quote read only",()=>{
 const x=run(request("b",channel,"quote_preview",{sku:"QA-B001",quantity:2,unit:"bao"}));
 assert.equal(x.ok,true);assert.match(x.preview.text,/170000 VND/);assert.equal(x.store_key,"qa_store_b");
 });
 test("Store C same Tenant as A "+channel+" same SKU DIFFERENT price",()=>{
 const x=run(request("c",channel,"quote_preview",{sku:"QA-G001",quantity:1,unit:"goi"}));
 assert.equal(x.ok,true);assert.equal(x.tenant_key,"qa_tenant_a");
 assert.equal(x.store_key,"qa_store_c");assert.match(x.preview.text,/13900 VND/);
 });
}
test("Store A and C price must not be mixed",()=>assert.match(run(request("a","website","quote_preview",{sku:"QA-G001",quantity:1,unit:"goi"})).preview.text,/12500 VND/));
test("Store C runs out of stock before A",()=>{
 assert.equal(run(request("c","website","quote_preview",{sku:"QA-G001",quantity:8,unit:"goi"})).code,"INSUFFICIENT_STOCK");
 assert.equal(run(request("a","website","quote_preview",{sku:"QA-G001",quantity:8,unit:"goi"})).ok,true);
});
test("Same Tenant A cannot access C installation",()=>{const x=request();x.installation_key="qa_fb_c";assert.equal(run(x).code,"INSTALLATION_STORE_MISMATCH")});
test("Same Tenant C cannot access A installation",()=>{const x=request("c");x.installation_key="qa_fb_a";assert.equal(run(x).code,"INSTALLATION_STORE_MISMATCH")});
test("Cross Tenant B cannot access A installation",()=>{const x=request("b");x.installation_key="qa_fb_a";assert.equal(run(x).code,"INSTALLATION_STORE_MISMATCH")});
test("Forged store override denied",()=>{const x=request();x.override.store_key="qa_store_c";assert.equal(run(x).code,"STORE_PROFILE_SCOPE_MISMATCH")});
test("Paused installation DENY",()=>{const x=request();x.installation_key="qa_fb_paused";assert.equal(run(x).code,"CHANNEL_PAUSED")});
test("Revoked installation DENY",()=>{const x=request();x.installation_key="qa_fb_revoked";assert.equal(run(x).code,"REAUTH_REQUIRED")});
test("Unknown installation DENY",()=>{const x=request();x.installation_key="fake";assert.equal(run(x).code,"INSTALLATION_UNKNOWN")});
test("Prototype installation DENY",()=>{const x=request();x.installation_key="constructor";assert.equal(run(x).code,"INSTALLATION_UNKNOWN")});
test("Wrong channel DENY",()=>{const x=request();x.channel="website";assert.equal(run(x).code,"CHANNEL_MISMATCH")});
test("External tenant claim DENY",()=>{const x=request();x.tenant_id="qa_tenant_b";assert.equal(run(x).code,"INPUT_UNTRUSTED")});
test("External store claim DENY",()=>{const x=request();x.store_id="qa_store_c";assert.equal(run(x).code,"INPUT_UNTRUSTED")});
test("Forged session DENY",()=>{const x=request();x.jwt="fake";assert.equal(run(x).code,"INPUT_UNTRUSTED")});
test("Provider send DENY",()=>{const x=request();x.operation="provider_send";assert.equal(run(x).code,"OPERATION_DENIED")});
test("Order write DENY",()=>{const x=request();x.operation="create_order";assert.equal(run(x).code,"OPERATION_DENIED")});
test("Private order lookup DENY across all channels",()=>{
 for(const channel of ["messenger","zalo_oa","website"]){
 const x=request("a",channel);x.operation="read_private_order";assert.equal(run(x).code,"OPERATION_DENIED");}
});
test("Customer identity auto link DENY",()=>{const x=request();x.customer_phone="0900000000";assert.equal(run(x).code,"INPUT_UNTRUSTED")});
test("Unexpected greeting payload DENY",()=>{const x=request();x.payload={customer_ref:"x"};assert.equal(run(x).code,"PAYLOAD_UNTRUSTED")});
test("Customer suggested quote price DENY",()=>{const x=request("a","website","quote_preview",{sku:"QA-G001",quantity:1,unit:"goi",price_vnd:1});assert.equal(run(x).code,"PAYLOAD_UNTRUSTED")});
test("Wrong profile DENY",()=>{const x=request();x.profile=materials;assert.equal(run(x).code,"STORE_PROFILE_SCOPE_MISMATCH")});
test("Wrong unit DENY",()=>assert.equal(run(request("b","website","quote_preview",{sku:"QA-B001",quantity:1,unit:"thung"})).code,"INVALID_UNIT"));
test("Unknown SKU DENY",()=>assert.equal(run(request("b","website","quote_preview",{sku:"QA-G001",quantity:1,unit:"goi"})).code,"PRODUCT_NOT_IN_STORE"));
test("Distinct non-sendable renderer types",()=>{
 const types=new Set(["messenger","zalo_oa","website"].map(c=>run(request("a",c)).preview.kind));assert.equal(types.size,3);
});
test("Prototype injection key DENY",()=>{const x=request();Object.defineProperty(x,"__proto__",{enumerable:true,value:{role:"admin"}});assert.equal(run(x).code,"INPUT_UNTRUSTED")});
