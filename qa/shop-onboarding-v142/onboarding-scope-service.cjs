'use strict';
/**
 * TIEN404 V14.2.1 — QA-only onboarding orchestration candidate.
 *
 * This is NOT an HTTP endpoint and must NOT be deployed to production.
 * The real Store/Auth schema and durable private draft repository are blocked
 * pending hosted RLS and restore testing. No database, n8n or provider I/O.
 *
 * Each call authenticates from Authorization bearer via the trusted injected
 * OFFLINE_TEST dependencies; the client cannot supply tenant/actor/role.
 * Process-memory drafts are lost on process restart.
 */
const {randomUUID}=require('node:crypto');
const {authorizeStore,AccessError}=require('../store-rls-v142/store-boundary.cjs');
const onboarding=require('./onboarding-core.cjs');

const DEFAULT_TTL_MS=20*60*1000;
const MAX_TTL_MS=60*60*1000;
function fail(code,status=403){throw new AccessError(code,status);}
function createOfflineOnboardingService({deps,now=Date.now,ttlMs=DEFAULT_TTL_MS,maxSessions=40}={}){
 if(!deps||deps.mode!=='OFFLINE_TEST'||deps.schemaReady!==true||
    typeof deps.verifySession!=='function'||typeof deps.lookupStoreAssignment!=='function'||
    typeof deps.readPublishedKnowledge!=='function')
   fail('OFFLINE_FIXTURE_ADAPTER_REQUIRED',503);
 if(typeof now!=='function'||!Number.isSafeInteger(ttlMs)||ttlMs<60000||ttlMs>MAX_TTL_MS||
    !Number.isSafeInteger(maxSessions)||maxSessions<1||maxSessions>100)
   fail('INVALID_OFFLINE_SERVICE_CONFIGURATION',503);
 const sessions=new Map();
 const purge=()=>{const at=now();for(const [id,s] of sessions){
    if(s.expires_at_ms<=at)sessions.delete(id);
 }};
 async function authenticate(input){
   if(!input||typeof input.store_id!=='string')fail('STORE_SELECTION_REQUIRED',400);
   const context=await authorizeStore({
     headers:input.headers,selection:{store_id:input.store_id},deps
   });
   if(context.session_expires_at_ms<=now())fail('AUTH_SESSION_EXPIRED',401);
   return context;
 }
 function lookup(session_id,context){
   if(typeof session_id!=='string'||!/^[a-f0-9-]{36}$/i.test(session_id))
     fail('SESSION_NOT_FOUND',404);
   const state=sessions.get(session_id);
   // Never return the existence or scope of another person's draft.
   if(!state)fail('SESSION_NOT_FOUND',404);
   if(state.expires_at_ms<=now()){
     sessions.delete(session_id);fail('SESSION_EXPIRED',410);
   }
   if(state.actor_id!==context.user_id||state.store_id!==context.store_id||
      state.tenant_id!==context.tenant_id)fail('SESSION_NOT_FOUND',404);
   return state;
 }
 function response(entry,duplicateIgnored=false){
   const r=onboarding.review(entry.draft);
   return Object.freeze({
     status:r.status,session_id:entry.id,
     store_id:entry.store_id,tenant_id:entry.tenant_id,
     completed_steps:entry.draft.index,total_steps:onboarding.FIELDS.length,
     next_field:r.next?.id||null,next_question:r.next_question,
     missing_required:[...r.missing_required],
     missing_optional:[...r.missing_optional],
     duplicate_ignored:duplicateIgnored,
     can_publish:false,
     knowledge_published:false,
     database_writes:0,provider_sends:0,model_calls:0,
     mode:'OFFLINE_SYNTHETIC_ONLY'
   });
 }
 return Object.freeze({
   async open(input){
     const context=await authenticate(input);purge();
     if(sessions.size>=maxSessions)fail('OFFLINE_SESSION_CAP_REACHED',429);
     const id=randomUUID();
     const entry={
       id,actor_id:context.user_id,store_id:context.store_id,
       tenant_id:context.tenant_id,
       expires_at_ms:Math.min(context.session_expires_at_ms,now()+ttlMs),
       draft:onboarding.start(context)
     };
     sessions.set(id,entry);
     return response(entry);
   },
   async submit(input={}){
     const context=await authenticate(input);
     const entry=lookup(input.session_id,context);
     // Existing frozen onboarding reducer enforces field sequence + replay turn ID.
     const next=onboarding.step(entry.draft,{
       field_id:input.field_id,value:input.value,
       turn_id:input.turn_id,skip:input.skip===true
     });
     const duplicateIgnored=next.duplicate_ignored===true;
     if(!duplicateIgnored)entry.draft=next;
     return response(entry,duplicateIgnored);
   },
   async review(input={}){
     const context=await authenticate(input);
     return response(lookup(input.session_id,context));
   },
   async exportUnverifiedDraft(input={}){
     const context=await authenticate(input);
     const entry=lookup(input.session_id,context);
     const result=onboarding.exportDraft(context,entry.draft);
     // Returned artifact is a human-review proposal, not a Knowledge release.
     return Object.freeze({...result,
       session_id:entry.id,publication_allowed:false,
       send_allowed:false,persistence_mode:'NONE'});
   },
   async discard(input={}){
     const context=await authenticate(input);
     lookup(input.session_id,context);
     sessions.delete(input.session_id);
     return Object.freeze({status:'DISCARDED_LOCALLY',database_writes:0,
       provider_sends:0,publication_allowed:false});
   },
   inspection(){
     // Never expose session contents, tenant/store identifiers, token or PII.
     purge();
     return Object.freeze({mode:'OFFLINE_SYNTHETIC_ONLY',
       active_draft_count:sessions.size,
       persistent_draft_count:0,can_deploy:false,can_publish:false,
       requires_canonical_store_schema:true,
       requires_verified_hosted_rls:true,requires_reviewed_restore:true});
   }
 });
}
module.exports={createOfflineOnboardingService,DEFAULT_TTL_MS};
