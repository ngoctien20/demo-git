'use strict';
// ALL records below are fictional QA fixtures, NOT verified merchant data.
const fixedNow=1794700000000;
const S={
 A:{tenant_id:'tenant-a',store_id:'shop-a',bot_id:'bot-a',name:'Tạp hóa Mẫu A',year:'2018',phone:'000-0000-0101',hours:'07:00–20:00',industry:'Tạp hóa',delivery:'Shop A chỉ giao trong khu vực thử nghiệm A.',returns:'Shop A tiếp nhận đổi trả theo phiếu xác minh A.',payments:'Shop A chấp nhận tiền mặt trong fixture.',wholesale:'Shop A có bán theo thùng; giá cần xác minh.'},
 B:{tenant_id:'tenant-b',store_id:'shop-b',bot_id:'bot-b',name:'Thời trang Mẫu B',year:'2021',phone:'000-0000-0202',hours:'09:00–21:00',industry:'Thời trang',delivery:'Shop B chỉ giao trong khu vực thử nghiệm B.',returns:'Shop B hỗ trợ đổi size theo điều kiện fixture B.',payments:'Shop B hỗ trợ COD theo fixture.',wholesale:'Shop B chưa công bố chính sách bán sỉ.'},
 C:{tenant_id:'tenant-c',store_id:'shop-c',bot_id:'bot-c',name:'VLXD Mẫu C',year:'2015',phone:'000-0000-0303',hours:'06:30–18:00',industry:'Vật liệu xây dựng',delivery:'Shop C giao tới công trình theo xác nhận nhân viên.',returns:'Shop C chỉ nhận lại hàng chưa sử dụng theo fixture.',payments:'Shop C có tiền mặt và chuyển khoản theo fixture.',wholesale:'Shop C hỗ trợ đơn sỉ, giá báo theo yêu cầu.'}
};
function binding(letter){const s=S[letter];return {source:'TRUSTED_TENANT_RESOLVER',server_verified:true,tenant_id:s.tenant_id,store_id:s.store_id,bot_id:s.bot_id};}
function entry(letter,topic,value,opts={}){
 const s=S[letter],version='knowledge-'+letter.toLowerCase()+'-1';
 return {entry_id:'e-'+letter.toLowerCase()+'-'+topic.replace(/\./g,'-')+(opts.suffix||''),
  tenant_id:s.tenant_id,store_id:s.store_id,type:topic.startsWith('policy.')?'policy':'profile',
  topic,value,visibility:opts.visibility||'PUBLIC',state:opts.state||'PUBLISHED',
  version:opts.version||version,source_ref:'qa-source-'+letter.toLowerCase(),
  source_status:opts.source_status||'VERIFIED',
  merchant_approved:opts.merchant_approved!==undefined?opts.merchant_approved:true,
  effective_at_ms:opts.effective_at_ms!==undefined?opts.effective_at_ms:fixedNow-100000,
  expires_at_ms:opts.expires_at_ms!==undefined?opts.expires_at_ms:null};
}
function snapshot(letter,options={}){
 const s=S[letter],version='knowledge-'+letter.toLowerCase()+'-1';
 const entries=[
 entry(letter,'profile.name',s.name),
 entry(letter,'profile.founded',s.year),
 entry(letter,'profile.phone',s.phone),
 entry(letter,'profile.hours',s.hours),
 entry(letter,'profile.industry',s.industry),
 entry(letter,'profile.address','Địa chỉ QA giả lập '+letter),
 entry(letter,'policy.delivery',s.delivery),
 entry(letter,'policy.returns',s.returns),
 entry(letter,'policy.payments',s.payments),
 entry(letter,'policy.wholesale',s.wholesale)
 ];
 return {source:'TRUSTED_KNOWLEDGE_READBACK',tenant_id:s.tenant_id,store_id:s.store_id,
   release_state:options.release_state||'PUBLISHED',version,revision:1,entries};
}
function actor(letter,role='TIEN404_SUPPORT',user='staff-qa-1'){
 return {server_verified:true,source:'VERIFIED_STAFF_SESSION',tenant_id:S[letter].tenant_id,store_id:S[letter].store_id,role,user_id:user};
}
function lifecycleEntry(letter,state='DRAFT'){
 return {...entry(letter,'policy.returns',S[letter].returns),entry_id:'lifecycle-'+letter,
 state,created_by:'staff-qa-1',reviewer_user_id:'reviewer-qa-2',reviewer_approved:true};
}
module.exports={S,fixedNow,binding,snapshot,actor,lifecycleEntry,entry};
