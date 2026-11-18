// TIEN404 B5 test harness: ONLY Miniflare local workerd. Never deploy.
// A synthetic fixed-input harness is not a Zalo webhook. No real provider,
// no outgoing fetch, no Store authority, no n8n, no Commerce access.
import { admitSyntheticFromLockedRegistry } from "../protected-admission-qa.mjs";
import { claimSynthetic, retrySynthetic, readSyntheticReceipt } from "../durable-inbox-contract.mjs";

const NOW=1795000000000;
const SHA_A="1".repeat(64);
const INSTALL_A="qa-install-"+"a".repeat(20);
const PEPPER="SYNTHETIC_B5_HMAC_PEPPER_"+"p".repeat(40);
const encode=new TextEncoder();
async function hexHmac(str){
 const key=await crypto.subtle.importKey("raw",encode.encode(PEPPER),
  {name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const h=await crypto.subtle.sign("HMAC",key,encode.encode(str));
 return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,"0")).join("");
}
export default {
 async fetch(request,env) {
  // Hard lock unless local-only test harness binding is present. This is NOT
  // authorization to expose this code; no Cloudflare deploy is permitted.
  if(env.B5_LOCAL_MODE!=="MINIFLARE_UNDEPLOYABLE_QA")return new Response(null,{status:423});
  const url=new URL(request.url);
  if(url.pathname!=="/__b5_local_runtime__/synthetic" ||
     url.search!=="" || request.method!=="POST" ||
     request.headers.get("x-b5-fixture")!=="LOCAL_SYNTHETIC_ONLY"){
    return new Response(null,{status:423});
  }
  try {
   const verdict=await admitSyntheticFromLockedRegistry({
     db:env.QA_D1,mode:"B5_LOCAL_D1_TEST_ONLY",
     trustedInstallationRef:INSTALL_A,trustedCredentialBindingSha256:SHA_A,
     qaPepper:PEPPER,fixtureRef:"QA_FIXTURE_ALPHA",
     payloadFixture:"SYNTHETIC_ALPHA",nowMs:NOW
   });
   const scopeKey=await hexHmac("scope:"+INSTALL_A);
   const eventKey=await hexHmac("event:QA_FIXTURE_ALPHA");
   const claim=await claimSynthetic(env.QA_D1,{scopeKey,eventKey,nowMs:NOW,leaseMs:500});
   let retry=null;
   if(claim.decision==="QA_LEASE_GRANTED_NO_SEND"){
     retry=await retrySynthetic(env.QA_D1,{
       scopeKey,eventKey,leaseToken:claim.leaseToken,nowMs:NOW+5,
       retryAfterMs:500,errorCode:"QA_SYNTHETIC_RETRY"
     });
   }
   const receipt=await readSyntheticReceipt(env.QA_D1,{scopeKey,eventKey,nowMs:NOW});
   return Response.json({
     verdict:verdict.decision,scope:verdict.syntheticBindingMatched===true,
     claim:claim.decision,retry:retry?.decision||null,
     receipt:receipt.decision,state:receipt.status||null,
     writesAllowed:false,providerSend:false,realStoreAuthority:false
   },{headers:{"cache-control":"no-store"}});
  }catch{return new Response(null,{status:503});}
 }
};
