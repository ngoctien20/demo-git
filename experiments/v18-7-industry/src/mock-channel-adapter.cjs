"use strict";
const { QA_ACTORS, buildQaPreview, previewQaQuote } = require("./qa-engine.cjs");
// Offline-only fake installations, not OAuth or real provider signatures.
const INSTALLATIONS = Object.freeze({
 qa_fb_a:{channel:"messenger",actor:"qa_owner_a",status:"connected_mock"},
 qa_fb_b:{channel:"messenger",actor:"qa_owner_b",status:"connected_mock"},
 qa_fb_c:{channel:"messenger",actor:"qa_owner_c",status:"connected_mock"},
 qa_zalo_a:{channel:"zalo_oa",actor:"qa_owner_a",status:"connected_mock"},
 qa_zalo_b:{channel:"zalo_oa",actor:"qa_owner_b",status:"connected_mock"},
 qa_zalo_c:{channel:"zalo_oa",actor:"qa_owner_c",status:"connected_mock"},
 qa_web_a:{channel:"website",actor:"qa_owner_a",status:"connected_mock"},
 qa_web_b:{channel:"website",actor:"qa_owner_b",status:"connected_mock"},
 qa_web_c:{channel:"website",actor:"qa_owner_c",status:"connected_mock"},
 qa_fb_paused:{channel:"messenger",actor:"qa_owner_a",status:"paused"},
 qa_fb_revoked:{channel:"messenger",actor:"qa_owner_a",status:"revoked"}
});
for(const installation of Object.values(INSTALLATIONS)) Object.freeze(installation); // immutable mock-only fixtures
const RENDER=Object.freeze({messenger:"messenger_text_mock",zalo_oa:"zalo_oa_text_mock",website:"website_card_mock"});
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const plain=o=>o!==null&&typeof o==="object"&&!Array.isArray(o)&&(Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
const exact=(o,keys)=>plain(o)&&Object.keys(o).every(k=>keys.includes(k)&&!["__proto__","prototype","constructor"].includes(k));
const deny=code=>({ok:false,status:"DENY",code,origin:"SYNTHETIC_QA",canWrite:false,canSend:false,providerVerified:false});
function mockChannelPreview(req) {
 if(!exact(req,["actor_key","installation_key","channel","profile","override","operation","payload"]))return deny("INPUT_UNTRUSTED");
 if(typeof req.installation_key!=="string"||typeof req.actor_key!=="string"||typeof req.channel!=="string")return deny("INPUT_INVALID");
 if(!own(INSTALLATIONS,req.installation_key))return deny("INSTALLATION_UNKNOWN");
 const i=INSTALLATIONS[req.installation_key];
 if(i.status!=="connected_mock")return deny(i.status==="paused"?"CHANNEL_PAUSED":"REAUTH_REQUIRED");
 if(i.channel!==req.channel)return deny("CHANNEL_MISMATCH");
 if(!own(QA_ACTORS,req.actor_key)||i.actor!==req.actor_key)return deny("INSTALLATION_STORE_MISMATCH");
 if(!["greeting_preview","quote_preview"].includes(req.operation))return deny("OPERATION_DENIED");
 const c=buildQaPreview({actor_key:req.actor_key,channel:req.channel,profile:req.profile,override:req.override});
 if(!c.ok)return deny(c.code);
 if(!exact(req.payload,req.operation==="quote_preview"?["sku","quantity","unit"]:[]))return deny("PAYLOAD_UNTRUSTED");
 let text=c.greeting;
 if(req.operation==="quote_preview"){
  const q=previewQaQuote(c,req.payload);
  if(!q.ok)return deny(q.code);
  text="SYNTHETIC_QA "+q.quantity+" "+q.unit+" = "+q.base_units+" đơn vị gốc, "+q.total_vnd+" VND. Chưa tạo đơn.";
 }
 return Object.freeze({ok:true,status:"MOCK_PREVIEW_ONLY",origin:"SYNTHETIC_QA",providerVerified:false,
  tenant_key:c.tenant_key,store_key:c.store_key,channel:req.channel,profile_id:c.profile_id,
  preview:Object.freeze({kind:RENDER[req.channel],text,sendable:false}),
  canReadPrivateOrder:false,canWrite:false,canSend:false,requiresRealAuthority:true});
}
module.exports={mockChannelPreview,INSTALLATIONS,RENDER};
