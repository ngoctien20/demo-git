import { useState } from 'react';
import type { Product } from '../data';
import { vnd } from '../format';
import { hub } from '../zaloHub';

type BotItem = {sku:string;name:string;price:number;stock:number};
type Catalog = {state:string;code:string|null;binding:string|null;revision:number|null;products:BotItem[]};

export function ProductSync({storeId,products,reloadWeb}:{storeId:string;products:Product[];reloadWeb:()=>Promise<void>}) {
  const [catalog,setCatalog]=useState<Catalog|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const base='/v1/owner/web-store/';
  const readBot=()=>hub('GET',base+'status?store_id='+encodeURIComponent(storeId));
  async function compare() {
    setBusy(true); setMessage('');
    try { const [fresh]=await Promise.all([readBot(),reloadWeb()]); setCatalog(fresh); }
    catch(e){setCatalog(null);setMessage((e as Error).message);}
    finally {setBusy(false);}
  }
  async function apply(source:'web'|'zalo',sku:string,web?:Product) {
    if (!catalog) return;
    let saved=false;
    setBusy(true); setMessage('');
    try {
      await hub('POST',base+'reconcile',{store_id:storeId,sku,source,binding:catalog.binding,
        revision:catalog.revision,webVersion:web?.updated_at ?? null});
      setCatalog(null);
      saved=true;
      setMessage('Đã lưu '+sku+'.');
      const [fresh]=await Promise.all([readBot(),reloadWeb()]);
      setCatalog(fresh);
    } catch(e){setCatalog(null);setMessage(saved ? 'Đã lưu '+sku+'. Hãy đối chiếu lại để xem dữ liệu mới.' : (e as Error).message);}
    finally {setBusy(false);}
  }
  const webBySku=new Map(products.map(p=>[p.sku,p]));
  const botBySku=new Map(catalog?.products.map(p=>[p.sku,p]));
  const differences=[...new Set([...webBySku.keys(),...botBySku.keys()])].filter(sku=>{
    const w=webBySku.get(sku), b=botBySku.get(sku);
    return b ? !w || !w.is_active || w.price_vnd!==b.price : !!w?.is_active;
  });
  return <section className="panel">
    <button className="btn btn-ghost" disabled={busy} onClick={compare}>Đối chiếu giá với Zalo</button>
    {message && <p role="alert">{message}</p>}
    {catalog && (catalog.state!=='linked' ? <p>Vào Kênh kết nối để liên kết bot với cửa hàng này.</p> :
      <><p>Cửa hàng <b>{catalog.code}</b></p>
        {catalog.revision===null ? <p>Hãy lưu danh mục đầu tiên trong bot rồi đối chiếu lại.</p> :
          differences.length===0 ? <p>Các SKU đang bán và giá đã khớp.</p> :
          differences.map(sku=>{
            const w=webBySku.get(sku), b=botBySku.get(sku);
            return <div key={sku} className="panel soft">
              <strong>{sku}</strong>
              <p>Web · {w ? w.name+' · '+vnd(w.price_vnd)+(w.is_active?'':' · đã ngừng bán') : 'Chưa có'}</p>
              <p>Zalo · {b ? b.name+' · '+vnd(b.price) : 'Chưa có'}</p>
              {(!w || !b) && <p>Tồn ban đầu khi thêm: {w?.stock_on_hand ?? b?.stock}</p>}
              <div className="row-btns">
                {w && <button disabled={busy} onClick={()=>apply('web',sku,w)}>{!w.is_active?'Ẩn SKU trên Zalo':b?'Dùng giá web cho Zalo':'Thêm vào Zalo'}</button>}
                {b && (!w || w.is_active) && <button disabled={busy} onClick={()=>apply('zalo',sku,w)}>{w?'Dùng giá Zalo cho web':'Thêm vào web'}</button>}
              </div>
            </div>;
          })}
      </>)}
  </section>;
}
