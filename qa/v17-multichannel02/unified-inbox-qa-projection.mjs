// TIEN404 V17.MULTI-CHANNEL-02 — Unified Inbox read-only PROJECTION for QA fixtures.
// Browser Preview does NOT connect to this module or customer DB; future API
// must authenticate independently and enforce Store-scoped RLS before any reads.
const MODE='OFFLINE_SYNTHETIC_UNIFIED_INBOX';
const CHANNELS=new Set(['messenger','zalo_oa','zalo_bot','website_widget']);
const STATES=new Set(['BOT_ACTIVE','HANDOFF_PENDING','HUMAN_ACTIVE','RESUME_PENDING']);
const KEYS=['source','marker','tenantId','storeId','bindingId','channel',
 'conversationId','state','displayLabel','previewText','updatedAtMs','assignedStaffId'];
const ID=/^[a-zA-Z0-9_.:-]{2,128}$/;
const valid=x=>typeof x==='string'&&ID.test(x);
const txt=(x,max)=>typeof x==='string'&&x.length>0&&x.length<=max&&
  !/[<>\u0000-\u001f\u007f]/.test(x)&&
  !/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(x)&&
  !/(?:\+84|0)[0-9][0-9 .-]{8,13}/.test(x);
const deny=reason=>Object.freeze({
 ok:false,reason,qaSynthetic:true,noSend:true,noHostedRead:true,
 canReply:false,canAssign:false,rows:[]
});
/** accessDecisions are outputs of staff-authority-offline.mjs, never host auth. */
export async function projectQaUnifiedInbox(input,deps) {
 if(!deps||deps.executionMode!==MODE||deps.hostedReadEnabled!==false||
   typeof deps.readQaRows!=='function')return deny('SYNTHETIC_INBOX_ONLY');
 if(!valid(input?.storeId)||!Array.isArray(input?.accessDecisions)||
   input.accessDecisions.length<1||input.accessDecisions.length>20)
  return deny('ACCESS_SCOPE_REQUIRED');
 if(input.channel && !CHANNELS.has(input.channel))return deny('INVALID_CHANNEL_FILTER');
 if(input.state && !STATES.has(input.state))return deny('INVALID_STATE_FILTER');
 const scopes=new Map(),tenants=new Set();
 for(const a of input.accessDecisions) {
  if(!a||a.previewAllowed!==true||
    a.source!=='QA_SYNTHETIC_STAFF_PREVIEW'||a.action!=='INBOX_READ'||
    a.authRealVerified!==false||a.storeRlsVerified!==false||
    a.canReadHostedInbox!==false||a.canActivateHandoff!==false||
    a.noSend!==true||a.storeId!==input.storeId||
    !valid(a.tenantId)||!valid(a.bindingId)||!CHANNELS.has(a.channel))
     return deny('STAFF_PREVIEW_SCOPE_DENIED');
  tenants.add(a.tenantId);
  const key=a.channel+'::'+a.bindingId;
  if(scopes.has(key))return deny('DUPLICATE_BINDING_DECISION');
  scopes.set(key,a);
 }
 if(tenants.size!==1)return deny('CROSS_TENANT_SCOPES_DENIED');
 const tenantId=[...tenants][0];
 let sourceRows;
 try {sourceRows=await deps.readQaRows({tenantId,storeId:input.storeId,
    bindingRefs:[...scopes.keys()]});}
 catch{return deny('FIXTURE_READER_UNAVAILABLE');}
 if(!Array.isArray(sourceRows)||sourceRows.length>100)
  return deny('FIXTURE_RESULT_INVALID');
 const result=[],seen=new Set();
 for(const row of sourceRows){
  if(!row||typeof row!=='object'||Array.isArray(row)||
    Object.keys(row).length!==KEYS.length||
    !KEYS.every(k=>Object.hasOwn(row,k))||
    row.source!=='QA_SYNTHETIC_INBOX_ROW'||
    row.marker!=='SYNTHETIC_NO_CUSTOMER_PII'||
    row.tenantId!==tenantId||row.storeId!==input.storeId||
    !valid(row.bindingId)||!valid(row.conversationId)||
    !CHANNELS.has(row.channel)||!STATES.has(row.state)||
    !txt(row.displayLabel,60)||!txt(row.previewText,180)||
    !Number.isSafeInteger(row.updatedAtMs)||row.updatedAtMs<=0||
    (row.assignedStaffId!==null&&!valid(row.assignedStaffId)))
     return deny('FOREIGN_OR_UNSAFE_ROW');
  const access=scopes.get(row.channel+'::'+row.bindingId);
  if(!access)return deny('UNAUTHORIZED_CHANNEL_BINDING');
  const rowKey=row.channel+'::'+row.bindingId+'::'+row.conversationId;
  if(seen.has(rowKey))return deny('DUPLICATE_CONVERSATION');
  seen.add(rowKey);
  if(input.channel&&row.channel!==input.channel)continue;
  if(input.state&&row.state!==input.state)continue;
  result.push(Object.freeze({
    reference:rowKey,channel:row.channel,state:row.state,
    displayLabel:row.displayLabel,previewText:row.previewText,
    updatedAtMs:row.updatedAtMs,assigned:row.assignedStaffId!==null
  }));
 }
 result.sort((a,b)=>b.updatedAtMs-a.updatedAtMs || a.reference.localeCompare(b.reference));
 return Object.freeze({
   ok:true,qaSynthetic:true,source:'QA_SYNTHETIC_INBOX_PROJECTION',
   storeId:input.storeId,tenantId,rowCount:result.length,
   rows:Object.freeze(result),noSend:true,noHostedRead:true,
   canReply:false,canAssign:false,realStaffAuthorized:false,
   realJwtRlsVerified:false
 });
}
