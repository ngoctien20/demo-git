'use strict';
/**
 * TIEN404 RPC10-G0.1 — offline, read-only operator-side alias bridge STRUCTURE guard.
 * Complements (does not duplicate) V17.1 provider ingress and RPC12 private owner evidence.
 *
 * All inputs are UNTRUSTED. It never authenticates human signatures, provider
 * headers, source databases, or JWTs; it cannot authorize hosted reads or writes.
 * It deliberately returns only counts and generic blockers (no IDs/PII).
 */
const CONTRACT='T404_RPC10_G01_ALIAS_BRIDGE_PREFLIGHT_V1';
const PROVIDERS=new Set(['MESSENGER','ZALO_OA','ZALO_BOT','WEBSITE']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const id=x=>typeof x==='string'&&x.length>=3&&x.length<=128&&/^[a-z0-9_-]+$/i.test(x);
const stamp=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&/Z$/.test(x);
const safeArray=x=>Array.isArray(x)&&x.length<=100;
const clean=x=>typeof x==='string'&&UUID.test(x);
const expectedCallers=Object.freeze([
 '5Eeh8hbpsoNhuiVo', // Commerce Tenant Resolver
 'oOOXicKXGkBskKqh', // Commerce Catalog
 'igPOsSbEgd4NgtRA'  // Commerce Cart
]);
function inspectBridge(snapshot,nowIso='2026-11-17T00:00:00.000Z'){
 const blockers=new Set(),deny=x=>blockers.add(x),ts=Date.parse(nowIso);
 if(!Number.isFinite(ts)||!stamp(nowIso))deny('INVALID_OPERATOR_CLOCK');
 if(!isObj(snapshot)||snapshot.contract!==CONTRACT){
  return Object.freeze({contract:CONTRACT,status:'STRUCTURAL_NO_GO',blockers:['INVALID_CONTRACT'],
   canRelease:false,canResolveRealStore:false,canAuthorizeOrderRead:false,canMigrate:false,
   actualAliasProofAuthenticated:false,actualOwnerProofAuthenticated:false});
 }
 if(snapshot.mode!=='SYNTHETIC_OR_PRIVATE_OFFLINE_ONLY')deny('EXTERNAL_SOURCE_NOT_ALLOWED');
 if(!safeArray(snapshot.tenants)||!safeArray(snapshot.stores)||
    !safeArray(snapshot.aliases)||!safeArray(snapshot.installations)||
    !safeArray(snapshot.callers))deny('UNBOUNDED_OR_MISSING_COLLECTION');
 const tenants=safeArray(snapshot.tenants)?snapshot.tenants:[],
       stores=safeArray(snapshot.stores)?snapshot.stores:[],
       aliases=safeArray(snapshot.aliases)?snapshot.aliases:[],
       installations=safeArray(snapshot.installations)?snapshot.installations:[],
       callers=safeArray(snapshot.callers)?snapshot.callers:[];
 const tenantIds=new Set(),storeIds=new Set(),aliasKeys=new Set(),aliasesByName=new Map(),installKeys=new Set();
 if(!tenants.length||!stores.length||!aliases.length||!installations.length)deny('CANONICAL_REGISTRY_EMPTY');
 for(const t of tenants){
  if(!isObj(t)||!clean(t.id)||tenantIds.has(t.id))deny('INVALID_OR_DUPLICATE_TENANT');
  else tenantIds.add(t.id);
 }
 for(const s of stores){
  if(!isObj(s)||!clean(s.id)||!clean(s.tenantId)||storeIds.has(s.id)||
     !tenantIds.has(s.tenantId)||s.active!==true)deny('INVALID_STORE_MEMBERSHIP_GRAPH');
  else storeIds.add(s.id);
 }
 for(const a of aliases){
  if(!isObj(a)||!id(a.alias)||aliasKeys.has(a.alias)||!clean(a.canonicalTenantId)||
     !tenantIds.has(a.canonicalTenantId)||a.source!=='INDEPENDENT_PRIVATE_REGISTRY_CLAIM')
    deny('UNKNOWN_AMBIGUOUS_OR_UNREVIEWED_TENANT_ALIAS');
  else{aliasKeys.add(a.alias);aliasesByName.set(a.alias,a.canonicalTenantId);}
 }
 for(const b of installations){
  if(!isObj(b)||!PROVIDERS.has(b.provider)||!id(b.installationRef)||
     !id(b.tenantAlias)||!clean(b.storeId)){
    deny('INVALID_PROVIDER_INSTALLATION');continue;
  }
  const key=b.provider+':'+b.installationRef;
  if(installKeys.has(key))deny('AMBIGUOUS_PROVIDER_INSTALLATION');
  installKeys.add(key);
  const tenantId=aliasesByName.get(b.tenantAlias);
  const store=stores.find(s=>isObj(s)&&s.id===b.storeId);
  if(!tenantId||!store||store.tenantId!==tenantId)deny('CROSS_TENANT_OR_UNKNOWN_STORE_BINDING');
  if(b.enabled!==true||b.revoked===true)deny('DISABLED_OR_REVOKED_INSTALLATION');
  if(!stamp(b.expiresAt)||!Number.isFinite(ts)||Date.parse(b.expiresAt)<=ts)
    deny('EXPIRED_INSTALLATION_BINDING');
  // Claims are structural markers only; no actual evidence is inspected.
  if(b.providerSignatureExternallyVerified!==true||b.ownerAttestationExternallyVerified!==true||
     b.registryVersionPinned!==true)deny('INDEPENDENT_PROVIDER_OR_OWNER_EVIDENCE_MISSING');
 }
 const callerIds=new Set();
 for(const c of callers){
  if(!isObj(c)||!id(c.workflowId)||callerIds.has(c.workflowId)){
   deny('INVALID_OR_DUPLICATE_CALLER');continue;
  }
  callerIds.add(c.workflowId);
  if(c.usesTrustedServerStoreResolver!==true||c.canonicalStoreIdRequired!==true||
     c.staleTenantOnlyPathDisabled!==true||c.authoritativeMembershipRecheck!==true)
   deny('TENANT_ONLY_OR_UNTRUSTED_CALLER');
 }
 for(const workflowId of expectedCallers)if(!callerIds.has(workflowId))deny('REQUIRED_COMMERCE_CALLER_UNREVIEWED');
 // This is a CHECKER, not a binding registry. Even an all-green fixture is not
 // cryptographically or operationally authoritative and cannot be used on hosted.
 const issues=[...blockers].sort();
 return Object.freeze({contract:CONTRACT,
  status:issues.length?'STRUCTURAL_NO_GO':'STRUCTURAL_FIXTURE_READY_FOR_EXTERNAL_EVIDENCE_REVIEW',
  blockers:Object.freeze(issues),
  inputCounts:Object.freeze({tenants:tenants.length,stores:stores.length,
   aliases:aliases.length,installations:installations.length,callers:callers.length}),
  canRelease:false,canResolveRealStore:false,canAuthorizeOrderRead:false,
  canCreateOrder:false,canMigrate:false,canChangeRls:false,canPublish:false,
  actualAliasProofAuthenticated:false,actualOwnerProofAuthenticated:false,
  actualProviderSignatureVerifiedHere:false,actualJwtVerifiedHere:false,
  customerDataDisclosed:false});
}
module.exports=Object.freeze({CONTRACT,expectedCallers,inspectBridge});
if(require.main===module){
 try{
  const fs=require('node:fs'),data=fs.readFileSync(0,'utf8');
  if(data.length>65536)throw Error('INPUT_TOO_LARGE');
  const result=inspectBridge(JSON.parse(data),new Date().toISOString());
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  process.exitCode=result.status==='STRUCTURAL_NO_GO'?3:2;
 }catch(_err){
  process.stderr.write('RPC10_G01_PRIVATE_INPUT_REJECTED_NO_IDENTIFIERS_PRINTED\n');
  process.exitCode=2;
 }
}
