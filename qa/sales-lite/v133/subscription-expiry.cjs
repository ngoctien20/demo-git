'use strict';
// Read-only expiry view. Backend subscription status remains authoritative.
const STATES=new Set(['ACTIVE','EXPIRING','EXPIRED','SUSPENDED','PAYMENT_PENDING','UNKNOWN']);
function expiryView(subscription,now=Date.now(),milestones=[7,3,0]){
 const state=STATES.has(subscription?.state)?subscription.state:'UNKNOWN';
 const timestamp=typeof subscription?.expiresAt==='string'?Date.parse(subscription.expiresAt):NaN;
 const expires=Number.isFinite(timestamp)?new Date(timestamp).toISOString():null;
 const remain=expires?Math.ceil((timestamp-now)/86400000):null;
 const valid=Number.isFinite(remain)&&remain>=-3650&&remain<=3650;
 // Do not treat a locally computed date as proof of entitlement.
 const attention=state==='UNKNOWN'||state==='SUSPENDED'||state==='PAYMENT_PENDING';
 let hint='Trạng thái chưa được xác minh; cần kiểm tra với TIEN404.';
 if(state==='ACTIVE'||state==='EXPIRING'){
  if(!valid)hint='Không có ngày hết hạn đã xác minh.';
  else if(remain<=0)hint='Đã tới ngày hết hạn theo dữ liệu đọc; cần backend xác nhận trạng thái.';
  else if(remain<=7)hint='Gói sắp hết hạn. Liên hệ TIEN404 để được hướng dẫn gia hạn.';
  else hint='Gói đang được hiển thị ở chế độ chỉ đọc.';
 } else if(state==='EXPIRED')hint='Gói đã hết hạn theo backend. Không tự gia hạn.';
 else if(state==='SUSPENDED')hint='Gói tạm ngừng. Liên hệ hỗ trợ.';
 else if(state==='PAYMENT_PENDING')hint='Đang chờ xác minh thanh toán; không tự xác nhận đã trả.';
 const thresholds=[...new Set(milestones)].filter(x=>Number.isInteger(x)&&x>=0&&x<=30).sort((a,b)=>b-a);
 const alertEligible=['ACTIVE','EXPIRING','EXPIRED'].includes(state)&&valid;
 const nextAlert=alertEligible?thresholds.find(x=>remain<=x)??null:null;
 return Object.freeze({state,expiresAt:expires,remainingDays:valid?remain:null,
   hint,attention,proposedAlertMilestone:nextAlert,notificationSent:false,subscriptionUpdated:false});
}
module.exports={expiryView};
