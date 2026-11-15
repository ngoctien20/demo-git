export function noticeContract(render) {
  const scope = {tenant:'qa-tenant-a',store:'qa-shop-a',bot:'qa-bot-a'};
  const request = {...scope,id:'fixture-request-a',source:'qa_inbound',code:'T404-0000000000000001',sku:'F01',
    product_label:'Áo thun thử',quantity:2,unit_vnd:'159000',total_vnd:'318000',status:'NEW_PENDING_OWNER'};
  const binding = {...scope,owner_ref:'fixture-owner-a',recipient_ref:'fixture-recipient-a'};
  const alert = {...binding,request_id:request.id,event_kind:'request_saved',channel:'zalo_bot'};
  const cases = [
    ['N01 · đúng shop A',request,alert,binding,true,'318.000đ'],
    ['N02 · đúng shop B',{...request,tenant:'qb',store:'sb',bot:'bb',unit_vnd:'199000',total_vnd:'398000'},
      {...alert,tenant:'qb',store:'sb',bot:'bb',owner_ref:'ob',recipient_ref:'rb'},
      {tenant:'qb',store:'sb',bot:'bb',owner_ref:'ob',recipient_ref:'rb'},true,'398.000đ'],
    ['N03 · shop khác',request,{...alert,store:'other'},binding,true,'RECIPIENT_UNAVAILABLE'],
    ['N04 · bot khác',request,alert,{...binding,bot:'other'},true,'RECIPIENT_UNAVAILABLE'],
    ['N05 · người nhận khác',request,alert,{...binding,recipient_ref:'other'},true,'RECIPIENT_UNAVAILABLE'],
    ['N06 · thiếu readback',null,alert,binding,true,'RECIPIENT_UNAVAILABLE'],
    ['N07 · chưa ghép',request,alert,null,true,'RECIPIENT_UNAVAILABLE'],
    ['N08 · thông báo tắt',request,alert,binding,false,'RECIPIENT_UNAVAILABLE'],
    ['N09 · tổng sai',{...request,total_vnd:'2'},alert,binding,true,'INVALID_READBACK'],
    ['N10 · sai mã yêu cầu',request,{...alert,request_id:'different'},binding,true,'RECIPIENT_UNAVAILABLE'],
    ['N11 · loại sự kiện khác',request,{...alert,event_kind:'quote_preview'},binding,true,'RECIPIENT_UNAVAILABLE'],
    ['N12 · chỉ báo trạng thái đã lưu',{...request,status:'CANCELLED'},alert,binding,true,'Đã từ chối']
  ];
  return cases.map(([test,r,a,b,enabled,expected])=>{
    let actual;
    try {
      const output=render(r,a,b,enabled);
      if([b?.owner_ref,b?.recipient_ref].filter(Boolean).some(ref=>output.includes(ref)))actual='PRIVATE_REFERENCE_IN_PREVIEW';
      else actual=output.includes(expected)?expected:'WRONG_PREVIEW';
    } catch(err) { actual=err.code||'UNEXPECTED_ERROR'; }
    return {test,expected,actual,status:actual===expected?'PASS':'FAIL'};
  });
}
