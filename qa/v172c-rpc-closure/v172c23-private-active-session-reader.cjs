'use strict';
// V17.2C.23 — PRIVILEGED SERVER READ-ONLY auth.sessions lookup.
// Inject a private Postgres client with *minimal* scoped read privileges.
// Never expose this to a browser or use session row as consent evidence.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function createActiveSessionReader({query}={}){
 if(typeof query!=='function') throw Error('MISSING_PRIVATE_SESSION_READER');
 return async function checkActiveSession({sessionId,subjectRef}={}){
  if(typeof sessionId!=='string'||!uuid.test(sessionId)||
     typeof subjectRef!=='string'||!uuid.test(subjectRef))
   return {active:false};
  try{
   const result=await query(
    'SELECT id::text AS id, user_id::text AS user_id FROM auth.sessions WHERE id=$1::uuid AND user_id=$2::uuid AND (not_after IS NULL OR not_after > NOW()) LIMIT 1',
    [sessionId,subjectRef]
   );
   if(!result||!Array.isArray(result.rows)||result.rows.length!==1||
      result.rows[0].id!==sessionId||result.rows[0].user_id!==subjectRef)
    return {active:false};
   return {active:true,sessionId,subjectRef,revoked:false};
  }catch{return {active:false};}
 };
}
module.exports={createActiveSessionReader};
