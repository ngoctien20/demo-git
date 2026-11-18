// TIEN404 V19.0-B7 — LOCAL Miniflare fixture, never deploy.
// This is NOT Cloudflare Access JWT validation, a real Worker service binding,
// an incoming Zalo webhook, Store identity, an order writer or a send path.
import {inspectPrivateCanary,signQaPermit} from "../protected-private-canary.mjs";
const NOW=1795000000000;
const KEY="a".repeat(64); // SYNTHETIC TEST KEY, NEVER USE AS SERVICE CREDENTIAL.
const EXPECTED={
 expectedIssuer:"b7-qa-issuer",
 expectedAudience:"b7-private-d1",
 expectedOperator:"b7-qa-operator",
 expectedBindingRef:"b7-qa-binding"
};
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(env.B7_LOCAL_TEST_ONLY!=="B7_MINIFLARE_UNDEPLOYABLE" ||
    url.pathname!=="/__b7_local__/private-binding"||url.search!==""||
    request.method!=="POST"||
    request.headers.get("x-b7-synthetic-fixture")!=="LOCAL_TEST_ONLY"){
   return new Response(null,{status:423});
  }
  const nonce=request.headers.get("x-b7-test-nonce")||"synthetic_nonce_000000000000001";
  const permit={
   issuer:EXPECTED.expectedIssuer,audience:EXPECTED.expectedAudience,
   operator:EXPECTED.expectedOperator,bindingRef:EXPECTED.expectedBindingRef,
   issuedAtMs:NOW,expiresAtMs:NOW+30000,nonce,
   fixture:"SYNTHETIC_PROTECTED_D1_ONLY"
  };
  const signed=await signQaPermit(permit,KEY);
  const judgment=await inspectPrivateCanary({
   db:env.QA_D1,mode:"B7_LOCAL_ONLY_HARD_LOCK",permit,
   signatureHex:signed,qaKeyHex:KEY,...EXPECTED,nowMs:NOW+1
  });
  return Response.json({
   decision:judgment.decision,
   providerIdentityVerified:false,storeAuthorityVerified:false,
   commerceReadAllowed:false,commerceWriteAllowed:false,
   hostedBindingVerified:false,accessJwtVerified:false,
   webhookPublished:false
  },{status:judgment.decision==="QA_LOCAL_D1_NONCE_CLAIMED_NO_SEND"?200:409,
      headers:{"cache-control":"no-store"}});
 }
};
