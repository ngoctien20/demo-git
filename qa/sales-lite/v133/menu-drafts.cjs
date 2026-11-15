'use strict';
// V13.3 isolated draft-only Menu Service. No database, no publish, no send.
const source=require('../v131/menu-registry.json');
const {createMenuRegistry}=require('../v131/menu-engine.cjs');
const ID=/^[A-Z][A-Z0-9_]{2,63}$/;
const deepCopy=v=>JSON.parse(JSON.stringify(v));
const fail=c=>{const e=new Error(c);e.code=c;throw e;};
function snapshot(registry=source){createMenuRegistry(registry);return deepCopy(registry);}
function actionMap(r){return new Map(r.menus.flatMap(m=>m.actions.map(a=>[a.action_id,{...a,menu_id:m.menu_id}])));}
function validateDraft(r){
 const errors=[];if(!r||r.send_enabled!==false||r.order_write_enabled!==false||r.subscription_write_enabled!==false)return ['UNSAFE_FLAGS'];
 if(r.menu_version!=='1.1.0'||!Array.isArray(r.menus)||r.menus.length!==3)return ['REGISTRY_VERSION_UNSUPPORTED'];
 const ids=new Set();const roleIds=new Set();
 for(const menu of r.menus){if(!['CUSTOMER','OWNER','TIEN404_SUPPORT'].includes(menu.actor_role)||roleIds.has(menu.actor_role))errors.push('DUPLICATE_ROLE');
 roleIds.add(menu.actor_role);const cmds=new Set();
 for(const a of menu.actions||[]){
  if(!ID.test(a.action_id||'')||ids.has(a.action_id))errors.push('ACTION_ID_DUPLICATED_OR_INVALID');
  ids.add(a.action_id);
  if(a.actor_role!==menu.actor_role||a.menu_version!==r.menu_version||typeof a.label!=='string'||!a.label.trim()||a.label.length>72||typeof a.description!=='string'||!a.description.trim())errors.push('ACTION_SCHEMA_INVALID');
  if(!/^[1-9][0-9]?$/.test(a.fallback_command||'')||cmds.has(a.fallback_command))errors.push('FALLBACK_COLLISION');
  cmds.add(a.fallback_command);
  if(!Array.isArray(a.required_permissions)||a.required_permissions.some(p=>typeof p!=='string'||!p)||!Array.isArray(a.channel_support)||!a.channel_support.includes('ZALO_BOT_TEXT')||!a.channel_support.includes('MOCK_WEB'))errors.push('PERMISSIONS_OR_CHANNEL_INVALID');
  if(a.action_type==='WRITE_PROPOSAL'&&(!a.requires_confirmation||a.idempotency_policy!=='RECEIPT_REQUIRED'))errors.push('UNSAFE_MUTATION');
 }}
 return [...new Set(errors)];
}
function compareMenuVersions(before,after){
 const x=actionMap(before),y=actionMap(after),changes=[];
 for(const id of new Set([...x.keys(),...y.keys()])){
  const a=x.get(id),b=y.get(id);
  if(!a){changes.push({action_id:id,field:'ADDED',risk:'REVIEW_REQUIRED'});continue;}
  if(!b){changes.push({action_id:id,field:'REMOVED',risk:'HIGH'});continue;}
  for(const f of ['menu_id','label','description','fallback_command','required_permissions','requires_confirmation','next_state','channel_support','enabled']){
   if(JSON.stringify(a[f])!==JSON.stringify(b[f])){
     changes.push({action_id:id,field:f,from:deepCopy(a[f]),to:deepCopy(b[f]),risk:['menu_id','required_permissions','requires_confirmation','channel_support','enabled'].includes(f)?'HIGH':'REVIEW_REQUIRED'});
   }
  }
 }
 return changes;
}
function createMenuDraftManager(base=source){
 const original=snapshot(base);const drafts=new Map();let counter=0;
 function create(){const id='DRAFT-'+(++counter);drafts.set(id,{status:'DRAFT',revision:1,data:deepCopy(original)});return {draftId:id,status:'DRAFT',revision:1};}
 function get(id){const d=drafts.get(id);if(!d)fail('DRAFT_NOT_FOUND');return {draftId:id,status:d.status,revision:d.revision,registry:deepCopy(d.data),diff:compareMenuVersions(original,d.data)};}
 function patch(id,{actionId,label,description,fallbackCommand}={}){
  const d=drafts.get(id);if(!d)fail('DRAFT_NOT_FOUND');if(d.status!=='DRAFT')fail('DRAFT_IMMUTABLE');
  const action=d.data.menus.flatMap(m=>m.actions).find(a=>a.action_id===actionId);if(!action)fail('ACTION_NOT_FOUND');
  const prev=deepCopy(action);
  if(label!==undefined)action.label=label;if(description!==undefined)action.description=description;if(fallbackCommand!==undefined)action.fallback_command=fallbackCommand;
  const issues=validateDraft(d.data);if(issues.length){Object.assign(action,prev);fail('DRAFT_VALIDATION_FAILED:'+issues.join(','));}
  d.revision++;return get(id);
 }
 function transition(id,next){
  const d=drafts.get(id);if(!d)fail('DRAFT_NOT_FOUND');
  if(next==='APPROVED'||next==='RELEASED')fail('OWNER_APPROVAL_GATE_REQUIRED');
  if(!(d.status==='DRAFT'&&next==='REVIEW')&&!(d.status==='REVIEW'&&next==='CANDIDATE'))fail('INVALID_DRAFT_TRANSITION');
  const issues=validateDraft(d.data);if(issues.length)fail('DRAFT_VALIDATION_FAILED');
  d.status=next;d.revision++;return get(id);
 }
 function exportDraft(id){const d=get(id);return {metadata:{draft_id:id,revision:d.revision,status:d.status,no_send:true,no_write:true},registry:{...d.registry,release:'EXPERIMENTAL',send_enabled:false,order_write_enabled:false,subscription_write_enabled:false}};}
 return Object.freeze({create,get,patch,transition,exportDraft,compare:(id)=>compareMenuVersions(original,get(id).registry),mode:'MEMORY_ONLY_NOT_PERSISTED'});
}
module.exports={createMenuDraftManager,compareMenuVersions,validateDraft,snapshot};
