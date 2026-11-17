import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTRACT,REQUIRED_SLOTS,SAFE_EVIDENCE_CLASSES,reviewFourRowManifest,inspectHostedJwtReadiness} from './private-owner-provenance-gate.mjs';
const good=()=>({contract:CONTRACT,slots:REQUIRED_SLOTS.map((slot,i)=>({slot,evidence:SAFE_EVIDENCE_CLASSES.map((c,j)=>({class:c,ref:'REF_'+String(i*3+j+1).padStart(12,'0')}))}))});
test('four-row structure is NOT ownership approval',()=>{const x=reviewFourRowManifest(good());assert.equal(x.status,'STRUCTURAL_EVIDENCE_READY_FOR_PRIVATE_REVIEW');assert.equal(x.storeOwnershipCertified,false);assert.equal(x.canApplyM1,false)});
test('no manifest',()=>assert.equal(reviewFourRowManifest().status,'STRUCTURAL_EVIDENCE_REJECTED'));
test('empty slots',()=>assert.equal(reviewFourRowManifest({contract:CONTRACT,slots:[]}).status,'STRUCTURAL_EVIDENCE_REJECTED'));
test('three rows',()=>{const m=good();m.slots.pop();assert.equal(reviewFourRowManifest(m).status,'STRUCTURAL_EVIDENCE_REJECTED')});
test('five rows',()=>{const m=good();m.slots.push(m.slots[0]);assert.equal(reviewFourRowManifest(m).status,'STRUCTURAL_EVIDENCE_REJECTED')});
test('wrong contract',()=>{const m=good();m.contract='FAKE';assert.equal(reviewFourRowManifest(m).status,'STRUCTURAL_EVIDENCE_REJECTED')});
test('duplicate slot',()=>{const m=good();m.slots[3].slot='T1_ORDER';assert.equal(reviewFourRowManifest(m).status,'STRUCTURAL_EVIDENCE_REJECTED')});
test('missing evidence class',()=>{const m=good();m.slots[0].evidence.pop();assert.equal(reviewFourRowManifest(m).status,'STRUCTURAL_EVIDENCE_REJECTED')});
test('duplicate class',()=>{const m=good();m.slots[0].evidence[1].class='original_source';assert.equal(reviewFourRowManifest(m).status,'STRUCTURAL_EVIDENCE_REJECTED')});
test('wrong ref',()=>{const m=good();m.slots[0].evidence[0].ref='123';assert.equal(reviewFourRowManifest(m).status,'STRUCTURAL_EVIDENCE_REJECTED')});
test('reused ref',()=>{const m=good();m.slots[1].evidence[2].ref=m.slots[0].evidence[0].ref;assert.equal(reviewFourRowManifest(m).status,'STRUCTURAL_EVIDENCE_REJECTED')});
for(const k of ['ownerId','storeId','rowId','tenantId','jwt','signature','rawSource']){
 test('reject raw evidence field '+k,()=>{const m=good();m.slots[0].evidence[0][k]='SENSITIVE_CANARY';const x=reviewFourRowManifest(m);assert.equal(x.status,'STRUCTURAL_EVIDENCE_REJECTED');assert.equal(JSON.stringify(x).includes('SENSITIVE_CANARY'),false)})
}
test('reject row extra field',()=>{const m=good();m.slots[0].orderId='SENSITIVE';assert.equal(reviewFourRowManifest(m).status,'STRUCTURAL_EVIDENCE_REJECTED')});
test('reject top-level extra field',()=>{const m=good();m.operatorToken='SECRET';assert.equal(reviewFourRowManifest(m).status,'STRUCTURAL_EVIDENCE_REJECTED')});
test('unknown slot rejected',()=>{const m=good();m.slots[0].slot='T3_PRODUCT';assert.equal(reviewFourRowManifest(m).status,'STRUCTURAL_EVIDENCE_REJECTED')});
test('missing JWT packet denied',()=>{const x=inspectHostedJwtReadiness();assert.equal(x.status,'REAL_JWT_HOSTED_NO_GO');assert.equal(x.canReadOrder,false)});
test('wrong mode denied',()=>{const x=inspectHostedJwtReadiness({mode:'SEND'});assert.ok(x.blockers.includes('ONLY_NO_SEND_READ_ONLY_ALLOWED'))});
test('NO_SEND with all self-claims still not validated',()=>{const flags=['private_operator_authenticated_out_of_band','independent_reviewer_authenticated_out_of_band','merchant_owner_evidence_primary_sources_verified','all_four_original_row_store_provenance_verified','current_m0_restore_independently_accepted','canonical_same_tenant_two_store_mapping_verified','supabase_issuer_validated_jwt_a','supabase_issuer_validated_jwt_b','two_distinct_active_auth_sessions_rechecked','store_membership_rbac_verified_database','store_scoped_rls_negative_uat_independent','verified_customer_pairing_challenge','provider_native_signed_event_and_installation_verified','no_send_and_no_write_hosted_guards_verified'];const x=inspectHostedJwtReadiness({mode:'NO_SEND_READ_ONLY',claims:Object.fromEntries(flags.map(k=>[k,true]))});assert.equal(x.selfReportedRequiredGateCount,14);assert.equal(x.actualCryptographicJwtVerification,false);assert.equal(x.canSubmitJwt,false);assert.equal(x.canReadOrder,false);assert.equal(x.canDeploy,false);assert.ok(x.blockers.includes('INDEPENDENT_PRIVATE_VERIFIER_NOT_CONNECTED'))});
for(const key of ['jwt','access_token','refresh_token','service_role','password','raw_provider_header','private_owner_document','merchant_email','merchant_phone','private_key','store_id','tenant_id','user_metadata']){
 test('reject '+key+' in packet, do not echo',()=>{const x=inspectHostedJwtReadiness({mode:'NO_SEND_READ_ONLY',[key]:'HIGHLY_SENSITIVE_XXX'});assert.ok(x.blockers.includes('PRIVATE_OR_CLIENT_TRUST_INPUT_REJECTED'));assert.ok(!JSON.stringify(x).includes('HIGHLY_SENSITIVE_XXX'))})
}
for(const key of ['jwt','access_token','user_metadata','store_id','tenant_id']){
 test('reject '+key+' in claims',()=>{const x=inspectHostedJwtReadiness({mode:'NO_SEND_READ_ONLY',claims:{[key]:'spoof'}});assert.ok(x.blockers.includes('PRIVATE_OR_CLIENT_TRUST_INPUT_REJECTED'))})
}
test('all no-send and mutation switches fail closed',()=>{const x=inspectHostedJwtReadiness({mode:'NO_SEND_READ_ONLY'});for(const k of ['canReadOrder','canSend','canWrite','canOpenAccess','canDeploy','canSubmitJwt'])assert.equal(x[k],false)});
