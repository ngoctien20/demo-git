// TIEN404 V19.8.20 — operator-invoked, READ-ONLY Supabase backup inventory.
// No hosted credentials in GitHub Actions. Never print raw API response or token.
// Use only the official GET endpoint for the fixed staging project ref.
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export const STAGING_PROJECT_REF='ifxlvrhyjhbzbrkdsida';
export const API_URL='https://api.supabase.com/v1/projects/'+STAGING_PROJECT_REF+'/database/backups';
const STATUSES=new Set(['COMPLETED','FAILED','PENDING','REMOVED','ARCHIVED','CANCELLED']);
function safeDate(v) {
 if(typeof v!=='string' || v.length>64)return null;
 const n=Date.parse(v);
 return Number.isFinite(n)?new Date(n).toISOString():null;
}
function safeUnix(v){
 return Number.isSafeInteger(v)&&v>0&&v<4102444800?v:null;
}
export function summarizeBackupResponse(payload,observedAt='2026-11-21T00:00:00.000Z') {
 const base={project_ref:STAGING_PROJECT_REF,source:'SUPABASE_BACKUP_API_FORMAT_VALIDATION',
   observed_at:safeDate(observedAt),schema_recognized:false,
   api_listed_backup_count:null,completed_backup_count:null,
   latest_completed_backup_at:null,pitr_enabled:null,walg_enabled:null,
   physical_window_earliest_unix:null,physical_window_latest_unix:null,
   artifact_digest_verified:false,independent_restore_verified:false,
   real_owner_a_b_verified:false,can_restore_or_migrate:false,
   decision:'NO_GO'};
 if(!payload||typeof payload!=='object'||Array.isArray(payload))return Object.freeze(base);
 const p=payload;
 if(typeof p.region!=='string'||p.region.length<3||p.region.length>100
    ||typeof p.pitr_enabled!=='boolean'||typeof p.walg_enabled!=='boolean'
    ||!Array.isArray(p.backups)||!p.physical_backup_data
    ||typeof p.physical_backup_data!=='object'||Array.isArray(p.physical_backup_data)
    ||p.backups.length>1000)return Object.freeze(base);
 const items=p.backups;
 if(items.some(b=>!b||typeof b!=='object'||Array.isArray(b)
     ||!Number.isSafeInteger(b.id)||typeof b.is_physical_backup!=='boolean'
     ||!STATUSES.has(b.status)||safeDate(b.inserted_at)===null))return Object.freeze(base);
 const complete=items.filter(b=>b.status==='COMPLETED');
 const times=complete.map(b=>safeDate(b.inserted_at)).sort();
 return Object.freeze({...base,schema_recognized:true,
   api_listed_backup_count:items.length,
   completed_backup_count:complete.length,
   latest_completed_backup_at:times.length?times[times.length-1]:null,
   pitr_enabled:p.pitr_enabled,
   walg_enabled:p.walg_enabled,
   physical_window_earliest_unix:safeUnix(p.physical_backup_data.earliest_physical_backup_date_unix),
   physical_window_latest_unix:safeUnix(p.physical_backup_data.latest_physical_backup_date_unix)
 });
}
export async function listBackupInventoryReadonly({token,fetchImpl=fetch,observedAt=new Date().toISOString()}={}){
 if(typeof token!=='string'||token.length<12||token.length>8192)
  throw Error('BACKUP_READ_ONLY_TOKEN_REQUIRED');
 const response=await fetchImpl(API_URL,{
  method:'GET',redirect:'error',headers:{Authorization:'Bearer '+token,Accept:'application/json'},
  signal:AbortSignal.timeout(15000)
 });
 if(!response||response.ok!==true)
  throw Error('BACKUP_READ_ONLY_API_STATUS_'+(Number.isInteger(response?.status)?response.status:'UNKNOWN'));
 const raw=await response.json();
 const summary=summarizeBackupResponse(raw,observedAt);
 return Object.freeze({...summary,source:'UNSIGNED_OPERATOR_LOCAL_MANAGEMENT_API_GET'});
}
const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
 try{
  const r=await listBackupInventoryReadonly({token:process.env.SUPABASE_ACCESS_TOKEN});
  console.log(JSON.stringify(r,null,2));
  if(!r.schema_recognized)process.exitCode=2;
 }catch(e){
  // Deliberately no raw error bodies, response URL, credentials or stack.
  const m=String(e?.message||'BACKUP_READ_ONLY_FAILED');
  const match=m.match(/^BACKUP_READ_ONLY_(?:TOKEN_REQUIRED|API_STATUS_\d{3})$/);
  console.error(match?match[0]:'BACKUP_READ_ONLY_UNAVAILABLE');
  process.exitCode=2;
 }
}
