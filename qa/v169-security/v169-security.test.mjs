import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createQaOwnerEvidenceLedger,EVIDENCE_TYPES,OWNERSHIP_CONTRACT,ownerProofChecklist,STORE_QA_METADATA} from './owner-evidence.mjs';
import {createQaPrivateImportReadiness,IMPORT_READINESS_CONTRACT,PRIVATE_IMPORT_DESIGN} from './private-import-readiness.mjs';
import {HEADERS,MARKER,parseCsv,sampleCsvForStore} from '../v168-merchant/import-preview.mjs';
const now=1794800000000;
const code=(fn,c)=>assert.throws(fn,new RegExp(c));
const a=()=>{
 const ledger=createQaOwnerEvidenceLedger(),gate=createQaPrivateImportReadiness(ledger);
 const ownerA=ledger.issueQaActor({actor_id:'QA_OWNER_A',store_id:'QA_STORE_A'});
 const ownerB=ledger.issueQaActor({actor_id:'QA_OWNER_B',store_id:'QA_STORE_B'});
 const ownerC=ledger.issueQaActor({actor_id:'QA_OWNER_C',store_id:'QA_STORE_C'});
 const staffA=ledger.issueQaActor({actor_id:'QA_TI_ENROLL_A',store_id:'QA_STORE_A'});
 const reviewerA=ledger.issueQaActor({actor_id:'QA_QA_REVIEWER_A',store_id:'QA_STORE_A'});
 const reviewerB=ledger.issueQaActor({actor_id:'QA_QA_REVIEWER_B',store_id:'QA_STORE_B'});
 const scannerA=ledger.issueQaActor({actor_id:'QA_QA_SCANNER_A',store_id:'QA_STORE_A'});
 const scannerB=ledger.issueQaActor({actor_id:'QA_QA_SCANNER_B',store_id:'QA_STORE_B'});
 return {ledger,gate,ownerA,ownerB,ownerC,staffA,reviewerA,reviewerB,scannerA,scannerB};
};
const begin=(x,scope=x.staffA,store_id='QA_STORE_A',import_id='QA_IMPORT_0001',file_ref='QA_FILE_0001',now_ms=now)=>x.gate.begin({
 scope,store_id,import_id,file_ref,format:'CSV',content_type:'text/csv',size_bytes:180,now_ms
});
const scan=(x,id='QA_IMPORT_0001')=>x.gate.scanMetadata({
 scope:x.scannerA,store_id:'QA_STORE_A',import_id:id,
 result:'CLEAN_QA_SIMULATION',expected_revision:1,now_ms:now+100});
const preview=(x,id='QA_IMPORT_0001',rows)=>x.gate.previewSyntheticRows({
 scope:x.staffA,store_id:'QA_STORE_A',import_id:id,
 expected_revision:2,now_ms:now+200,rows});
const approve=(x,id='QA_IMPORT_0001')=>x.gate.approvePreview({
 scope:x.ownerA,store_id:'QA_STORE_A',import_id:id,expected_revision:3,now_ms:now+300});
const review=(x,id='QA_IMPORT_0001')=>x.gate.reviewSecurityMetadata({
 scope:x.reviewerA,store_id:'QA_STORE_A',import_id:id,expected_revision:4,now_ms:now+400});
const pipeline=()=>{const x=a();begin(x);scan(x);preview(x);approve(x);return x};
test('01 immutable ownership contract',()=>assert.equal(OWNERSHIP_CONTRACT,'T404_V169_OWNER_EVIDENCE_METADATA_QA'));
test('02 immutable private intake contract',()=>assert.equal(IMPORT_READINESS_CONTRACT,'T404_V169_PRIVATE_IMPORT_QUARANTINE_QA'));
test('03 same tenant different Stores A/B',()=>assert.equal(STORE_QA_METADATA.QA_STORE_A.tenant_id,STORE_QA_METADATA.QA_STORE_B.tenant_id));
test('04 different tenant Shop C',()=>assert.notEqual(STORE_QA_METADATA.QA_STORE_A.tenant_id,STORE_QA_METADATA.QA_STORE_C.tenant_id));
test('05 ownerA scope maps only to Shop A',()=>{const x=a();assert.equal(x.ownerA.store_id,'QA_STORE_A')});
test('06 ownerB is denied cross-store A',()=>code(()=>a().ledger.issueQaActor({actor_id:'QA_OWNER_B',store_id:'QA_STORE_A'}),'CROSS_STORE|MISSING'));
test('07 unenrolled arbitrary actor denied',()=>code(()=>a().ledger.issueQaActor({actor_id:'QA_HACKER',store_id:'QA_STORE_A'}),'MISSING'));
test('08 expired support grant denied',()=>code(()=>a().ledger.issueQaActor({actor_id:'QA_TI_ENROLL_EXPIRED',store_id:'QA_STORE_A'}),'MISSING'));
test('09 unknown Store denied',()=>code(()=>a().ledger.issueQaActor({actor_id:'QA_OWNER_A',store_id:'QA_STORE_X'}),'UNKNOWN'));
test('10 forged scope denied',()=>code(()=>a().ledger.validateScope({actor_id:'QA_OWNER_A',store_id:'QA_STORE_A',role:'OWNER'},'QA_STORE_A',['OWNER']),'NOT_ISSUED'));
test('11 cloned issued scope denied',()=>{const x=a();code(()=>x.ledger.validateScope({...x.ownerA},'QA_STORE_A',['OWNER']),'NOT_ISSUED')});
test('12 cross-Store validation denied',()=>{const x=a();code(()=>x.ledger.validateScope(x.ownerB,'QA_STORE_A',['OWNER']),'CROSS_STORE')});
test('13 unknown evidence kind denied',()=>{const x=a();code(()=>x.ledger.makeSubmission({scope:x.ownerA,store_id:'QA_STORE_A',kind:'TOKEN_READ',evidence_ref:'QA_EVID_0001',now_ms:now}),'UNRECOGNIZED')});
test('14 raw URL evidence reference rejected',()=>{const x=a();code(()=>x.ledger.makeSubmission({scope:x.ownerA,store_id:'QA_STORE_A',kind:EVIDENCE_TYPES[0],evidence_ref:'https://example.org/secret',now_ms:now}),'PRIVATE_EVIDENCE_REF')});
test('15 redacted metadata submission is unverified',()=>{
 const x=a(),doc=x.ledger.makeSubmission({scope:x.staffA,store_id:'QA_STORE_A',kind:EVIDENCE_TYPES[0],evidence_ref:'QA_EVID_0001',now_ms:now});
 assert.equal(doc.external_attestation,false);assert.equal(doc.hosted_jwt_verified,false);assert.equal(doc.review_state,'SUBMITTED_UNVERIFIED_METADATA');
});
test('16 missing metadata initial statuses 9',()=>{
 const x=a(),s=x.ledger.evidenceStatus({scope:x.ownerA,store_id:'QA_STORE_A'});
 assert.equal(s.evidence_total,9);assert.equal(s.metadata_reviewed,0);assert(s.evidence.every(v=>v.state==='MISSING'));
});
test('17 reviewer A can check metadata but not verify live identity',()=>{
 const x=a();x.ledger.makeSubmission({scope:x.staffA,store_id:'QA_STORE_A',kind:EVIDENCE_TYPES[0],evidence_ref:'QA_EVID_0001',now_ms:now});
 const doc=x.ledger.reviewMetadata({scope:x.reviewerA,store_id:'QA_STORE_A',kind:EVIDENCE_TYPES[0],evidence_ref:'QA_EVID_0001',now_ms:now+1});
 assert.equal(doc.review_state,'REVIEWED_METADATA_QA_ONLY');assert.equal(doc.external_attestation,false);
});
test('18 owner cannot independently review own evidence',()=>{
 const x=a();x.ledger.makeSubmission({scope:x.ownerA,store_id:'QA_STORE_A',kind:EVIDENCE_TYPES[0],evidence_ref:'QA_EVID_0001',now_ms:now});
 code(()=>x.ledger.reviewMetadata({scope:x.ownerA,store_id:'QA_STORE_A',kind:EVIDENCE_TYPES[0],evidence_ref:'QA_EVID_0001',now_ms:now+1}),'ROLE_DENIED');
});
test('19 Shop B reviewer cannot review Shop A',()=>{
 const x=a();x.ledger.makeSubmission({scope:x.staffA,store_id:'QA_STORE_A',kind:EVIDENCE_TYPES[0],evidence_ref:'QA_EVID_0001',now_ms:now});
 code(()=>x.ledger.reviewMetadata({scope:x.reviewerB,store_id:'QA_STORE_A',kind:EVIDENCE_TYPES[0],evidence_ref:'QA_EVID_0001',now_ms:now+1}),'CROSS_STORE');
});
test('20 mismatched evidence ref denied',()=>{
 const x=a();x.ledger.makeSubmission({scope:x.staffA,store_id:'QA_STORE_A',kind:EVIDENCE_TYPES[0],evidence_ref:'QA_EVID_0001',now_ms:now});
 code(()=>x.ledger.reviewMetadata({scope:x.reviewerA,store_id:'QA_STORE_A',kind:EVIDENCE_TYPES[0],evidence_ref:'QA_EVID_OTHER',now_ms:now+1}),'MISMATCH');
});
test('21 second metadata claim is not overwritten silently',()=>{
 const x=a();x.ledger.makeSubmission({scope:x.staffA,store_id:'QA_STORE_A',kind:EVIDENCE_TYPES[0],evidence_ref:'QA_EVID_0001',now_ms:now});
 code(()=>x.ledger.makeSubmission({scope:x.staffA,store_id:'QA_STORE_A',kind:EVIDENCE_TYPES[0],evidence_ref:'QA_EVID_0002',now_ms:now+1}),'ALREADY_SUBMITTED');
});
test('22 reviewer double-review denied',()=>{
 const x=a();x.ledger.makeSubmission({scope:x.staffA,store_id:'QA_STORE_A',kind:EVIDENCE_TYPES[0],evidence_ref:'QA_EVID_0001',now_ms:now});
 const req={scope:x.reviewerA,store_id:'QA_STORE_A',kind:EVIDENCE_TYPES[0],evidence_ref:'QA_EVID_0001',now_ms:now+1};
 x.ledger.reviewMetadata(req);code(()=>x.ledger.reviewMetadata(req),'REVIEW_ALREADY');
});
test('23 invalid time denied',()=>{
 const x=a();code(()=>x.ledger.makeSubmission({scope:x.staffA,store_id:'QA_STORE_A',kind:EVIDENCE_TYPES[0],evidence_ref:'QA_EVID_0001',now_ms:-1}),'QA_CLOCK');
});
test('24 independent 9-type ledger cannot unlock production',()=>{
 const x=a();
 for(const [i,kind] of EVIDENCE_TYPES.entries()){
  const ref='QA_EVID_00'+String(i+10);
  x.ledger.makeSubmission({scope:x.staffA,store_id:'QA_STORE_A',kind,evidence_ref:ref,now_ms:now});
  x.ledger.reviewMetadata({scope:x.reviewerA,store_id:'QA_STORE_A',kind,evidence_ref:ref,now_ms:now+1});
 }
 const state=x.ledger.evidenceStatus({scope:x.ownerA,store_id:'QA_STORE_A'});
 assert.equal(state.metadata_reviewed,9);assert.equal(state.merchant_production_ready,false);
 assert.equal(state.hosted_owner_jwt_rls,'BLOCKED');assert.equal(state.actual_external_certification,false);
});
test('25 cannot issue production capability',()=>code(()=>a().ledger.issueProductionCapability(),'HOSTED_IDENTITY'));
test('26 cannot approve hosted migration',()=>code(()=>a().ledger.approveHostedMigration(),'HOSTED_BACKUP'));
test('27 owner can revoke a QA metadata evidence record',()=>{
 const x=a();x.ledger.makeSubmission({scope:x.staffA,store_id:'QA_STORE_A',kind:EVIDENCE_TYPES[0],evidence_ref:'QA_EVID_0001',now_ms:now});
 assert.equal(x.ledger.revokeEvidence({scope:x.ownerA,store_id:'QA_STORE_A',kind:EVIDENCE_TYPES[0]}).status,'REVOKED_QA');
 assert.equal(x.ledger.evidenceStatus({scope:x.ownerA,store_id:'QA_STORE_A'}).metadata_reviewed,0);
});
test('28 cross store cannot see QA evidence',()=>{
 const x=a();code(()=>x.ledger.evidenceStatus({scope:x.ownerB,store_id:'QA_STORE_A'}),'CROSS_STORE');
});
test('29 evidence audit contains no raw payload',()=>{
 const x=a();x.ledger.makeSubmission({scope:x.staffA,store_id:'QA_STORE_A',kind:EVIDENCE_TYPES[0],evidence_ref:'QA_EVID_0001',now_ms:now});
 const audit=x.ledger.scopedAudit({scope:x.ownerA,store_id:'QA_STORE_A'});
 assert.equal(audit.length,1);assert.equal('phone' in audit[0],false);assert.equal('url' in audit[0],false);
});
test('30 security reviewer cannot read another Shop audit',()=>{
 const x=a();code(()=>x.ledger.scopedAudit({scope:x.reviewerA,store_id:'QA_STORE_B'}),'CROSS_STORE');
});
test('31 checklist acknowledges all external gates',()=>{
 const c=ownerProofChecklist();assert.equal(c.actual_hosted_owner_jwt_required,true);assert.equal(c.production_ready,false);
});
test('32 private file intake denies PII and actual upload capabilities',()=>{
 const x=a(),s=x.gate.canUploadRealData();
 assert.equal(s.actual_upload_enabled,false);assert.equal(s.signed_upload_url_issued,false);assert.equal(s.production_import_allowed,false);
});
test('33 owner/assigned support opens metadata-only QA intake',()=>{
 const x=a(),j=begin(x);
 assert.equal(j.state,'QUARANTINED_METADATA_ONLY');assert.equal(j.actual_file_stored,false);assert.equal(j.qa_only,true);
});
test('34 scanner B cannot act on Shop A intake',()=>{
 const x=a();begin(x);
 code(()=>x.gate.scanMetadata({scope:x.scannerB,store_id:'QA_STORE_A',import_id:'QA_IMPORT_0001',result:'CLEAN_QA_SIMULATION',expected_revision:1,now_ms:now+1}),'CROSS_STORE');
});
test('35 owner B cannot begin Shop A import',()=>{
 const x=a();code(()=>begin(x,x.ownerB),'CROSS_STORE');
});
test('36 unauthorized reviewer cannot create upload',()=>{
 const x=a();code(()=>begin(x,x.reviewerA),'ROLE_DENIED');
});
test('37 malformed opaque import ID rejected',()=>{
 const x=a();code(()=>begin(x,x.staffA,'QA_STORE_A','my_real_file'),'OPAQUE');
});
test('38 raw untrusted path file reference rejected',()=>{
 const x=a();code(()=>begin(x,x.staffA,'QA_STORE_A','QA_IMPORT_0001','../../secret.csv'),'OPAQUE');
});
test('39 invalid content_type mismatch denied',()=>{
 const x=a();code(()=>x.gate.begin({scope:x.staffA,store_id:'QA_STORE_A',import_id:'QA_IMPORT_0001',file_ref:'QA_FILE_0001',format:'CSV',content_type:'application/octet-stream',size_bytes:200,now_ms:now}),'CONTENT_TYPE');
});
test('40 unsupported content type denied',()=>{
 const x=a();code(()=>x.gate.begin({scope:x.staffA,store_id:'QA_STORE_A',import_id:'QA_IMPORT_0001',file_ref:'QA_FILE_0001',format:'DOCX',content_type:'application/msword',size_bytes:200,now_ms:now}),'CONTENT_TYPE');
});
test('41 zero file size denied',()=>{
 const x=a();code(()=>x.gate.begin({scope:x.staffA,store_id:'QA_STORE_A',import_id:'QA_IMPORT_0001',file_ref:'QA_FILE_0001',format:'CSV',content_type:'text/csv',size_bytes:0,now_ms:now}),'FILE_SIZE');
});
test('42 file bigger than V16.8 2MB denied',()=>{
 const x=a();code(()=>x.gate.begin({scope:x.staffA,store_id:'QA_STORE_A',import_id:'QA_IMPORT_0001',file_ref:'QA_FILE_0001',format:'CSV',content_type:'text/csv',size_bytes:2*1024*1024+1,now_ms:now}),'FILE_SIZE');
});
test('43 same Store replay same import ID denied',()=>{
 const x=a();begin(x);code(()=>begin(x),'REPLAY_IMPORT');
});
test('44 different import ID but reused Store file ref denied',()=>{
 const x=a();begin(x);code(()=>begin(x,x.staffA,'QA_STORE_A','QA_IMPORT_0002','QA_FILE_0001'),'DUPLICATE_FILE');
});
test('45 scanner only runs once for same import',()=>{
 const x=a();begin(x);scan(x);
 code(()=>x.gate.scanMetadata({scope:x.scannerA,store_id:'QA_STORE_A',import_id:'QA_IMPORT_0001',result:'CLEAN_QA_SIMULATION',expected_revision:2,now_ms:now+200}),'SCAN_ORDER');
});
test('46 rejected scan permanently blocks preview',()=>{
 const x=a();begin(x);
 const s=x.gate.scanMetadata({scope:x.scannerA,store_id:'QA_STORE_A',import_id:'QA_IMPORT_0001',result:'REJECTED_QA_SIMULATION',expected_revision:1,now_ms:now+100});
 assert.equal(s.state,'REJECTED_QA');
 code(()=>preview(x),'IMPORT_CLOSED');
});
test('47 arbitrary scan PASS not accepted',()=>{
 const x=a();begin(x);
 code(()=>x.gate.scanMetadata({scope:x.scannerA,store_id:'QA_STORE_A',import_id:'QA_IMPORT_0001',result:'CLEAN_VERIFIED',expected_revision:1,now_ms:now+100}),'SCAN_RESULT_NOT_SYNTHETIC');
});
test('48 cannot preview before simulated scan',()=>{
 const x=a();begin(x);code(()=>preview(x),'SCAN_STEP_REQUIRED');
});
test('49 clean simulated scan is not actual antivirus',()=>{
 const x=a();begin(x);const s=scan(x);
 assert.equal(s.scan_state,'CLEAN_QA_SIMULATION');assert.equal(s.actual_antivirus_scanned,false);
});
test('50 QA catalog imported through V16.8 preview code',()=>{
 const x=a();begin(x);scan(x);const p=preview(x);
 assert.equal(p.preview_accepted,1);assert.equal(p.hosted_import_written,false);assert.equal(p.state,'PREVIEW_ONLY');
});
test('51 no customer phone column accepted in product preview',()=>{
 const x=a();begin(x);scan(x);
 const columns=HEADERS.concat('phone');const cells=[MARKER,'A001','Tên','159000','130000','2','cái','0901'];
 code(()=>preview(x,'QA_IMPORT_0001',[columns,cells]),'UNSUPPORTED_HEADERS');
});
test('52 missing synthetic marker fails',()=>{
 const x=a();begin(x);scan(x);
 const rows=parseCsv(sampleCsvForStore('QA_STORE_A'));rows[1][0]='LIVE';
 code(()=>preview(x,'QA_IMPORT_0001',rows),'VALIDATION_FAILURE');
});
test('53 manipulated VND price rejected',()=>{
 const x=a();begin(x);scan(x);
 const rows=parseCsv(sampleCsvForStore('QA_STORE_A'));rows[1][3]='159.000';
 code(()=>preview(x,'QA_IMPORT_0001',rows),'VALIDATION_FAILURE');
});
test('54 owner can approve only after scan and valid preview',()=>{
 const x=a();begin(x);scan(x);preview(x);const r=approve(x);
 assert.equal(r.state,'OWNER_APPROVED_QA_ONLY');assert.equal(r.production_activation,false);
});
test('55 support cannot approve even with grant',()=>{
 const x=a();begin(x);scan(x);preview(x);
 code(()=>x.gate.approvePreview({scope:x.staffA,store_id:'QA_STORE_A',import_id:'QA_IMPORT_0001',expected_revision:3,now_ms:now+300}),'ROLE_DENIED');
});
test('56 owner B cannot approve Shop A',()=>{
 const x=a();begin(x);scan(x);preview(x);
 code(()=>x.gate.approvePreview({scope:x.ownerB,store_id:'QA_STORE_A',import_id:'QA_IMPORT_0001',expected_revision:3,now_ms:now+300}),'CROSS_STORE');
});
test('57 real security reviewer records only metadata review',()=>{
 const x=pipeline(),s=review(x);
 assert.equal(s.state,'METADATA_REVIEWED_OFFLINE_QA_ONLY');assert.equal(s.actual_file_stored,false);
 assert.equal(s.production_activation,false);
});
test('58 owner cannot self-issue independent security signoff',()=>{
 const x=pipeline();
 code(()=>x.gate.reviewSecurityMetadata({scope:x.ownerA,store_id:'QA_STORE_A',import_id:'QA_IMPORT_0001',expected_revision:4,now_ms:now+400}),'ROLE_DENIED');
});
test('59 stale version/replay cannot double approve',()=>{
 const x=pipeline();code(()=>x.gate.approvePreview({scope:x.ownerA,store_id:'QA_STORE_A',import_id:'QA_IMPORT_0001',expected_revision:3,now_ms:now+400}),'VALIDATED_PREVIEW_REQUIRED');
});
test('60 expired metadata prevents further scan',()=>{
 const x=a();begin(x);
 code(()=>x.gate.scanMetadata({scope:x.scannerA,store_id:'QA_STORE_A',import_id:'QA_IMPORT_0001',result:'CLEAN_QA_SIMULATION',expected_revision:1,now_ms:now+21*60*1000}),'EXPIRED');
});
test('61 owner cancel yields no live mutation',()=>{
 const x=a();begin(x);const s=x.gate.cancel({scope:x.ownerA,store_id:'QA_STORE_A',import_id:'QA_IMPORT_0001',expected_revision:1});
 assert.equal(s.state,'ABORTED_QA');assert.equal(s.hosted_import_written,false);
});
test('62 canceled import cannot be scanned',()=>{
 const x=a();begin(x);x.gate.cancel({scope:x.ownerA,store_id:'QA_STORE_A',import_id:'QA_IMPORT_0001',expected_revision:1});
 code(()=>scan(x),'IMPORT_CLOSED');
});
test('63 cannot see another Store private intake status',()=>{
 const x=a();begin(x);
 code(()=>x.gate.getStatus({scope:x.ownerB,store_id:'QA_STORE_A',import_id:'QA_IMPORT_0001'}),'CROSS_STORE');
});
test('64 no job from Shop B may read A import ID',()=>{
 const x=a();begin(x);
 code(()=>x.gate.getStatus({scope:x.ownerB,store_id:'QA_STORE_B',import_id:'QA_IMPORT_0001'}),'IMPORT_NOT_FOUND');
});
test('65 QA import audit is scoped to Store A',()=>{
 const x=a();begin(x);
 assert.equal(x.gate.auditForStore({scope:x.ownerA,store_id:'QA_STORE_A'}).length,1);
 code(()=>x.gate.auditForStore({scope:x.ownerB,store_id:'QA_STORE_A'}),'CROSS_STORE');
});
test('66 no real file reference is exposed by status',()=>{
 const x=a();begin(x);const s=JSON.stringify(x.gate.getStatus({scope:x.ownerA,store_id:'QA_STORE_A',import_id:'QA_IMPORT_0001'}));
 assert.equal(s.includes('QA_FILE_0001'),false);assert.equal(s.includes('phone'),false);
});
test('67 signed URL issuance blocked',()=>code(()=>a().gate.issueSignedUploadUrl(),'PRIVATE_STORAGE_NOT_PROVISIONED'));
test('68 actual import commit blocked',()=>code(()=>a().gate.commitCatalog(),'LIVE_CATALOG_COMMIT_FORBIDDEN'));
test('69 real malware scanning claims blocked',()=>code(()=>a().gate.scanRealContent(),'REAL_FILE_SCANNER_NOT_CONNECTED'));
test('70 customer PII ingestion blocked',()=>code(()=>a().gate.acceptCustomerPII(),'CUSTOMER_PII_INTAKE_FORBIDDEN'));
test('71 design contract explicitly no network and no PII',()=>{
 assert.equal(PRIVATE_IMPORT_DESIGN.file_bytes_saved,false);
 assert.equal(PRIVATE_IMPORT_DESIGN.antimalware_performed,false);
 assert.equal(PRIVATE_IMPORT_DESIGN.customers_allowed,false);
 assert.equal(PRIVATE_IMPORT_DESIGN.production_ready,false);
});
test('72 V16.8 previous migration still all commented, no DDL executable',()=>{
 const s=readFileSync(new URL('../../docs/ai-handoff/V16_8_STORE_JWT_RLS_MIGRATION_DO_NOT_APPLY.sql',import.meta.url),'utf8');
 assert(s.split('\n').every(line=>line===''||line.startsWith('--')));
});
test('73 no unverified metadata record can certify hosted owner',()=>{
 const x=a(),s=x.ledger.evidenceStatus({scope:x.ownerB,store_id:'QA_STORE_B'});
 assert.equal(s.hosted_owner_jwt_rls,'BLOCKED');assert.equal(s.merchant_production_ready,false);
});
test('74 synthetic source has no provider/model/hosted network calls',()=>{
 const files=['owner-evidence.mjs','private-import-readiness.mjs'];
 for(const file of files){
  const src=readFileSync(new URL('./'+file,import.meta.url),'utf8');
  for(const token of ['fetch(', 'XMLHttpRequest','api.openai.com','service_role','createClient(', 'localStorage','process.env']){
   assert.equal(src.includes(token),false,file+' '+token);
  }
 }
});
test('75 import comparison uses same SKU safely per synthetic Shop',()=>{
 const x=a(),ownerB=x.ownerB;
 const b=x.gate.begin({scope:ownerB,store_id:'QA_STORE_B',import_id:'QA_IMPORT_B001',file_ref:'QA_FILE_B001',format:'CSV',content_type:'text/csv',size_bytes:140,now_ms:now});
 assert.equal(b.store_id,'QA_STORE_B');
 const s=x.gate.scanMetadata({scope:x.scannerB,store_id:'QA_STORE_B',import_id:'QA_IMPORT_B001',result:'CLEAN_QA_SIMULATION',expected_revision:1,now_ms:now+100});
 assert.equal(s.state,'QA_SCAN_SIMULATED');
 const result=x.gate.previewSyntheticRows({scope:ownerB,store_id:'QA_STORE_B',import_id:'QA_IMPORT_B001',expected_revision:2,now_ms:now+200});
 assert.equal(result.preview_accepted,1);
});
