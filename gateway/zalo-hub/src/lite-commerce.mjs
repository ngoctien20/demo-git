// Lite only: trusted Hub webhook determines identity. Never use customer text as authority.
// Draft setup is private to the paired owner; only explicit confirmation changes live data.
import { botLink } from './web-store.mjs';
import { classifyIntent } from './lite-intent.mjs';

const SETUP_TTL_MS = 30 * 60 * 1000;
const MAX_PRODUCTS = 50;
const empty = () => ({ name: '', phone: '', enabled: false, products: [] });
const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
const skuRE = /^[A-Z0-9_-]{1,24}$/;
const tokenLike = /\d{5,20}:[A-Za-z0-9_-]{8,128}/;
const publicText = (s, n) => typeof s === 'string' && s.length > 0 && s.length <= n && !/[\p{Cc}\p{Cf}|<>]/u.test(s) && !tokenLike.test(s);
const validPhone = s => s === '' || /^\+?[0-9][0-9 .-]{6,18}$/.test(s);
const integer = (n, max) => Number.isSafeInteger(n) && n >= 0 && n <= max;
const money = n => new Intl.NumberFormat('vi-VN').format(n) + ' đ';
const copyProducts = products => products.map(p => ({ ...p }));
const setupSteps = new Set(['shop_name', 'phone', 'product_sku', 'product_name', 'product_price', 'product_stock', 'edit_sku', 'edit_price', 'edit_stock', 'review']);
const guide = 'Chủ shop tự cài bằng tin nhắn:\nBắt đầu — bot hướng dẫn từng bước\nThêm sản phẩm\nSửa sản phẩm — đổi giá hoặc tồn kho\nXem cấu hình\nThử câu hỏi của khách\nBật bot / Tạm dừng\nHủy — bỏ bước cài đang làm\n\nLệnh nhanh:\nCài shop | Tên shop | Số CSKH công khai hoặc -\nSản phẩm | Mã | Tên | Giá VND | Tồn kho\nẨn sản phẩm | Mã';
const unavailable = 'Dạ, cửa hàng chưa có thông tin để tư vấn chính xác. Bác vui lòng liên hệ cửa hàng giúp em.';
const conflict = 'Cấu hình chưa được lưu vì trạng thái vừa thay đổi. Bác nhắn “Xem cấu hình” rồi thử lại.';

export const isLiteConnection = c => c?.flow_mode === 'shared' && /^zl-[0-9a-f]{24}$/.test(c.store_id);
export const isCommerceConnection = (env, c) => isLiteConnection(c) || (c?.flow_mode === 'own' && /^qa-/.test(c.store_id) && String(env.ZH_LITE_COMMERCE_QA_STORES || '').split(',').map(s => s.trim()).includes(c.store_id));

function validProduct(p) {
  return p && typeof p.sku === 'string' && skuRE.test(p.sku) && publicText(p.name, 80) && integer(p.price, 1000000000) && integer(p.stock, 1000000);
}

function readCatalog(value, requireEnabled = true) {
  if (!value || typeof value !== 'object' || (value.name !== '' && !publicText(value.name, 70)) || typeof value.phone !== 'string' || !validPhone(value.phone) || !Array.isArray(value.products) || value.products.length > MAX_PRODUCTS || !value.products.every(validProduct) || new Set(value.products.map(p => p.sku)).size !== value.products.length || (requireEnabled && typeof value.enabled !== 'boolean')) throw Error('INVALID_LITE_CATALOG');
  return { name: value.name, phone: value.phone, ...(requireEnabled ? { enabled: value.enabled } : {}), products: value.products.map(({ sku, name, price, stock }) => ({ sku, name, price, stock })) };
}

function readSnapshot(snapshot) {
  const value = JSON.parse(snapshot);
  const data = readCatalog(value);
  if (value.setup) {
    const s = value.setup;
    if (!setupSteps.has(s.step) || !['shop', 'product', 'edit_product'].includes(s.kind) || !Number.isSafeInteger(s.expires_at) || !s.product || typeof s.product.sku !== 'string' || typeof s.product.name !== 'string' || (s.product.sku && !skuRE.test(s.product.sku)) || (s.product.name && !publicText(s.product.name, 80)) || (s.product.price !== null && !integer(s.product.price, 1000000000)) || (s.product.stock !== null && !integer(s.product.stock, 1000000))) throw Error('INVALID_LITE_SETUP');
    data.setup = { kind: s.kind, step: s.step, expires_at: s.expires_at, draft: readCatalog(s.draft, false), product: { sku: s.product.sku, name: s.product.name, price: s.product.price, stock: s.product.stock } };
  }
  return data;
}

async function load(db, c) {
  const row = await db.prepare('SELECT revision,snapshot,owner_epoch FROM zh_lite_catalog WHERE connection_id=? AND store_id=?').bind(c.id, c.store_id).first();
  if (!row) return { revision: null, data: empty() };
  // Pairing a new owner never exposes a previous owner's catalog or unfinished setup.
  if (Number(row.owner_epoch) !== Number(c.owner_epoch || 0)) return { revision: Number(row.revision), data: empty() };
  return { revision: Number(row.revision), data: readSnapshot(row.snapshot) };
}

async function save(db, c, chat, state, data, now) {
  const json = JSON.stringify(data);
  if (json.length > 32000) return false;
  const epoch = Number(c.owner_epoch || 0), user = c.owner_user_id || null;
  // Recheck the actual owner and pairing epoch atomically. CAS prevents concurrent lost edits.
  const result = state.revision === null
    ? await db.prepare("INSERT OR IGNORE INTO zh_lite_catalog(connection_id,store_id,owner_epoch,revision,snapshot,updated_at) SELECT id,store_id,owner_epoch,1,?,? FROM zh_connections WHERE id=? AND store_id=? AND status='active' AND owner_chat_id=? AND owner_user_id IS ? AND owner_epoch=?").bind(json, now, c.id, c.store_id, chat, user, epoch).run()
    : await db.prepare("UPDATE zh_lite_catalog SET snapshot=?,owner_epoch=?,revision=revision+1,updated_at=? WHERE connection_id=? AND store_id=? AND revision=? AND EXISTS(SELECT 1 FROM zh_connections WHERE id=? AND store_id=? AND status='active' AND owner_chat_id=? AND owner_user_id IS ? AND owner_epoch=?)").bind(json, epoch, now, c.id, c.store_id, state.revision, c.id, c.store_id, chat, user, epoch).run();
  return result?.meta?.changes === 1;
}

function numberInput(text, max, currency = false) {
  const value = currency ? text.trim().replace(/\s*(?:đồng|vnd|đ)$/i, '').trim() : text.trim();
  if (!/^\d{1,10}$/.test(value) && !/^\d{1,3}(?:[. ]\d{3})+$/.test(value)) return null;
  const n = Number(value.replace(/[. ]/g, ''));
  return integer(n, max) ? n : null;
}

function matches(text, product) {
  const q = normalize(text);
  const esc = s => s.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
  const sku = new RegExp('(?:^|[^a-z0-9_-])' + esc(normalize(product.sku)) + '(?:$|[^a-z0-9_-])');
  const name = new RegExp('(?:^|[^a-z0-9])' + esc(normalize(product.name)) + '(?:$|[^a-z0-9])');
  return sku.test(q) || name.test(q);
}

async function answer(env, c, data, text, now, preview = false) {
  if (!data.enabled && !preview) return null;
  if (!data.name || tokenLike.test(text)) return unavailable;
  const hits = data.products.filter(p => matches(text, p));
  if (hits.length > 1) return 'Bác muốn hỏi mã sản phẩm nào: ' + hits.slice(0, 10).map(p => p.sku).join(', ') + '?';
  if (hits.length === 1) {
    const p = hits[0];
    return data.name + ': ' + p.name + ' (' + p.sku + ') — ' + money(p.price) + '. ' + (p.stock > 0 ? 'Theo dữ liệu shop đã cập nhật: còn ' + p.stock + ' sản phẩm.' : 'Theo dữ liệu shop đã cập nhật: hết hàng.') + ' Em chưa tạo đơn tự động.';
  }
  const intent = await classifyIntent(env, text, c, now);
  if (intent === 'CONTACT') return data.phone ? 'CSKH ' + data.name + ': ' + data.phone + '.' : 'Shop chưa công khai số CSKH.';
  if (intent === 'CATALOG') return data.products.length ? data.name + ' — Danh mục' + (data.products.length > 10 ? ' (10 sản phẩm đầu)' : '') + ':\n' + data.products.slice(0, 10).map(p => p.sku + ' | ' + p.name + ' | ' + money(p.price)).join('\n') : 'Shop chưa cập nhật sản phẩm.';
  if (intent === 'GREETING') return 'Em chào bác! Em là trợ lý của ' + data.name + '. Bác muốn xem sản phẩm hay gặp CSKH ạ?';
  return 'Em chưa có thông tin xác nhận cho yêu cầu này. Bác cho em tên hoặc mã sản phẩm cụ thể nhé.';
}

function summary(data, focusSku) {
  const product = focusSku ? data.products.find(p => p.sku === focusSku) : data.products.at(-1);
  return 'Shop: ' + (data.name || 'chưa đặt tên') + '\nCSKH công khai: ' + (data.phone || 'chưa có') + '\nSản phẩm: ' + data.products.length + (product ? '\nSản phẩm xem lại: ' + product.sku + ' | ' + product.name + ' | ' + money(product.price) + ' | tồn ' + product.stock : '');
}

function promptFor(setup) {
  switch (setup.step) {
    case 'shop_name': return 'Bước 1: Bác muốn khách thấy tên cửa hàng là gì?\nNhắn tên shop (tối đa 70 ký tự). Có thể nhắn “Hủy” bất kỳ lúc nào.';
    case 'phone': return 'Bước 2: Số điện thoại CSKH nào được phép hiển thị công khai cho khách?\nChỉ gửi số khi bác đồng ý công khai. Nhắn “Bỏ qua” nếu chưa muốn cung cấp.';
    case 'product_sku': return 'Nhập mã cho sản phẩm, ví dụ SP01. Chỉ dùng chữ không dấu, số, dấu - hoặc _ (tối đa 24 ký tự).';
    case 'product_name': return 'Tên sản phẩm mà khách sẽ nhìn thấy là gì? (Tối đa 80 ký tự.)';
    case 'product_price': return 'Giá bán của một sản phẩm là bao nhiêu đồng?\nNhắn số tiền, ví dụ 12000 hoặc 12.000. Không nhập giá ước lượng.';
    case 'product_stock': return 'Hiện cửa hàng còn bao nhiêu sản phẩm này?\nNhắn số nguyên từ 0; nhập 0 nếu đã hết hàng.';
    case 'edit_sku': return 'Bác muốn sửa mã sản phẩm nào?\nCác mã đã có: ' + setup.draft.products.map(p => p.sku).join(', ') + '.\nNhắn “Hủy” để bỏ bước này.';
    case 'edit_price': return setup.product.name + ' (' + setup.product.sku + ') đang có giá ' + money(setup.product.price) + '.\nBác nhập giá mới, hoặc nhắn “Giữ nguyên”.';
    case 'edit_stock': return setup.product.name + ' (' + setup.product.sku + ') đang có tồn kho ' + setup.product.stock + '.\nBác nhập số tồn mới, hoặc nhắn “Giữ nguyên”.';
    case 'review': return 'Bản xem trước, chưa áp dụng:\n' + summary(setup.draft, setup.product.sku) + '\n\nNhắn “Thử mã sản phẩm” để xem câu trả lời.\nNhắn “Lưu” để lưu dữ liệu và giữ trạng thái hiện tại, hoặc “Bật bot” để lưu và bật trả lời khách. Nhắn “Hủy” để bỏ bản nháp.';
    default: return guide;
  }
}

function wizard(data, kind, now) {
  return { kind, step: kind === 'shop' ? 'shop_name' : (kind === 'edit_product' ? 'edit_sku' : 'product_sku'), expires_at: now + SETUP_TTL_MS, draft: { name: data.name, phone: data.phone, products: copyProducts(data.products) }, product: { sku: '', name: '', price: null, stock: null } };
}

function advance(setup, text) {
  const draft = setup.draft;
  switch (setup.step) {
    case 'shop_name':
      if (!publicText(text, 70)) return 'Tên shop cần từ 1–70 ký tự, không chứa mã bí mật hay ký tự điều khiển.';
      draft.name = text; setup.step = 'phone'; break;
    case 'phone':
      if (text === '-' || normalize(text) === 'bo qua') draft.phone = '';
      else if (validPhone(text)) draft.phone = text;
      else return 'Bác gửi một số điện thoại hợp lệ, hoặc nhắn “Bỏ qua”. Số được nhập sẽ hiển thị công khai cho khách.';
      setup.step = draft.products.length ? 'review' : 'product_sku'; break;
    case 'product_sku': {
      const sku = text.toUpperCase();
      if (!skuRE.test(sku)) return 'Mã sản phẩm chỉ gồm chữ không dấu, số, dấu - hoặc _, tối đa 24 ký tự.';
      if (draft.products.some(p => p.sku === sku)) return 'Mã này đã có. Bác gửi mã khác, hoặc nhắn “Sửa sản phẩm” để cập nhật giá và tồn kho của sản phẩm cũ.';
      setup.product.sku = sku; setup.step = 'product_name'; break;
    }
    case 'product_name':
      if (!publicText(text, 80)) return 'Tên sản phẩm cần từ 1–80 ký tự, không chứa mã bí mật hay ký tự điều khiển.';
      setup.product.name = text; setup.step = 'product_price'; break;
    case 'product_price': {
      const price = numberInput(text, 1000000000, true);
      if (price === null) return 'Giá phải là số đồng nguyên không âm, tối đa 1.000.000.000. Ví dụ: 12000 hoặc 12.000.';
      setup.product.price = price; setup.step = 'product_stock'; break;
    }
    case 'product_stock': {
      const stock = numberInput(text, 1000000);
      if (stock === null) return 'Tồn kho phải là số nguyên từ 0 đến 1.000.000.';
      setup.product.stock = stock;
      if (draft.products.length >= MAX_PRODUCTS) return 'Hiện hỗ trợ tối đa 50 sản phẩm. Bác nhắn “Hủy” để trở về cấu hình.';
      draft.products.push({ ...setup.product }); setup.step = 'review'; break;
    }
    case 'edit_sku': {
      const product = draft.products.find(p => p.sku === text.toUpperCase());
      if (!product) return 'Không tìm thấy mã sản phẩm này. Bác kiểm tra mã và gửi lại, hoặc nhắn “Hủy”.';
      setup.product = { ...product }; setup.step = 'edit_price'; break;
    }
    case 'edit_price': {
      const price = normalize(text) === 'giu nguyen' ? setup.product.price : numberInput(text, 1000000000, true);
      if (price === null) return 'Giá phải là số đồng nguyên không âm, tối đa 1.000.000.000. Bác cũng có thể nhắn “Giữ nguyên”.';
      setup.product.price = price; setup.step = 'edit_stock'; break;
    }
    case 'edit_stock': {
      const stock = normalize(text) === 'giu nguyen' ? setup.product.stock : numberInput(text, 1000000);
      if (stock === null) return 'Tồn kho phải là số nguyên từ 0 đến 1.000.000. Bác cũng có thể nhắn “Giữ nguyên”.';
      const index = draft.products.findIndex(p => p.sku === setup.product.sku);
      if (index < 0) return 'Không còn sản phẩm trong bản nháp. Bác nhắn “Hủy” rồi thử lại.';
      setup.product.stock = stock; draft.products[index] = { ...setup.product }; setup.step = 'review'; break;
    }
    case 'review': return 'Bác nhắn “Lưu”, “Bật bot”, “Thử câu hỏi” hoặc “Hủy” để xử lý bản xem trước này.';
    default: return guide;
  }
  return null;
}

export async function liteReply(env, c, ev, now) {
  if (!isCommerceConnection(env, c) || c.status !== 'active' || !c.owner_chat_id || ev.type !== 'text' || ev.chat?.type !== 'PRIVATE' || !ev.chat.id || !ev.user?.id || ev.user.is_bot || typeof ev.text !== 'string') return null;
  const text = ev.text.trim();
  if (!text || tokenLike.test(text)) return null;
  const owner = ev.chat.id === c.owner_chat_id && ev.user.id === (c.owner_user_id || c.owner_chat_id);
  if (env.ZH_WEB_STORE_LINK === 'true' && /^(?:Liên kết\s|Thông tin cửa hàng$)/iu.test(text)) {
    return owner ? botLink(env,c,text,now) : null;
  }
  const state = await load(env.ZH_DB, c), data = state.data;
  if (!owner) return answer(env, c, data, text, now);
  const fields = text.split('|').map(x => x.trim()), cmd = normalize(fields[0]);
  const next = structuredClone(data);
  const persist = async message => await save(env.ZH_DB, c, ev.chat.id, state, next, now) ? message : conflict;

  if (cmd === 'tro giup') return guide;
  if (cmd === 'xem cau hinh') return summary(data) + '\nTrợ lý: ' + (data.enabled ? 'đang bật' : 'đang tắt') + (data.setup ? '\nCó bản nháp chưa lưu. Nhắn “Hủy” để bỏ hoặc tiếp tục bước đang làm.' : '') + '\n\n' + guide;
  const previewText = cmd === 'thu' && fields.length === 2 ? fields[1] : (normalize(text).startsWith('thu ') && !text.includes('|') ? text.slice(text.indexOf(' ') + 1).trim() : '');
  if (previewText) {
    const preview = data.setup?.step === 'review' && data.setup.expires_at > now ? { ...data.setup.draft, enabled: false } : data;
    return 'Bản xem trước:\n' + await answer(env, c, preview, previewText, now, true);
  }
  if (cmd === 'huy' && fields.length === 1) {
    if (!data.setup) return 'Không có bước cài nào đang làm. Nhắn “Bắt đầu” để cài shop hoặc “Thêm sản phẩm”.';
    delete next.setup;
    return persist('Đã bỏ bản nháp. Dữ liệu đã lưu và trạng thái trợ lý giữ nguyên.');
  }
  if (cmd === 'tam dung' && fields.length === 1) {
    next.enabled = false;
    delete next.setup;
    return persist('Đã tạm dừng trả lời khách và bỏ bản nháp đang làm. Dữ liệu đã lưu vẫn được giữ. Nhắn “Bật bot” để hoạt động lại.');
  }
  if ((cmd === 'bat dau' || cmd === 'cai dat') && fields.length === 1) {
    next.setup = wizard(data, 'shop', now);
    return persist(promptFor(next.setup));
  }
  if (cmd === 'them san pham' && fields.length === 1) {
    if (!data.name) return 'Bác nhắn “Bắt đầu” để đặt tên shop và thêm sản phẩm đầu tiên.';
    if (data.products.length >= MAX_PRODUCTS) return 'Hiện hỗ trợ tối đa 50 sản phẩm. Bác có thể cập nhật hoặc ẩn sản phẩm cũ.';
    next.setup = wizard(data, 'product', now);
    return persist(promptFor(next.setup));
  }
  if (cmd === 'sua san pham' && fields.length === 1) {
    if (!data.products.length) return 'Shop chưa có sản phẩm để sửa. Bác nhắn “Bắt đầu” hoặc “Thêm sản phẩm” trước.';
    next.setup = wizard(data, 'edit_product', now);
    return persist(promptFor(next.setup));
  }
  if (data.setup && data.setup.expires_at <= now) {
    delete next.setup;
    return persist('Bản nháp đã hết hạn sau 30 phút. Dữ liệu đã lưu giữ nguyên. Bác nhắn “Bắt đầu”, “Thêm sản phẩm” hoặc “Sửa sản phẩm” để làm lại.');
  }
  if (data.setup && fields.length === 1) {
    if (['luu', 'xac nhan', 'bat bot'].includes(cmd)) {
      if (data.setup.step !== 'review') return 'Bác hoàn tất bước đang làm trước, hoặc nhắn “Hủy” để bỏ bản nháp.\n' + promptFor(data.setup);
      const ready = data.setup.draft;
      if (!ready.name || !ready.products.length) return 'Bác cần cài shop và ít nhất một sản phẩm trước.';
      next.name = ready.name; next.phone = ready.phone; next.products = copyProducts(ready.products);
      if (cmd === 'bat bot') next.enabled = true;
      delete next.setup;
      return persist('Đã lưu dữ liệu riêng của shop. Trợ lý: ' + (next.enabled ? 'bật, sẵn sàng trả lời khách.' : 'tắt. Nhắn “Bật bot” khi bác sẵn sàng.') + '\nNhắn “Thêm sản phẩm” để tiếp tục hoặc “Thử câu hỏi” để kiểm tra.');
    }
    const error = advance(next.setup, text);
    if (error) return error;
    return persist(promptFor(next.setup));
  }
  if (cmd === 'cai shop' && fields.length === 3) {
    if (!publicText(fields[1], 70) || !(fields[2] === '-' || (fields[2] && validPhone(fields[2])))) return 'Sai định dạng. Số CSKH trong lệnh này sẽ công khai cho khách; dùng - nếu chưa muốn cung cấp.\n' + guide;
    next.name = fields[1]; next.phone = fields[2] === '-' ? '' : fields[2];
  } else if (cmd === 'san pham' && fields.length === 5) {
    const sku = fields[1].toUpperCase(), price = numberInput(fields[3], 1000000000, true), stock = numberInput(fields[4], 1000000);
    if (!skuRE.test(sku) || !publicText(fields[2], 80) || price === null || stock === null) return 'Sai định dạng. Giá và tồn kho phải là số nguyên không âm.\n' + guide;
    const i = next.products.findIndex(p => p.sku === sku);
    if (i < 0 && next.products.length >= MAX_PRODUCTS) return 'Hiện hỗ trợ tối đa 50 sản phẩm.';
    const p = { sku, name: fields[2], price, stock };
    if (i >= 0) next.products[i] = p; else next.products.push(p);
  } else if (cmd === 'an san pham' && fields.length === 2) {
    const sku = fields[1].toUpperCase();
    if (!skuRE.test(sku) || !next.products.some(p => p.sku === sku)) return 'Không tìm thấy mã sản phẩm.';
    next.products = next.products.filter(p => p.sku !== sku);
    if (!next.products.length) next.enabled = false;
  } else if (cmd === 'bat bot' && fields.length === 1) {
    if (!next.name || !next.products.length) return 'Bác cần cài shop và ít nhất một sản phẩm trước. Nhắn “Bắt đầu” để được hướng dẫn.';
    next.enabled = true;
  } else return guide;
  // An explicit quick command supersedes an unfinished draft, preventing a later stale overwrite.
  delete next.setup;
  return persist('Đã lưu cấu hình. Trợ lý: ' + (next.enabled ? 'bật' : 'tắt') + '. Sản phẩm: ' + next.products.length + '.');
}
