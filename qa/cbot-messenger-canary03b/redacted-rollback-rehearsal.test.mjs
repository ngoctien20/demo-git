import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {rehearseRedactedTopologyRollback,reviewPrivateRecoveryReceipt} from './redacted-rollback-rehearsal.mjs';
const dir=dirname(fileURLToPath(import.meta.url));
const path=join(dir,'../cbot-messenger-canary03/actual-published-redacted-topology-27nodes.json');
const before=JSON.parse(readFileSync(path,'utf8'));
const receipt=JSON.parse(readFileSync(join(dir,'private-backup-restore-public-status.json'),'utf8'));
test('in-memory 27→32→27 topology rollback matches exact original sha256',()=>{
 const r=rehearseRedactedTopologyRollback(before);
 assert.equal(r.rehearsal,'REDACTED_SOURCE_TOPOLOGY_RESTORE_PASS');
 assert.equal(r.before_node_count,27);
 assert.equal(r.after_node_count,32);
 assert.equal(r.restored_node_count,27);
 assert.equal(r.topology_hash_sha256,r.restored_hash_sha256);
 assert.notEqual(r.topology_hash_sha256,r.candidate_hash_sha256);
 assert.equal(r.original_edge_restored,true);
});
test('a successful redacted rehearsal is NEVER a full n8n Published restore certification',()=>{
 const r=rehearseRedactedTopologyRollback(before);
 assert.equal(r.verdict,'NO_GO_FULL_BACKUP_NOT_CERTIFIED');
 assert.equal(r.private_full_export_present,false);
 assert.equal(r.credential_restoration_verified,false);
 assert.equal(r.can_restore_published,false);
 assert.equal(r.can_publish,false);
 assert.equal(r.can_send,false);
 assert.equal(r.production_changed,false);
});
test('current public backup status is explicitly pending operator and reviewer',()=>{
 const r=reviewPrivateRecoveryReceipt(receipt);
 assert.equal(r.reason,'PRIVATE_FULL_RESTORABLE_WORKFLOW_BACKUP_NOT_RECEIVED');
 assert.equal(receipt.operator_authorized,false);
 assert.equal(receipt.encrypted_archive_verified,false);
 assert.equal(receipt.restore_dry_run,false);
 assert.equal(receipt.reviewer_independent,false);
 assert.equal(receipt.production_backup_performed,false);
});
test('self-reported full backup and restore flags cannot be accepted',()=>{
 for(const k of ['operator_authorized','full_node_parameters','credential_reference_inventory',
  'encrypted_archive_verified','restore_dry_run','reviewer_independent','production_backup_performed']){
  const x={...receipt,[k]:true};
  assert.equal(reviewPrivateRecoveryReceipt(x).reason,'UNTRUSTED_OR_SELF_ASSERTED_BACKUP_RECEIPT',k);
 }
});
test('wrong published version, workflow id or injected private archive path denied',()=>{
 for(const [k,v] of [['workflow_id','WRONG'],['version','unexpected'],
  ['archive_location','/tmp/claimed.zip']]){
  const x={...receipt,[k]:v};
  assert.equal(reviewPrivateRecoveryReceipt(x).reason,'UNTRUSTED_OR_SELF_ASSERTED_BACKUP_RECEIPT');
 }
});
test('untrusted or tampered original metadata cannot be restored as accepted baseline',()=>{
 const x=structuredClone(before);x.activeVersionId='UNEXPECTED';
 const r=rehearseRedactedTopologyRollback(x);
 assert.equal(r.reason,'PINNED_PUBLISHED_BASELINE_NOT_VERIFIED');
});
test('unexpected loop edge or missing business tool blocks rehearsal',()=>{
 for(const kind of ['loop','tool']){
  const x=structuredClone(before);
  if(kind==='loop')x.connections['Loop One Message'].main[1][0].node='Wrong';
  else x.connections.create_order.ai_tool=[[]];
  assert.equal(rehearseRedactedTopologyRollback(x).reason,'PINNED_PUBLISHED_BASELINE_NOT_VERIFIED');
 }
});
test('local source rehearsal never edits its incoming original topology',()=>{
 const x=structuredClone(before),original=JSON.stringify(x);
 rehearseRedactedTopologyRollback(x);
 assert.equal(JSON.stringify(x),original);
});
test('redacted rehearsal receipt contains no Meta PSID, secret or restore credentials',()=>{
 const raw=readFileSync(join(dir,'private-backup-restore-public-status.json'),'utf8');
 for(const key of ['"psid"','"page_id"','"access_token"','"credential_id"',
  '"customer_name"','"phone"','"email"','"secret"','"raw_body"'])
  assert.equal(raw.includes(key),false,key);
});
