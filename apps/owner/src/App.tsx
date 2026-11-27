import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { chooseShop, returnRoute } from './loginFlow.mjs';
import { callbackStatus, supabase } from './supabase';
import { go, useRoute } from './router';
import { StoreCtx, StoreRow, Role } from './store';
import { Spinner, Notice } from './ui';
import { AuthPage } from './pages/Auth';
import { Onboarding } from './pages/Onboarding';
import { Shell } from './Shell';


const PUBLIC_PATHS = ['/dang-nhap', '/dang-ky', '/quen-mat-khau', '/dat-lai-mat-khau'];

export function App() {
  const route = useRoute();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [callbackError, setCallbackError] = useState('');
  useEffect(() => {
    callbackStatus.then(setCallbackError);
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') go('/dat-lai-mat-khau');
      if (event === 'SIGNED_OUT') go('/dang-nhap');
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || route.path === '/dat-lai-mat-khau') return;
    const target = sessionStorage.getItem('t404_google_return');
    sessionStorage.removeItem('t404_google_return');
    if (target || PUBLIC_PATHS.includes(route.path)) go(returnRoute(target ?? ''));
  }, [session?.user.id, route.path]);

  if (session === undefined) return <div className="center-screen"><Spinner /></div>;
  if (!session || route.path === '/dat-lai-mat-khau')
    return <AuthPage callbackError={callbackError} path={PUBLIC_PATHS.includes(route.path) ? route.path : '/dang-nhap'} />;
  return <Workspace key={session.user.id} session={session} route={route} />;
}

function Workspace({ session, route }: { session: Session; route: ReturnType<typeof useRoute> }) {
  const [stores, setStores] = useState<StoreRow[] | null>(null);
  const [storesErr, setStoresErr] = useState('');
  const [current, setCurrent] = useState<string | null>(null);
  const loadStores = useCallback(async () => {
    setStoresErr('');
    const [m, s, t0] = await Promise.all([
      supabase.from('store_memberships').select('store_id, tenant_id, role').eq('active', true).eq('user_id', session.user.id),
      supabase.from('stores').select('id, tenant_id, name, is_default').order('created_at'),
      supabase.from('tenants').select('id, name, industry'),
    ]);
    // tenants.industry drives only UI wording/modules (workspace.ts). Older schemas: fall back to id, name.
    const t = t0.error ? await supabase.from('tenants').select('id, name') : t0;
    if (m.error || s.error || t.error) { setStoresErr('Không tải được danh sách không gian làm việc. Vui lòng thử lại.'); setStores([]); return; }
    const role = new Map(m.data.map(r => [r.store_id as string, r.role as Role]));
    const tname = new Map(t.data.map(r => [r.id as string, r.name as string]));
    const tind = new Map(t.data.map(r => [r.id as string, ((r as { industry?: string | null }).industry ?? null)]));
    setStores(s.data.filter(r => role.has(r.id)).map(r => ({
      id: r.id, tenant_id: r.tenant_id, name: r.name, is_default: r.is_default,
      role: role.get(r.id)!, tenant_name: tname.get(r.tenant_id) ?? '', tenant_industry: tind.get(r.tenant_id) ?? null,
    })));
  }, [session.user.id]);

  useEffect(() => { if (session) loadStores(); }, [session?.user.id, loadStores]);
  const store: StoreRow | null = chooseShop(stores ?? [], current);
  if (stores === null) return <div className="center-screen"><Spinner label="Đang tải không gian làm việc…" /></div>;
  if (storesErr) return <div className="center-screen"><Notice kind="err">{storesErr}</Notice><button className="btn btn-primary" onClick={loadStores}>Thử lại</button></div>;
  if (!store && stores.length) return <div className="auth"><section className="auth-card"><h1>Chọn cửa hàng</h1>{stores.map(s => <button className="btn btn-ghost btn-block" key={s.id} onClick={() => setCurrent(s.id)}>{s.name} · {s.role}</button>)}</section></div>;
  if (!store) return <Onboarding email={session.user.email ?? ''} onDone={loadStores} />;

  return (
    <StoreCtx.Provider value={{
      store, stores, email: session.user.email ?? '', canManage: store.role !== 'staff', reloadStores: loadStores,
    }}>
      <Shell key={store.id} route={route} onSwitch={id => setCurrent(id)} />
    </StoreCtx.Provider>
  );
}
