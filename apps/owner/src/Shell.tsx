import { useCallback, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { Route } from './router';
import { useStore } from './store';
import { SITE_HOME } from './config';
import { isMissingFeature, useLoad } from './data';
import { resolveWorkspace, INDUSTRY_META, Profile, moduleOwner, ROLE_LABEL, Workspace, WorkspaceCtx } from './workspace';
import { Notice, PageHead } from './ui';
import { loadCatalog, SETTINGS } from './billing';
import { Overview } from './pages/Overview';
import { Products } from './pages/Products';
import { Orders } from './pages/Orders';
import { Customers } from './pages/Customers';
import { Channels } from './pages/Channels';
import { BotSettings } from './pages/BotSettings';
import { ReactionSettings } from './pages/ReactionSettings';
import { Menu } from './pages/Menu';
import { Knowledge } from './pages/Knowledge';
import { Plan } from './pages/Plan';
import { Account } from './pages/Account';
import { Assistants } from './pages/Assistants';
import { IndustryModule } from './pages/IndustryModule';
import { Conversations } from './pages/Conversations';
import { Reports } from './pages/Reports';
import { Notifications } from './pages/Notifications';
import { Personality } from './pages/Personality';
type NavItem = [string, string, string];

export function Shell({ route, onSwitch }: { route: Route; onSwitch: (id: string) => void }) {
  const { store, stores, email } = useStore();
  const [open, setOpen] = useState(false);

  // Assistants of THIS store only (RLS: active store members). Failure = Config Core not reachable;
  // the Workspace still works with the tenant industry alone.
  const asst = useLoad(async () => {
    const r = await supabase.from('assistants').select('id, name, template_key').eq('store_id', store.id).order('created_at');
    if (r.error) { if (isMissingFeature(r.error)) return null; throw r.error; }
    return r.data as Workspace['assistants'];
  }, [store.id]);
  // Owner's Workspace profile (V25.1). Missing table = server not updated yet: fall back to inference.
  const prof = useLoad(async () => {
    const r = await supabase.from('workspace_profiles').select('label, modules, people_label, updated_at').eq('store_id', store.id).maybeSingle();
    if (r.error) return { ready: false, row: null as Profile | null };
    return { ready: true, row: r.data as Profile | null };
  }, [store.id]);
  // Platform notice + plans edited by TIEN404 Admin (db/v28-account/20). Missing = nothing shown.
  const cat = useLoad(() => loadCatalog(), []);
  const reload = useCallback(async () => { await Promise.all([asst.reload(), prof.reload()]); }, [asst.reload, prof.reload]);
  const ws = useMemo<Workspace>(() => {
    const assistants = asst.data ?? [];
    const profile = prof.data?.row ?? null;
    const r = resolveWorkspace(store.tenant_industry, assistants.map(a => a.template_key), profile);
    return { ...r, profile, profileReady: prof.data?.ready === true, assistants, assistantsReady: !!asst.data && !asst.error, reload };
  }, [asst.data, asst.error, prof.data, store.tenant_industry, reload]);

  const nav: { group: string; items: NavItem[] }[] = [
    { group: 'Trợ lý AI', items: [
      ['/', 'Tổng quan', '◎'], ['/tro-ly', 'Trợ lý AI', '✦'], ['/menu-tro-ly', 'Menu & hành động', '☰'],
      ['/tri-thuc', 'Kho kiến thức', '❖'], ['/kenh-ban', 'Kênh kết nối', '⇄'], ['/hoi-thoai', 'Hội thoại & bàn giao', '✉'],
    ] },
    ...ws.industries.map(i => ({ group: INDUSTRY_META[i].short, items: INDUSTRY_META[i].modules.map(m => [m.path, m.label, m.icon] as NavItem) })),
    { group: 'Theo dõi', items: [
      ['/khach-hang', ws.people, '♧'], ['/bao-cao', 'Báo cáo', '▥'], ['/thong-bao', 'Thông báo', '◔'],
    ] },
    { group: 'Workspace', items: [
      ['/cai-dat-bot', 'Cài đặt', '⚙'], ['/phong-cach', 'Phong cách & biểu cảm', '☺'], ['/bieu-cam-fanpage', 'Biểu cảm Fanpage', '♡'], ['/goi-dich-vu', 'Gói và thanh toán', '◈'], ['/tai-khoan', 'Tài khoản', '◐'],
    ] },
  ];

  const owner = moduleOwner(route.path);
  const page = (() => {
    if (owner && !ws.industries.includes(owner)) return <ModuleOff owner={owner} />;
    switch (route.path) {
      case '/san-pham': return <Products />;
      case '/don-hang': return <Orders />;
      case '/nghe-si': return <IndustryModule industry="artist" />;
      case '/dich-vu': return <IndustryModule industry="service" />;
      case '/khoa-hoc': return <IndustryModule industry="education" />;
      case '/khach-hang': return <Customers />;
      case '/kenh-ban': return <Channels />;
      case '/cai-dat-bot': return <BotSettings />;
      case '/menu-tro-ly': return <Menu />;
      case '/bieu-cam-fanpage': return <ReactionSettings />;
      case '/tri-thuc': return <Knowledge />;
      case '/tro-ly': return <Assistants />;
      case '/hoi-thoai': return <Conversations />;
      case '/bao-cao': return <Reports />;
      case '/thong-bao': return <Notifications />;
      case '/phong-cach': return <Personality />;
      case '/goi-dich-vu': return <Plan />;
      case '/tai-khoan': return <Account />;
      default: return <Overview />;
    }
  })();
  const current = nav.flatMap(g => g.items).find(i => i[0] === route.path)?.[0] ?? '/';

  return (
    <WorkspaceCtx.Provider value={ws}>
      <div className={`shell${open ? ' nav-open' : ''}`}>
        <header className="mobile-bar">
          <button type="button" className="icon-btn" aria-label={open ? 'Đóng menu' : 'Mở menu'} aria-expanded={open} aria-controls="app-side" onClick={() => setOpen(!open)}>☰</button>
          <b>{store.name}</b>
          <span className="pill soft">{ws.label}</span>
        </header>
        <aside className="side" id="app-side" onClick={e => { if ((e.target as HTMLElement).closest('a')) setOpen(false); }}>
          <a className="side-brand" href={SITE_HOME}><span className="logo" aria-hidden="true">T</span>TIEN404<b>AI</b><small>Workspace</small></a>
          <label className="store-switch">
            <span>Không gian làm việc</span>
            <select value={store.id} onChange={e => onSwitch(e.target.value)} aria-label="Chọn không gian làm việc">
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}{stores.some(o => o.tenant_id !== s.tenant_id) ? ` · ${s.tenant_name}` : ''}</option>)}
            </select>
            <small>{ROLE_LABEL[store.role]} · {ws.label}</small>
          </label>
          <nav aria-label="Menu Workspace">
            {nav.map(g => (
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
        <main className="content" id="main" key={store.id}>{cat.data && SETTINGS.notice && <div className="platform-notice" role="note"><b>TIEN404</b><span>{SETTINGS.notice}</span></div>}{page}</main>
      </div>
    </WorkspaceCtx.Provider>
  );
}

function ModuleOff({ owner }: { owner: keyof typeof INDUSTRY_META }) {
  const m = INDUSTRY_META[owner];
  return (
    <>
      <PageHead title={m.modules[0].label} />
      <Notice>Mô-đun <b>{m.modules[0].label}</b> chưa bật cho không gian làm việc này. Chủ sở hữu bật được ở Cài đặt › Hồ sơ ngành, hoặc tạo trợ lý theo mẫu {m.short}.</Notice>
      <p className="row-actions"><a className="btn btn-ghost" href="#/cai-dat-bot">Mở Hồ sơ ngành</a><a className="btn btn-ghost" href="#/tro-ly">Tạo trợ lý mẫu {m.short}</a></p>
    </>
  );
}
