// The staging ingress assigns a contiguous sequence starting at 1 for each binding.
// Text is parsed on arrival. Only validated operations can enter the reorder buffer.
function parseTurn(text) {
  if(typeof text!=='string'||text.length>512) throw Error('INVALID_TEXT');
  const q=text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').trim().replace(/[.!?]+$/,'');
  if (/^(?:thoi |minh )?(?:huy|bo qua|khong lay|khong mua)(?: nua)?$/.test(q)) return ['cancel'];
  if (/^(?:size )?l$/.test(q)) return ['size'];
  if (/^(?:shop )?(?:con )?ao den(?: khong)?$/.test(q)) return ['black'];
  if (/^f0[12]$/.test(q)) return ['sku',q.toUpperCase()];
  const qty=q.match(/^(?:thoi |minh )?(?:lay|mua) ([1-9]\d{0,2})(?: (?:cai|ao|thoi|nhe))?$/);
  return qty?['qty',Number(qty[1])]:['clarify'];
}
function validOp(op) {
  return Array.isArray(op) && (op.length===1&&['cancel','size','black','clarify'].includes(op[0]) ||
    op.length===2&&(op[0]==='sku'&&['F01','F02'].includes(op[1]) ||
      op[0]==='qty'&&Number.isSafeInteger(op[1])&&op[1]>=1&&op[1]<=999));
}
function advance(row,event,now,respond) {
  if(!['qa-order-a','qa-order-b'].includes(event.scope)||row.scope!==event.scope||
    !Number.isSafeInteger(event.seq)||event.seq<1||!Number.isSafeInteger(row.rev)||row.rev<0||
    !Number.isSafeInteger(row.cursor)||row.cursor<0||!/^qa-[a-z0-9-]{1,48}$/.test(event.id)) throw Error('BAD_BINDING_OR_EVENT');
  let buffered=JSON.parse(row.buffer),seen=JSON.parse(row.seen),state=JSON.parse(row.facts);
  if(!Array.isArray(buffered)||buffered.length>16||!Array.isArray(seen)||seen.length>64||
     buffered.some(x=>!Number.isSafeInteger(x.seq)||x.seq<=row.cursor||!validOp(x.op))||
     !state||!Number.isFinite(row.expires)) throw Error('BAD_ROW');
  let cursor=row.cursor;
  if(row.expires<=now) {state={}; if(buffered.length) throw Error('EXPIRED_GAP_REQUIRES_NEW_BINDING');}
  const op=parseTurn(event.text);
  const prior=[...seen,...buffered].find(x=>x.id===event.id||x.seq===event.seq);
  if(prior&&(prior.id!==event.id||prior.seq!==event.seq||JSON.stringify(op)!==JSON.stringify(prior.op))) throw Error('IDENTITY_CONFLICT');
  if(prior||event.seq<=cursor) return {skip:true};
  if(event.seq>cursor+16) throw Error('GAP_LIMIT');
  buffered.push({id:event.id,seq:event.seq,op});
  buffered.sort((a,b)=>a.seq-b.seq);
  let preview=null;
  while(buffered.length && buffered[0].seq===cursor+1) {
    const entry=buffered.shift(),[kind,value]=entry.op;
    const input={cancel:'hủy',size:'size L',black:'áo đen',sku:value,qty:'lấy '+value,clarify:'?'}[kind];
    const result=respond('fashion',state,input);
    if(result.kind==='preview') state={sku:result.facts.sku,quantity:result.facts.qty};
    else if(['cancel','size','catalog','empty'].includes(result.kind)) state=result.state;
    preview=result.reply;
    cursor=entry.seq;
    seen.push(entry);
  }
  return {scope:row.scope,prev:row.rev,rev:row.rev+1,cursor,seen:JSON.stringify(seen.slice(-64)),
    buffer:JSON.stringify(buffered),facts:JSON.stringify(state),expires:now+1800000,preview};
}
module.exports={advance,parseTurn};
