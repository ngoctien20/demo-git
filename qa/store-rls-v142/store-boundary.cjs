'use strict';
/**
 * TIEN404 V14.2 — Store-scoped Knowledge Backend Boundary.
 * Server-side adapter CONTRACT, tested offline. No database/network mutation.
 * Production requires real auth verifier, private repository and approved RLS.
 * Never trust bot/tenant/store/user/role/verified fields supplied in request JSON.
 */
const {reply:knowledgeReply}=require('../shop-knowledge-v141/knowledge-core.cjs');
const STORE_SCHEMA_GATE=Object.freeze([
 'public.stores','public.store_memberships',
 'app_private.shop_knowledge_releases','app_private.shop_knowledge_items'
]);
class AccessError extends Error {
 constructor(code,status=403){super(code);this.name='AccessError';this.code=code;this.status=status;}
}
const deny=(code,status)=>{throw new AccessError(code,status)};
const validId=x=>typeof x==='string' && /^[a-zA-Z0-9_-]{2,100}$/.test(x);
const safeToken=x=>typeof x==='string' && x.length>=12&&x.length<=8192&&!/[\r\n\0]/.test(x);
function requiredBackend(deps){
 if(!deps||typeof deps.verifySession!=='function'||typeof deps.lookupStoreAssignment!=='function'
    ||typeof deps.readPublishedKnowledge!=='function')
  deny('REAL_BACKEND_ADAPTER_REQUIRED',503);
 if(deps.mode!=='HOSTED_READ_ONLY'&&deps.mode!=='OFFLINE_TEST')deny('BACKEND_MODE_UNAPPROVED',503);
 if(deps.schemaReady!==true)deny('CANONICAL_STORE_SCHEMA_NOT_APPROVED',503);
}
async function authorizeStore({headers,selection,deps}={}){
 requiredBackend(deps);
 const h=headers?.authorization;
 // Never parse a token from a query-string or request body; Authorization only.
 if(typeof h!=='string'||!/^Bearer [A-Za-z0-9._~+\/=-]+$/.test(h)||!safeToken(h.slice(7)))
  deny('MISSING_OR_INVALID_BEARER',401);
 const token=h.slice(7);
 const actor=await deps.verifySession(token); // Backend must verify cryptographic signature + claims.
 if(!actor||actor.verified_by!=='SUPABASE_AUTH_SERVER'||!validId(actor.user_id)||
    !Number.isFinite(actor.expires_at_ms)||actor.expires_at_ms<=Date.now()||
    actor.anonymous===true)deny('AUTH_SESSION_NOT_VERIFIED',401);
 // Store chosen by user is a selector, not an authorization claim.
 if(!selection||!validId(selection.store_id))deny('STORE_SELECTION_REQUIRED',400);
 const assignment=await deps.lookupStoreAssignment({
   user_id:actor.user_id,store_id:selection.store_id
 });
 if(!assignment||assignment.source!=='AUTHORITATIVE_DATABASE'||assignment.active!==true||
    assignment.user_id!==actor.user_id||assignment.store_id!==selection.store_id||
    !validId(assignment.tenant_id)||!['SHOP_OWNER','SHOP_MANAGER','TIEN404_SUPPORT','TIEN404_REVIEWER','PLATFORM_SUPER_ADMIN'].includes(assignment.role))
   deny('STORE_ASSIGNMENT_NOT_AUTHORIZED',403);
 if(!assignment.tenant_membership_active)deny('TENANT_MEMBERSHIP_NOT_ACTIVE',403);
 // Staff role must additionally be explicitly assigned to store; lookupStoreAssignment
 // is responsible for checking BOTH tenant and store assignment in one trusted query.
 if((assignment.role.startsWith('TIEN404_')||assignment.role==='PLATFORM_SUPER_ADMIN')&&
    assignment.store_staff_assignment_active!==true)deny('STAFF_STORE_ASSIGNMENT_MISSING',403);
 return Object.freeze({
   source:'SERVER_AUTHENTICATED_STORE_SESSION',
   user_id:actor.user_id,tenant_id:assignment.tenant_id,store_id:assignment.store_id,
   role:assignment.role,session_expires_at_ms:actor.expires_at_ms,
   // never forward raw JWT or other credentials
   _scope_key:assignment.tenant_id+'|'+assignment.store_id
 });
}
function assertContext(context){
 if(!context||context.source!=='SERVER_AUTHENTICATED_STORE_SESSION'||
    !validId(context.user_id)||!validId(context.tenant_id)||!validId(context.store_id))
   deny('STORE_CONTEXT_REQUIRED',403);
}
function validateReadback(context,raw){
 assertContext(context);
 if(!raw||raw.source!=='AUTHORITATIVE_DATABASE'||raw.tenant_id!==context.tenant_id||
   raw.store_id!==context.store_id||!validId(raw.version)||raw.state!=='PUBLISHED'||
   !Number.isInteger(raw.revision)||raw.revision<1||!Array.isArray(raw.entries)||
   raw.entries.length>500)deny('PUBLISHED_READBACK_INVALID',503);
 for(const e of raw.entries){
   if(!e||e.tenant_id!==context.tenant_id||e.store_id!==context.store_id)
     deny('CROSS_STORE_ENTRY_IN_READBACK',503);
 }
 return true;
}
async function readCustomerKnowledge({context,question,deps,now=Date.now(),conversationStatus='AI_ACTIVE'}={}){
 assertContext(context);requiredBackend(deps);
 // NOTE: Only a trusted private DB adapter can construct the source marker below.
 const raw=await deps.readPublishedKnowledge({
   tenant_id:context.tenant_id,store_id:context.store_id,role:'CUSTOMER_PUBLIC_READ'
 });
 validateReadback(context,raw);
 // Do not send STAFF_ONLY or RESTRICTED to any customer model context.
 const allowed=raw.entries.filter(e=>e.visibility==='PUBLIC');
 const snapshot={
   source:'TRUSTED_KNOWLEDGE_READBACK',tenant_id:context.tenant_id,store_id:context.store_id,
   version:raw.version,release_state:raw.state,revision:raw.revision,entries:allowed
 };
 return knowledgeReply({
   binding:{source:'TRUSTED_TENANT_RESOLVER',server_verified:true,
     tenant_id:context.tenant_id,store_id:context.store_id,bot_id:'web-onboarding-read'},
   snapshot,question,now,conversationStatus
 });
}
function assertMigrationSafety(known){
 // Read-only health gate. This never applies DDL.
 const missing=STORE_SCHEMA_GATE.filter(x=>!known?.includes(x));
 return Object.freeze({status:missing.length?'BLOCKED':'READY_FOR_HOSTED_QA',
   missing,can_change_rls:false,can_deploy_production:false});
}
function redactServerError(e){
 const code=e instanceof AccessError?e.code:'BACKEND_UNAVAILABLE';
 const status=e instanceof AccessError?e.status:503;
 // Do not expose SQL text, key, JWT, query, private knowledge.
 return Object.freeze({ok:false,status,error:code});
}
module.exports={authorizeStore,readCustomerKnowledge,assertMigrationSafety,validateReadback,
 redactServerError,AccessError,STORE_SCHEMA_GATE};
