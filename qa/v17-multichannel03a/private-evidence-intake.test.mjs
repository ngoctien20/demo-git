import test from 'node:test';
import assert from 'node:assert/strict';
import {preflightPrivateEvidenceTicket,privateEvidenceAcceptanceChecklist}
 from './private-evidence-intake.mjs';
const NOW=1794900000000;
const types=['MERCHANT_STORE_OWNERSHIP','COMMERCIAL_STAFF_AUTHORITY',
 'SAME_TENANT_STORE_PAIR','META_PAGE_APP_ADMIN','META_HANDOVER_PERMISSION',
 'RECOVERY_OPERATOR_APPROVAL'];
const fixture=()=>({contract:'T404_MC03A_PRIVATE_INTAKE_V1',
 ticket:'EV-0123456789ABCDEF',evidenceType:types[0],
 stage:'PRIVATE_SUBMISSION_PENDING',expiresAtMs:NOW+3600000});
const deny=(value,reason)=>{const r=preflightPrivateEvidenceTicket(value,NOW);
 assert.equal(r.accepted,false);assert.equal(r.reason,reason);
 assert.equal(r.canDeploy,false);assert.equal(r.privateVaultWrite,false);};
test('exact opaque ticket allows metadata preview and nothing else',()=>{
 const r=preflightPrivateEvidenceTicket(fixture(),NOW);
 assert.equal(r.accepted,true);assert.equal(r.privateEvidenceVerified,false);
 assert.equal(r.canApproveUat,false);assert.equal(r.noSend,true);
 assert.equal(r.status,'PENDING_PRIVATE_OWNER_AND_INDEPENDENT_REVIEW');
});
test('all six intake categories remain private-only',()=>{
 for(const x of types){const d=fixture();d.evidenceType=x;
  assert.equal(preflightPrivateEvidenceTicket(d,NOW).accepted,true);}
});
test('reject uploaded token or secret in unrecognized field',()=>{
 const d=fixture();d.access_token='not-a-real-token';
 deny(d,'STRICT_METADATA_ONLY_NO_ATTACHMENTS');
});
test('reject raw merchant name and email',()=>{
 const d=fixture();d.merchantEmail='a@b.example';
 deny(d,'STRICT_METADATA_ONLY_NO_ATTACHMENTS');
});
test('reject file/path and external URL',()=>{
 const a=fixture();a.fileUrl='https://private.example/secret';
 deny(a,'STRICT_METADATA_ONLY_NO_ATTACHMENTS');
 const b=fixture();b.path='/customer-ids/report.pdf';
 deny(b,'STRICT_METADATA_ONLY_NO_ATTACHMENTS');
});
test('reject client-signed owner approval flag',()=>{
 const d=fixture();d.ownerApproved=true;
 deny(d,'STRICT_METADATA_ONLY_NO_ATTACHMENTS');
});
test('invalid ticket syntax rejected',()=>{
 const d=fixture();d.ticket='EV-../../secret';
 deny(d,'TICKET_TYPE_STAGE_OR_EXPIRY_INVALID');
});
test('short or predictable ticket rejected',()=>{
 const d=fixture();d.ticket='EV-12345';
 deny(d,'TICKET_TYPE_STAGE_OR_EXPIRY_INVALID');
});
test('no unrecognized evidence types',()=>{
 const d=fixture();d.evidenceType='WRITE_STOCK';
 deny(d,'TICKET_TYPE_STAGE_OR_EXPIRY_INVALID');
});
test('cannot claim private upload or verification from request',()=>{
 const d=fixture();d.stage='PRIVATE_VERIFIED';
 deny(d,'TICKET_TYPE_STAGE_OR_EXPIRY_INVALID');
});
test('expires after 24-hour maximum blocked',()=>{
 const d=fixture();d.expiresAtMs=NOW+24*3600000+1;
 deny(d,'TICKET_TYPE_STAGE_OR_EXPIRY_INVALID');
});
test('expired ticket rejected',()=>{
 const d=fixture();d.expiresAtMs=NOW;
 deny(d,'TICKET_TYPE_STAGE_OR_EXPIRY_INVALID');
});
test('noninteger time rejected',()=>{
 const r=preflightPrivateEvidenceTicket(fixture(),'now');
 assert.equal(r.accepted,false);
});
test('private evidence checklist has no verified capability',()=>{
 const r=privateEvidenceAcceptanceChecklist();
 assert.equal(r.verified,false);assert.equal(r.approved,false);
 assert.equal(r.canPublishEvidence,false);assert.ok(r.checks.length>=7);
});
