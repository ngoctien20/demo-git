import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { hub } from '../zaloHub';
import { must, Product, useLoad } from '../data';
import { ProductSync } from './ProductSync';
import { ZaloStoreLink } from './ZaloStoreLink';

function Store({id}:{id:string}) {
  const [linked,setLinked]=useState(false);
  const catalog=useLoad(async()=>must(await supabase.from('products').select('id,sku,name,price_vnd,stock_on_hand,is_active,updated_at').eq('store_id',id).order('sku')) as Product[],[id]);
  return <><p>ID cửa hàng <code>{id}</code></p><ZaloStoreLink storeId={id} request={hub} onLinked={setLinked}/>
    {linked && catalog.data && !catalog.error && <ProductSync storeId={id} products={catalog.data} reloadWeb={catalog.reload}/>}</>;
}

export function PilotStore() {
  const [user,setUser]=useState('');
  const [error,setError]=useState('');
  const [selected,setSelected]=useState('');
  useEffect(()=>{
    const {data}=supabase.auth.onAuthStateChange((_event,session)=>setUser(session?.user.id || ''));
    return ()=>data.subscription.unsubscribe();
  },[]);
  const stores=useLoad(async()=>user ? must(await supabase.from('stores').select('id,name').order('name')) : [],[user]);
  async function login(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values=new FormData(e.currentTarget);
    const {error}=await supabase.auth.signInWithPassword({email:String(values.get('email')),password:String(values.get('password'))});
    setError(error?'Đăng nhập chưa thành công. Vui lòng kiểm tra tài khoản Dashboard.':'');
  }
  return <main className="panel" style={{maxWidth:680,margin:'2rem auto'}}><h1>Liên kết cửa hàng với Bot QA</h1>
    {!user ? <form className="form" onSubmit={login}><label>Email Dashboard<input type="email" name="email" autoComplete="username" required/></label>
    <label>Mật khẩu<input type="password" name="password" autoComplete="current-password" required/></label>
    <button className="btn btn-primary">Đăng nhập</button>{error && <p role="alert">{error}</p>}</form> :
    <><label>Cửa hàng <select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Chọn cửa hàng</option>
      {stores.data?.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      {!!stores.error && <p role="alert">Chưa tải được cửa hàng.</p>}
      {selected && stores.data?.some(s=>s.id===selected) && <Store key={selected} id={selected}/>}
      <button className="btn btn-ghost" onClick={()=>{setSelected('');supabase.auth.signOut();}}>Đăng xuất</button></>}
  </main>;
}
