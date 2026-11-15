'use strict';
/**
 * PostgreSQL repository adapter. IMPLEMENTED SOURCE, NOT HOSTED:
 * requires approved Store/Knowledge schema and server-side SQL connection.
 * Requires injected query(text, parameters) returning { rows: [] }.
 * For service-role connections RLS may be bypassed, so every query must scope
 * by tenant+store and authenticated assignment; never trust client role claims.
 */
const {AccessError}=require('./store-boundary.cjs');
const err=(code)=>{throw new AccessError(code,503)};
const membershipSQL=[
 'SELECT sm.tenant_id::text, sm.store_id::text, sm.user_id::text,',
 'sm.role, sm.active, sm.staff_store_assignment_active,',
 'tm.active AS tenant_membership_active',
 'FROM public.store_memberships sm',
 'JOIN public.stores s ON s.id=sm.store_id',
 'AND s.tenant_id=sm.tenant_id AND s.status IN (\'active\',\'setup\')',
 'JOIN public.tenant_memberships tm ON tm.tenant_id=sm.tenant_id',
 'AND tm.user_id=sm.user_id',
 'WHERE sm.user_id=$1::uuid AND sm.store_id=$2::uuid',
 'AND sm.active AND tm.active',
 'LIMIT 1'
].join(' ');
const knowledgeSQL=[
 'SELECT r.tenant_id::text AS tenant_id, r.store_id::text AS store_id,',
 'r.version, r.state, r.revision,',
 'COALESCE(jsonb_agg(jsonb_build_object(',
 "'entry_id',i.id::text,",
 "'tenant_id',i.tenant_id::text,'store_id',i.store_id::text,",
 "'type',lower(i.item_type),'topic',i.topic,'question',i.question,",
 "'value',i.value,'visibility',i.visibility,'state',r.state,",
 "'version',r.version,'source_ref',i.source_ref,",
 "'source_status',i.source_status,'merchant_approved',i.merchant_approved,",
 "'effective_at_ms',extract(epoch FROM i.effective_at)*1000,",
 "'expires_at_ms',CASE WHEN i.expires_at IS NULL THEN NULL",
 'ELSE extract(epoch FROM i.expires_at)*1000 END',
 ")) FILTER (WHERE i.id IS NOT NULL), '[]'::jsonb) AS entries",
 'FROM app_private.shop_knowledge_releases r',
 'LEFT JOIN app_private.shop_knowledge_items i',
 'ON i.release_id=r.id AND i.tenant_id=r.tenant_id AND i.store_id=r.store_id',
 "AND i.visibility='PUBLIC'",
 "AND i.source_status='VERIFIED' AND i.merchant_approved",
 'AND i.effective_at <= now() AND (i.expires_at IS NULL OR i.expires_at>now())',
 'WHERE r.tenant_id=$1::uuid AND r.store_id=$2::uuid',
 "AND r.state='PUBLISHED' AND r.merchant_approved_by IS NOT NULL",
 'AND r.reviewed_by IS NOT NULL AND r.published_by IS NOT NULL',
 'GROUP BY r.id,r.tenant_id,r.store_id,r.version,r.state,r.revision',
 'LIMIT 1'
].join(' ');
function createPostgresKnowledgeRepository({query}={}){
 if(typeof query!=='function')err('SQL_QUERY_ADAPTER_MISSING');
 return Object.freeze({
  async lookupStoreAssignment({user_id,store_id}={}){
   if(typeof user_id!=='string'||typeof store_id!=='string')err('IDENTITY_PARAMETERS_MISSING');
   const data=await query(membershipSQL,[user_id,store_id]);
   if(!data||!Array.isArray(data.rows)||data.rows.length>1)err('ASSIGNMENT_QUERY_FAILED');
   const r=data.rows[0];return r?{
    source:'AUTHORITATIVE_DATABASE',user_id:r.user_id,store_id:r.store_id,
    tenant_id:r.tenant_id,role:r.role,active:r.active===true,
    tenant_membership_active:r.tenant_membership_active===true,
    store_staff_assignment_active:r.staff_store_assignment_active===true
   }:null;
  },
  async readPublishedKnowledge({tenant_id,store_id,role}={}){
   if(typeof tenant_id!=='string'||typeof store_id!=='string'||
      role!=='CUSTOMER_PUBLIC_READ')err('KNOWLEDGE_READ_SCOPE_INVALID');
   const data=await query(knowledgeSQL,[tenant_id,store_id]);
   if(!data||!Array.isArray(data.rows)||data.rows.length>1)err('KNOWLEDGE_QUERY_FAILED');
   const r=data.rows[0];
   return r?{
     source:'AUTHORITATIVE_DATABASE',tenant_id:r.tenant_id,store_id:r.store_id,
     version:r.version,state:r.state,revision:r.revision,entries:r.entries
   }:null;
  },
  // NO write methods. Draft persistence requires a separately authorized API.
 });
}
module.exports={createPostgresKnowledgeRepository,membershipSQL,knowledgeSQL};
