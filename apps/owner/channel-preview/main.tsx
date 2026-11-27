import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../src/App';
import { finish } from './mock';
import '../src/app.css';
import './preview.css';
function Preview() {
  const [chooser,setChooser]=useState(false);
  const [cancel,setCancel]=useState(false);
  const [attempt,retry]=useState(0);
  useEffect(()=>{ const show=()=>{setChooser(true);setCancel(false);};window.addEventListener('qa:accounts',show);return()=>window.removeEventListener('qa:accounts',show);},[]);
  return <><aside className="qa-banner">QA · Đăng nhập Google mô phỏng · Chỉ dùng danh tính mẫu</aside>
    {cancel && <p role="status">Đã hủy đăng nhập. Bạn có thể thử lại.</p>}
    <div hidden={chooser}><App key={attempt}/></div>
    {chooser && <main className="qa-home"><p className="eyebrow">Google mô phỏng</p><h1>Chọn tài khoản QA</h1>
      {([['old','Chủ Tiệm Mây · hai shop'],['second','Chủ Vải Mộc'],['new','Chủ mới'],['staff','Nhân viên Tiệm Mây']] as const).map(([id,name])=>
        <button className="btn btn-ghost btn-block" key={id} onClick={()=>{finish(id);setChooser(false);}}>{name}</button>)}
      <button className="link-btn" onClick={()=>{sessionStorage.removeItem('t404_google_return');retry(n=>n+1);setCancel(true);setChooser(false);}}>Hủy đăng nhập</button>
    </main>}</>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
