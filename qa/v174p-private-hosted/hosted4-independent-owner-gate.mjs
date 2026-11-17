/**
 * TIEN404 V17.4P-HOSTED.4: read-only, dual-signed authorization + Cloudflare
 * deployment-isolation preflight. Never deploys, updates a policy or exposes credentials.
 *
 * NOTE: Trust anchors must be provisioned OUTSIDE GitHub and independently tied to
 * actual owner/security humans. Passing unverified keys cannot create real authority.
 */
import {createPublicKey,verify as verifySignature} from 'node:crypto';

export const CONTRACT='T404_V174P_HOSTED4_DUAL_SIGNED_ISOLATED_NO_DEPLOY_V1';
export const WORKER='tien404-v174p-private-qa-issuer';
export const ACCOUNT='ac01685529c0a31fc185335f07648edf';
export const REPLAY_CLASS='V174PReplayGuard';
export const MAX_REQUESTS=96;
const REQUIRED_RESOURCES=Object.freeze([
 'dedicated_qa_worker','sqlite_durable_object','worker_access_all_traffic',
 'reusable_operator_allow_policy','managed_session_key','managed_access_jwks',
 'dedicated_qa_host'
]);
const LOCKED_NAMESPACES=Object.freeze([
 'tien404-v175e2-durable-replay-nosend-staging_ReplayBucket',
 'tien404-v175e2a-private-hosted-runner-nosend-staging_RunnerResults'
]);
const LOCKED_SCRIPTS=Object.freeze([
 'tien404-v175e1-private-issuer-nosend-staging',
 'tien404-v175e2-ab-gateway-nosend-staging',
 'tien404-v175e2-durable-replay-nosend-staging',
 'tien404-v175e2-installation-registry-nosend-staging',
 'tien404-v175e2a-private-hosted-runner-nosend-staging'
]);
const VALID_KEYS=Object.freeze([
 'contract','account_id','target_worker','replay_class','phase','scope',
 'source_sha','qa_origin','operator_emails','resources','max_http_requests',
 'max_spend_usd','allow_account_wide_spend_limit_change',
 'allow_real_data','allow_commerce_writes','allow_provider_send',
 'issued_at','expires_at'
].sort());
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const keys=x=>isObj(x)?Object.keys(x).sort():[];
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function canonical(x){
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 if(isObj(x))return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
 return JSON.stringify(x);
}
function safeOrigin(raw){
 try{
  const u=new URL(raw);
  return u.protocol==='https:'&&u.pathname==='/'&&!u.port&&!u.username&&!u.password&&
  !u.search&&!u.hash&&!u.hostname.includes('*')&&
  !['localhost','127.0.0.1','ngoctien20.io.vn'].includes(u.hostname)&&
  !u.hostname.endsWith('.pages.dev')&&!u.hostname.endsWith('.invalid')&&
  /^[a-z0-9.-]{6,180}$/.test(u.hostname)&&raw===u.origin+'/';
 }catch{return false;}
}
function normalizeList(items){
 return Array.isArray(items)?items.map(x=>String(x||'')):[];
}
function verifyEd25519(payload,signature,trust){
 try{
  if(!isObj(signature)||typeof signature.kid!=='string'||!isObj(trust)||
    trust.kid!==signature.kid||typeof trust.public_key_spki_pem!=='string')return false;
  const sig=signature.signature;
  if(typeof sig!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(sig))return false;
  const value=Buffer.from(sig.replace(/-/g,'+').replace(/_/g,'/'),'base64');
  if(value.length!==64)return false;
  const key=createPublicKey(trust.public_key_spki_pem);
  if(key.asymmetricKeyType!=='ed25519')return false;
  return verifySignature(null,Buffer.from('TIEN404_V174P_HOSTED4_OWNER_GATE\n'+canonical(payload)),key,value);
 }catch{return false;}
}
export function assessIndependentAuthorization(payload,signatures,trust,inventory,review,now=Date.now()){
 const reasons=[];
 const check=(id,yes)=>{if(yes!==true)reasons.push(id);};
 const a=isObj(payload)?payload:{},s=isObj(signatures)?signatures:{};
 const t=isObj(trust)?trust:{},v=isObj(inventory)?inventory:{},r=isObj(review)?review:{};
 check('exact_signed_contract_fields',equal(keys(a),VALID_KEYS));
 check('exact_contract_version',a.contract===CONTRACT);
 check('isolated_target_account',a.account_id===ACCOUNT);
 check('dedicated_worker_and_class',a.target_worker===WORKER&&a.replay_class===REPLAY_CLASS);
 check('phase_a_only_no_active_route',a.phase==='INACTIVE_UPLOAD_ONLY');
 check('no_send_synthetic_scope',a.scope==='SYNTHETIC_QA_NO_SEND_NO_COMMERCE'&&
    a.allow_real_data===false&&a.allow_commerce_writes===false&&a.allow_provider_send===false);
 check('pinned_source_sha',typeof a.source_sha==='string'&&/^[a-f0-9]{40}$/i.test(a.source_sha)&&
    a.source_sha===r.independently_verified_source_sha);
 check('private_qa_origin',safeOrigin(a.qa_origin));
 check('explicit_operator_emails',Array.isArray(a.operator_emails)&&a.operator_emails.length>=1&&
   a.operator_emails.length<=3&&new Set(a.operator_emails).size===a.operator_emails.length&&
   a.operator_emails.every(e=>typeof e==='string'&&
     /^[a-z0-9][a-z0-9.+_-]*@[a-z0-9.-]+\.[a-z]{2,}$/.test(e)));
 check('strict_resource_scope',equal([...normalizeList(a.resources)].sort(),
   [...REQUIRED_RESOURCES].sort()));
 check('bounded_http_requests',Number.isSafeInteger(a.max_http_requests)&&
   a.max_http_requests>0&&a.max_http_requests<=MAX_REQUESTS);
 check('explicit_positive_qa_spend',Number.isFinite(a.max_spend_usd)&&a.max_spend_usd>0&&a.max_spend_usd<=25);
 check('no_shared_account_limit_change',a.allow_account_wide_spend_limit_change===false);
 const issued=Date.parse(a.issued_at),expiry=Date.parse(a.expires_at);
 check('short_lived_time_bound',Number.isFinite(issued)&&Number.isFinite(expiry)&&
   Number.isFinite(now)&&issued<=now&&now<expiry&&expiry-issued<=3600000&&
   issued>=now-3600000&&new Date(issued).toISOString()===a.issued_at&&
   new Date(expiry).toISOString()===a.expires_at);
 // No trusted authority can be inferred from any public key in the JSON payload.
 check('external_owner_trust_anchor',t.owner?.role==='owner'&&t.owner?.provisioned_out_of_band===true);
 check('external_security_trust_anchor',t.security?.role==='security_reviewer'&&
   t.security?.provisioned_out_of_band===true);
 check('independent_distinct_signer_keys',!!t.owner?.kid&&!!t.security?.kid&&
   t.owner.kid!==t.security.kid&&
   t.owner.public_key_spki_pem!==t.security.public_key_spki_pem);
 check('owner_ed25519_signature',verifyEd25519(a,s.owner,t.owner));
 check('security_ed25519_signature',verifyEd25519(a,s.security,t.security));
 // Inventory is an explicitly independent read-only API snapshot, NOT a
 // browser value, source fixture or proof of owner permission by itself.
 check('independent_fresh_cloudflare_read_only_inventory',
   v.account_id===ACCOUNT&&r.live_inventory_independently_attested===true&&
   v.source==='CLOUDFLARE_CONTROL_PLANE_READ_ONLY'&&
   Number.isSafeInteger(v.collected_at_ms)&&v.collected_at_ms<=now&&
   now-v.collected_at_ms<=600000);
 const scripts=normalizeList(v.script_names);
 const workers=normalizeList(v.worker_names);
 const namespaces=normalizeList(v.do_namespace_names);
 const apps=normalizeList(v.access_app_names);
 const blocked=[...LOCKED_SCRIPTS,...LOCKED_NAMESPACES];
 check('parallel_v175_resources_preserved',
    blocked.every(x=>(x.endsWith('_ReplayBucket')||x.endsWith('_RunnerResults')?
      namespaces:scripts).includes(x)));
 check('no_target_worker_collision',!scripts.includes(WORKER)&&!workers.includes(WORKER));
 check('no_durable_namespace_collision',!namespaces.some(x=>x.includes(WORKER)||x.includes(REPLAY_CLASS)));
 check('no_access_app_collision',!apps.some(x=>x.includes(WORKER)));
 check('no_shared_qa_data_or_binding',r.verified_no_cross_workstream_bindings===true);
 check('owner_privacy_and_cost_review',r.owner_budget_reviewed_independently===true&&
   r.operator_identity_reviewed_independently===true);
 check('rollback_and_no_route_attestation',r.rollback_plan_reviewed_independently===true&&
   r.no_public_route_attested===true);
 return Object.freeze({
  contract:CONTRACT,
  status:reasons.length?'BLOCKED':'DUAL_SIGNATURES_AND_SOURCE_CONSISTENT_NEEDS_OPERATOR_AUTHORIZATION',
  reasons,required_owner_action:'EXPLICIT_SCOPED_PRIVATE_APPROVAL',
  proposed_phase:'INACTIVE_UPLOAD_ONLY',
  no_cloudflare_changes_made:true,deploy_authorized:false,
  run_real_browser_authorized:false,enable_public_route_authorized:false,
  real_commerce_authorized:false,verified_owner_authority:false
 });
}
export const LOCKED_V175_RESOURCES=Object.freeze({scripts:LOCKED_SCRIPTS,namespaces:LOCKED_NAMESPACES});
