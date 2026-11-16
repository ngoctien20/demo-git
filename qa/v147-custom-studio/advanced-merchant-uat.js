'use strict';
/**
 * ADV.5 — Merchant UAT worksheet with human-observed outcomes.
 * No persistence, no network, no browser identity attestation, no live actions.
 */
(function(factory){
 const core=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=core;
 if(typeof window!=='undefined')Object.defineProperty(window,'T404MerchantUAT',{value:core,writable:false});
})(function(){
 const VERSION='T404_ADV5_MERCHANT_UAT_SELF_REPORT_V1';
 const STATUS=Object.freeze(['NOT_RUN','PASS','FAIL','NOT_APPLICABLE']);
 const CASES=Object.freeze([
  {id:'UAT01',scope:'Điện thoại',name:'Đọc được giao diện 320px',steps:'Mở Studio trên điện thoại màn nhỏ; kiểm tra bảng không làm toàn trang bị tràn ngang.',expected:'Chữ và nút điều khiển dễ đọc, có thể cuộn bảng riêng'},
  {id:'UAT02',scope:'Điện thoại',name:'Thao tác được ở 390px',steps:'Chọn Shop và kênh trên điện thoại; thử lưu nháp.',expected:'Không bị che nút Lưu nháp và bảng vẫn dùng được'},
  {id:'UAT03',scope:'Shop A · Messenger',name:'Giá Shop A',steps:'Chọn Shop A, Messenger, ý định Báo giá.',expected:'Chỉ hiển thị giá QA 159.000đ cho hàng của Shop A'},
  {id:'UAT04',scope:'Shop B · Messenger',name:'Giá Shop B',steps:'Đổi Shop B, Messenger, Báo giá.',expected:'Giá QA 209.000đ, không có giá hay sản phẩm Shop A'},
  {id:'UAT05',scope:'Shop C · Widget',name:'Giá Shop C',steps:'Chọn Shop C, Website Widget, Báo giá.',expected:'Chỉ hiển thị giá QA 259.000đ và sản phẩm của Shop C'},
  {id:'UAT06',scope:'Cách ly Shop',name:'Không lẫn cấu hình giữa Shop A/B',steps:'Đổi tên Bot Shop A, lưu; chuyển Shop B rồi quay lại Shop A.',expected:'Shop B giữ tên riêng, Shop A giữ nháp của mình'},
  {id:'UAT07',scope:'Cách ly kênh',name:'Không lẫn giữa Messenger và Zalo Bot',steps:'Lưu lời chào cho Shop A/Messenger, chuyển Shop A/Zalo Bot.',expected:'Lời chào Zalo Bot vẫn độc lập'},
  {id:'UAT08',scope:'Cấu hình bot',name:'Tên, lời chào, giọng điệu',steps:'Đổi tên trợ lý, lời chào và giọng điệu rồi nhấn Lưu nháp.',expected:'Studio phản ánh nháp mới, không yêu cầu đăng nhập thật'},
  {id:'UAT09',scope:'Cấu hình bot',name:'Đặt lại nháp',steps:'Nhấn Đặt lại nháp sau khi đã thay tên Bot.',expected:'Bản nháp trở về giá trị tổng hợp ban đầu'},
  {id:'UAT10',scope:'Tư vấn AI',name:'Xem thử ý định báo giá',steps:'Nhập câu hỏi giá và chọn Tự chọn theo luật QA.',expected:'Được hiển thị như mô phỏng, không tuyên bố đã gọi model thật'},
  {id:'UAT11',scope:'Zalo Bot',name:'Thành phần chưa hỗ trợ có fallback',steps:'Chọn Zalo Bot và đề xuất thẻ sản phẩm hay trả lời nhanh.',expected:'Có fallback an toàn, không bật nút Zalo native chưa xác minh'},
  {id:'UAT12',scope:'Zalo OA',name:'Khóa mẫu ZBS cần phê duyệt',steps:'Chọn Zalo OA, thành phần ZBS.',expected:'Có thông báo khóa vì cần duyệt mẫu/ngân sách; không tính phí'},
  {id:'UAT13',scope:'Quyền truy cập',name:'Tra đơn phải xác minh danh tính',steps:'Chọn Tra mã đơn; thử đề xuất TRACK_ORDER.',expected:'Chỉ nhắc xác minh, không hiện SĐT hay đơn hàng'},
  {id:'UAT14',scope:'Tồn kho',name:'Cảnh báo từ dữ liệu Shop',steps:'Chọn Shop A rồi B, chọn Tồn kho.',expected:'Shop A cảnh báo sắp hết; Shop B không nhận cảnh báo sai'},
  {id:'UAT15',scope:'Bảo mật giao diện',name:'Nút chỉ xem trước',steps:'Kiểm tra nút Xem giá, Yêu cầu đặt hàng, Gặp nhân viên.',expected:'Tất cả nút mô phỏng bị vô hiệu; không thể tạo đơn hoặc gửi tin'},
  {id:'UAT16',scope:'Bàn giao QA',name:'Xuất cấu hình JSON an toàn',steps:'Nhấn Xuất JSON QA và kiểm tra nội dung.',expected:'Không chứa token/mật khẩu/dữ liệu khách thật; releaseAuthorized=false'}
 ].map(x=>Object.freeze(x)));
 const validNotes=x=>typeof x==='string'&&x.length<=280&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(x);
 function createSession({clock=()=>new Date().toISOString(),sessionLabel='LOCAL_SYNTHETIC_UAT'}={}){
  if(typeof clock!=='function'||typeof sessionLabel!=='string'||sessionLabel.length>80||!sessionLabel)
   throw Error('UAT_SESSION_INPUT_INVALID');
  let outcomes=new Map(),revisions=0;
  function update(caseId,status,note=''){
   if(!CASES.some(c=>c.id===caseId))throw Error('UAT_CASE_UNKNOWN');
   if(!STATUS.includes(status))throw Error('UAT_STATUS_DENIED');
   if(!validNotes(note))throw Error('UAT_NOTE_INVALID');
   outcomes.set(caseId,Object.freeze({status,note}));revisions++;
   return inspect();
  }
  function inspect(){
   const rows=CASES.map(c=>Object.freeze({...c,...(outcomes.get(c.id)||{status:'NOT_RUN',note:''})}));
   const counts=Object.fromEntries(STATUS.map(x=>[x,rows.filter(r=>r.status===x).length]));
   return Object.freeze({contract:VERSION,cases:rows.length,revisions,
    counts:Object.freeze(counts),selfReportedComplete:counts.NOT_RUN===0&&counts.FAIL===0,
    independentMerchantAcceptance:false,ownerIdentityVerified:false,
    submissionReceivedByPlatform:false,releaseAuthorized:false,mode:'LOCAL_MEMORY_ONLY'});
  }
  function exportEvidence(){
   const snapshot=inspect();
   const evidence={contract:VERSION,kind:'MERCHANT_SELF_REPORTED_NOT_VERIFIED',
    sessionLabel,generatedAt:clock(),scope:'PUBLIC_SYNTHETIC_QA_ONLY',
    source:'HUMAN_SELF_ASSESSMENT_INPUT_NOT_AUTOMATED_CI',
    canonicalRegistryReleaseCandidate:'T404_ADV5_CANONICAL_RC1_NO_SEND',
    cases:CASES.map(c=>Object.freeze({caseId:c.id,scope:c.scope,
     result:(outcomes.get(c.id)||{status:'NOT_RUN'}).status,
     observation:(outcomes.get(c.id)||{note:''}).note})),
    counts:snapshot.counts,claims:Object.freeze({
     merchantIdentityIndependentlyVerified:false,
     platformReviewCompleted:false,merchantUatApproved:false,productionReady:false,
     noProviderSendAuthorized:true,noOrderWritesAuthorized:true,releaseAuthorized:false
    })};
   return Object.freeze(evidence);
  }
  function reset(){outcomes=new Map();revisions++;return inspect()}
  return Object.freeze({update,inspect,exportEvidence,reset});
 }
 return Object.freeze({VERSION,STATUS,CASES,createSession});
});
