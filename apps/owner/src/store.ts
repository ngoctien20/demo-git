import { createContext, useContext } from 'react';

export type Role = 'owner' | 'manager' | 'staff';
export type StoreRow = { id: string; tenant_id: string; name: string; is_default: boolean; role: Role; tenant_name: string };
export type Ctx = { store: StoreRow; stores: StoreRow[]; email: string; canManage: boolean; reloadStores: () => Promise<void> };
export const StoreCtx = createContext<Ctx | null>(null);
export function useStore(): Ctx {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('StoreCtx missing');
  return c;
}
