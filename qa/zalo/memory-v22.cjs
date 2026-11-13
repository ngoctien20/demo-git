function transition(row, event, now, respond) {
  if (!['qa-owner-a','qa-owner-b'].includes(event.scope) ||
      row.scope!==event.scope || !Number.isSafeInteger(row.revision) || row.revision<0 ||
      !Number.isFinite(row.expires) || !/^qa-[a-z0-9-]{1,60}$/.test(event.messageId) ||
      typeof event.text!=='string'||!event.text.trim()||event.text.length>512) throw Error('QA_INPUT_DENIED');
  const old=JSON.parse(row.facts), receipts=JSON.parse(row.receipts);
  if (!old || Array.isArray(old) || typeof old!=='object' ||
      !Object.keys(old).every(k=>k==='sku'||k==='pending') ||
      (old.sku!==undefined&&!['F01','F02'].includes(old.sku)) ||
      (old.pending!==undefined&&old.pending!=='black') ||
      !Array.isArray(receipts)||receipts.length>128 ||
      receipts.some(r=>!Array.isArray(r)||r.length!==2||typeof r[0]!=='string'||!Number.isFinite(r[1]))) throw Error('CORRUPT_MEMORY');
  const recent=receipts.filter(r=>r[1]>now);
  if(recent.some(r=>r[0]===event.messageId)) return {duplicate:true};
  if(recent.length>=128) throw Error('QA_CAPACITY');
  const reply=respond('fashion',row.expires>now?old:{},event.text);
  recent.push([event.messageId,now+86400000]);
  return {scope:event.scope,previous:row.revision,revision:row.revision+1,facts:JSON.stringify(reply.state),
    receipts:JSON.stringify(recent),expires:now+1800000,preview:reply.reply};
}
module.exports={transition};
