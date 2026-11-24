// V23: every send in this turn (max 3) must be confirmed by Meta for the intended recipient.
const results=$input.all().map(i=>i.json);
const original=$('Prepare Messenger Reply').first(0, $('Prepare Messenger Reply').context.currentRunIndex).json;
if(results.length<1||results.length>3)throw new Error('Messenger reply count out of range: '+results.length);
for(const result of results){
 if (typeof result.message_id!=='string' || !result.message_id ||
     String(result.recipient_id??'')!==String(original.senderId??'')) {
   throw new Error('Meta Send API did not confirm intended recipient and message ID');
 }
}
return [{json:{...original,metaMessageId:results[0].message_id,metaMessageIds:results.map(r=>r.message_id),sentMessageCount:results.length,deliveryAcceptedAt:new Date().toISOString()}}];

