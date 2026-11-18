// TIEN404 V19.0-B7-H0 — planning only.
// NO runtime / account authorization. An apparently complete form is NOT owner
// approval, a Cloudflare Access identity check or permission to deploy.
const REQUIRED=[
 "cloudflareAccountRef","newQaWorkerName","disposableD1Ref",
 "privateCallerService","operatorAllowlistRef","signedApprovalEvidenceRef",
 "securityReviewerRef","exactGitCommitSha","beforeStateEvidenceRef",
 "rollbackPlanRef","testWindowStart","testWindowEnd","maxSyntheticRequests",
 "maxSyntheticRows","maxBudgetRef"
];
const NAME=/^[a-z0-9][a-z0-9._-]{5,90}$/;
const SHA=/^[0-9a-f]{40}$/;
export function assessB7HostedApproval(input={}){
 const x=(input&&typeof input==="object"&&!Array.isArray(input))?input:{};
 const missing=REQUIRED.filter(key=>x[key]===undefined||x[key]===null||
  (typeof x[key]==="string"&&x[key].trim()===""));
 const invalid=[];
 for(const k of REQUIRED.filter(key=>!missing.includes(key))){
  if(k==="exactGitCommitSha"&&!SHA.test(x[k])) invalid.push(k);
  else if(k==="maxSyntheticRequests"&&(!Number.isInteger(x[k])||x[k]<1||x[k]>20)) invalid.push(k);
  else if(k==="maxSyntheticRows"&&(!Number.isInteger(x[k])||x[k]<1||x[k]>5)) invalid.push(k);
  else if(["testWindowStart","testWindowEnd"].includes(k)&&
   (typeof x[k]!=="string"||Number.isNaN(Date.parse(x[k])))) invalid.push(k);
  else if(!["exactGitCommitSha","maxSyntheticRequests","maxSyntheticRows",
   "testWindowStart","testWindowEnd"].includes(k)&&
   (typeof x[k]!=="string"||!NAME.test(x[k]))) invalid.push(k);
 }
 if(missing.length===0 && !invalid.includes("testWindowStart")&&
  !invalid.includes("testWindowEnd")){
  const start=Date.parse(x.testWindowStart),end=Date.parse(x.testWindowEnd);
  if(end<=start||end-start>30*60*1000)invalid.push("boundedTestWindow");
 }
 for(const [flag,want] of [
  ["productionEnabled",false],["providerSendEnabled",false],
  ["orderWriteEnabled",false],["publicWorkersDevEnabled",false],
  ["previewUrlsEnabled",false],["webhookRegistrationEnabled",false]
 ]){
  if(x[flag]!==want)invalid.push(flag);
 }
 return Object.freeze({
  stage:"V19_B7_H0_HOSTED_APPROVAL_PREFLIGHT",
  result:"BLOCKED_NO_HOSTED_DEPLOY_PERMISSION",
  missing:Object.freeze(missing),
  invalid:Object.freeze([...new Set(invalid)]),
  readyForHumanReview:missing.length===0&&invalid.length===0,
  exactOwnerApprovalVerified:false,
  cloudflareAccessJwtVerified:false,
  serviceCallerAuthorityVerified:false,
  privateHostedWorkerBindingTested:false,
  storeAuthorityVerified:false,
  productionAllowed:false,
  deployAllowed:false,
  providerSendAllowed:false,
  orderWriteAllowed:false
 });
}
export default {fetch(){return new Response(null,{status:423});}};
