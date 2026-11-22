// V21 Phase 2: isolated route simulation using a sanitized snapshot of real n8n DRAFT Code nodes.
// No webhook invoked, no external send, no database writes. Node.js vm uses synthetic inputs only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { decide } from '../lib/bot-bridge.mjs';
import { templateConfig } from '../lib/templates.mjs';

const snapshot = JSON.parse(fs.readFileSync(new URL('./fixtures/messenger-phase2-draft.json', import.meta.url), 'utf8'));
const source = snapshot.nodes;
const ID = 'msg.synthetic.same';
const pageA = '11111111111', pageB = '22222222222';
const senderA = '33333333333', senderB = '44444444444';

function fakeNode(name, items, { webhook = null, original = [], current = null } = {}) {
  const code = source[name]?.code;
  assert.ok(code, 'Missing audited code snapshot for ' + name);
  const $ = (target) => {
    if (target === 'Webhook1') return { first: () => ({ json: { body: webhook } }) };
    if (target === 'Nút menu đã cấu hình?') return { all: () => original };
    if (target === 'Loop One Message') return {
      first: () => ({ json: current }),
      context: { currentRunIndex: 0 },
    };
    throw new Error('Unexpected dependency: ' + target);
  };
  const $input = { all: () => items, first: () => items[0] };
  const out = vm.runInNewContext('(function(){\n' + code + '\n})()', { $, $input }, { timeout: 1000 });
  return JSON.parse(JSON.stringify(out));
}

function item(json) { return { json }; }
function messengerBody(pageId, senderId, payload, { postback = true, id = ID, ts = 1785000000000 } = {}) {
  const event = {
    sender: { id: senderId }, recipient: { id: pageId }, timestamp: ts,
    ...(postback ? { postback: { payload, mid: id } } : {
      message: { mid: id, text: 'Chọn mục', quick_reply: { payload } },
    }),
  };
  return { object: 'page', entry: [{ id: pageId, messaging: [event] }] };
}
function published(config) {
  return { ...config, version_no: 7, config_sha256: 'synthetic-sha',
    menu: config.menu.filter(m => m.enabled) };
}
function simulatedPath({ pageId = pageA, senderId = senderA, payload, config, postback = true, id = ID }) {
  const ts = 1785000000000;
  const body = messengerBody(pageId, senderId, payload, { postback, id, ts });
  const extracted = item({ pageId, senderId, messageId: id, mediaType: postback ? 'postback' : 'text',
    chatInput: postback ? 'Khách nhấn nút' : 'Chọn mục', receivedAt: 'synthetic' });
  const tagged = fakeNode('Tìm nút menu', [extracted], { webhook: body });
  const mode = tagged[0].json.menuPayload ? decide(config, { payload: tagged[0].json.menuPayload }) : { mode: 'legacy' };
  const decision = config && mode.mode === 'catalog' ? { ...mode, configVersion: config.version_no } : mode;
  const applied = fakeNode('Áp quyết định menu', [item(decision)], { original: tagged });
  const classified = fakeNode('Classify explicit human request', applied);
  return { tagged: tagged[0].json, mode, applied: applied[0].json, classified: classified[0].json };
}
function messagePreview(current) {
  return fakeNode('Prepare Messenger Reply', [item({ output: '' })], { current })
    .map(x => x.json.messengerMessage);
}
function preTransferMessage(classified) {
  const expression = source['Notify customer and Inbox of handoff request'].jsonBody;
  assert.ok(expression.startsWith('={{') && expression.endsWith('}}'));
  const result = vm.runInNewContext(expression.slice(3, -2), { $json: classified }, { timeout: 1000 });
  return JSON.parse(result).message.text;
}

test('snapshot corresponds to the reviewed draft, not a published workflow', () => {
  assert.equal(snapshot.workflow, 'Z7FdV7uDvApfbURQ');
  assert.equal(snapshot.activeVersionBaseline, '47b48f6d-bc3d-40ae-afe6-96c5fd5452ac');
  assert.ok(snapshot.draftVersion && snapshot.draftVersion !== snapshot.activeVersionBaseline);
  assert.match(source['Tìm nút menu'].code, /JSON\.stringify\(\[page,sid,id\]\)/);
});

test('postback: shop configured catalog routes to read-only catalog page, not AI', () => {
  const s = simulatedPath({ payload: 'T404:M:catalog', config: published(templateConfig('shop')) });
  assert.equal(s.tagged.menuPayload, 'T404:M:catalog');
  assert.equal(s.mode.mode, 'catalog');
  assert.equal(s.applied.mediaType, 'catalog_page');
  assert.equal(s.applied.catalogPage, 1);
  assert.equal(s.applied.catalogItemId, 'catalog');
  assert.equal(s.applied.catalogVersion, 7);
  assert.equal(s.classified.pauseAction, '');
});

test('quick reply: artist profile returns only approved text in one outgoing message', () => {
  const c = templateConfig('artist');
  c.profile = { display_name: 'Nghệ sĩ QA', bio: 'Thông tin thử nghiệm được duyệt.' };
  const s = simulatedPath({ payload: 'T404:M:profile', config: published(c), postback: false });
  assert.equal(s.mode.mode, 'direct');
  assert.equal(s.classified.mediaType, 'menu_reply');
  assert.deepEqual(messagePreview(s.classified), [{ text: 'Nghệ sĩ QA\nThông tin thử nghiệm được duyệt.' }]);
});

test('manager handoff carries allowed team and pre-transfer wording, without claiming transfer completed', () => {
  const s = simulatedPath({ payload: 'T404:M:manager', config: published(templateConfig('artist')) });
  assert.equal(s.mode.mode, 'handoff');
  assert.equal(s.applied.menuHandoffTeam, 'manager');
  assert.equal(s.classified.pauseAction, 'handoff');
  const pre = preTransferMessage(s.classified);
  assert.match(pre, /đội ngũ quản lý/);
  assert.match(pre, /đang gửi yêu cầu chuyển/);
  assert.doesNotMatch(pre, /đã chuyển|gặp trực tiếp nghệ sĩ/i);
});

test('shop legacy button does not get hijacked by new menu correlation', () => {
  const s = simulatedPath({ payload: 'TIEN404:VIEW:A002', config: published(templateConfig('shop')) });
  assert.equal(s.tagged.menuPayload, undefined);
  assert.equal(s.mode.mode, 'legacy');
});

test('disabled/stale new item produces current-menu fallback, no AI/tool execution', () => {
  const cfg = templateConfig('shop');
  const disabled = cfg.menu.find(i => i.id === 'catalog');
  assert.ok(disabled);
  disabled.enabled = false;
  const s = simulatedPath({ payload: 'T404:M:catalog', config: published(cfg) });
  assert.equal(s.mode.mode, 'rejected');
  assert.equal(s.classified.mediaType, 'menu_reply');
  assert.match(messagePreview(s.classified)[0].text, /Chào|shop|trợ lý/i);
  assert.ok(messagePreview(s.classified)[0].quick_replies.every(x => x.payload !== 'T404:M:catalog'));
});

test('new item with no configuration returns a safe message; forged payload is rejected', () => {
  const noMenu = simulatedPath({ payload: 'T404:M:manager', config: null });
  assert.equal(noMenu.mode.mode, 'rejected');
  assert.equal(noMenu.mode.reason, 'menu_unavailable');
  assert.match(messagePreview(noMenu.classified)[0].text, /không khả dụng/);
  const forged = simulatedPath({ payload: 'T404:M:__proto__', config: published(templateConfig('shop')) });
  assert.equal(forged.mode.mode, 'rejected');
  assert.equal(forged.classified.mediaType, 'menu_reply');
});

test('GET STARTED uses published menu and does not force a shop-specific assistant reply', () => {
  const s = simulatedPath({ payload: 'TIEN404:START', config: published(templateConfig('artist')) });
  assert.equal(s.mode.mode, 'greeting');
  assert.equal(s.classified.mediaType, 'menu_reply');
  const reply = messagePreview(s.classified)[0];
  assert.ok(reply.quick_replies?.some(q => q.payload === 'T404:M:manager'));
});

test('mixed-page batch: same message id never crosses Page or sender boundaries', () => {
  const body = { object: 'page', entry: [
    { id: pageA, messaging: [{ sender: { id: senderA }, message: { mid: ID, quick_reply: { payload: 'T404:M:catalog' } } }] },
    { id: pageB, messaging: [{ sender: { id: senderB }, message: { mid: ID, quick_reply: { payload: 'T404:M:profile' } } }] },
  ] };
  const base = { messageId: ID, mediaType: 'text', chatInput: 'Chọn mục' };
  const items = [item({ ...base, pageId: pageA, senderId: senderA }),
    item({ ...base, pageId: pageB, senderId: senderB }),
    item({ ...base, pageId: pageB, senderId: senderA })];
  const tagged = fakeNode('Tìm nút menu', items, { webhook: body }).map(x => x.json.menuPayload);
  assert.deepEqual(tagged, ['T404:M:catalog', 'T404:M:profile', undefined]);
});

test('quick reply without mid uses the same synthetic ID fallback as Extract Messenger Text', () => {
  const ts = 1785000000000;
  const body = messengerBody(pageA, senderA, 'T404:M:catalog', { postback: false, ts });
  delete body.entry[0].messaging[0].message.mid;
  const syntheticId = 'attachment_' + senderA + '_' + ts;
  const tagged = fakeNode('Tìm nút menu', [item({
    pageId: pageA, senderId: senderA, messageId: syntheticId, mediaType: 'text',
  })], { webhook: body });
  assert.equal(tagged[0].json.menuPayload, 'T404:M:catalog');
});

test('same composite event id duplicated in webhook cannot change first selected action', () => {
  const body = messengerBody(pageA, senderA, 'T404:M:catalog', { postback: false });
  body.entry[0].messaging.push({
    sender: { id: senderA }, message: { mid: ID, quick_reply: { payload: 'T404:M:handoff' } },
  });
  const tagged = fakeNode('Tìm nút menu', [item({ pageId: pageA, senderId: senderA, messageId: ID, mediaType: 'text' })], { webhook: body });
  assert.equal(tagged[0].json.menuPayload, 'T404:M:catalog');
});

test('Meta handoff success gate protects waiting label; failure has no path to label', () => {
  const edges = snapshot.connections;
  const main = edges['Handoff succeeded?'].main;
  assert.ok(main[0].some(x => x.node === 'Apply waiting staff Inbox label'));
  assert.ok(!main[1] || !main[1].some(x => x.node === 'Apply waiting staff Inbox label'));
  assert.ok(source['Handoff succeeded?'].conditions.conditions[0].leftValue.includes('$json.success === true'));
  assert.ok(edges['Notify customer and Inbox of handoff request'].main[0].some(x => x.node === 'Pass Messenger Thread to Page Inbox'));
  assert.ok(edges['Pass Messenger Thread to Page Inbox'].main[0].some(x => x.node === 'Handoff succeeded?'));
});

function prepareCatalog(reply, currentPatch = {}) {
  const current = { pageId: pageA, senderId: senderA, messageId: ID, receivedAt: 'synthetic',
    mediaType: 'text', chatInput: 'Shop đang có những sản phẩm nào?', ...currentPatch };
  return fakeNode('Prepare Messenger Reply', [item({ output: reply })], { current })
    .map(x => x.json.messengerMessage);
}

test('catalog with four SKU lines still offers first three native tap buttons (P1 mobile)', () => {
  const reply = [
    '- A002 — Áo thun nam trắng, 159.000đ',
    '- A003 — Áo thun nam đen, 159.000đ',
    '- A004 — Áo polo nam, 289.000đ',
    '- A005 — Áo sơ mi nam, 329.000đ',
  ].join('\n');
  const messages = prepareCatalog(reply);
  assert.equal(messages.length, 1);
  const buttons = messages[0].attachment?.payload?.buttons;
  assert.ok(buttons, 'customer must see clickable product choices even when catalog has >3 SKUs');
  assert.deepEqual(buttons.map(x => x.payload), [
    'TIEN404:VIEW:A002', 'TIEN404:VIEW:A003', 'TIEN404:VIEW:A004',
  ]);
  assert.ok(buttons.every(x => x.type === 'postback'));
});

test('numbered product list also provides native tap buttons', () => {
  const messages = prepareCatalog([
    '1. A002 — Áo thun nam trắng',
    '2) A003 — Áo thun nam đen',
    '3. A004 — Áo polo nam',
    '4. A005 — Áo sơ mi nam',
  ].join('\n'));
  assert.deepEqual(messages[0].attachment?.payload?.buttons?.map(x => x.payload), [
    'TIEN404:VIEW:A002', 'TIEN404:VIEW:A003', 'TIEN404:VIEW:A004',
  ]);
});

test('long catalog stays at most three messages and ends with selectable buttons', () => {
  const lines = Array.from({ length: 12 }, (_, i) => {
    const sku = 'A' + String(i + 2).padStart(3, '0');
    return '- ' + sku + ' — ' + 'Áo kiểm thử '.repeat(10);
  });
  const messages = prepareCatalog(lines.join('\n'));
  assert.ok(messages.length >= 2 && messages.length <= 3);
  assert.equal(messages.at(-1).attachment?.payload?.buttons?.length, 3);
});

test('ordinary response with no confirmed SKU does not invent product buttons', () => {
  const messages = prepareCatalog('Mình đang kiểm tra danh mục, bạn vui lòng hỏi lại sau nhé.');
  assert.equal(messages.length, 1);
  assert.equal(messages[0].attachment, undefined);
});

function formatProduct(selectedSku, rows) {
  const selected = { selectedSku, pageId: pageA, senderId: senderA, messageId: ID };
  return fakeNode('Format selected product', rows.map(item), { current: selected })[0].json.output;
}

test('product lookup: Google Sheets Demo is read-only and no-match still reaches formatter', () => {
  const read = source['Read selected demo product'].settings;
  assert.equal(read.sourceTag, 'AI_SALES_DEMO_READ_ONLY');
  assert.equal(read.operation, 'read');
  assert.equal(read.hasSkuFilter, true);
  assert.equal(read.alwaysOutputData, true);
  const edges = snapshot.connections;
  assert.ok(edges['Read selected demo product'].main[0].some(x => x.node === 'Format selected product'));
  assert.ok(edges['Format selected product'].main[0].some(x => x.node === 'Remember selected Messenger product'));
  assert.ok(edges['Remember selected Messenger product'].main[0].some(x => x.node === 'Forward selected product reply'));
  assert.ok(edges['Forward selected product reply'].main[0].some(x => x.node === 'Prepare Messenger Reply'));
  assert.ok(!JSON.stringify(edges['Read selected demo product']).includes('create_order'));
});

test('product A002 matches the read-only DEMO catalog snapshot, not customer-supplied price', () => {
  assert.equal(formatProduct('A002', [{
    sku: 'A002', name: 'Áo thun nam trắng basic size M', price: 159000, stock: 25,
  }]), 'A002 — Áo thun nam trắng basic size M | 159.000đ/cái. Còn 25 cái.');
});

test('product A011 with zero stock is not recommended as available', () => {
  const actual = formatProduct('A011', [{
    sku: 'A011', name: 'Áo polo nam đen size XL', price: 289000, stock: 0,
  }]);
  assert.match(actual, /289.000đ\/cái/);
  assert.match(actual, /đã hết hàng/);
  assert.doesNotMatch(actual, /Còn \d+ cái/);
});

test('missing SKU Z999 returns no-data response and no unrelated product', () => {
  const actual = formatProduct('Z999', [{}]); // n8n Always Output Data emits one empty item
  assert.match(actual, /chưa tìm thấy mẫu Z999/);
  assert.doesNotMatch(actual, /A002|159.000đ|Còn \d+/);
});

test('mismatched row must not leak another SKU as the chosen product', () => {
  const actual = formatProduct('A002', [{ sku: 'A003', name: 'Áo thun nam đen basic size L', price: 159000, stock: 18 }]);
  assert.match(actual, /chưa tìm thấy mẫu A002/);
  assert.doesNotMatch(actual, /A003|Áo thun nam đen/);
});

test('duplicate SKU rows fail closed without selecting an arbitrary price', () => {
  const actual = formatProduct('A002', [
    { sku: 'A002', name: 'Áo thun nam trắng basic size M', price: 159000, stock: 25 },
    { sku: 'A002', name: 'Áo thun nam trắng basic size M', price: 139000, stock: 25 },
  ]);
  assert.match(actual, /chưa xác minh được/);
  assert.doesNotMatch(actual, /139.000đ|159.000đ/);
});

test('malformed prices or impossible stock are never presented as verified', () => {
  const base = { sku: 'A002', name: 'Áo thun nam trắng basic size M', price: 159000, stock: 25 };
  for (const patch of [{price: '159.000'}, {price: -500}, {price: 12.5}, {stock: -1}, {stock: 1.4},
    {price: Number.MAX_SAFE_INTEGER + 10}, {name: ''}]) {
    assert.match(formatProduct('A002', [{ ...base, ...patch }]), /chưa xác minh được/,
      'bad case ' + JSON.stringify(patch));
  }
});

test('normal non-menu text remains on legacy text route', () => {
  const body = { object: 'page', entry: [{ id: pageA, messaging: [{
    sender: { id: senderA }, message: { mid: ID, text: 'Cho xem áo' },
  }] }] };
  const tags = fakeNode('Tìm nút menu', [item({ pageId: pageA, senderId: senderA, messageId: ID,
    mediaType: 'text', chatInput: 'Cho xem áo' })], { webhook: body });
  assert.equal(tags[0].json.menuPayload, undefined);
});

test('Next-page quick reply resolves through the same published-config bridge route',()=>{
  const cfg=published(templateConfig('shop'));
  const s=simulatedPath({payload:'T404:C:catalog:7:deadbeef:2',config:cfg,postback:false});
  assert.equal(s.tagged.menuPayload,'T404:C:catalog:7:deadbeef:2');
  assert.equal(s.mode.mode,'catalog');
  assert.equal(s.classified.mediaType,'catalog_page');
  assert.equal(s.classified.catalogPage,2);
  assert.equal(s.classified.catalogVersion,7);
  assert.equal(s.classified.catalogDigest,'deadbeef');
});

test('stale/forged catalog cursors cannot reach catalog data or product tools',()=>{
  const cfg=published(templateConfig('shop'));
  for(const payload of ['T404:C:catalog:6:deadbeef:2','T404:C:catalog:7:deadbeef:100',
    'T404:C:order_lookup:7:deadbeef:2','T404:C:catalog:7:deadbeef:-1']){
    const s=simulatedPath({payload,config:cfg});
    assert.equal(s.mode.mode,'rejected',payload);
    assert.equal(s.classified.mediaType,'menu_reply');
    assert.notEqual(s.classified.mediaType,'catalog_page');
    assert.ok(messagePreview(s.classified)[0].text);
  }
});

test('catalog route is read-only and bypasses the AI/transaction tools',()=>{
  const e=snapshot.connections;
  assert.ok(e['Trả lời menu cố định?'].main[1].some(x=>x.node==='Danh mục Messenger cần phân trang?'));
  assert.ok(e['Danh mục Messenger cần phân trang?'].main[0].some(x=>x.node==='Đọc danh mục Products DEMO'));
  assert.ok(e['Danh mục Messenger cần phân trang?'].main[1].some(x=>x.node==='Product detail postback?'));
  assert.ok(e['Đọc danh mục Products DEMO'].main[0].some(x=>x.node==='Trình bày trang danh mục Messenger'));
  assert.ok(e['Trình bày trang danh mục Messenger'].main[0].some(x=>x.node==='Prepare Messenger Reply'));
  assert.equal(source['Đọc danh mục Products DEMO'].settings.operation,'read');
  assert.equal(source['Đọc danh mục Products DEMO'].settings.sourceTag,'AI_SALES_DEMO_READ_ONLY');
  assert.equal(source['Đọc danh mục Products DEMO'].settings.alwaysOutputData,true);
  assert.equal(source['Đọc danh mục Products DEMO'].settings.hasFilter,false);
  assert.match(source['Extract Messenger Text'].code,/action\.startsWith\('T404:C:'\)/);
});

test('catalog message from validated renderer is sent as one Meta template with next-page quick reply',()=>{
  const current={pageId:pageA,senderId:senderA,messageId:ID,receivedAt:'synthetic',mediaType:'catalog_page'};
  const msg={attachment:{type:'template',payload:{template_type:'button',
    text:'Danh mục trang 1/2',
    buttons:[{type:'postback',title:'Xem A002',payload:'TIEN404:VIEW:A002'}]}},
    quick_replies:[{content_type:'text',title:'Trang tiếp',payload:'T404:C:catalog:7:deadbeef:2'}]};
  const prepared=fakeNode('Prepare Messenger Reply',[item({catalogMessage:msg})],{current});
  assert.equal(prepared.length,1);
  assert.equal(prepared[0].json.messageCount,1);
  assert.equal(prepared[0].json.messengerMessage.attachment.payload.buttons[0].payload,'TIEN404:VIEW:A002');
  assert.equal(prepared[0].json.messengerMessage.quick_replies[0].payload,'T404:C:catalog:7:deadbeef:2');
});

test('concurrent reaction shadow stays ALL OFF and preserves existing handoff routing',()=>{
  const edges=snapshot.connections;
  const shadow=source['V21 Social Reactions Shadow (ALL OFF)'].settings;
  assert.equal(shadow.shadowOnly,true);
  assert.equal(shadow.allPagesOff,true);
  assert.equal(shadow.hasNoSend,true);
  assert.ok(edges['Classify explicit human request'].main[0].some(e=>e.node==='V21 Social Reactions Shadow (ALL OFF)'));
  assert.ok(edges['V21 Social Reactions Shadow (ALL OFF)'].main[0].some(e=>e.node==='Human handoff request?'));
  assert.ok(!JSON.stringify(edges['V21 Social Reactions Shadow (ALL OFF)']).includes('Send Messenger Reply'));
});

function verifyMetaSend({planned=1,receipts=null,planIndex=1}={}) {
  const original={messageCount:planned,messageIndex:planIndex,pageId:pageA,senderId:senderA,
    messageId:ID,replyText:'Synthetic catalog QA'};
  const confirmations=receipts??Array.from({length:planned},(_,i)=>({
    recipient_id:senderA,message_id:'meta.synthetic.out.'+(i+1)
  }));
  const $ = (name)=>{
    assert.equal(name,'Prepare Messenger Reply');
    return {first:()=>({json:original}),context:{currentRunIndex:0}};
  };
  const $input={all:()=>confirmations.map(item)};
  const code=source['Verify Messenger Send Result'].code;
  return JSON.parse(JSON.stringify(vm.runInNewContext('(function(){\n'+code+'\n})()',{$,$input},{timeout:1000})));
}

test('Meta send receipt: one requested catalog template needs exactly one confirmation',()=>{
  const verified=verifyMetaSend({planned:1});
  assert.equal(verified.length,1);
  assert.equal(verified[0].json.sentMessageCount,1);
  assert.equal(verified[0].json.metaMessageId,'meta.synthetic.out.1');
});

test('Meta send receipt: three-part AI answer requires all three distinct Meta IDs',()=>{
  const verified=verifyMetaSend({planned:3});
  assert.equal(verified[0].json.sentMessageCount,3);
  assert.deepEqual(verified[0].json.metaMessageIds,
    ['meta.synthetic.out.1','meta.synthetic.out.2','meta.synthetic.out.3']);
});

test('Meta partial transport success never records inbound as fully answered',()=>{
  assert.throws(()=>verifyMetaSend({planned:3,receipts:[{
    recipient_id:senderA,message_id:'meta.synthetic.only.one'
  }]}),/Incomplete Messenger Send API confirmations/);
  assert.throws(()=>verifyMetaSend({planned:2,receipts:[]}),/Incomplete Messenger Send API confirmations/);
});

test('Meta send plan count is required and cannot be faked by extra receipts',()=>{
  for(const planned of [0,4,-1,1.5,'not-a-number']){
    assert.throws(()=>verifyMetaSend({planned,receipts:[]}),/Invalid Messenger reply plan/);
  }
  assert.throws(()=>verifyMetaSend({planned:1,planIndex:2}),/Invalid Messenger reply plan/);
  assert.throws(()=>verifyMetaSend({planned:1,receipts:[
    {recipient_id:senderA,message_id:'mid.one'},
    {recipient_id:senderA,message_id:'mid.two'},
  ]}),/Incomplete Messenger Send API confirmations/);
});

test('Meta send receipt rejects mismatched recipient, missing MID and duplicated MIDs',()=>{
  assert.throws(()=>verifyMetaSend({planned:1,receipts:[{
    recipient_id:senderB,message_id:'meta.synthetic'
  }]}),/did not confirm intended recipient/);
  assert.throws(()=>verifyMetaSend({planned:1,receipts:[{
    recipient_id:senderA,code:190,error:'Auth expired'
  }]}),/did not confirm intended recipient/);
  assert.throws(()=>verifyMetaSend({planned:2,receipts:[
    {recipient_id:senderA,message_id:'duplicate.mid'},
    {recipient_id:senderA,message_id:'duplicate.mid'},
  ]}),/duplicate message ID/);
});

test('Meta inbound dedupe marker is structurally AFTER full Send receipt verification',()=>{
  const edges=snapshot.connections;
  assert.ok(edges['Prepare Messenger Reply'].main[0].some(e=>e.node==='Send Messenger Reply - CONFIGURE TOKEN'));
  assert.ok(edges['Send Messenger Reply - CONFIGURE TOKEN'].main[0].some(e=>e.node==='Verify Messenger Send Result'));
  assert.ok(edges['Verify Messenger Send Result'].main[0].some(e=>e.node==='Record Successful Messenger MID'));
  assert.ok(!edges['Send Messenger Reply - CONFIGURE TOKEN'].main[0].some(e=>e.node==='Record Successful Messenger MID'));
  assert.equal(source['Record Successful Messenger MID'].settings.writesEventDedupeRow,true);
});
