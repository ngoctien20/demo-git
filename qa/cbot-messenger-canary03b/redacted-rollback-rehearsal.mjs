import {createHash} from 'node:crypto';
import {previewLockedExactPatch,verifyObservedBaseline} from
 '../cbot-messenger-canary03/exact-locked-graph-patch.mjs';

/**
 * REDACTED TOPOLOGY restore rehearsal: fully in memory, non-secret.
 * A passing rehearsal is NOT a restorable full n8n workflow backup.
 * Production requires a private full export including node params and
 * independently controlled credential references, with operator-tested
 * import/rollback and write authorization.
 */
const clone=x=>structuredClone(x);
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const block=reason=>Object.freeze({
 verdict:'NO_GO_FULL_BACKUP_NOT_CERTIFIED',reason,
 private_full_export_present:false,credential_restoration_verified:false,
 can_restore_published:false,can_publish:false,can_send:false,
 production_changed:false
});
export function rehearseRedactedTopologyRollback(baseline){
 if(!baseline||!verifyObservedBaseline(baseline).valid)
  return block('PINNED_PUBLISHED_BASELINE_NOT_VERIFIED');
 const before=clone(baseline),baseHash=digest(before);
 const proposal=previewLockedExactPatch(before);
 if(proposal.status!=='PATCH_BLUEPRINT_VALID_LOCKED_NOT_APPLIED')
  return block('PATCH_BLUEPRINT_NOT_SAFE');
 const candidate=clone(before);
 candidate.nodes.push(...clone(proposal.changes.added_nodes));
 const edge=proposal.changes.replace_connection;
 const old=JSON.stringify(candidate.connections[edge.from]?.[edge.output]?.[edge.output_index]);
 if(old!==JSON.stringify(edge.old))return block('EXACT_EDGE_PRECONDITION_FAILED');
 candidate.connections[edge.from][edge.output][edge.output_index]=clone(edge.new);
 Object.assign(candidate.connections,clone(proposal.changes.add_connections));
 if(candidate.nodes.length!==32)return block('CANDIDATE_NODE_COUNT_WRONG');
 const patchHash=digest(candidate);
 if(patchHash===baseHash)return block('NO_CHANGE_DETECTED');
 // Restore only the non-secret local copy; no n8n update/publish call.
 const restored=clone(before);
 const restoredHash=digest(restored);
 if(restoredHash!==baseHash||JSON.stringify(restored)!==JSON.stringify(baseline))
  return block('IN_MEMORY_RESTORE_MISMATCH');
 return Object.freeze({
 verdict:'NO_GO_FULL_BACKUP_NOT_CERTIFIED',
 rehearsal:'REDACTED_SOURCE_TOPOLOGY_RESTORE_PASS',
 before_node_count:27,after_node_count:32,restored_node_count:27,
 topology_hash_sha256:baseHash,
 candidate_hash_sha256:patchHash,
 restored_hash_sha256:restoredHash,
 original_edge_restored:true,original_connections_unchanged:true,
 private_full_export_present:false,
 credential_restoration_verified:false,
 can_restore_published:false,can_publish:false,can_send:false,
 production_changed:false,real_page_recipient_approved:false
 });
}
export function reviewPrivateRecoveryReceipt(record){
 const keys=['contract','workflow_id','version','scope','archive_location',
 'operator_authorized','full_node_parameters','credential_reference_inventory',
 'encrypted_archive_verified','restore_dry_run','reviewer_independent',
 'production_backup_performed'];
 if(!record||typeof record!=='object'||Array.isArray(record)||
 Object.keys(record).length!==keys.length||
 Object.keys(record).some(k=>!keys.includes(k))||
 record.contract!=='T404_CANARY03B_RECOVERY_PUBLIC_RECEIPT_V1'||
 record.workflow_id!=='Z7FdV7uDvApfbURQ'||
 record.version!=='d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92'||
 record.scope!=='PUBLIC_STATUS_ONLY'||
 record.archive_location!=='PRIVATE_NOT_DISCLOSED'||
 record.operator_authorized!==false||
 record.full_node_parameters!==false||
 record.credential_reference_inventory!==false||
 record.encrypted_archive_verified!==false||
 record.restore_dry_run!==false||
 record.reviewer_independent!==false||
 record.production_backup_performed!==false)
  return block('UNTRUSTED_OR_SELF_ASSERTED_BACKUP_RECEIPT');
 return block('PRIVATE_FULL_RESTORABLE_WORKFLOW_BACKUP_NOT_RECEIVED');
}
