/**
 * V18.3.6P — offline Auth/Store transaction attestation transcript validator.
 * A synthetic Ed25519-signed receipt proves integrity of TEST FIXTURE BYTES,
 * NOT a real SQL commit, GoTrue session state or production owner authority.
 */
import {verify,createPublicKey,createHash} from 'node:crypto';
const HEX=/^[a-f0-9]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const STEPS=Object.freeze([
 'SESSION_AUTHORITY_CHECK',
 'SESSION_ROW_LOCK',
 'STORE_MEMBERSHIP_LOCK',
 'CATALOG_RESOURCE_LOCK',
 'NONCE_CONSUME',
 'TRANSACTION_COMMIT'
]);
export const canonicalAttestation=(x)=>JSON.stringify({
 protocol:'TIEN404_P_SYNTHETIC_TX_ATTEST_V1',
 source:x.source,
 database:x.database,
 transactionId:x.transactionId,
 jti:x.jti,
 issuer:x.issuer,
 capability:x.capability,
 sessionHash:x.sessionHash,
 subjectHash:x.subjectHash,
 tenantHash:x.tenantHash,
 storeHash:x.storeHash,
 resourceHash:x.resourceHash,
 membershipRevision:x.membershipRevision,
 nonceResult:x.nonceResult,
 authDecision:x.authDecision,
 storeDecision:x.storeDecision,
 resourceDecision:x.resourceDecision,
 transactionDecision:x.transactionDecision,
 startedAt:x.startedAt,
 committedAt:x.committedAt,
 steps:x.steps
});
const response=(status,findings,digest)=>Object.freeze({
 status,
 findings:Object.freeze([...new Set(findings)]),
 syntheticReceiptDigest:digest||null,
 syntheticBytesIntegrityVerified:status==='SYNTHETIC_BYTES_VERIFIED',
 actualPostgresTransactionVerified:false,
 actualGoTrueSessionVerified:false,
 actualOwnerABVerified:false,
 durableNonceLedgerVerified:false,
 productionPermission:false,
});
export function verifySyntheticTransactionAttestation(receipt,proof,publicFixtureKey,{seenJti}={}){
 const r=receipt&&typeof receipt==='object'&&!Array.isArray(receipt)?receipt:{};
 const errors=[];
 if(r.protocol!=='TIEN404_P_SYNTHETIC_TX_ATTEST_V1'||
    r.source!=='SYNTHETIC_OFFLINE_PG17_MODEL'||r.database!=='tien404_v1836m_disposable')
   errors.push('SYNTHETIC_PROVENANCE_ONLY');
 if(!UUID.test(r.transactionId||'')||!UUID.test(r.jti||''))
   errors.push('TX_ID_AND_JTI_REQUIRED');
 for(const k of ['sessionHash','subjectHash','tenantHash','storeHash','resourceHash'])
   if(!HEX.test(r[k]||''))errors.push('INVALID_'+k);
 if(r.issuer!=='tien404-synthetic-authority'||r.capability!=='CATALOG_READ')
   errors.push('UNAUTHORIZED_OPERATION');
 if(!Number.isInteger(r.membershipRevision)||r.membershipRevision<1)
   errors.push('STORE_REVISION_REQUIRED');
 if(r.authDecision!=='ACTIVE'||r.storeDecision!=='ACTIVE'||
    r.resourceDecision!=='OWNED_BY_STORE'||r.nonceResult!=='FIRST_CONSUME'||
    r.transactionDecision!=='COMMIT')
   errors.push('AUTH_STORE_NONCE_OR_COMMIT_UNVERIFIED');
 if(!Number.isSafeInteger(r.startedAt)||!Number.isSafeInteger(r.committedAt)||
    r.startedAt>r.committedAt||r.committedAt-r.startedAt>60)
   errors.push('TRANSACTION_CLOCK_INVALID');
 if(!Array.isArray(r.steps)||r.steps.length!==STEPS.length||
    r.steps.some((x,i)=>x?.action!==STEPS[i]||x?.transactionId!==r.transactionId||
      !Number.isSafeInteger(x?.occurredAt)||x.occurredAt<r.startedAt||
      x.occurredAt>r.committedAt||(i>0&&x.occurredAt<r.steps[i-1].occurredAt)))
   errors.push('SINGLE_TRANSACTION_LOCK_ORDER_INVALID');
 if(seenJti instanceof Set&&seenJti.has(r.jti))
   errors.push('LOCAL_FIXTURE_REPLAY_DETECTED');
 if(!proof||proof.alg!=='Ed25519'||typeof proof.signature!=='string'||
    !/^[a-f0-9]{128}$/.test(proof.signature))
   errors.push('SIGNATURE_FORMAT_INVALID');
 let signed=false;
 try{
  signed=verify(null,Buffer.from(canonicalAttestation(r)),
    createPublicKey(publicFixtureKey),Buffer.from(proof.signature,'hex'));
 }catch{signed=false;}
 if(!signed)errors.push('SYNTHETIC_ATTESTATION_SIGNATURE_INVALID');
 const digest=createHash('sha256').update(canonicalAttestation(r)).digest('hex');
 return response(errors.length?'BLOCKED_SYNTHETIC_ATTESTATION':'SYNTHETIC_BYTES_VERIFIED',errors,digest);
}
export function describeTransactionAttestationBoundary(){
 return Object.freeze({
  steps:STEPS,
  baselineDisposablePg17Evidence:'V18.3.6M GitHub Actions #44505388890 (327/327 plus 4 races)',
  actualGoTrueDeleteRaceNotVerified:true,
  realAuthSessionsNeverRead:true,
  privilegeBodyReviewNotAuthorized:true,
  signatureIsOnlyTestFixtureIntegrity:true,
  productionAdmitted:false,
 });
}
