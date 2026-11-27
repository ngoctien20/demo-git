import { useState } from 'react';
import { useStore } from '../src/store';
import { ZaloHubPanel } from '../src/pages/ZaloHubPanel';
import { finish } from './mock';

export function Shell() {
  const {store,canManage}=useStore();
  const [hub,open]=useState(false);
  return <main className="qa-home"><p className="eyebrow">Không gian làm việc</p>
    <h1>{store.name}</h1><p>Mã cửa hàng · {store.id} · {store.role==='staff'?'Nhân viên':store.role==='manager'?'Quản lý':'Chủ shop'}</p>
    <button className="btn btn-primary" onClick={()=>open(true)}>Kết nối kênh</button>
    {hub && <><section className="panel"><h2>Messenger / Fanpage</h2><p>Chưa kết nối · Chờ Fanpage QA được cấp quyền.</p></section>
    <ZaloHubPanel canManage={canManage} bot={<p>Zalo Bot QA · Chưa kết nối. Trong dashboard, chủ dùng mã bot và xác nhận bằng tài khoản Zalo.</p>} oaStatus="Chưa kết nối · OA mô phỏng" /></>}
    <button className="link-btn" onClick={()=>finish(null)}>Đăng xuất TIEN404</button></main>;
}
