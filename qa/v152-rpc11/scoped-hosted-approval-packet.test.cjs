'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {CONTRACT,PROJECT,REQUIRED,ROLES,scopeCommitment,
 inspectPhaseApproval,executeHostedPhase}=require('./scoped-hosted-approval-packet.cjs');
const NOW=Date.parse('2026-11-17T00:05:00.000Z');
const ACTORS=['aaaaaaaa-0000-4000-8000-000000000001',
 'bbbbbbbb-0000-4000-8000-000000000002',
 'cccccccc-0000-4000-8000-000000000003'];
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function packet(phase='M1_SCHEMA_ONLY'){
 const p={contract:CONTRACT,projectRef:PROJECT,environment:'STAGING_ONLY',
  phase,sourceCommitSha:'a'.repeat(40),
  operationNonceSha256:hash('RPC11 synthetic nonce'),
  issuedAtUtc:'2026-11-17T00:00:00.000Z',
  expiresAtUtc:'2026-11-17T00:20:00.000Z',
  claimsZeroDowntime:false,
  evidence:REQUIRED[phase].map((kind,i)=>({
   kind,receiptSha256:hash(phase+' synthetic receipt '+i)
  })),attestations:[]};
 const scope=scopeCommitment(p);
 p.attestations=ROLES.map((role,i)=>({
  role,actorId:ACTORS[i],scopeSha256:scope,
  approvedAtUtc:'2026-11-17T00:02:00.000Z'
 }));
 return p;
}
const review=p=>inspectPhaseApproval({packet:p,now:NOW});
const has=(p,k)=>review(p).blockers.includes(k);
test('01 valid-looking M1 claims are only packet review, not authorization',()=>{
 const x=review(packet());
 assert.equal(x.status,'STRUCTURAL_PACKET_READY_FOR_PRIVATE_ORIGINAL_EVIDENCE_REVIEW');
 assert.equal(x.approvalGranted,false);
 assert.equal(x.canApplyM1,false);
 assert.equal(x.signaturesCryptographicallyVerified,false);
});
test('02 M2M4 evidence has a different exact receipt inventory',()=>{
 const x=review(packet('M2_M4_ATOMIC'));
 assert.equal(x.requiredReceipts,7);
 assert.equal(x.canApplyM2M4,false);
});
test('03 M3 evidence packet is separate from M1 and M2M4',()=>{
 const x=review(packet('M3_COMPOSITE_FK'));
 assert.equal(x.requiredReceipts,7);
 assert.equal(x.canApplyM3,false);
});
test('04 every phase is STAGING_ONLY; production scope refused',()=>{
 const p=packet();p.environment='PRODUCTION';
 assert(has(p,'STAGING_OPERATION_SCOPE_INVALID'));
});
test('05 operation cannot claim zero downtime for reader blackout',()=>{
 const p=packet('M2_M4_ATOMIC');p.claimsZeroDowntime=true;
 assert(has(p,'STAGING_OPERATION_SCOPE_INVALID'));
});
test('06 source commit must be exact SHA40',()=>{
 const p=packet();p.sourceCommitSha='main';
 assert(has(p,'STAGING_OPERATION_SCOPE_INVALID'));
});
test('07 nonce must be nonempty domain separated SHA256',()=>{
 const p=packet();p.operationNonceSha256='short';
 assert(has(p,'STAGING_OPERATION_SCOPE_INVALID'));
});
test('08 missing recovery evidence blocks M1',()=>{
 const p=packet();p.evidence.splice(2,1);
 assert(has(p,'PHASE_RECEIPT_COUNT_INVALID'));
 assert(has(p,'PHASE_REQUIRED_RECEIPT_MISSING'));
});
test('09 wrong M1 receipt kind cannot be used as M2/M4 approval',()=>{
 const p=packet('M2_M4_ATOMIC');
 p.evidence[0].kind='M1_EXACT_SCHEMA_PLAN';
 assert(has(p,'PHASE_RECEIPT_FORMAT_INVALID'));
});
test('10 duplicate receipt kind blocks',()=>{
 const p=packet();p.evidence[1].kind=p.evidence[0].kind;
 assert(has(p,'PHASE_DUPLICATE_EVIDENCE_KIND'));
});
test('11 same receipt hash reused across different evidence classes blocks',()=>{
 const p=packet();p.evidence[1].receiptSha256=p.evidence[0].receiptSha256;
 assert(has(p,'PHASE_REUSED_EVIDENCE_DIGEST'));
});
test('12 Controller and Security Reviewer must be different',()=>{
 const p=packet();p.attestations[1].actorId=p.attestations[0].actorId;
 assert(has(p,'NON_INDEPENDENT_REVIEW_ACTOR'));
});
test('13 DB Operator is mandatory and separate role',()=>{
 const p=packet();p.attestations.pop();
 assert(has(p,'INDEPENDENT_ROLE_COUNT_INVALID'));
 assert(has(p,'REQUIRED_INDEPENDENT_ROLE_MISSING'));
});
test('14 mismatched scope digest rejects changed approval',()=>{
 const p=packet();p.sourceCommitSha='b'.repeat(40);
 assert(has(p,'INDEPENDENT_ROLE_SCOPE_CLAIM_INVALID'));
});
test('15 expired packet requires another phase-specific review',()=>{
 const p=packet();p.expiresAtUtc='2026-11-17T00:04:00.000Z';
 assert(has(p,'PHASE_APPROVAL_WINDOW_EXPIRED_OR_INVALID'));
});
test('16 excessively long operation window denied',()=>{
 const p=packet();p.expiresAtUtc='2026-11-17T01:00:00.000Z';
 assert(has(p,'PHASE_APPROVAL_WINDOW_EXPIRED_OR_INVALID'));
});
test('17 fake future approvals denied',()=>{
 const p=packet();p.attestations[0].approvedAtUtc='2029-01-01T00:00:00.000Z';
 assert(has(p,'INDEPENDENT_ROLE_SCOPE_CLAIM_INVALID'));
});
test('18 wrong project has no authority',()=>{
 const p=packet();p.projectRef='another-project';
 assert(has(p,'STAGING_OPERATION_SCOPE_INVALID'));
});
test('19 arbitrary extra credential/secret fields denied and never echoed',()=>{
 const p=packet();p.serviceKey='SHOULD_NEVER_ECHO';
 const x=review(p);
 assert(x.blockers.includes('STAGING_OPERATION_SCOPE_INVALID'));
 assert(!JSON.stringify(x).includes('SHOULD_NEVER_ECHO'));
});
test('20 all operator claims green never grant read/export/apply/revoke',()=>{
 const x=review(packet('M3_COMPOSITE_FK'));
 for(const k of ['realSignerIdentityAuthenticated','primaryEvidenceContentsIndependentlyInspected',
  'realAuthorizedHostMigration','approvalGranted','canApplyM1','canApplyM2M4',
  'canApplyM3','canExportHostedBackup','canRevokePublicRpc','canPublishN8n'])
  assert.equal(x[k],false,k);
 assert.equal(x.crossPhaseApprovalReusable,false);
});
test('21 malformed packet input fails without throwing or revealing anything',()=>{
 for(const p of [undefined,null,{},[],{'contract':'../../tokens'}]){
  const x=review(p);
  assert.equal(x.status,'HOSTED_PHASE_APPROVAL_NO_GO');
 }
});
test('22 no hosted execute method exists and only explicit throwing stub',()=>{
 assert.throws(()=>executeHostedPhase(),/RPC11_NO_HOSTED_MIGRATION_EXECUTOR/);
 assert.equal(CONTRACT,'T404_RPC11_STAGING_PHASE_PRIVATE_APPROVAL_PACKET_V1');
});
