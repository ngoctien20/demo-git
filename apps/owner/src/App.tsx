import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { go, useRoute } from './router';
import { StoreCtx, StoreRow, Role } from './store';
import { Spinner, Notice } from './ui';
import { AuthPage } from './pages/Auth';
import { Onboarding } from './pages/Onboarding';
import { Shell } from './Shell';

// Platform Admin is NOT part of the public build. It exists only in the separate admin build
// (`npm run build:admin` → admin-local/, never deployed). Vite replaces the flag at build time, so the public
// bundle carries no admin page, menu, RPC names or chunk. The admin build shows ONLY the admin app, no shop pages.
const ADMIN_BUILD = import.meta.env.VITE_T404_ADMIN === '1';
const AdminApp = ADMIN_BUILD ? lazy(() => import('./pages/Admin').then(m => ({ default: m.AdminApp }))) : null;

const STORE_KEY = 'tien404_current_store';
const PUBLIC_PATHS = ['/dang-nhap', '/dang-ky', '/quen-mat-khau', '/dat-lai-mat-khau'];

export function App() {
  const route = useRoute();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [stores, setStores] = useState<StoreRow[] | null>(null);
  const [storesErr, setStoresErr] = useState('');
  const [current, setCurrent] = useState<string | null>(() => { try { return localStorage.getItem(STORE_KEY); } catch { return null; } });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') go('/dat-lai-mat-khau');
      if (event === 'SIGNED_OUT') { setStores(null); go('/dang-nhap'); }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const loadStores = useCallback(async () => {
    setStoresErr('');
    const [m, s, t0] = await Promise.all([
      supabase.from('store_memberships').select('store_id, tenant_id, role').eq('active', true),
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
  }, []);

  useEffect(() => { if (session && !ADMIN_BUILD) loadStores(); }, [session?.user.id, loadStores]);
  // Signed-in people who open a login/sign-up link land on the dashboard instead.
  useEffect(() => { if (session && PUBLIC_PATHS.includes(route.path) && route.path !== '/dat-lai-mat-khau') go('/'); }, [session, route.path]);

  const store = useMemo(() => stores?.find(s => s.id === current) ?? stores?.[0] ?? null, [stores, current]);
  useEffect(() => { if (store) try { localStorage.setItem(STORE_KEY, store.id); } catch { /* private mode */ } }, [store]);

  if (session === undefined) return <div className="center-screen"><Spinner /></div>;

  if (!session) return <AuthPage path={PUBLIC_PATHS.includes(route.path) ? route.path : '/dang-nhap'} />;
  if (route.path === '/dat-lai-mat-khau') return <AuthPage path={route.path} />;

  if (ADMIN_BUILD && AdminApp) return <Suspense fallback={<div className="center-screen"><Spinner /></div>}><AdminApp email={session.user.email ?? ''} /></Suspense>;

  if (stores === null) return <div className="center-screen"><Spinner label="Đang tải không gian làm việc…" /></div>;
  if (storesErr) return <div className="center-screen"><Notice kind="err">{storesErr}</Notice><button className="btn btn-primary" onClick={loadStores}>Thử lại</button></div>;
  if (!store) return <Onboarding email={session.user.email ?? ''} onDone={loadStores} />;

  return (
    <StoreCtx.Provider value={{
      store, stores, email: session.user.email ?? '', canManage: store.role !== 'staff', reloadStores: loadStores,
    }}>
      <Shell route={route} onSwitch={id => setCurrent(id)} />
    </StoreCtx.Provider>
  );
}
