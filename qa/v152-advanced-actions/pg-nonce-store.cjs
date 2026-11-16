'use strict';
/*
 * V15.2-ADV.6 — Parameterized PostgreSQL nonce-claim adapter (NOT DEPLOYED).
 * Requires injected privileged server DB query and separately approved
 * private-schema migration. No DB connection or network created here.
 * Atomicity is backed by PG PRIMARY KEY + INSERT ON CONFLICT DO NOTHING.
 */
const VERSION='T404_PG_NONCE_CLAIM_V1';
const CLAIM_SQL=[
 'INSERT INTO tien404_action_private.action_nonce_claims',
 '  (nonce_key_hash, retain_until)',
 'SELECT decode($1::text, \'hex\'),',
 '       to_timestamp($2::double precision / 1000.0)',
 'WHERE to_timestamp($2::double precision / 1000.0) > clock_timestamp()',
 'ON CONFLICT (nonce_key_hash) DO NOTHING',
 'RETURNING nonce_key_hash'
].join('\n');
const fail=r=>{throw Error(r)};
function createPgNonceStore({query,clock=()=>Date.now()}={}){
 if(typeof query!=='function'||typeof clock!=='function')
   fail('PRIVATE_PG_DB_ADAPTER_REQUIRED');
 async function claimOnce(key,expiresAt){
   if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key)||
     !Number.isSafeInteger(expiresAt))fail('NONCE_CLAIM_INVALID');
   const now=clock();
   if(!Number.isSafeInteger(now)||now<0||expiresAt<=now||expiresAt-now>15*60*1000)
     fail('NONCE_RETENTION_INVALID');
   const result=await query(CLAIM_SQL,[key,expiresAt]);
   if(!result||!Number.isInteger(result.rowCount)||
      !Array.isArray(result.rows)||result.rowCount!==result.rows.length||
      ![0,1].includes(result.rowCount))fail('NONCE_DB_RESULT_UNTRUSTED');
   return result.rowCount===1;
 }
 return Object.freeze({VERSION,claimOnce,backend:'PRIVATE_POSTGRES_SQL_DRAFT_ONLY',
   durableQaCertified:false,readyForProduction:false});
}
module.exports=Object.freeze({VERSION,CLAIM_SQL,createPgNonceStore});