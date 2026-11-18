import test from "node:test";
import assert from "node:assert/strict";
import candidate,{assessB7HostedApproval} from "../hosted-approval-preflight.mjs";
const fixture=()=>({
 cloudflareAccountRef:"qa_account_ref_0001",
 newQaWorkerName:"new-qa-isolated-worker",
 disposableD1Ref:"qa_disposable_d1_ref",
 privateCallerService:"qa-private-service",
 operatorAllowlistRef:"qa_allowlist_ref_001",
 signedApprovalEvidenceRef:"qa_approval_receipt_0001",
 securityReviewerRef:"qa_security_reviewer",
 exactGitCommitSha:"a".repeat(40),
 beforeStateEvidenceRef:"qa_state_snapshot_0001",
 rollbackPlanRef:"qa_rollback_plan_001",
 testWindowStart:"2026-11-20T01:00:00Z",
 testWindowEnd:"2026-11-20T01:20:00Z",
 maxSyntheticRequests:20,maxSyntheticRows:5,
 maxBudgetRef:"qa_budget_ref_001",
 productionEnabled:false,providerSendEnabled:false,orderWriteEnabled:false,
 publicWorkersDevEnabled:false,previewUrlsEnabled:false,
 webhookRegistrationEnabled:false
});
test("default module fetch 423",async()=>assert.equal((await candidate.fetch()).status,423));
test("empty request lists required scope and never grants deployment",()=>{
 const x=assessB7HostedApproval();
 assert.equal(x.readyForHumanReview,false);
 assert.ok(x.missing.length>=12);
 assert.equal(x.deployAllowed,false);
 assert.equal(x.productionAllowed,false);
});
test("fully populated fixture still NOT approved, no hosted claim",()=>{
 const x=assessB7HostedApproval(fixture());
 assert.equal(x.readyForHumanReview,true);
 assert.equal(x.result,"BLOCKED_NO_HOSTED_DEPLOY_PERMISSION");
 for(const k of ["exactOwnerApprovalVerified","cloudflareAccessJwtVerified",
  "serviceCallerAuthorityVerified","privateHostedWorkerBindingTested",
  "storeAuthorityVerified","productionAllowed","deployAllowed","providerSendAllowed",
  "orderWriteAllowed"])assert.equal(x[k],false);
});
for(const k of ["productionEnabled","providerSendEnabled","orderWriteEnabled",
 "publicWorkersDevEnabled","previewUrlsEnabled","webhookRegistrationEnabled"]){
 test("fail closed if "+k+" toggled on",()=>{
  const x=assessB7HostedApproval({...fixture(),[k]:true});
  assert.equal(x.readyForHumanReview,false);
  assert.ok(x.invalid.includes(k));
  assert.equal(x.deployAllowed,false);
 });
}
test("missing rollback plan blocks human readiness",()=>{
 const a=fixture();delete a.rollbackPlanRef;
 const x=assessB7HostedApproval(a);
 assert.ok(x.missing.includes("rollbackPlanRef"));
 assert.equal(x.readyForHumanReview,false);
});
test("missing approved operator blocks human readiness",()=>{
 const a=fixture();a.operatorAllowlistRef="";
 assert.ok(assessB7HostedApproval(a).missing.includes("operatorAllowlistRef"));
});
test("more than 20 test requests is blocked",()=>{
 const a=fixture();a.maxSyntheticRequests=21;
 assert.ok(assessB7HostedApproval(a).invalid.includes("maxSyntheticRequests"));
});
test("more than 5 synthetic rows is blocked",()=>{
 const a=fixture();a.maxSyntheticRows=100;
 assert.ok(assessB7HostedApproval(a).invalid.includes("maxSyntheticRows"));
});
test("test window longer than 30 minutes is blocked",()=>{
 const a=fixture();a.testWindowEnd="2026-11-20T02:30:00Z";
 assert.ok(assessB7HostedApproval(a).invalid.includes("boundedTestWindow"));
});
test("invalid Git commit SHA blocks",()=>{
 const a=fixture();a.exactGitCommitSha="draft";
 assert.ok(assessB7HostedApproval(a).invalid.includes("exactGitCommitSha"));
});
test("invented user approval flag cannot grant deploy",()=>{
 const x=assessB7HostedApproval({...fixture(),
  approved:true,ownerApproved:true,userRequestedContinue:true,
  signedApprovalEvidenceRef:"qa_approval_receipt_0001"
 });
 assert.equal(x.readyForHumanReview,true);
 assert.equal(x.deployAllowed,false);
});
