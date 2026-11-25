import { useStore } from '../store';
import { PageHead } from '../ui';
import { Billing } from './Billing';

export function Plan() {
  const { store } = useStore();
  return (
    <>
      <PageHead title="Gói và thanh toán" sub={`${store.tenant_name || store.name} · bản DEMO`} actions={<a className="btn btn-ghost" href="#/tai-khoan">Tài khoản</a>} />
      <Billing />
    </>
  );
}
