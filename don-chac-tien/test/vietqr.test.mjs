import test from 'node:test';
import assert from 'node:assert/strict';
import { crc16, vietQrPayload, parseVietQr, findBank, bankName } from '../lib/vietqr.mjs';
import { encodeQr, qrSvg } from '../lib/qr.mjs';
import { qrPng } from '../lib/png.mjs';

test('CRC-16/CCITT-FALSE đúng giá trị kiểm chuẩn', () => {
  assert.equal(crc16('123456789'), '29B1');
});

test('VietQR động: đủ trường EMVCo, đúng thứ tự, CRC khớp', () => {
  const p = vietQrPayload({ bin: '970422', account: '0123456789', amount: 318000, memo: 'T404ABCDEF' });
  assert.equal(p, '00020101021238540010A00000072701240006970422011001234567890208QRIBFTTA530370454063180005802VN62140810T404ABCDEF6304' + crc16(p.slice(0, -4)));
  assert.deepEqual(parseVietQr(p), { dynamic: true, bin: '970422', account: '0123456789', service: 'QRIBFTTA', currency: '704', amount: 318000, country: 'VN', memo: 'T404ABCDEF' });
});

test('VietQR tĩnh (in dán quầy): không số tiền, không nội dung', () => {
  const r = parseVietQr(vietQrPayload({ bin: '970436', account: '1012345678' }));
  assert.equal(r.dynamic, false); assert.equal(r.amount, null); assert.equal(r.memo, null);
});

test('sửa 1 ký tự là CRC báo sai', () => {
  const p = vietQrPayload({ bin: '970422', account: '0123456789', amount: 318000, memo: 'T404ABCDEF' });
  assert.equal(parseVietQr(p.replace('318000', '918000')), null);
});

test('từ chối đầu vào sai', () => {
  assert.throws(() => vietQrPayload({ bin: '97042', account: '0123456789', amount: 1 }), /BAD_BANK_BIN/);
  assert.throws(() => vietQrPayload({ bin: '970422', account: '01-23', amount: 1 }), /BAD_ACCOUNT/);
  assert.throws(() => vietQrPayload({ bin: '970422', account: '0123456789', amount: 1.5 }), /BAD_AMOUNT/);
  assert.throws(() => vietQrPayload({ bin: '970422', account: '0123456789', amount: -5 }), /BAD_AMOUNT/);
  assert.throws(() => vietQrPayload({ bin: '970422', account: '0123456789', amount: 1, memo: 'có dấu' }), /BAD_MEMO/);
});

test('tìm ngân hàng theo cách người lớn tuổi gõ', () => {
  assert.equal(findBank('vietcombank').bin, '970436');
  assert.equal(findBank('Ngân hàng Ngoại thương').bin, '970436');
  assert.equal(findBank('MB bank').bin, '970422');
  assert.equal(findBank('techcom').bin, '970407');
  assert.equal(findBank('970418').short, 'BIDV');
  assert.equal(findBank('agri').short, 'Agribank');
  assert.equal(findBank('không biết'), null);
  assert.equal(bankName('Nguyễn Thị Đào'), 'NGUYEN THI DAO');
});

test('QR: đúng kích thước theo phiên bản, PNG hợp lệ, SVG có vùng trắng', () => {
  const qr = encodeQr(vietQrPayload({ bin: '970422', account: '0123456789', amount: 318000, memo: 'T404ABCDEF' }));
  assert.equal(qr.size, qr.version * 4 + 17);
  assert.ok(qr.get(0, 0) && qr.get(6, 6) && !qr.get(7, 7)); // góc định vị
  const png = qrPng(qr, { scale: 4 });
  assert.deepEqual([...png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.match(qrSvg(qr), /^<svg[^>]+viewBox="0 0 (\d+) \1"/);
});

// Giải mã ngược bằng thư viện độc lập (jsQR) nếu có cài: CI cài jsqr+pngjs, máy khác thì bỏ qua.
test('giải mã ngược ảnh PNG ra đúng chuỗi (jsQR)', async (t) => {
  let jsQR, PNG;
  try { jsQR = (await import('jsqr')).default; PNG = (await import('pngjs')).PNG; } catch { t.skip('chưa cài jsqr/pngjs'); return; }
  const samples = [vietQrPayload({ bin: '970422', account: '0123456789', amount: 318000, memo: 'T404ABCDEF' }),
    vietQrPayload({ bin: '970436', account: '1012345678' }), 'x'.repeat(250), 'Tiếng Việt có dấu'];
  for (const s of samples) {
    const png = PNG.sync.read(Buffer.from(qrPng(encodeQr(s), { scale: 4 })));
    const rgba = new Uint8ClampedArray(png.width * png.height * 4);
    for (let i = 0; i < png.width * png.height; i++) { const g = png.data[i * 4]; rgba.set([g, g, g, 255], i * 4); }
    assert.equal(jsQR(rgba, png.width, png.height)?.data, s);
  }
});
