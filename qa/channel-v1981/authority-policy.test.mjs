import assert from 'node:assert/strict';
import {planZaloStoreRead} from './authority-policy.mjs';

const nowMs = 1795089000000;
const makeBase = ()=>({receipt:{evidenceType:"SYNTHETIC_SIGNED_WEBHOOK_FIXTURE",transportVerified:true,trustedServerIssuer:true,eventType:"message.text.received",chatType:"PRIVATE",isBot:false,messageIdValid:true,occurredAtMs:nowMs,uniqueEvent:true,rateAllowed:true,boundBotId:"BOT_B"},installation:{source:"SYNTHETIC_SERVER_REGISTRY",status:"qa_active",channel:"zalo_bot",botId:"BOT_B",tenantId:"T_SHARED",storeId:"STORE_B",installationId:"INST_B"},authority:{source:"SYNTHETIC_SERVER_AUTHORITY",ownerVerified:true,storeActive:true,tenantId:"T_SHARED",storeId:"STORE_B"},request:{source:"SYNTHETIC_QA_INPUT",sku:"F01"},product:{source:"SYNTHETIC_CATALOG_FIXTURE",tenantId:"T_SHARED",storeId:"STORE_B",sku:"F01",priceVnd:159000,stock:2},nowMs});
const scenarios = [
  ["approved qa preview", ()=>{}, "CANDIDATE_PREVIEW_ONLY"],
  ["missing receipt", x=>{delete x.receipt}, "DENY"],
  ["fake provider proof", x=>{x.receipt.evidenceType="LIVE"}, "DENY"],
  ["unverified transport", x=>{x.receipt.transportVerified=false}, "DENY"],
  ["wrong issuer", x=>{x.receipt.trustedServerIssuer=false}, "DENY"],
  ["wrong event", x=>{x.receipt.eventType="message.other"}, "DENY"],
  ["group chat", x=>{x.receipt.chatType="GROUP"}, "DENY"],
  ["bot echo", x=>{x.receipt.isBot=true}, "DENY"],
  ["missing message id", x=>{x.receipt.messageIdValid=false}, "DENY"],
  ["expired event", x=>{x.receipt.occurredAtMs=nowMs-900001}, "DENY"],
  ["duplicate", x=>{x.receipt.uniqueEvent=false}, "DENY"],
  ["rate denied", x=>{x.receipt.rateAllowed=false}, "DENY"],
  ["wrong bot", x=>{x.receipt.boundBotId="BOT_A"}, "DENY"],
  ["registry client spoof", x=>{x.installation.source="CLIENT"}, "DENY"],
  ["wrong channel", x=>{x.installation.channel="zalo_oa"}, "DENY"],
  ["inactive installation", x=>{x.installation.status="disabled"}, "DENY"],
  ["missing store", x=>{x.installation.storeId=""}, "DENY"],
  ["unverified owner", x=>{x.authority.ownerVerified=false}, "DENY"],
  ["cross store authority", x=>{x.authority.storeId="STORE_A"}, "DENY"],
  ["cross tenant authority", x=>{x.authority.tenantId="T_A"}, "DENY"],
  ["inactive store", x=>{x.authority.storeActive=false}, "DENY"],
  ["forged client store", x=>{x.request.storeId="STORE_A"}, "DENY"],
  ["forged admin", x=>{x.request.admin=true}, "DENY"],
  ["forged canWrite", x=>{x.request.canWrite=true}, "DENY"],
  ["bad sku", x=>{x.request.sku="../../etc"}, "DENY"],
  ["wrong sku", x=>{x.product.sku="F99"}, "DENY"],
  ["cross store product", x=>{x.product.storeId="STORE_A"}, "DENY"],
  ["cross tenant product", x=>{x.product.tenantId="T_A"}, "DENY"],
  ["invalid price", x=>{x.product.priceVnd=-1}, "DENY"],
  ["invalid stock", x=>{x.product.stock=-2}, "DENY"],
  ["missing product", x=>{delete x.product}, "DENY"]
];
for (const [name,mutate,expected] of scenarios) {
 const data=makeBase(); mutate(data); const response=planZaloStoreRead(data);
 assert.equal(response.decision,expected,name);
 assert.equal(response.canReadHosted,false,name+' hosted read');
 assert.equal(response.canSend,false,name+' provider send');
 assert.equal(response.canWrite,false,name+' commerce write');
 assert.equal(response.providerSends,0,name+' provider sends count');
 assert.equal(response.commerceWrites,0,name+' commerce writes count');
}
console.log('TIEN404_V1981_STORE_AUTHORITY_OFFLINE_PASS='+scenarios.length);
