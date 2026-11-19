import assert from 'node:assert/strict';
import {evaluateBotInstallation} from './installation-authority.mjs';

const T='00000000-0000-0000-0000-000000000001';
const A='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const nowMs=1795089000000;
function fixture() {
 return {
  mode:'V1986_OFFLINE_FIXTURE',nowMs,
  transport:{source:'MOCK_AUTHENTICATED_ENDPOINT',method:'POST',
   endpointRef:'QA_ENDPOINT_A',credentialBindingRef:'QA_CRED_REF_A',secretEpoch:2,
   headerAuthenticated:true,providerAttested:true,claimsVerified:true,
   replayStatus:'MOCK_DURABLE_UNIQUE',rateStatus:'ALLOW',receivedAtMs:nowMs-1000},
  event:{source:'MOCK_NORMALIZED_EVENT',type:'message.text.received',chatType:'PRIVATE',
   isBotEcho:false,eventIdStatus:'MOCK_UNIQUE',senderRole:'CUSTOMER',qaOwnerCustomerAllowed:false},
  registry:[{source:'MOCK_PRIVATE_SERVER_REGISTRY',installationId:'QA_INSTALL_A',
   channel:'zalo_bot',endpointRef:'QA_ENDPOINT_A',credentialBindingRef:'QA_CRED_REF_A',
   secretEpoch:2,tenantId:T,storeId:A,lifecycle:'qa_active',ownerId:'QA_OWNER_A',
   botRef:'QA_BOT_A',verifiedAtMs:nowMs-100000,revokedAtMs:null,version:3}],
  ownerEvidence:[{source:'MOCK_SERVER_VERIFIED_OWNER',installationId:'QA_INSTALL_A',
   ownerId:'QA_OWNER_A',tenantId:T,storeId:A,approval:'consented_readonly_qa',
   sessionProof:'MOCK_AUTH_SESSION',membershipActive:true,ownerRole:'owner',
   approvedVersion:3,approvedAtMs:nowMs-10000,revokedAtMs:null}],
  storeAuthority:{source:'MOCK_CANONICAL_STORE_AUTHORITY',tenantId:T,storeId:A,
   state:'staging_active',ownerId:'QA_OWNER_A',ownerActive:true,verifiedVersion:3},
  priorBinding:{source:'MOCK_REGISTRY_HISTORY',lastKnownVersion:2,
   lastKnownStoreId:A,transferApproval:null}
 };
}
function replaceEveryStore(f,store) {
 f.registry[0].storeId=store;f.ownerEvidence[0].storeId=store;
 f.storeAuthority.storeId=store;f.priorBinding.lastKnownStoreId=store;
}
const cases=[
 ['01 valid customer',x=>{},'OFFLINE_BINDING_CANDIDATE'],
 ['02 owner customer QA',x=>{x.event.senderRole='OWNER_AS_CUSTOMER_QA';x.event.qaOwnerCustomerAllowed=true},'OFFLINE_BINDING_CANDIDATE'],
 ['03 isolated Store B same tenant',x=>replaceEveryStore(x,B),'OFFLINE_BINDING_CANDIDATE'],
 ['04 late owner consent within valid registration',x=>{x.ownerEvidence[0].approvedAtMs=nowMs-1},'OFFLINE_BINDING_CANDIDATE'],
 ['05 approved transfer of Bot to Store B',x=>{replaceEveryStore(x,B);x.priorBinding.lastKnownStoreId=A;x.priorBinding.transferApproval='MOCK_NEW_OWNER_AND_OLD_OWNER_APPROVAL'},'OFFLINE_BINDING_CANDIDATE'],
 ['06 invalid runtime mode',x=>{x.mode='LIVE_PRODUCTION'},'DENY'],
 ['07 unexpected envelope privilege',x=>{x.serviceRole=true},'DENY'],
 ['08 invalid time type',x=>{x.nowMs='today'},'DENY'],
 ['09 request claims leaked as transport',x=>{x.transport.storeId=A},'DENY'],
 ['10 wrong transport source',x=>{x.transport.source='CUSTOMER_PAYLOAD'},'DENY'],
 ['11 unsupported GET',x=>{x.transport.method='GET'},'DENY'],
 ['12 missing endpoint reference',x=>{x.transport.endpointRef=''},'DENY'],
 ['13 invalid credential reference',x=>{x.transport.credentialBindingRef='???'},'DENY'],
 ['14 missing epoch',x=>{delete x.transport.secretEpoch},'DENY'],
 ['15 zero epoch',x=>{x.transport.secretEpoch=0},'DENY'],
 ['16 header bypass',x=>{x.transport.headerAuthenticated=false},'DENY'],
 ['17 no provider attestation',x=>{x.transport.providerAttested=false},'DENY'],
 ['18 issuer claims unverified',x=>{x.transport.claimsVerified=false},'DENY'],
 ['19 transport stale',x=>{x.transport.receivedAtMs=nowMs-800000},'DENY'],
 ['20 transport future',x=>{x.transport.receivedAtMs=nowMs+500000},'DENY'],
 ['21 ephemeral replay store',x=>{x.transport.replayStatus='MEMORY_ONLY'},'DENY'],
 ['22 duplicate event',x=>{x.transport.replayStatus='DUPLICATE'},'DENY'],
 ['23 rate blocked',x=>{x.transport.rateStatus='DENY'},'DENY'],
 ['24 event malicious scope claim',x=>{x.event.tenantId=T},'DENY'],
 ['25 wrong event source',x=>{x.event.source='REAL_EVENT'},'DENY'],
 ['26 other event type',x=>{x.event.type='message.sticker.received'},'DENY'],
 ['27 group conversation',x=>{x.event.chatType='GROUP'},'DENY'],
 ['28 echo',x=>{x.event.isBotEcho=true},'DENY'],
 ['29 replay ID',x=>{x.event.eventIdStatus='DUPLICATE'},'DENY'],
 ['30 impersonated admin sender',x=>{x.event.senderRole='ADMIN'},'DENY'],
 ['31 owner as customer disabled',x=>{x.event.senderRole='OWNER_AS_CUSTOMER_QA'},'DENY'],
 ['32 missing registry',x=>{x.registry=[]},'DENY'],
 ['33 registry fake source',x=>{x.registry[0].source='MESSAGE'},'DENY'],
 ['34 registry unexpected secret',x=>{x.registry[0].token='secret'},'DENY'],
 ['35 unknown endpoint',x=>{x.transport.endpointRef='QA_ENDPOINT_X'},'DENY'],
 ['36 duplicate endpoint',x=>{x.registry.push({...x.registry[0],installationId:'QA_INSTALL_2',botRef:'QA_BOT_2'})},'DENY'],
 ['37 wrong channel',x=>{x.registry[0].channel='zalo_oa'},'DENY'],
 ['38 empty installation ID',x=>{x.registry[0].installationId=''},'DENY'],
 ['39 invalid bot ref',x=>{x.registry[0].botRef='?'},'DENY'],
 ['40 invalid tenant',x=>{x.registry[0].tenantId='T1'},'DENY'],
 ['41 invalid store',x=>{x.registry[0].storeId='shop-b'},'DENY'],
 ['42 wrong lifecycle',x=>{x.registry[0].lifecycle='pending'},'DENY'],
 ['43 revoked registration',x=>{x.registry[0].revokedAtMs=nowMs-100},'DENY'],
 ['44 disabled registration',x=>{x.registry[0].lifecycle='revoked'},'DENY'],
 ['45 wrong credential ref',x=>{x.registry[0].credentialBindingRef='QA_CRED_REF_B'},'DENY'],
 ['46 stale secret epoch',x=>{x.transport.secretEpoch=1},'DENY'],
 ['47 missing store owner',x=>{x.registry[0].ownerId=''},'DENY'],
 ['48 future installation verification',x=>{x.registry[0].verifiedAtMs=nowMs+100},'DENY'],
 ['49 invalid registration version',x=>{x.registry[0].version=0},'DENY'],
 ['50 bot bound twice',x=>{x.registry.push({...x.registry[0],installationId:'QA_INSTALL_B',endpointRef:'QA_ENDPOINT_B',storeId:B})},'DENY'],
 ['51 missing owner proof',x=>{x.ownerEvidence=[]},'DENY'],
 ['52 duplicate approval',x=>{x.ownerEvidence.push({...x.ownerEvidence[0]})},'DENY'],
 ['53 owner fake source',x=>{x.ownerEvidence[0].source='USER_SUPPLIED'},'DENY'],
 ['54 owner identity mismatch',x=>{x.ownerEvidence[0].ownerId='QA_OWNER_B'},'DENY'],
 ['55 owner tenant mismatch',x=>{x.ownerEvidence[0].tenantId='ffffffff-ffff-ffff-ffff-ffffffffffff'},'DENY'],
 ['56 owner Store mismatch',x=>{x.ownerEvidence[0].storeId=B},'DENY'],
 ['57 owner consent pending',x=>{x.ownerEvidence[0].approval='pending'},'DENY'],
 ['58 owner consent revoked',x=>{x.ownerEvidence[0].revokedAtMs=nowMs-1},'DENY'],
 ['59 owner membership inactive',x=>{x.ownerEvidence[0].membershipActive=false},'DENY'],
 ['60 owner role manager not owner',x=>{x.ownerEvidence[0].ownerRole='manager'},'DENY'],
 ['61 owner mock session missing',x=>{x.ownerEvidence[0].sessionProof='NONE'},'DENY'],
 ['62 owner approval old installation version',x=>{x.ownerEvidence[0].approvedVersion=2},'DENY'],
 ['63 owner approval before Bot verification',x=>{x.ownerEvidence[0].approvedAtMs=nowMs-200000},'DENY'],
 ['64 owner approval from future',x=>{x.ownerEvidence[0].approvedAtMs=nowMs+100},'DENY'],
 ['65 canonical Store fake source',x=>{x.storeAuthority.source='MESSAGE'},'DENY'],
 ['66 inactive Store',x=>{x.storeAuthority.state='paused'},'DENY'],
 ['67 invalid Store owner',x=>{x.storeAuthority.ownerId='QA_OWNER_B'},'DENY'],
 ['68 owner revoked on Store',x=>{x.storeAuthority.ownerActive=false},'DENY'],
 ['69 Store version outdated',x=>{x.storeAuthority.verifiedVersion=2},'DENY'],
 ['70 canonical Store ID different',x=>{x.storeAuthority.storeId=B},'DENY'],
 ['71 canonical Tenant different',x=>{x.storeAuthority.tenantId='ffffffff-ffff-ffff-ffff-ffffffffffff'},'DENY'],
 ['72 no registry history',x=>{delete x.priorBinding},'DENY'],
 ['73 prior history client sourced',x=>{x.priorBinding.source='CLIENT'},'DENY'],
 ['74 missing history version',x=>{delete x.priorBinding.lastKnownVersion},'DENY'],
 ['75 history newer than registered version',x=>{x.priorBinding.lastKnownVersion=4},'DENY'],
 ['76 move Bot B without transfer agreement',x=>{x.registry[0].storeId=B;x.ownerEvidence[0].storeId=B;x.storeAuthority.storeId=B},'DENY'],
 ['77 move Bot B with fake one-owner proof',x=>{x.registry[0].storeId=B;x.ownerEvidence[0].storeId=B;x.storeAuthority.storeId=B;x.priorBinding.transferApproval='OWNER_B_ONLY'},'DENY'],
 ['78 registry contains extra dangerous field',x=>{x.registry[0].admin=true},'DENY'],
 ['79 owner contains user-supplied role',x=>{x.ownerEvidence[0].canWrite=true},'DENY'],
 ['80 store evidence contains credential',x=>{x.storeAuthority.token='secret'},'DENY'],
 ['81 previous binding history contains untrusted metadata',x=>{x.priorBinding.tenantOverride=T},'DENY'],
 ['82 historic version same as installation',x=>{x.priorBinding.lastKnownVersion=3},'OFFLINE_BINDING_CANDIDATE']
];
let pass=0;
for(const [label,mutation,expected] of cases){
 const c=fixture();mutation(c);const result=evaluateBotInstallation(c);
 assert.equal(result.decision,expected,label);
 assert.equal(result.canReadHosted,false,label+' read');
 assert.equal(result.canSend,false,label+' send');
 assert.equal(result.canWrite,false,label+' write');
 assert.equal(result.providerSends,0,label+' provider sends');
 assert.equal(result.orderWrites,0,label+' orders');
 assert.equal(result.tenantId,null,label+' no tenant');
 assert.equal(result.storeId,null,label+' no Store');
 assert.equal(result.installationId,null,label+' no installation ref');
 assert.equal(result.ownerId,null,label+' no owner ref');
 assert.equal(result.realProviderProof,false,label+' no live provider proof');
 assert.equal(result.realOwnerProof,false,label+' no live owner proof');
 assert.equal(result.productionReady,false,label+' no production');
 assert.equal(result.replyPreview,'',label+' no reply');
 pass++;
}
console.log('TIEN404_V1986_INSTALLATION_AUTHORITY_OFFLINE_PASS='+pass);
