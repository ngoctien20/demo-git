/**
 * TIEN404 V17.4P-HOSTED.4B.3 — isolated LOCAL Workers runtime only.
 *
 * NOT IMPORTED BY HOSTED ISSUER, NEVER DEPLOYED.
 * SQLite Durable Object validates protocol and unique immutable claims.
 * The external authenticated operator gateway MUST authenticate/authorize
 * owner, reviewer, Cloudflare inventory and signed permit BEFORE calling it.
 *
 * No HTTP endpoint is exposed through a public Worker router.
 */
const ACCOUNT='ac01685529c0a31fc185335f07648edf';
const WORKER='tien404-v174p-private-qa-issuer';
const PHASE='FIRST_UPLOAD_INACTIVE_ONLY';
const HEX=/^[a-f0-9]{64}$/;
const allow = x => typeof x==='string' && HEX.test(x);
const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
 'Content-Type':'application/json','Cache-Control':'no-store',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'
}});
export class V174PPermitLedgerLocal{
 constructor(state){
  this.storage=state.storage;
  this.storage.sql.exec(`CREATE TABLE IF NOT EXISTS claims (
    nonce_hash TEXT PRIMARY KEY,
    permit_hash TEXT NOT NULL,
    account_id TEXT NOT NULL,
    worker_name TEXT NOT NULL,
    phase TEXT NOT NULL,
    operator_subject_hash TEXT NOT NULL,
    claimed_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    receipt_id TEXT NOT NULL,
    UNIQUE (account_id,worker_name,phase)
  )`);
 }
 async fetch(request){
  if(new URL(request.url).pathname!=='/private/claim-once'||request.method!=='POST')
   return respond({status:'BLOCKED_METHOD'},405);
  if(request.headers.get('content-type')!=='application/json')return respond({status:'BLOCKED_CONTENT_TYPE'},415);
  const size=Number(request.headers.get('content-length'));
  if(Number.isFinite(size)&&size>1400)return respond({status:'BLOCKED_BODY'},413);
  let b;
  try{
   const raw=await request.text();
   if(raw.length>1400)return respond({status:'BLOCKED_BODY'},413);
   b=JSON.parse(raw);
  }catch{return respond({status:'BLOCKED_JSON'},400);}
  if(!b||typeof b!=='object'||Array.isArray(b)||
     Object.keys(b).sort().join(',')!==[
       'account_id','expires_at','nonce_hash','operator_subject_hash','permit_hash',
       'phase','worker_name'
     ].sort().join(',')||
     b.account_id!==ACCOUNT||b.worker_name!==WORKER||b.phase!==PHASE||
     !allow(b.nonce_hash)||!allow(b.permit_hash)||!allow(b.operator_subject_hash)||
     !Number.isSafeInteger(b.expires_at)||
     b.expires_at<=Date.now()||b.expires_at>Date.now()+15*60_000)
   return respond({status:'BLOCKED_INPUT'},400);
  // SQLite INSERT is an atomic unique-key operation at a single Durable Object.
  // Never release a claimed key, even on failure after this insertion.
  const receipt=crypto.randomUUID();
  try{
   this.storage.sql.exec(`INSERT INTO claims
    (nonce_hash,permit_hash,account_id,worker_name,phase,operator_subject_hash,claimed_at,expires_at,receipt_id)
    VALUES (?,?,?,?,?,?,?,?,?)`,
    b.nonce_hash,b.permit_hash,b.account_id,b.worker_name,b.phase,
    b.operator_subject_hash,Date.now(),b.expires_at,receipt);
  }catch{
   return respond({status:'BLOCKED_REPLAY_OR_LEDGER_UNCERTAIN',claimed:false,
    durable_commit_confirmed:false},409);
  }
  return respond({status:'ONE_TIME_CLAIMED_LOCAL_ONLY',claimed:true,
   durable_commit_confirmed:true,receipt_id:receipt,cloudflare_hosted:false,
   owner_verified:false,upload_authorized:false});
 }
}
