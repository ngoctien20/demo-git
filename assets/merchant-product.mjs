import {withDeadline} from './auth-runtime.mjs';

// The deployed RPC verifies auth.uid() and membership. This switch only controls availability of the form.
export const PRODUCT_EDITOR_ENABLED = false;

export function addProductEditor(card, tenantId, client, current) {
  const details = document.createElement('details');
  const title = document.createElement('summary');
  title.textContent = 'Quản lý sản phẩm';
  const form = document.createElement('form');
  function field(label, type, maxLength) {
    const wrapper = document.createElement('label');
    wrapper.textContent = label;
    const input = document.createElement('input');
    input.type = type;
    if (type === 'number') { input.min = '0'; input.step = '1'; }
    if (maxLength) input.maxLength = maxLength;
    input.required = true;
    wrapper.append(input);
    form.append(wrapper);
    return input;
  }
  const sku = field('Mã SKU','text',80);
  const name = field('Tên bán hàng','text',250);
  const price = field('Giá bán (đồng)','number');
  price.max = '1000000000000';
  const stock = field('Tồn ban đầu','number');
  stock.max = '2147483647';
  const activeLabel = document.createElement('label');
  const active = document.createElement('input');
  active.type = 'checkbox';
  active.checked = active.defaultChecked = true;
  activeLabel.append(active,' Đang bán');
  const lookup = document.createElement('button');
  lookup.type = 'button';
  lookup.textContent = 'Mở SKU để sửa';
  const save = document.createElement('button');
  save.type = 'submit';
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Nhập sản phẩm mới';
  const status = document.createElement('p');
  status.setAttribute('role','status');
  form.append(activeLabel,lookup,save,reset,status);
  details.append(title,form);
  card.append(details);
  let version = null;
  let busy = false;
  function state() {
    for (const el of [sku,name,price,stock,active,lookup,save,reset]) el.disabled = busy;
    sku.readOnly = Boolean(version);
    stock.disabled = busy || Boolean(version);
    save.textContent = version ? 'Lưu thay đổi' : 'Tạo sản phẩm';
  }
  function fresh() {
    form.reset();
    version = null;
    state();
  }
  reset.addEventListener('click',()=>{fresh();status.textContent='';});
  lookup.addEventListener('click',async()=>{
    if (busy || !current() || !sku.reportValidity()) return;
    const key = sku.value.trim();
    busy = true;
    state();
    status.textContent = 'Đang tải sản phẩm…';
    try {
      const result = await withDeadline(client.from('products').select('tenant_id,sku,name,price_vnd,stock_on_hand,is_active,updated_at')
        .eq('tenant_id',tenantId).eq('sku',key).maybeSingle(),13000);
      if (!card.isConnected || !current()) return;
      const row = result.data;
      if (result.error || !row || row.tenant_id!==tenantId || row.sku!==key || !row.updated_at) throw Error();
      sku.value = row.sku;
      name.value = row.name;
      price.value = row.price_vnd;
      stock.value = row.stock_on_hand;
      active.checked = row.is_active;
      version = row.updated_at;
      status.textContent = 'Đã tải phiên bản hiện tại. Tồn kho được quản lý riêng khi sửa.';
    } catch {
      if (card.isConnected && current()) { fresh();sku.value=key;status.textContent='Chưa mở được SKU. Kiểm tra mã và quyền truy cập.'; }
    } finally { busy=false;state(); }
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if (busy || !current() || !form.reportValidity()) return;
    const payload = {p_tenant:tenantId,p_sku:sku.value.trim(),p_name:name.value.trim(),p_price:price.valueAsNumber,
      p_active:active.checked,p_initial_stock:version?null:stock.valueAsNumber,p_expected_updated_at:version};
    busy=true;
    state();
    status.textContent='Đang lưu sản phẩm…';
    try {
      const result = await withDeadline(client.rpc('save_merchant_product',payload),13000);
      if (!card.isConnected || !current()) return;
      if (result.error || typeof result.data!=='string') throw Error();
      version=result.data;
      sku.value=payload.p_sku;
      status.textContent='Đã lưu sản phẩm. Tải lại danh mục để xem bản mới.';
    } catch {
      if (card.isConnected && current()) status.textContent='Chưa xác nhận được lần lưu. Mở lại SKU để kiểm tra phiên bản trước khi thử lại.';
    } finally { busy=false;state(); }
  });
  state();
}
