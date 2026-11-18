// TIEN404 B6: UNDEPLOYABLE local Miniflare QA harness.
// No real Zalo webhook, merchant data, Commerce tools or provider sending.
// Deployed candidate's default handler (in recoverable-inbox-candidate) is 423.
import {
 admitEncryptedSynthetic,claimEncryptedSynthetic,recoverSyntheticWithLease,
 ackEncryptedSynthetic
} from "../recoverable-inbox-candidate.mjs";

const NOW=1795000000000;
const SCOPE="a".repeat(64),EVENT="b".repeat(64);
const KEY="1".repeat(64);
const PEPPER="SYNTHETIC_QA_ONLY_PEPPER_"+"p".repeat(40);
export default {
 async fetch(request,env){
  if(env.B6_LOCAL_CI_MODE!=="MINIFLARE_ONLY_NEVER_DEPLOY" ||
    new URL(request.url).pathname!=="/__b6_local_qa__/encrypted"||
    new URL(request.url).search!==""||
    request.method!=="POST"||
    request.headers.get("x-b6-local-fixture")!=="SYNTHETIC_QA_ONLY"){
   return new Response(null,{status:423});
  }
  try{
   const admission=await admitEncryptedSynthetic(env.QA_D1,{
    scopeKey:SCOPE,eventKey:EVENT,fixtureRef:"QA_FIXTURE_WORKER",
    content:"SYNTHETIC_LOCAL_WORKER",rawKeyHex:KEY,keyVersion:"QA_K1",
    digestPepper:PEPPER,nowMs:NOW,expiresAtMs:NOW+300000
   });
   const claimed=await claimEncryptedSynthetic(env.QA_D1,{
    scopeKey:SCOPE,eventKey:EVENT,nowMs:NOW+2,leaseMs:1000
   });
   let recovery={decision:"NOT_CLAIMED"},finished={decision:"NOT_CLAIMED"};
   if(claimed.decision==="QA_ENCRYPTED_LEASE_GRANTED_NO_SEND"){
    recovery=await recoverSyntheticWithLease(env.QA_D1,{
     scopeKey:SCOPE,eventKey:EVENT,leaseToken:claimed.leaseToken,
     nowMs:NOW+3,keyRing:{QA_K1:KEY},digestPepper:PEPPER
    });
    if(recovery.decision==="QA_ENCRYPTED_FIXTURE_RECOVERED_NO_SEND"){
     finished=await ackEncryptedSynthetic(env.QA_D1,{
      scopeKey:SCOPE,eventKey:EVENT,leaseToken:claimed.leaseToken,
      nowMs:NOW+4
     });
    }
   }
   return Response.json({
    admission:admission.decision,claim:claimed.decision,
    recover:recovery.decision,ack:finished.decision,
    proofOnly:"LOCAL_WORKER_D1_BINDING",
    storeAuthorityVerified:false,providerSendAllowed:false,
    orderWriteAllowed:false
   },{headers:{"cache-control":"no-store"}});
  }catch{
   return new Response(null,{status:503});
  }
 }
};
