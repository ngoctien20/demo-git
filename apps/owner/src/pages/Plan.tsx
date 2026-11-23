import { useStore } from '../store';
import { PageHead } from '../ui';
import { SITE_HOME } from '../config';

export function Plan() {
  const { store } = useStore();
  return (
    <>
      <PageHead title="Gói dịch vụ" sub={store.tenant_name} />
      <section className="panel plan-now">
        <p className="eyebrow">Gói hiện tại</p>
        <h2>Dùng thử</h2>
        <p className="muted">Bạn đang dùng TIEN404 AI Workspace trong giai đoạn thử nghiệm có giới hạn. App chưa thu phí và chưa phát hành hoá đơn.</p>
        <ul className="ticks"><li>Trợ lý từ mẫu ngành, menu bản nháp, lịch sử phiên bản</li><li>Kho kiến thức, module theo ngành</li><li>Hỗ trợ kết nối kênh</li></ul>
        <a className="btn btn-primary" href={`${SITE_HOME}pricing.html`} target="_blank" rel="noopener">Xem bảng giá và nhận báo giá</a>
      </section>
    </>
  );
}
