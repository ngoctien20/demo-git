'use strict';
/**
 * TIEN404 V15.2 ADV.6C-RPC.4: SYNTHETIC, NON-EXECUTABLE
 * one-time signed RPC privilege-change intent.
 *
 * Signature validity only means that an independently enrolled key signed
 * metadata. It is NOT proof of the real actor's authority, the truth of
 * private evidence, or permission to perform a database operation. Only a
 * separately approved, audited external operator may make that decision.
 * This module does not connect to Supabase/n8n/Cloudflare or read credentials.
 */
const crypto=require('node:crypto');
const CONTRACT='T404_RPC4_PRIVATE_REVOKE_INTENT_V1';
const PROJECT='ifxlvrhyjhbzbrkdsida';
const PARENT='7300d9e6feaaf9d8601721bd544d73c1d36f80a0';
const TARGET='public.qa_shop_b_zalo_claim(uuid,text,text,text)';
const OPERATION='REQUEST_REVOKE_EXECUTE_FROM_PUBLIC_AND_ANON_ONLY';
const ROLES=Object.freeze(['CONTROLLER','SECURITY_REVIEWER','DB_OPERATOR']);
const DOMAINS=Object.freeze([
 'N8N_PUBLISHED_AND_DRAFT',
 'CLOUDFLARE_WORKERS_AND_ROUTES',
 'SUPABASE_EDGE_AND_POSTGREST_LOGS',
 'EXTERNAL_MANUAL_OPERATOR_SCRIPTS',
 'THIRD_PARTY_API_CONSUMERS',
 'BACKUP_RESTORE_JWT_AND_CANARY_PROOFS'
]);
const exact=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
 Object.getPrototypeOf(o)===Object.prototype&&Object.keys(o).length===keys.length&&
 keys.every(k=>Object.hasOwn(o,k));
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const ref=x=>typeof x==='string'&&/^EV-[A-Z0-9]{12,32}$/.test(x);
const die=code=>{let e=new Error(code);e.code=code;throw e};
const signBytes=(role,p)=>Buffer.from('TIEN404:RPC4:REVOKE-INTENT:V1:'+role+':'+JSON.stringify(p),'utf8');
function createPrivateRevocationIntake({mode,trustAnchors,nonceLedger,clock=()=>Date.now()}={}){
 if(mode!=='SYNTHETIC_NO_SEND'||!Array.isArray(trustAnchors)||
  trustAnchors.length!==ROLES.length||typeof nonceLedger?.claimOnce!=='function'||
  typeof clock!=='function')die('RPC4_TRUST_ANCHOR_AND_LEDGER_REQUIRED');
 const trusted=new Map(),actors=new Set(),roleSeen=new Set();
 for(const k of trustAnchors){
  if(!exact(k,['role','keyId','actorDigest','publicKey'])||
   !ROLES.includes(k.role)||!ref(k.keyId)||!hash(k.actorDigest)||
   !(k.publicKey instanceof crypto.KeyObject)||
   k.publicKey.type!=='public'||k.publicKey.asymmetricKeyType!=='ed25519'||
   trusted.has(k.keyId)||roleSeen.has(k.role)||actors.has(k.actorDigest))
   die('RPC4_INVALID_INDEPENDENT_TRUST_ENROLLMENT');
  trusted.set(k.keyId,k);actors.add(k.actorDigest);roleSeen.add(k.role);
 }
 if(ROLES.some(r=>!roleSeen.has(r)))die('RPC4_INVALID_INDEPENDENT_TRUST_ENROLLMENT');
 async function inspect(packet){
  if(!exact(packet,['payload','signatures']))die('RPC4_PACKET_SCHEMA_DENIED');
  const p=packet.payload;
  if(!exact(p,['contract','projectRef','parentSha','operation','targetFunction',
    'grantees','nonceHex','issuedAtMs','expiresAtMs','scope','evidence',
    'controllerDecision'])||
    p.contract!==CONTRACT||p.projectRef!==PROJECT||p.parentSha!==PARENT||
    p.operation!==OPERATION||p.targetFunction!==TARGET||
    !Array.isArray(p.grantees)||p.grantees.length!==2||
    p.grantees[0]!=='PUBLIC'||p.grantees[1]!=='anon'||
    p.scope!=='PRIVATE_DRAFT_REVIEW_ONLY_NO_EXECUTION'||
    p.controllerDecision!=='REQUEST_SEPARATE_OPERATION_APPROVAL'||
    !hash(p.nonceHex))die('RPC4_SCOPE_OR_TARGET_DENIED');
  const now=clock();
  if(!Number.isSafeInteger(now)||!Number.isSafeInteger(p.issuedAtMs)||
    !Number.isSafeInteger(p.expiresAtMs)||p.issuedAtMs>now+10000||
    p.expiresAtMs<=now||p.expiresAtMs<=p.issuedAtMs||
    p.expiresAtMs-p.issuedAtMs>300000)
    die('RPC4_ONE_TIME_TTL_INVALID');
  if(!Array.isArray(p.evidence)||p.evidence.length!==DOMAINS.length)
    die('RPC4_PRIVATE_EVIDENCE_INCOMPLETE');
  const domains=new Set(),refs=new Set();
  for(const e of p.evidence){
   if(!exact(e,['domain','ref','sha256','independentlyInspected',
       'observationCertified'])||
    !DOMAINS.includes(e.domain)||!ref(e.ref)||!hash(e.sha256)||
    typeof e.independentlyInspected!=='boolean'||
    typeof e.observationCertified!=='boolean'||
    domains.has(e.domain)||refs.has(e.ref))
    die('RPC4_EVIDENCE_SCHEMA_DENIED');
   domains.add(e.domain);refs.add(e.ref);
  }
  if(DOMAINS.some(x=>!domains.has(x)))die('RPC4_PRIVATE_EVIDENCE_INCOMPLETE');
  if(!Array.isArray(packet.signatures)||packet.signatures.length!==ROLES.length)
    die('RPC4_THREE_SIGNERS_REQUIRED');
  const sigRoles=new Set(),sigActors=new Set();
  for(const s of packet.signatures){
   if(!exact(s,['role','keyId','actorDigest','signatureBase64Url'])||
    !ROLES.includes(s.role)||!ref(s.keyId)||!hash(s.actorDigest)||
    typeof s.signatureBase64Url!=='string'||!/^[A-Za-z0-9_-]{80,100}$/.test(s.signatureBase64Url)||
    sigRoles.has(s.role)||sigActors.has(s.actorDigest))
    die('RPC4_DUPLICATE_OR_MALFORMED_SIGNER');
   const k=trusted.get(s.keyId);
   if(!k||k.role!==s.role||k.actorDigest!==s.actorDigest)
    die('RPC4_UNENROLLED_SIGNER_DENIED');
   const buf=Buffer.from(s.signatureBase64Url,'base64url');
   if(buf.length!==64||buf.toString('base64url')!==s.signatureBase64Url||
    !crypto.verify(null,signBytes(s.role,p),k.publicKey,buf))
    die('RPC4_DETACHED_SIGNATURE_INVALID');
   sigRoles.add(s.role);sigActors.add(s.actorDigest);
  }
  if(ROLES.some(r=>!sigRoles.has(r)))die('RPC4_THREE_SIGNERS_REQUIRED');
  const nonceDigest=crypto.createHash('sha256')
   .update('TIEN404:RPC4:ONLY_OFFLINE:'+p.nonceHex).digest('hex');
  if(await nonceLedger.claimOnce(nonceDigest,p.expiresAtMs)!==true)
   die('RPC4_SIGNED_INTENT_REPLAY_OR_LEDGER_FAILED');
  const declaredGaps=p.evidence
   .filter(x=>!x.independentlyInspected||!x.observationCertified)
   .map(x=>x.domain);
  return Object.freeze({
   contract:CONTRACT,
   status:'THREE_SIGNED_INTENTS_REVIEW_ONLY_NOT_AUTHORIZATION',
   targetFunction:TARGET,roleCount:ROLES.length,evidenceRefCount:DOMAINS.length,
   selfDeclaredEvidenceGaps:Object.freeze(declaredGaps),
   realRoleEnrollmentVerified:false,underlyingEvidenceIndependentlyVerified:false,
   externallyApprovedChangeWindow:false,durableProductionNonceVerified:false,
   controllerConsentForRealRevokeVerified:false,privilegeChanged:false,
   revokeAllowed:false,backupAllowed:false,publishAllowed:false,
   rollbackExecuted:false,hostedWrites:0,realProviderSends:0
  });
 }
 return Object.freeze({inspect,
  revoke(){die('RPC4_REAL_REVOKE_REQUIRES_EXTERNAL_APPROVAL')},
  issueAuthority(){die('RPC4_AUTHORITY_NOT_IN_THIS_MODULE')},
  sql(){die('RPC4_ARBITRARY_SQL_DISABLED')}
 });
}
function evaluateHostedReadiness(baseline={}){
 const b=baseline!==null&&typeof baseline==='object'&&!Array.isArray(baseline)?baseline:{};
 const reasons=[];
 const require=(ok,reason)=>{if(!ok)reasons.push(reason)};
 require(b.contract==='T404_RPC3_HOSTED_READONLY_BASELINE_V1'||
   b.contract==='T404_ADV6C_RPC3_HOSTED_READONLY_BASELINE_V1',
   'CURRENT_SIGNED_BASELINE_SOURCE_UNVERIFIED');
 require(b.supabase_project===PROJECT,'WRONG_HOSTED_PROJECT');
 require(b.supabase_rpc?.anon_execute===false,'ANON_RPC_STILL_PUBLIC');
 require(b.caller_chain?.external_callers_independently_certified===true,
   'EXTERNAL_CALLER_OBSERVATION_INCOMPLETE');
 require(b.hosted_two_step?.public_stores_table_exists===true&&
   b.hosted_two_step?.public_store_memberships_table_exists===true,
   'STORE_SCHEMA_AND_OWNER_AUTH_MISSING');
 require(b.hosted_two_step?.authenticated_real_owner_a_jwt_proof===true&&
   b.hosted_two_step?.authenticated_real_owner_b_jwt_proof===true&&
   b.hosted_two_step?.same_tenant_cross_store_denial_proof===true&&
   b.hosted_two_step?.active_jwt_session_revocation_proof===true,
   'HOSTED_REAL_JWT_RLS_NEGATIVE_TEST_MISSING');
 require(b.hosted_two_step?.claim_call_executed_on_hosted===true&&
   b.hosted_two_step?.confirm_call_executed_on_hosted===true,
   'HOSTED_TWO_STEP_PAIRING_NOT_CERTIFIED');
 require(b.backup?.encrypted_backup_export_verified===true&&
   b.backup?.independent_restore_verified===true,
   'BACKUP_AND_INDEPENDENT_RESTORE_MISSING');
 require(b.migration?.no_double_writer_real_canary===true&&
   b.migration?.rollback_drill_verified===true,
   'LIVE_SINGLE_WRITER_AND_ROLLBACK_UNVERIFIED');
 return Object.freeze({
  status:reasons.length?'NO_GO':'PENDING_INDEPENDENT_HOSTED_CERTIFICATION',
  blockers:Object.freeze(reasons),
  currentHostDataOnly:true,
  canRevoke:false,canChangeRls:false,canPublish:false,canExportBackup:false,
  verifiedExternalSignedAuthority:false,hostedWrites:0
 });
}
module.exports=Object.freeze({
 CONTRACT,PROJECT,PARENT,TARGET,OPERATION,ROLES,DOMAINS,
 createPrivateRevocationIntake,evaluateHostedReadiness
});