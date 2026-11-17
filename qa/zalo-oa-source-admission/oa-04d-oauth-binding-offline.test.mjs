import test from 'node:test';
import assert from 'node:assert/strict';
import {makeOfflineCallbackFixtureHash,inspectOaOAuthCallbackBinding} from './oa-04d-oauth-binding-offline.mjs';

const NOW=1794900000000;
const nonce='aB5CdEfGhIJkLmnOpQRS_tuVwXyZ01234567890-aBc';
const hash=makeOfflineCallbackFixtureHash;
function f(mode='STATE_QUERY'){
 const ctx={ownerAuthenticated:true,ownerRevoked:false,
   ownerActorId:'owner-A',ownerSessionId:'qa-session-001'};
 const t={mode,appId:'360846524940903967',tenantId:'tenant-A',
   storeId:'store-A',ownerActorId:'owner-A',ownerSessionDigest:hash(ctx.ownerSessionId),
   createdAtMs:NOW-1000,expiresAtMs:NOW+100000,
   stateOrNonceDigest:hash(nonce),canSend:false,canWriteOrders:false};
 const base='https://oa-qa.example.invalid/oauth/zalo/callback';
 const params=new URLSearchParams({code:'QA_fake_oauth_code_123456',
    oa_id:'388613280879808645',[(mode==='STATE_QUERY'?'state':'tien404_qa')]:nonce});
 let fresh=true;
 const deps={executionMode:'OFFLINE_FIXTURE_ONLY',liveEnabled:false,nowMs:NOW,
   consumeOnce:async()=>{if(!fresh)return false;fresh=false;return true}};
 return {ctx,deps,input:{callbackUrl:base+'?'+params.toString(),
   pinnedRedirectBase:base,transaction:t}};
}
async function blocked(reason,mutate,mode='STATE_QUERY'){
 const x=f(mode);mutate(x);const r=await inspectOaOAuthCallbackBinding(x.input,x.ctx,x.deps);
 assert.equal(r.bindingCandidate,false,JSON.stringify(r));
 assert.equal(r.reason,reason);assert.equal(r.canSend,false);
 assert.equal(r.canConnectStore,false);assert.equal(r.canExchangeOAuthCode,false);
}
test('43 char nonce test fixture',()=>assert.equal(nonce.length,43));
test('state query candidate retains server-only/no provider claim',async()=>{
 const x=f(),r=await inspectOaOAuthCallbackBinding(x.input,x.ctx,x.deps);
 assert.equal(r.bindingCandidate,true);assert.equal(r.ownerGrantVerified,false);
 assert.equal(r.liveProviderUat,false);assert.equal(r.canExchangeOAuthCode,false);
 assert.equal(JSON.stringify(r).includes('QA_fake_oauth_code_'),false);
});
test('Zalo redirect URI bound nonce mode candidate does not disable CSRF',async()=>{
 const x=f('REDIRECT_QUERY_NONCE'),r=await inspectOaOAuthCallbackBinding(x.input,x.ctx,x.deps);
 assert.equal(r.bindingCandidate,true);assert.equal(r.canConnectStore,false);
});
test('repeat state denied with atomic once',async()=>{
 const x=f();assert.equal((await inspectOaOAuthCallbackBinding(x.input,x.ctx,x.deps)).bindingCandidate,true);
 assert.equal((await inspectOaOAuthCallbackBinding(x.input,x.ctx,x.deps)).reason,'CALLBACK_REPLAY_OR_ALREADY_USED');
});
test('no callback binding rejects',async()=>blocked('SERVER_ONE_SHOT_CALLBACK_DEPENDENCIES_MISSING',x=>{x.deps.executionMode='REAL_PROVIDER'}));
test('live mode explicitly rejects',async()=>blocked('SERVER_ONE_SHOT_CALLBACK_DEPENDENCIES_MISSING',x=>{x.deps.liveEnabled=true}));
test('session revoked rejects',async()=>blocked('FRESH_OWNER_SESSION_REQUIRED',x=>{x.ctx.ownerRevoked=true}));
test('session unauthenticated rejects',async()=>blocked('FRESH_OWNER_SESSION_REQUIRED',x=>{x.ctx.ownerAuthenticated=false}));
test('owner substitution rejects',async()=>blocked('TRUSTED_TRANSACTION_NOT_BOUND_TO_OWNER',x=>{x.ctx.ownerActorId='owner-B'}));
test('owner session theft rejects',async()=>blocked('TRUSTED_TRANSACTION_NOT_BOUND_TO_OWNER',x=>{x.ctx.ownerSessionId='qa-session-002'}));
test('expired transaction rejects',async()=>blocked('TRUSTED_TRANSACTION_NOT_BOUND_TO_OWNER',x=>{x.input.transaction.expiresAtMs=NOW-1}));
test('transaction permitting sends rejects',async()=>blocked('TRUSTED_TRANSACTION_NOT_BOUND_TO_OWNER',x=>{x.input.transaction.canSend=true}));
test('wrong callback origin rejected',async()=>blocked('EXACT_HTTPS_CALLBACK_NOT_MATCHED',x=>{x.input.callbackUrl=x.input.callbackUrl.replace('oa-qa.example.invalid','evil.example.invalid')}));
test('wrong callback path rejected',async()=>blocked('EXACT_HTTPS_CALLBACK_NOT_MATCHED',x=>{x.input.callbackUrl=x.input.callbackUrl.replace('/oauth/zalo/callback','/oauth/zalo/other')}));
test('HTTP downgrade rejected',async()=>blocked('EXACT_HTTPS_CALLBACK_NOT_MATCHED',x=>{x.input.callbackUrl=x.input.callbackUrl.replace('https:','http:')}));
test('provider OAuth error rejected',async()=>blocked('PROVIDER_OAUTH_ERROR',x=>{x.input.callbackUrl+='&error=access_denied'}));
test('unrecognized query rejected',async()=>blocked('UNKNOWN_QUERY_FIELDS_REQUIRE_PROVIDER_REVIEW',x=>{x.input.callbackUrl+='&access_token=leak'}));
test('duplicate code rejected',async()=>blocked('DUPLICATED_CALLBACK_PARAMETER',x=>{x.input.callbackUrl+='&code=other'}));
test('duplicate state rejected',async()=>blocked('DUPLICATED_CALLBACK_PARAMETER',x=>{x.input.callbackUrl+='&state='+nonce}));
test('no state query denied',async()=>blocked('STATE_OR_REDIRECT_NONCE_NOT_MATCHED',x=>{x.input.callbackUrl=x.input.callbackUrl.replace('&state='+nonce,'')}));
test('fake state denied',async()=>blocked('STATE_OR_REDIRECT_NONCE_NOT_MATCHED',x=>{x.input.callbackUrl=x.input.callbackUrl.replace(nonce,'X'.repeat(43))}));
test('redirect nonce mode without nonce denied',async()=>blocked('STATE_OR_REDIRECT_NONCE_NOT_MATCHED',x=>{x.input.callbackUrl=x.input.callbackUrl.replace('&tien404_qa='+nonce,'')},'REDIRECT_QUERY_NONCE'));
test('two different binding modes at once denied',async()=>blocked('AMBIGUOUS_CALLBACK_BINDING',x=>{x.input.callbackUrl+='&tien404_qa='+nonce}));
test('redirect binding plus state disallowed',async()=>blocked('AMBIGUOUS_CALLBACK_BINDING',x=>{x.input.callbackUrl+='&state='+nonce},'REDIRECT_QUERY_NONCE'));
test('bogus OA claimed id rejected',async()=>blocked('OA_ID_CLAIM_FORMAT_INVALID',x=>{x.input.callbackUrl=x.input.callbackUrl.replace('388613280879808645','store-B')}));
test('missing callback code rejected',async()=>blocked('CODE_FORMAT_UNVERIFIED',x=>{x.input.callbackUrl=x.input.callbackUrl.replace('QA_fake_oauth_code_123456','')}));
test('broken code containing whitespace denied',async()=>blocked('CODE_FORMAT_UNVERIFIED',x=>{x.input.callbackUrl=x.input.callbackUrl.replace('QA_fake_oauth_code_123456','%0Ainvalid')}));
test('Atomic callback consume service fails closed',async()=>blocked('ATOMIC_STATE_SERVICE_UNAVAILABLE',x=>{x.deps.consumeOnce=async()=>{throw Error('offline')}}));
test('malicious unknown mode denied',async()=>blocked('UNSUPPORTED_CALLBACK_BINDING_MODE',x=>{x.input.transaction.mode='NONE'}));
