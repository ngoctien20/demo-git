import test from 'node:test';
import assert from 'node:assert/strict';
import { voiceRules, parseGemini, decideVoice, buildVoicePrompt, buildGeminiBody, VOICE_SCHEMA } from '../../channels/lib/voice-understanding.mjs';

const SKUS = ['A001','A002','A003','A004','A005','A006','A007','A008','A009','A010','A011','B002','B003','B004','B005','B006','B007','B008','B009','B010','B011'];
const gem = (o) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(o) }] } }] });

test('rules: đọc mã kiểu nói', () => {
  assert.equal(voiceRules('giá a không không ba bao nhiêu', SKUS).sku, 'A003');
  assert.equal(voiceRules('A003 còn không shop', SKUS).sku, 'A003');
  assert.equal(voiceRules('cho xem bê năm', SKUS).sku, 'B005');
  assert.equal(voiceRules('a ba còn hàng không', SKUS).sku, 'A003');
  assert.equal(voiceRules('a mười', SKUS).sku, 'A010');
  assert.equal(voiceRules('Z999 giá sao', SKUS).sku, null, 'mã ngoài danh mục');
});
test('rules: ý định + số lượng', () => {
  assert.deepEqual(voiceRules('mua A003 hai cái', SKUS), { sku: 'A003', skuCount: 1, intent: 'buy', quantity: 2 });
  assert.equal(voiceRules('mo A003', SKUS).intent, 'buy');
  assert.equal(voiceRules('giá B002', SKUS).intent, 'price');
  assert.equal(voiceRules('đơn của mình giao chưa', SKUS).intent, 'other');
});
test('parseGemini: đọc JSON, chặn giá trị lạ', () => {
  const p = parseGemini(gem({ transcript: ' giá  A003 ', intent: 'price', sku: 'a 003', quantity: 0, confidence: 'high' }));
  assert.equal(p.transcript, 'giá A003'); assert.equal(p.sku, 'A003'); assert.equal(p.quantity, null);
  assert.equal(parseGemini({ error: { message: 'timeout of 15000ms exceeded' } }).error.includes('timeout'), true);
  assert.equal(parseGemini(gem({ transcript: 'x', intent: 'hack', confidence: 'sure' })).confidence, 'low');
});
test('decide: hỏi giá có mã → đi fast path', () => {
  const d = decideVoice(parseGemini(gem({ transcript: 'giá A003 bao nhiêu', intent: 'price', sku: 'A003', confidence: 'high' })), SKUS);
  assert.equal(d.ok, true); assert.equal(d.how, 'agree'); assert.equal(d.selectedSku, 'A003'); assert.equal(d.memoryUserText, '[Tin thoại] giá A003 bao nhiêu');
});
test('decide: muốn mua → AI với gợi ý mã + số lượng', () => {
  const d = decideVoice(parseGemini(gem({ transcript: 'mua A003 hai cái', intent: 'buy', sku: 'A003', quantity: 2, confidence: 'high' })), SKUS);
  assert.equal(d.selectedSku, ''); assert.match(d.text, /^\[Tin nhắn thoại, hệ thống nghe được\] mua A003 hai cái \(mã nghe được: A003, số lượng 2\)$/);
});
test('decide: câu hỏi chung → chuyển transcript cho AI', () => {
  const d = decideVoice(parseGemini(gem({ transcript: 'quần jean nam dưới 400 nghìn có không', intent: 'other', sku: null, confidence: 'high' })), SKUS);
  assert.equal(d.ok, true); assert.equal(d.how, 'transcript'); assert.equal(d.sku, null);
});
test('decide: AI chắc, không có mã → không lấy mã sai từ luật', () => {
  const d = decideVoice(parseGemini(gem({ transcript: 'có áo cho bé 2 tuổi không', intent: 'other', sku: null, confidence: 'high' })), SKUS);
  assert.equal(d.sku, null); assert.equal(d.selectedSku, '');
});
test('decide: AI không chắc nhưng luật đọc ra mã → đi tiếp', () => {
  const d = decideVoice(parseGemini(gem({ transcript: 'giá a không không ba', intent: 'unknown', sku: null, confidence: 'low' })), SKUS);
  assert.equal(d.ok, true); assert.equal(d.how, 'rules'); assert.equal(d.selectedSku, 'A003');
});
test('decide: hỏi lại khi không rõ / lệch mã / lỗi AI / mã bịa', () => {
  assert.equal(decideVoice(parseGemini(gem({ transcript: 'ừm ờ', intent: 'unknown', confidence: 'low' })), SKUS).reason, 'unclear');
  assert.equal(decideVoice(parseGemini(gem({ transcript: 'giá A003', intent: 'price', sku: 'A004', confidence: 'medium' })), SKUS).reason, 'sku_conflict');
  assert.equal(decideVoice(parseGemini({ error: 'timeout' }), SKUS).reason, 'ai_error');
  assert.equal(decideVoice(null, SKUS, 'too_large').ok, false);
  const fake = decideVoice(parseGemini(gem({ transcript: 'giá Z999', intent: 'price', sku: 'Z999', confidence: 'high' })), SKUS);
  assert.equal(fake.ok, true); assert.equal(fake.sku, null); assert.equal(fake.selectedSku, '');
  for (const r of ['unclear', 'sku_conflict', 'ai_error']) assert.match(decideVoice(null, SKUS, r).replyText, /^Dạ shop/);
});
test('prompt + body: có danh mục, schema, không lộ chỉ dẫn lạ', () => {
  const p = buildVoicePrompt([{ sku: 'A003', name: 'Áo thun nam đen basic size L' }, { sku: 'bad', name: 'x' }]);
  assert.match(p, /- A003: Áo thun nam đen basic size L/); assert.doesNotMatch(p, /- bad/);
  const b = buildGeminiBody('QUJD', 'audio/ogg', []);
  assert.equal(b.contents[0].parts[0].inline_data.mime_type, 'audio/ogg');
  assert.deepEqual(b.generationConfig.responseSchema, VOICE_SCHEMA);
});
