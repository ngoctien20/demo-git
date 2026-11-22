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
  assert.deepEqual(voiceRules('mua A003 hai cái', SKUS), { sku: 'A003', skuCount: 1, codeLike: true, nearSku: null, alts: [], intent: 'buy', quantity: 2 });
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
test('decide: AI không chắc, chỉ luật đọc ra mã → hỏi xác nhận mã (V24.2, giọng thật dễ lệch 1 số)', () => {
  const d = decideVoice(parseGemini(gem({ transcript: 'giá a không không ba', intent: 'unknown', sku: null, confidence: 'low' })), SKUS);
  assert.equal(d.reason, 'confirm_sku'); assert.deepEqual(d.suggestSkus, ['A003']);
  const med = decideVoice(parseGemini(gem({ transcript: 'giá A003 bao nhiêu', intent: 'price', sku: 'A003', confidence: 'medium' })), SKUS);
  assert.equal(med.reason, 'confirm_sku', 'AI + luật cùng mã nhưng AI chưa chắc');
  const high = decideVoice(parseGemini(gem({ transcript: 'Áo A không không ba bao nhiêu?', intent: 'price', sku: 'A003', confidence: 'high' })), SKUS);
  assert.equal(high.selectedSku, 'A003', 'Telegram live exec 6427 vẫn trả lời thẳng');
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
test('decide: model chép lại tên sản phẩm thay vì lời khách → hỏi lại (exec 6379-6381)', () => {
  const names = ['Áo thun nam đen basic size L', 'Áo sơ mi nam trắng slimfit size L', 'Áo hoodie xám size XL'];
  const ask = (t, sku) => decideVoice(parseGemini(gem({ transcript: t, intent: 'price', sku, confidence: 'high' })), SKUS, null, names);
  assert.equal(ask('Áo thun nam đen basic size L', 'A003').reason, 'unclear');
  assert.equal(ask('Sơ mi nam trắng slimfit size L', 'A005').reason, 'unclear');
  assert.equal(ask('Cho mình xem áo hoodie xám size XL', 'A007').reason, 'unclear');
  assert.equal(ask('áo thun nam đen size L còn không shop, giá bao nhiêu vậy ạ', 'A003').ok, true, 'câu thật của khách dài hơn tên');
});
test('decide: mã đọc nghe sai chữ cái → không tin mã AI tự đoán (exec 6385)', () => {
  const d = decideVoice(parseGemini(gem({ transcript: 'Cho mình mô đê không không hai hai cái nhé', intent: 'other', sku: 'A002', quantity: 2, confidence: 'high' })), SKUS);
  assert.equal(d.reason, 'sku_conflict');
  const ok = decideVoice(parseGemini(gem({ transcript: 'lấy cho mình cái áo thun đen size L hai cái', intent: 'buy', sku: 'A003', quantity: 2, confidence: 'high' })), SKUS);
  assert.equal(ok.ok, true, 'mô tả sản phẩm, không đọc mã → vẫn tin AI');
  const size = decideVoice(parseGemini(gem({ transcript: 'lấy quần jean đen size ba mươi', intent: 'buy', sku: 'B002', confidence: 'high' })), SKUS);
  assert.equal(size.ok, true, 'size ba mươi không phải mã');
});
test('decide: mã gần đúng từ giọng thật Messenger → hỏi xác nhận, không báo giá (exec 6450/6456)', () => {
  const ask = (t, conf = 'high', sku = null) => decideVoice(parseGemini(gem({ transcript: t, intent: 'price', sku, confidence: conf })), SKUS);
  for (const t of ['A000 bo gió bao nhiêu', 'A00 bò gió bao nhiêu?', 'A không không bo giờ bao nhiêu.']) {
    const d = ask(t);
    assert.equal(d.ok, false, t);
    assert.equal(d.reason, 'confirm_sku', t);
    assert.equal(d.suggestSku, 'A003', t);
    assert.match(d.replyText, /có phải mình hỏi mã A003/);
  }
  assert.equal(ask('Xem lại A000 bao nhiêu', 'low').reason, 'unclear', 'không có tiếng giống "ba" → chỉ hỏi lại');
  assert.equal(ask('A00 bò gió bao nhiêu', 'high', 'A007').reason, 'sku_conflict', 'AI đoán mã khác → không gợi ý');
  assert.equal(voiceRules('mua A003 hai bộ', SKUS).nearSku, null, 'đã có mã đúng thì không gợi ý');
  // exec 6477/6479: cùng file thoại, lần sau Gemini nghe thành A002 → hỏi "A002 hay A003", không báo giá A002
  for (const [t, conf, sku] of [['A002 bo gió bao nhiêu', 'low', null], ['Xem A002 áo không không bo gió bo nhiêu', 'medium', 'A002']]) {
    const d = ask(t, conf, sku);
    assert.equal(d.reason, 'confirm_sku', t);
    assert.deepEqual(d.suggestSkus, ['A002', 'A003'], t);
    assert.match(d.replyText, /A002 hay A003/);
  }
  assert.equal(voiceRules('cho mình xem bộ đồ', SKUS).nearSku, null);
});
