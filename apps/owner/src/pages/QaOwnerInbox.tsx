import { useLoad, must } from '../data';
import { vnd } from '../format';
import { supabase, friendlyError } from '../supabase';
import { Notice, Spinner } from '../ui';

type RequestRow = { order_key: string; sku: string; quantity: number; total_vnd: number; created_at: string };

export function QaOwnerInbox({ storeId }: { storeId: string }) {
  const { data, error, loading } = useLoad(async () => {
    return must(await supabase.rpc('qa_owner_inbox', { p_store: storeId })) as RequestRow[];
  }, [storeId]);
  return <section className="panel" aria-label="Yêu cầu mua mô phỏng">
    <h2>Yêu cầu mua mô phỏng</h2>
    {loading ? <Spinner /> : error ? <Notice kind="err">{friendlyError(error)}</Notice> :
      !data?.length ? <p>Chưa có yêu cầu QA cho tài khoản và cửa hàng này.</p> :
      <ul>{data.map(row => <li key={row.order_key}>
        <strong>{row.order_key}</strong> · {row.sku} × {row.quantity} · {vnd(row.total_vnd)}
      </li>)}</ul>}
  </section>;
}
