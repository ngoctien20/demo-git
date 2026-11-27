import { useEffect, useState } from 'react';

type Product = {sku:string; name:string; price:number; stock:number};
type Link = {state:'idle'|'confirm'|'linked'; code:string|null; bot:string|null; confirmation:string|null; revision:number|null; products:Product[]};
type Request = (method:'GET'|'POST', path:string, body?:object)=>Promise<any>;

export function ZaloStoreLink({storeId, request, onLinked}:{storeId:string; request:Request; onLinked:(linked:boolean)=>void}) {
  const [data,setData]=useState<Link|null>(null);
  const [command,setCommand]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [edit,setEdit]=useState<{sku:string;price:string;revision:number|null}|null>(null);
  const base='/v1/owner/web-store/';
  const load=()=>request('GET',base+'status?store_id='+encodeURIComponent(storeId));
  useEffect(()=>{
    let current=true;
    load().then(r=>{if(current)setData(r);}).catch(()=>{});
    return ()=>{current=false;};
  },[storeId,request]);
  useEffect(()=>{onLinked(data?.state==='linked');},[data,onLinked]);
  async function act(task:()=>Promise<void>) {
    setBusy(true); setError('');
    try { await task(); const fresh=await load(); setData(fresh); if(fresh.state!=='idle')setCommand(''); }
    catch(e){setError((e as Error).message);}
    finally {setBusy(false);}
  }
  const post=(action:string,fields:object={})=>request('POST',base+action,{store_id:storeId,...fields});
  if(!data)return null;
  return <section className="panel soft">
    {data.code && <p>Mã cửa hàng <strong>{data.code}</strong></p>}
    {data.state==='idle' && <>
      <button disabled={busy} onClick={()=>act(async()=>setCommand((await post('start')).command))}>Liên kết bot đang dùng</button>
      {command && <><p>Gửi lệnh này trong chat riêng với bot bằng tài khoản chủ bot, trong 10 phút.</p><code>{command}</code>
        <button disabled={busy} onClick={()=>act(async()=>{})}>Kiểm tra liên kết</button></>}
    </>}
    {data.state==='confirm' && <button disabled={busy} onClick={()=>act(async()=>{await post('confirm',{confirmation:data.confirmation});})}>Xác nhận liên kết {data.bot || 'bot Zalo'} với {data.code}</button>}
    {data.state==='linked' && <><p>Bot đã liên kết: <b>{data.bot || 'Zalo Bot'}</b></p><h3>Sản phẩm đã lưu trên bot</h3>
      {!data.products.length && <p>Chủ bot nhắn “Bắt đầu” trong Zalo để nhập sản phẩm.</p>}
      {data.products.map(p=><div key={p.sku}><b>{p.sku} · {p.name}</b> · {p.price.toLocaleString('vi-VN')} đ · Tồn {p.stock}
        <button disabled={busy} onClick={()=>setEdit({sku:p.sku,price:String(p.price),revision:data.revision})}>Sửa giá {p.sku}</button></div>)}
      {edit && <form onSubmit={e=>{e.preventDefault();act(async()=>{await post('price',{...edit,price:Number(edit.price)});setEdit(null);});}}>
        <label>Giá mới cho {edit.sku} (đồng)<input required type="number" min="0" max="1000000000" step="1" value={edit.price} onChange={e=>setEdit({...edit,price:e.target.value})}/></label>
        <button disabled={busy}>Lưu giá trên bot</button></form>}
      <button disabled={busy} onClick={()=>act(async()=>{setEdit(null);})}>Tải lại danh mục</button></>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
