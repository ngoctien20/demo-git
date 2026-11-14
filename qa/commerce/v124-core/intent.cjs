'use strict';

const normalise = text => String(text).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
const skusIn = text => [...new Set((text.match(/\b[a-z]{1,4}\d{2,5}\b/gi) || []).map(s => s.toUpperCase()))];
const intents = new Set(['GREETING','PRODUCT_QUERY','ORDER_PREVIEW','HUMAN','CANCEL','UNKNOWN',
  'COMPARE','WHOLESALE','PROMOTION','RECOMMEND','CONFIRM']);
function parseQuantity(text) {
  const withoutSku = text.replace(/\b[a-z]{1,4}\d{2,5}\b/gi, ' ').trim();
  const numbers = withoutSku.match(/\d+/g);
  if (numbers?.length !== 1 || !/^[1-9]\d{0,3}$/.test(numbers[0])) return null;
  const valid = /(?:\b(?:mua|lay|dat|doi(?: thanh)?|tang len|giam con|so luong)\s+|^)(\d{1,4})(?:\s*(?:cai|chiec|san pham|ao|goi|hop|bo))?(?=$|[ !?]|\.(?:$|\s))/;
  // Only accept a single explicit count. Currency, ranges, decimals and negation require clarification.
  if (/\b(?:gia|vnd|dong|nghin|ngan|trieu|tram|chuc|muoi|ruoi|den|toi da|it nhat)\b|\d+\s*[kđ₫]|\d\s*[-–/,.:]\s*\d|[-−+]\s*\d/.test(withoutSku)) return null;
  return valid.test(withoutSku.replace(/\s+/g,' ')) ? Number(numbers[0]) : null;
}

function classifyFixture({text}) {
  const s = normalise(text), codes = skusIn(s);
  let intent = 'UNKNOWN';
  const buying = /\b(?:mua|lay|dat)\b/.test(s);
  const productQuestion = /\b(?:bao nhieu|gia sao|gia gi|het hang|con hang|con khong|con ko)\b/.test(s);
  if (/\b(?:khieu nai|gap (?:nhan vien|nguoi)|tu van vien|ho tro tu nguoi)\b/.test(s)) intent = 'HUMAN';
  else if (/\b(?:khong|ko|k) (?:muon )?(?:mua|lay|dat)\b|^(?:huy|dung lai|thoi)(?:\s|$)/.test(s)) intent = 'CANCEL';
  else if (/\b(?:so sanh|khac nhau)\b/.test(s)) intent = 'COMPARE';
  else if (/\b(?:gia si|ban si|mua si|gia buon|mua buon|moq)\b/.test(s)) intent = 'WHOLESALE';
  else if (/\b(?:khuyen mai|giam gia|ma giam|phi ship|freeship)\b/.test(s)) intent = 'PROMOTION';
  else if (/^(?:xac nhan|chot don|dong y|ok chot)\b/.test(s)) intent = 'CONFIRM';
  else if (/\b(?:doi (?:sang|qua|mau|ma)|chuyen sang)\b/.test(s)) intent = codes.length ? 'PRODUCT_QUERY' : 'RECOMMEND';
  else if (productQuestion && !/\d\s*(?:cai|ao|hop|chiec)/.test(s)) intent = 'PRODUCT_QUERY';
  else if (buying || /\b(?:doi thanh|tang len|giam con|so luong)\b/.test(s) || /^\d+\s*(?:cai|chiec|ao|bo|hop|goi)?[.!?]?$/.test(s)) intent = 'ORDER_PREVIEW';
  else if (codes.length || /\b(?:gia|giaa|ton|con hang|con ko|con khong|bao nhieu|bn tien|con khum)\b/.test(s)) intent = 'PRODUCT_QUERY';
  else if (/\b(?:tu van|goi y|tim|tuong tu|phu hop)\b/.test(s)) intent = 'RECOMMEND';
  else if (/^(?:xin chao|chao|hi|hello|helo|shop oi)\b/.test(s)) intent = 'GREETING';
  return {intent, sku:codes[0] || 'UNKNOWN', quantity:intent==='ORDER_PREVIEW' ? parseQuantity(s) : null};
}

module.exports = {normalise, skusIn, intents, parseQuantity, classifyFixture};
