import { useState } from 'react';
import { supabase } from './supabase';
import { Route } from './router';
import { useStore } from './store';
import { SITE_HOME } from './config';
import { Overview } from './pages/Overview';
import { Products } from './pages/Products';
import { Orders } from './pages/Orders';
import { Customers } from './pages/Customers';
import { Channels } from './pages/Channels';
import { BotSettings } from './pages/BotSettings';
import { Menu } from './pages/Menu';
import { Knowledge } from './pages/Knowledge';
import { Plan } from './pages/Plan';
import { Account } from './pages/Account';

const NAV: { group: string; items: [string, string, string][] }[] = [
  { group: 'Bán hàng', items: [['/', 'Tổng quan', '◎'], ['/san-pham', 'Sản phẩm & tồn kho', '▣'], ['/don-hang', 'Đơn hàng', '▤'], ['/khach-hang', 'Khách hàng', '♧']] },
  { group: 'Trợ lý AI', items: [['/cai-dat-bot', 'Cài đặt bot', '✦'], ['/menu-tro-ly', 'Menu trợ lý', '☰'], ['/tri-thuc', 'Hỏi đáp & chính sách', '❖'], ['/kenh-ban', 'Kênh bán', '⇄']] },
  { group: 'Tài khoản', items: [['/goi-dich-vu', 'Gói dịch vụ', '◈'], ['/tai-khoan', 'Tài khoản', '⚙']] },
];

const ROLE_LABEL = { owner: 'Chủ shop', manager: 'Quản lý', staff: 'Nhân viên' } as const;

export function Shell({ route, onSwitch }: { route: Route; onSwitch: (id: string) => void }) {
  const { store, stores, email } = useStore();
  const [open, setOpen] = useState(false);
  const page = (() => {
    switch (route.path) {
      case '/san-pham': return <Products />;
      case '/don-hang': return <Orders />;
      case '/khach-hang': return <Customers />;
      case '/kenh-ban': return <Channels />;
      case '/cai-dat-bot': return <BotSettings />;
      case '/menu-tro-ly': return <Menu />;
      case '/tri-thuc': return <Knowledge />;
      case '/goi-dich-vu': return <Plan />;
      case '/tai-khoan': return <Account />;
      default: return <Overview />;
    }
  })();
  const current = NAV.flatMap(g => g.items).find(i => i[0] === route.path)?.[0] ?? '/';

  return (
    <div className={`shell${open ? ' nav-open' : ''}`}>
      <header className="mobile-bar">
        <button type="button" className="icon-btn" aria-label="Mở menu" aria-expanded={open} onClick={() => setOpen(!open)}>☰</button>
        <b>{store.name}</b>
      </header>
      <aside className="side" onClick={e => { if ((e.target as HTMLElement).closest('a')) setOpen(false); }}>
        <a className="side-brand" href={SITE_HOME}><span className="logo" aria-hidden="true">T</span>TIEN404<b>AI</b></a>
        <label className="store-switch">
          <span>Cửa hàng</span>
          <select value={store.id} onChange={e => onSwitch(e.target.value)} aria-label="Chọn cửa hàng">
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}{stores.some(o => o.tenant_id !== s.tenant_id) ? ` · ${s.tenant_name}` : ''}</option>)}
          </select>
          <small>{ROLE_LABEL[store.role]}</small>
        </label>
        <nav aria-label="Menu App">
          {NAV.map(g => (
            <div key={g.group} className="nav-group">
              <p>{g.group}</p>
              {g.items.map(([href, label, icon]) => (
                <a key={href} href={`#${href}`} aria-current={current === href ? 'page' : undefined}><span aria-hidden="true">{icon}</span>{label}</a>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <span className="muted" title={email}>{email}</span>
          <button type="button" className="link-btn" onClick={() => supabase.auth.signOut()}>Đăng xuất</button>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <main className="content" id="main" key={store.id}>{page}</main>
    </div>
  );
}
