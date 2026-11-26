/**
 * V17.17 exact pure classifier extracted from n8n Messenger Code node.
 * Published workflow ID: Z7FdV7uDvApfbURQ
 * Published version: 1064b1b3-d3f1-4a6b-a367-2414ba691522
 * Read-only DEMO scope; this is a TEST SNAPSHOT, not live Meta HMAC verification.
 * Do not use this file to authenticate providers, issue Store permissions or send messages.
 */
export const classify=function classify(p){
  const raw=String(p?.chatInput??'');
  if(!(p?.pageId==='2379295362359912'&&p?.mediaType==='text'&&raw.startsWith('QA_CORE:')&&/^\d{5,30}$/.test(String(p?.senderId??''))))return null;
  const text=raw.slice(8).trim();
  const norm=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();
  const privacy=/(?:^|[^\w])(?:0\d[\d .()-]{7,13}|\+84[\d .()-]{8,13})(?:$|[^\w])|[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\/|www\.|(?:password|token|credential|api.?key|secret|otp|mat khau|private key|admin|chu shop|quan tri)/i.test(norm);
  const order=/(?:\b(?:tao don|dat hang|chot don|mua|thanh toan|tru kho|giu hang|giu kho|doi don|sua don|huy don|hoan tien|checkout|order|payment|pay)\b)/i.test(norm);
  const human=/\b(?:nhan vien|nguoi that|support|ho tro truc tiep|tu van vien)\b/i.test(norm);
  const wholesale=/\b(?:gia si|ban si|dai ly|si le|so luong lon)\b/i.test(norm);
  const shipping=/\b(?:ship|giao hang|van chuyen|phi ship|phi giao|cuoc van chuyen|bao lau giao)\b/i.test(norm);
  const known=text.match(/\bF[- ]?10[12]\b/i);
  const any=/\b(?:[A-Z]{1,6}[- ]?)?\d{2,8}\b/i.test(text);
  let topic;
  if(!text||text.length>140||privacy)topic='__T404_PRIVATE__';
  else if(order)topic='__T404_ORDER__';
  else if(human)topic='__T404_HUMAN__';
  else if(wholesale)topic='__T404_WHOLESALE__';
  else if(shipping)topic='__T404_SHIPPING__';
  else if(known)topic='F-10'+known[0].replace(/\D/g,'').slice(-1);
  else if(any)topic='__T404_UNKNOWN_SKU__';
  else if(/\b(?:danh muc|danh sach|catalog|san pham|shop co gi|ao|shirt|thun|so mi|phong|gia|bao gia)\b/i.test(norm))topic='__T404_CATALOG__';
  else topic='__T404_UNKNOWN__';
  return {channelType:'messenger',accountId:'2379295362359912',senderId:'V1717_DEMO_TECH_ONLY',chatInput:'QA_CORE: '+topic,mode:'qa_only_read_only',canWrite:false};
};
