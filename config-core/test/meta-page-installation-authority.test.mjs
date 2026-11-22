import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { META_INSTALL_CONTRACT,verifyMetaPageInstallationReceipt } from '../lib/meta-page-installation-authority.mjs';

const now=1795345000000;
const key=Buffer.alloc(32,41); // Synthetic CI test key, never a production credential.
const ctx={
  connectionId:'a0000000-0000-4000-8000-000000000001',
  tenantId:'a0000000-0000-4000-8000-000000000002',
  storeId:'a0000000-0000-4000-8000-000000000003',
  ownerUserId:'a0000000-0000-4000-8000-000000000004',
  metaPageId:'123456789012345',appId:'999888777666'
};
const original=()=>{
  const p={
    schemaVersion:1,audience:META_INSTALL_CONTRACT,issuer:'t404_meta_oauth_gateway',
    appId:ctx.appId,installationId:'a0000000-0000-4000-8000-000000000005',
    connectionId:ctx.connectionId,tenantId:ctx.tenantId,storeId:ctx.storeId,
    ownerUserId:ctx.ownerUserId,metaPageId:ctx.metaPageId,
    metaActorIdSha256:'a'.repeat(64),oauthNonceSha256:'b'.repeat(64),
    permissions:['pages_manage_metadata','pages_messaging','pages_show_list'],
    callbackStateVerified:true,tokenAppBindingVerified:true,pageTokenValidated:true,
    pageMessagingTaskVerified:true,pageSubscriptionVerified:true,
    verifiedAtMs:now-1000,expiresAtMs:now+30*60*1000
  };
  return p;
};
const seal=(p)=>{
  const payload=Buffer.from(JSON.stringify(p),'utf8').toString('base64url');
  const signature=createHmac('sha256',key).update('TIEN404_META_PAGE_INSTALL_V1:'+payload).digest('hex');
  return {version:1,payload,signature};
};
const verify=(p,c=ctx,time=now)=>verifyMetaPageInstallationReceipt(seal(p),key,c,time);
const blocked=(p,reason)=>assert.equal(verify(p).reason,reason);

test('signed, scoped Meta Page installation proof allows server draft authority only',()=>{
  const r=verify(original());
  assert.equal(r.status,'verified');
  assert.equal(r.metaPageId,ctx.metaPageId);
  assert.equal(r.sendAllowed,false);
  assert.equal(r.requiresIndependentOwnerConsent,true);
});
test('unsigned or incorrect server key never grants authority',()=>{
  const e=seal(original());
  assert.equal(verifyMetaPageInstallationReceipt(e,null,ctx,now).reason,'missing_server_signing_key');
  assert.equal(verifyMetaPageInstallationReceipt(e,Buffer.alloc(31,7),ctx,now).status,'blocked');
  assert.equal(verifyMetaPageInstallationReceipt(e,Buffer.alloc(32,9),ctx,now).reason,'invalid_receipt_signature');
});
test('tampered payload signature or version rejects before claims are evaluated',()=>{
  const e=seal(original());
  assert.equal(verifyMetaPageInstallationReceipt({...e,signature:'c'.repeat(64)},key,ctx,now).reason,'invalid_receipt_signature');
  assert.equal(verifyMetaPageInstallationReceipt({...e,payload:e.payload+'a'},key,ctx,now).reason,'invalid_receipt_signature');
  assert.equal(verifyMetaPageInstallationReceipt({...e,version:2},key,ctx,now).reason,'invalid_receipt_format');
});
test('cross-tenant, cross-store, cross-owner and cross-Page receipt replay blocked',()=>{
  for(const field of ['tenantId','storeId','ownerUserId','connectionId','appId','metaPageId']){
    const p=original();
    p[field]=field==='metaPageId'?'123450001234500':field==='appId'?'123456':field==='tenantId'?'b0000000-0000-4000-8000-000000000002':'b0000000-0000-4000-8000-000000000004';
    assert.equal(verify(p).reason,'installation_scope_mismatch',field);
  }
});
test('no trusted store context means no permission irrespective of signed claims',()=>{
  assert.equal(verifyMetaPageInstallationReceipt(seal(original()),key,null,now).reason,'untrusted_installation_context');
  assert.equal(verifyMetaPageInstallationReceipt(seal(original()),key,{...ctx,tenantId:'bad'},now).reason,'untrusted_installation_context');
});
test('required Meta Page permissions must all exist exactly once',()=>{
  for(const perms of [
    ['pages_messaging'],['pages_show_list','pages_messaging'],
    ['pages_show_list','pages_manage_metadata'],
    ['pages_manage_metadata','pages_messaging','pages_show_list','business_management'],
    ['pages_manage_metadata','pages_messaging','pages_messaging']
  ]) blocked({...original(),permissions:perms},'meta_permissions_missing');
});
test('state validation, token/app binding, Page task and subscribed Page check mandatory',()=>{
  for(const flag of ['callbackStateVerified','tokenAppBindingVerified','pageTokenValidated',
    'pageMessagingTaskVerified','pageSubscriptionVerified']){
      blocked({...original(),[flag]:false},'meta_authority_not_confirmed');
    }
});
test('receipt without OAuth audience or trusted issuer is rejected',()=>{
  blocked({...original(),audience:'t404:customer-payload'},'invalid_receipt_claims');
  blocked({...original(),issuer:'messenger_webhook'},'invalid_receipt_claims');
  blocked({...original(),schemaVersion:2},'invalid_receipt_claims');
});
test('secrets and metadata smuggled in receipt are forbidden',()=>{
  blocked({...original(),access_token:'secret-not-allowed'},'invalid_receipt_claims');
  blocked({...original(),service_role:'nope'},'invalid_receipt_claims');
});
test('stale, future and expired Meta attestation cannot be reused',()=>{
  blocked({...original(),verifiedAtMs:now-16*60*1000},'stale_meta_authority');
  blocked({...original(),verifiedAtMs:now+15*1000},'stale_meta_authority');
  blocked({...original(),expiresAtMs:now-1},'stale_meta_authority');
  blocked({...original(),expiresAtMs:now+25*60*60*1000},'stale_meta_authority');
});
test('invalid noncanonical payload or malformed JSON always rejects',()=>{
  const payload=Buffer.from('{"broken"').toString('base64url');
  const signature=createHmac('sha256',key).update('TIEN404_META_PAGE_INSTALL_V1:'+payload).digest('hex');
  assert.equal(verifyMetaPageInstallationReceipt({version:1,payload,signature},key,ctx,now).reason,'invalid_receipt_json');
  assert.equal(verifyMetaPageInstallationReceipt({version:1,payload:payload+'=',signature},key,ctx,now).reason,'invalid_receipt_format');
});
test('Page identifier must be a provider Page ID, not a username or URL',()=>{
  blocked({...original(),metaPageId:'https://facebook.com/page'},'invalid_receipt_claims');
  blocked({...original(),metaPageId:'0'},'invalid_receipt_claims');
});
test('a valid receipt for Page A cannot authorize Page B even with the same store',()=>{
  const a=seal(original());
  const b={...ctx,metaPageId:'123456789012346'};
  assert.equal(verifyMetaPageInstallationReceipt(a,key,b,now).reason,'installation_scope_mismatch');
});
test('missing server authority flags cannot be recreated by LLM output',()=>{
  const p=original();delete p.pageTokenValidated;
  blocked(p,'invalid_receipt_claims');
});
