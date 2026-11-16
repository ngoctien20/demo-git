/**
 * CBOT-MSG-CANARY-03B — independent review-only structural restore harness.
 * No real N8N APIs, credentials, Page IDs or customer data. It reconstructs
 * a proposed 32-node *redacted* topology, then reverts it in memory.
 *
 * This is NOT an encrypted backup nor a real hosted restore acceptance.
 * It cannot be used to publish, activate, restore or send Messenger.
 */
import {previewLockedExactPatch, CANARY03_ADDED_NAMES} from
 '../cbot-messenger-canary03/exact-locked-graph-patch.mjs';

const deep=x=>JSON.parse(JSON.stringify(x));
const eq=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
const keys=x=>Object.keys(x||{}).sort();
const expectedAdded=Object.values(CANARY03_ADDED_NAMES);

export function constructReviewOnlyCandidate(original){
 if(!original||original.id!=='Z7FdV7uDvApfbURQ')
  return {status:'BLOCKED_WRONG_ORIGINAL'};
 const blueprint=previewLockedExactPatch(original);
 if(blueprint.status!=='PATCH_BLUEPRINT_VALID_LOCKED_NOT_APPLIED')
  return {status:'BLOCKED_BLUEPRINT_NOT_PINNED'};
 if(blueprint.changes.added_nodes.length!==5 ||
    !eq(blueprint.changes.added_nodes.map(n=>n.name).sort(),
      [...expectedAdded].sort()))
  return {status:'BLOCKED_ADDED_NODES'};
 const copy=deep(original),delta=blueprint.changes;
 copy.nodes.push(...deep(delta.added_nodes));
 copy.connections[delta.replace_connection.from].main[
  delta.replace_connection.output_index]=deep(delta.replace_connection.new);
 for(const [node,conn] of Object.entries(delta.add_connections))
  copy.connections[node]=deep(conn);
 // All added nodes must remain strictly Code/IF. The guard is permanently
 // disabled; no Page/PSID verification, atomic claim or provider send exists.
 if(copy.nodes.filter(n=>n.type==='n8n-nodes-base.httpRequest').length!==1)
  return {status:'BLOCKED_EXTRA_HTTP'};
 if(copy.nodes.filter(n=>n.type==='n8n-nodes-base.webhook').length!==2)
  return {status:'BLOCKED_EXTRA_WEBHOOK'};
 if(copy.nodes.length!==32)
  return {status:'BLOCKED_NODE_COUNT'};
 return {status:'REDUCTED_SOURCE_ONLY_PATCH_SIMULATED',candidate:copy,
  blueprintVersion:blueprint.original_published_version};
}

export function independentlyReviewAndRestore(original, candidate){
 const blocked=reason=>Object.freeze({
  contract:'T404_CBOT_MSG_CANARY03B_ROLLBACK_REVIEW_V1',
  status:'NO_GO_LIVE_RESTORE',reason,
  source_roundtrip_pass:false,private_backup_certified:false,
  real_restore_rehearsal_pass:false,can_publish:false,can_send:false
 });
 if(!original||!candidate||original.id!=='Z7FdV7uDvApfbURQ'||
    original.activeVersionId!=='d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92'||
    candidate.activeVersionId!==original.activeVersionId||
    !Array.isArray(candidate.nodes)||candidate.nodes.length!==32||
    !Array.isArray(original.nodes)||original.nodes.length!==27)
  return blocked('SOURCE_VERSION_OR_NODE_COUNT_CHANGED');
 const originalNodes=new Map(original.nodes.map(n=>[n.name,n]));
 const addedNodes=candidate.nodes.filter(n=>!originalNodes.has(n.name));
 if(addedNodes.length!==5||!eq(addedNodes.map(n=>n.name).sort(),[...expectedAdded].sort()))
  return blocked('UNEXPECTED_ADDED_OR_MISSING_NODE');
 if(addedNodes.some(n=>n.credentials||
   !['n8n-nodes-base.code','n8n-nodes-base.if'].includes(n.type)))
  return blocked('NEW_CREDENTIAL_OR_EXTERNAL_NODE');
 for(const [name,node] of originalNodes){
  const patched=candidate.nodes.find(n=>n.name===name);
  if(!patched||!eq(node,patched))
   return blocked('EXISTING_NODE_PARAMETERS_MUTATED');
 }
 const baselineSources=keys(original.connections);
 const patchedSources=keys(candidate.connections);
 if(!eq(patchedSources,[...baselineSources,...expectedAdded.slice(0,4)].sort()))
  return blocked('UNEXPECTED_NEW_CONNECTION_SOURCE');
 const loop='Loop One Message';
 const candidatesMain=candidate.connections[loop]?.main;
 if(!Array.isArray(candidatesMain)||!eq(candidatesMain[1],
   [{node:CANARY03_ADDED_NAMES.guard,type:'main',index:0}]))
  return blocked('LOOP_NOT_EXACTLY_LOCKED');
 for(const name of baselineSources){
  if(name===loop)continue;
  if(!eq(original.connections[name],candidate.connections[name]))
   return blocked('OTHER_EXISTING_CONNECTION_MUTATED');
 }
 const expected={
  [CANARY03_ADDED_NAMES.guard]:[[CANARY03_ADDED_NAMES.ifMatch]],
  [CANARY03_ADDED_NAMES.ifMatch]:[[CANARY03_ADDED_NAMES.greeting],[CANARY03_ADDED_NAMES.ifBlock]],
  [CANARY03_ADDED_NAMES.ifBlock]:[[CANARY03_ADDED_NAMES.drop],['Messenger AI Agent']],
  [CANARY03_ADDED_NAMES.greeting]:[['Prepare Messenger Reply']]
 };
 for(const [name,outs] of Object.entries(expected)){
  const actual=candidate.connections[name]?.main?.map(group=>(group||[]).map(n=>n.node));
  if(!eq(actual,outs))return blocked('NEW_CANARY_CONNECTION_CHANGED');
 }
 if(candidate.connections[CANARY03_ADDED_NAMES.drop])
  return blocked('DROP_HAS_SEND_PATH');
 const guard=addedNodes.find(n=>n.name===CANARY03_ADDED_NAMES.guard);
 const code=guard?.parameters?.jsCode||'';
 if(!code.includes('t404_canary_match:false')||
    !code.includes('t404_qa_block:false'))
  return blocked('CANARY_GUARD_NOT_LOCKED');
 // Undo on a copy: remove the only five approved nodes and connections,
 // reset ONLY the changed Loop edge, and compare full redacted baseline.
 const restored=deep(candidate);
 restored.nodes=restored.nodes.filter(n=>!expectedAdded.includes(n.name));
 for(const name of expectedAdded)delete restored.connections[name];
 restored.connections[loop].main[1]=deep(original.connections[loop].main[1]);
 if(!eq(restored.nodes,original.nodes)||!eq(restored.connections,original.connections))
  return blocked('ROUNDTRIP_NOT_EQUAL_TO_ORIGINAL');
 return Object.freeze({
  contract:'T404_CBOT_MSG_CANARY03B_ROLLBACK_REVIEW_V1',
  status:'SOURCE_ONLY_ROUNDTRIP_PASS_LIVE_RESTORE_NO_GO',
  reason:'PRIVATE_ENCRYPTED_BACKUP_AND_HOSTED_RESTORE_REHEARSAL_MISSING',
  source_roundtrip_pass:true,
  restored_node_count:restored.nodes.length,
  restored_connection_sources:keys(restored.connections).length,
  original_published_version:original.activeVersionId,
  private_backup_certified:false,real_restore_rehearsal_pass:false,
  can_publish:false,can_send:false,orders_written:0,provider_messages_sent:0
 });
}
