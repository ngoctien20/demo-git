import test from 'node:test';
import assert from 'node:assert/strict';
import { liteReply, isCommerceConnection } from '../src/lite-commerce.mjs';
import { makeD1 } from './d1-shim.mjs';

// Synthetic actors and products only. These tests call no messaging or AI provider.
function setupHarness() {
  const env = { ZH_DB: makeD1() };
  const c = { id: 'fixture-connection', store_id: 'zl-' + 'a'.repeat(24), flow_mode: 'shared', status: 'active', owner_chat_id: 'owner-thread', owner_user_id: 'owner-person', owner_epoch: 0 };
  env.ZH_DB.sqlite.prepare("INSERT INTO zh_connections(id,store_id,status,bot_id,path_id,wh_secret_hash,forward_url,owner_chat_id,owner_user_id,owner_epoch,connected_at,updated_at,flow_mode) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run(c.id, c.store_id, c.status, 'fake-bot', 'path-fixture', 'hashed-fixture', 'https://fixture.invalid', c.owner_chat_id, c.owner_user_id, c.owner_epoch, 1, 1, c.flow_mode);
  let now = Date.parse('2026-11-26T10:00:00Z');
  const send = (text, chat = c.owner_chat_id, user = c.owner_user_id, connection = c) => liteReply(env, connection, { type: 'text', chat: { id: chat, type: 'PRIVATE' }, user: { id: user, is_bot: false }, text }, now);
  const customer = text => send(text, 'customer-thread', 'customer-person');
  const snapshot = () => {
    const row = env.ZH_DB.sqlite.prepare('SELECT snapshot FROM zh_lite_catalog WHERE connection_id=?').get(c.id);
    return row ? JSON.parse(row.snapshot) : null;
  };
  return { env, c, send, customer, snapshot, advance: ms => { now += ms; } };
}

async function simpleCatalog(h) {
  await h.send('Cài shop | Cửa hàng QA | -');
  await h.send('Sản phẩm | QA1 | Sản phẩm QA một | 12000 | 5');
  await h.send('Bật bot');
}

test('guided setup collects one field at a time, previews private draft, and requires explicit enable', async () => {
  const h = setupHarness();
  assert.match(await h.send('Bắt đầu'), /tên cửa hàng/);
  assert.match(await h.send('Cửa hàng QA'), /đồng ý công khai/);
  assert.match(await h.send('Bỏ qua'), /mã cho sản phẩm/);
  assert.match(await h.send('QA1'), /Tên sản phẩm/);
  assert.match(await h.send('Sản phẩm QA một'), /Giá bán/);
  assert.match(await h.send('12.000'), /bao nhiêu sản phẩm/);
  assert.match(await h.send('5'), /Bản xem trước, chưa áp dụng/);
  assert.equal(h.snapshot().name, '');
  assert.equal(h.snapshot().products.length, 0);
  assert.equal(h.snapshot().setup.draft.products[0].price, 12000);
  assert.equal(await h.customer('QA1 giá bao nhiêu?'), null);
  assert.match(await h.send('Thử QA1'), /12\.000 đ/);
  assert.match(await h.send('Lưu'), /tắt/);
  assert.equal(h.snapshot().setup, undefined);
  assert.equal(h.snapshot().enabled, false);
  assert.equal(await h.customer('QA1'), null);
  assert.match(await h.send('Bật bot'), /bật/);
  assert.match(await h.customer('QA1'), /12\.000 đ/);
  assert.match(await h.customer('Gặp CSKH'), /chưa công khai/);
  assert.equal(h.snapshot().phone, '');
});

test('draft edits leave existing customer catalog unchanged until confirmation and can be cancelled', async () => {
  const h = setupHarness();
  await simpleCatalog(h);
  await h.send('Cài đặt');
  await h.send('Tên mới QA');
  await h.send('0901234567');
  assert.match(await h.customer('QA1'), /Cửa hàng QA/);
  assert.match(await h.customer('Gặp CSKH'), /chưa công khai/);
  assert.match(await h.send('Thử gặp CSKH'), /0901234567/);
  await h.send('Hủy');
  assert.equal(h.snapshot().name, 'Cửa hàng QA');
  assert.equal(h.snapshot().phone, '');
  assert.equal(h.snapshot().enabled, true);
  assert.equal(h.snapshot().setup, undefined);
  await h.send('Cài đặt');
  await h.send('Tên mới QA');
  await h.send('0901234567');
  await h.send('Lưu');
  assert.match(await h.customer('QA1'), /Tên mới QA/);
  assert.match(await h.customer('Gặp CSKH'), /0901234567/);
});

test('add-product wizard never exposes unfinished products, rejects invalid numbers, and expires safely', async () => {
  const h = setupHarness();
  await simpleCatalog(h);
  await h.send('Thêm sản phẩm');
  assert.match(await h.send('QA1'), /Mã này đã có/);
  await h.send('QA2');
  await h.send('Sản phẩm QA hai');
  assert.match(await h.send('-10'), /số đồng nguyên không âm/);
  assert.equal(h.snapshot().setup.step, 'product_price');
  await h.send('33.000 đồng');
  assert.match(await h.send('2.5'), /số nguyên/);
  await h.send('0');
  assert.doesNotMatch(await h.customer('Xem sản phẩm'), /QA2/);
  assert.match(await h.send('Thử QA2'), /33\.000 đ.*hết hàng/);
  h.advance(30 * 60 * 1000);
  assert.match(await h.send('Bật bot'), /hết hạn/);
  assert.equal(h.snapshot().products.length, 1);
  assert.equal(h.snapshot().setup, undefined);
  assert.equal(h.snapshot().enabled, true);
});

test('pause stops customer answers while owner can preview and safely resume', async () => {
  const h = setupHarness();
  await simpleCatalog(h);
  await h.send('Thêm sản phẩm');
  assert.match(await h.send('Tạm dừng'), /tạm dừng trả lời khách/);
  assert.equal(h.snapshot().setup, undefined);
  assert.equal(await h.customer('QA1'), null);
  assert.equal(await h.customer('xin chào'), null);
  assert.match(await h.send('Thử | QA1'), /12\.000 đ/);
  await h.send('Bật bot');
  assert.match(await h.customer('QA1'), /12\.000 đ/);
});

test('customer commands and spoofed owner chat cannot mutate data; real owner user may differ from chat', async () => {
  const h = setupHarness();
  await simpleCatalog(h);
  const before = h.snapshot();
  await h.customer('Cài shop | Bị thay đổi | 0909999999');
  await h.customer('Sản phẩm | QA1 | Đổi giá | 1 | 999');
  await h.send('Tạm dừng', h.c.owner_chat_id, 'another-person');
  await h.send('Bắt đầu', 'another-thread', h.c.owner_user_id);
  assert.deepEqual(h.snapshot(), before);
  assert.match(await h.customer('QA1'), /12\.000 đ/);
  assert.match(await h.send('Xem cấu hình'), /Cửa hàng QA/);
});

test('new pairing epoch hides previous data and blocks stale owner mutations', async () => {
  const h = setupHarness();
  await simpleCatalog(h);
  h.env.ZH_DB.sqlite.prepare("UPDATE zh_connections SET owner_epoch=1,owner_chat_id='new-thread',owner_user_id='new-person' WHERE id=?").run(h.c.id);
  assert.match(await h.send('Sản phẩm | QA1 | Giá giả QA | 1 | 9'), /chưa được lưu/);
  const replacement = { ...h.c, owner_epoch: 1, owner_chat_id: 'new-thread', owner_user_id: 'new-person' };
  assert.doesNotMatch(await h.send('Xem cấu hình', 'new-thread', 'new-person', replacement), /Sản phẩm QA một|12\.000/);
  assert.equal(await h.send('QA1', 'buyer-thread', 'buyer-person', replacement), null);
  await h.send('Bắt đầu', 'new-thread', 'new-person', replacement);
  const row = h.env.ZH_DB.sqlite.prepare('SELECT owner_epoch,snapshot FROM zh_lite_catalog WHERE connection_id=?').get(h.c.id);
  assert.equal(row.owner_epoch, 1);
  assert.equal(JSON.parse(row.snapshot).products.length, 0);
});

test('explicit quick command discards an old wizard draft so it cannot overwrite a newer catalog', async () => {
  const h = setupHarness();
  await simpleCatalog(h);
  await h.send('Cài đặt');
  await h.send('Bản nháp chưa xác nhận');
  await h.send('Cài shop | Tên đã xác nhận | -');
  assert.equal(h.snapshot().setup, undefined);
  await h.send('Lưu');
  assert.equal(h.snapshot().name, 'Tên đã xác nhận');
  assert.match(await h.customer('QA1'), /Tên đã xác nhận/);
});

test('optimistic revision rejects one of two overlapping writes rather than losing the newer change', async () => {
  const h = setupHarness();
  await simpleCatalog(h);
  const responses = await Promise.all([h.send('Cài shop | Tên QA A | -'), h.send('Cài shop | Tên QA B | -')]);
  assert.equal(responses.filter(r => r.includes('chưa được lưu')).length, 1);
  assert.ok(['Tên QA A', 'Tên QA B'].includes(h.snapshot().name));
});

test('QA commerce is selected only by server-side exact allowlist and QA-owned connection', () => {
  const c = { store_id: 'qa-zalo-bot', flow_mode: 'own' };
  assert.equal(isCommerceConnection({}, c), false);
  assert.equal(isCommerceConnection({ ZH_LITE_COMMERCE_QA_STORES: 'qa-zalo-bot' }, c), true);
  assert.equal(isCommerceConnection({ ZH_LITE_COMMERCE_QA_STORES: 'qa-zalo-bot' }, { ...c, store_id: 'qa-zalo-bot-other' }), false);
  assert.equal(isCommerceConnection({ ZH_LITE_COMMERCE_QA_STORES: 'merchant' }, { ...c, store_id: 'merchant' }), false);
  assert.equal(isCommerceConnection({ ZH_LITE_COMMERCE_QA_STORES: 'qa-zalo-bot' }, { ...c, flow_mode: 'shared' }), false);
});


test('edit-product wizard validates SKU and keeps customer price and stock unchanged until explicit save', async () => {
  const h = setupHarness();
  await simpleCatalog(h);
  await h.send('Sản phẩm | QA2 | Sản phẩm QA hai | 33000 | 0');
  assert.match(await h.send('Sửa sản phẩm'), /QA1, QA2/);
  assert.match(await h.send('KHONG-CO'), /Không tìm thấy mã/);
  assert.equal(h.snapshot().setup.step, 'edit_sku');
  assert.match(await h.send('qa1'), /đang có giá 12\.000 đ/);
  assert.match(await h.send('22.500'), /đang có tồn kho 5/);
  assert.match(await h.send('-1'), /số nguyên/);
  const review = await h.send('12');
  assert.match(review, /QA1 \| Sản phẩm QA một \| 22\.500 đ \| tồn 12/);
  assert.doesNotMatch(review, /QA2 \|/);
  assert.match(await h.send('Thử QA1'), /22\.500 đ.*còn 12/);
  assert.match(await h.customer('QA1'), /12\.000 đ.*còn 5/);
  await h.send('Lưu');
  assert.equal(h.snapshot().enabled, true);
  assert.equal(h.snapshot().products.length, 2);
  assert.match(await h.customer('QA1'), /22\.500 đ.*còn 12/);
  assert.match(await h.customer('QA2'), /33\.000 đ.*hết hàng/);
});

test('edit-product keep-current values and save preserve paused status; cancel discards changes', async () => {
  const h = setupHarness();
  await simpleCatalog(h);
  await h.send('Tạm dừng');
  await h.send('Sửa sản phẩm');
  await h.send('QA1');
  await h.send('Giữ nguyên');
  await h.send('0');
  await h.send('Lưu');
  assert.equal(h.snapshot().enabled, false);
  assert.deepEqual(h.snapshot().products[0], { sku: 'QA1', name: 'Sản phẩm QA một', price: 12000, stock: 0 });
  assert.equal(await h.customer('QA1'), null);
  await h.send('Sửa sản phẩm');
  await h.send('QA1');
  await h.send('24.000');
  await h.send('Giữ nguyên');
  assert.match(await h.send('Thử QA1'), /24\.000 đ.*hết hàng/);
  await h.send('Hủy');
  assert.equal(h.snapshot().products[0].price, 12000);
  assert.equal(h.snapshot().products[0].stock, 0);
  await h.send('Bật bot');
  assert.match(await h.customer('QA1'), /12\.000 đ.*hết hàng/);
});

test('expired edit-product draft cannot replace published price and stock', async () => {
  const h = setupHarness();
  await simpleCatalog(h);
  await h.send('Sửa sản phẩm');
  await h.send('QA1');
  await h.send('1000');
  await h.send('100');
  h.advance(30 * 60 * 1000);
  assert.match(await h.send('Lưu'), /hết hạn/);
  assert.equal(h.snapshot().setup, undefined);
  assert.match(await h.customer('QA1'), /12\.000 đ.*còn 5/);
});


