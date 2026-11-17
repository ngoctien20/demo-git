import test from 'node:test';
import assert from 'node:assert/strict';
import {REQUIRED_PROOFS,reviewMigrationCandidate,reviewRealJwtAdmission} from './migration-admission.mjs';
const all=Object.fromEntries(REQUIRED_PROOFS.map(k=>[k,true]));
const proposal={schema_name:'rpc178_qa',mutate_public:false,mutate_auth:false,grant_anon:false,grant_authenticated:false,grant_service_role:false,expose_data_api:false,real_customer_data:false,cloudflare_change:false,cost_approval_present:true};
const deny=x=>{assert.equal(x.status,'BLOCKED');for(const p of ['can_migrate','can_create_user','can_grant_roles','can_deploy','can_upload','can_send','can_assert_real_auth_uat'])assert.equal(x[p],false)};
test('missing everything is BLOCKED',()=>{const x=reviewMigrationCandidate();deny(x);assert.ok(x.missing.length>=REQUIRED_PROOFS.length)});
for(const field of REQUIRED_PROOFS)test('missing '+field+' fails closed',()=>{
 const fake={...all};delete fake[field];const x=reviewMigrationCandidate(fake,proposal);deny(x);assert.ok(x.missing.includes(field));
});
for(const [label,patch] of [
 ['wrong schema',{schema_name:'public'}],['public mutation',{mutate_public:true}],['auth mutation',{mutate_auth:true}],
 ['anon grant',{grant_anon:true}],['authenticated grant',{grant_authenticated:true}],['service role grant',{grant_service_role:true}],
 ['data api exposed',{expose_data_api:true}],['real customer import',{real_customer_data:true}],['Cloudflare change',{cloudflare_change:true}],['cost unknown',{cost_approval_present:false}]
])test(label+' blocks candidate',()=>{const x=reviewMigrationCandidate(all,{...proposal,...patch});deny(x);assert.ok(x.missing.length>0)});
test('all synthetic approvals never authorize migration',()=>{const x=reviewMigrationCandidate(all,proposal);deny(x);assert.equal(x.reason,'INDEPENDENT_SIGNED_AUTHORIZATION_NOT_PROVIDED')});
test('string true cannot counterfeit independent approval',()=>{const x=reviewMigrationCandidate(Object.fromEntries(REQUIRED_PROOFS.map(k=>[k,'true'])),proposal);deny(x);assert.ok(x.missing.length>=REQUIRED_PROOFS.length)});
test('null candidate fails closed',()=>deny(reviewMigrationCandidate(null,null)));
test('raw JWT explicitly rejected',()=>{const x=reviewRealJwtAdmission({jwtA:'raw.jwt.secret',jwtB:'another.jwt.secret'});deny(x);assert.equal(JSON.stringify(x).includes('raw.jwt.secret'),false)});
test('claimed private operator does not authenticate session',()=>{const x=reviewRealJwtAdmission({policy:{private_operator_verified:true}});deny(x)});
test('no JWT evidence denies',()=>deny(reviewRealJwtAdmission()));
