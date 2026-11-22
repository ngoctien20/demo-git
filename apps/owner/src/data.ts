import { useCallback, useEffect, useState } from 'react';

/** Small loader hook: runs `fn` on mount / when deps change; exposes reload(). */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);
  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await run()); } catch (e) { setError(e); } finally { setLoading(false); }
  }, [run]);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, loading, reload, setData };
}

/** Throws Supabase errors so useLoad can catch them. */
export function must<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

export type Product = { id: string; sku: string; name: string; price_vnd: number; stock_on_hand: number; is_active: boolean; updated_at: string };
export type Order = { id: string; status: string; total_vnd: number; order_source: string; created_at: string; customer_id: string | null };
export type Customer = { id: string; display_name: string; phone: string | null; email: string | null; created_at: string; stage?: string; follow_up_at?: string | null; note?: string | null };
export type BotSettingsRow = { shop_info: string; forbidden_promises: string; tone: 'polite' | 'friendly' | 'cute'; bot_enabled: boolean; notify_emails: string[]; updated_at: string };
export type Faq = { id: string; question: string; answer: string; active: boolean; updated_at: string };

export const ORDER_STATUS: Record<string, string> = { pending: 'Chờ duyệt', confirmed: 'Đã xác nhận', paid: 'Đã thanh toán', cancelled: 'Đã huỷ', refunded: 'Đã hoàn tiền' };
export const ORDER_SOURCE: Record<string, string> = { manual: 'Nhập tay', web: 'Website', messenger: 'Messenger', zalo: 'Zalo', line: 'LINE', api: 'API' };
export const STAGES: [string, string][] = [['new', 'Mới'], ['consulting', 'Đang tư vấn'], ['hot', 'Tiềm năng cao'], ['won', 'Đã chốt'], ['lost', 'Mất khách'], ['needs_human', 'Cần người xử lý']];
export const isMissingFeature = (e: unknown) => /does not exist|schema cache|Could not find/i.test(String((e as { message?: string })?.message ?? e));
