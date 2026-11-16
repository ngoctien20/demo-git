'use strict';
/**
 * V15 P0-F -- OFFLINE synthetic threat-matrix review of the current hosted
 * Zalo QA claim RPC's risk controls, NOT a replacement for that RPC.
 *
 * Caveat: Even a PASS-shaped synthetic object DOES NOT establish a genuine
 * native Zalo signature, Vault custody, authenticated owner, or a safe
 * HTTP ingress. NEVER wire this helper to any real provider/webhook/send.
 */
const {createHash,timingSafeEqual}=require('node:crypto');
const HEX64=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const hash=s=>createHash('sha256').update(s).digest('hex');
const response=(status,reason)=>Object.freeze({
 status,reason,synthetic_only:true,
 real_zalo_provider_verified:false,
 real_owner_verified:false,
 can_claim_live:false,can_mutate_hosted:false,can_write_order:false,
 can_send_provider:false,provider_sends:0,orders_written:0
});
const deny=reason=>response('BLOCKED',reason);
function assessSyntheticZaloClaim({headerGate,claim,privateQa,nowMs}={}){
 if(!plain(privateQa)||privateQa.mode!=='DISPOSABLE_ZALO_QA_THREAT_MATRIX'||
    typeof privateQa.vaultGateSynthetic!=='string'||privateQa.vaultGateSynthetic.length<43||
    privateQa.vaultGateSynthetic.length>256)
   return deny('TRUSTED_QA_GATE_NOT_AVAILABLE');
 if(typeof headerGate!=='string'||headerGate.length>256||headerGate.length<43)
   return deny('MISSING_OR_MALFORMED_GATE');
 if(!timingSafeEqual(Buffer.from(hash(headerGate),'hex'),
                     Buffer.from(hash(privateQa.vaultGateSynthetic),'hex')))
   return deny('GATE_MISMATCH');
 if(!plain(claim)||Object.keys(claim).some(k=>![
   'challenge','code','sender','event','tenant','store','bot'].includes(k)))
   return deny('STRICT_CLAIM_INPUT_SCHEMA');
 if(typeof claim.challenge!=='string'||!UUID.test(claim.challenge)||
   typeof claim.code!=='string'||claim.code.length<8||claim.code.length>128||
   typeof claim.sender!=='string'||claim.sender.length<1||claim.sender.length>128||
   typeof claim.event!=='string'||claim.event.length<1||claim.event.length>128)
   return deny('INVALID_CHALLENGE_OR_SENDER_EVENT');
 if(!Number.isSafeInteger(nowMs)||nowMs<1700000000000||
   !plain(privateQa.challenge)||!Number.isSafeInteger(privateQa.challenge.expiresAtMs)||
   !Number.isInteger(privateQa.challenge.failedAttempts)||
   !plain(privateQa.binding)||
   typeof privateQa.challenge.challengeId!=='string')
   return deny('HOSTED_CHALLENGE_PROOF_MISSING');
 const c=privateQa.challenge;
 if(claim.challenge!==c.challengeId||
    claim.tenant!==privateQa.binding.tenant||
    claim.store!==privateQa.binding.store||
    claim.bot!==privateQa.binding.bot)
   return deny('CHALLENGE_SCOPE_OR_STORE_MISMATCH');
 if(c.usedAtMs!==null||c.expiresAtMs<=nowMs||c.failedAttempts>=5||
   c.failedAttempts<0)
   return deny('REPLAY_EXPIRED_OR_ATTEMPT_LIMIT');
 if(!HEX64.test(c.codeHash)||!timingSafeEqual(
   Buffer.from(c.codeHash,'hex'),Buffer.from(hash(claim.code),'hex')))
   return deny('WRONG_CODE');
 if(privateQa.eventAlreadySeen===true)return deny('DUPLICATE_EVENT');
 if(privateQa.providerVerifiedNative!==true)return deny('NATIVE_PROVIDER_SIGNATURE_UNVERIFIED');
 // ProviderVerifiedNative is only a test-double boolean, never an actual
 // verified signature. The caller cannot gain authority by setting true.
 return response('OFFLINE_REVIEW_ONLY','NEEDS_INDEPENDENT_REAL_PROVIDER_AND_STORE_CERTIFICATION');
}
module.exports={assessSyntheticZaloClaim};
