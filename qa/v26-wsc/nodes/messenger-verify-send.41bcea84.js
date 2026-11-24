// V21: fail closed unless Meta confirms every message planned for this inbound event.
// A partial/ambiguous HTTP result MUST NOT record the inbound event as successfully answered.
const results=$input.all().map(i=>i.json);
const original=$('Prepare Messenger Reply').first(0, $('Prepare Messenger Reply').context.currentRunIndex).json;
const expected=Number(original.messageCount);
if(!Number.isSafeInteger(expected)||expected<1||expected>3||Number(original.messageIndex)!==1){
 throw new Error('Invalid Messenger reply plan; no successful MID recorded');
}
if(results.length!==expected){
 throw new Error('Incomplete Messenger Send API confirmations: expected '+expected+', confirmed '+results.length);
}
const confirmedIds=new Set();
for(const result of results){
 if(typeof result.message_id!=='string'||!result.message_id.trim()||
  String(result.recipient_id??'')!==String(original.senderId??'')){
  throw new Error('Meta Send API did not confirm intended recipient and message ID');
 }
 if(confirmedIds.has(result.message_id)){
  throw new Error('Meta Send API returned duplicate message ID; do not record complete delivery');
 }
 confirmedIds.add(result.message_id);
}
return [{json:{...original,metaMessageId:results[0].message_id,
 metaMessageIds:[...confirmedIds],sentMessageCount:results.length,
 deliveryAcceptedAt:new Date().toISOString()}}];
