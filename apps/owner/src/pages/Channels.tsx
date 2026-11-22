import { useStore } from '../store';
import { PageHead, Notice } from '../ui';
import { SITE_HOME } from '../config';

const CHANNELS = [
  { name: 'Facebook Messenger', desc: 'Bot trả lời tin nhắn Page, gửi nút xem sản phẩm và ghi đơn.', state: 'Kết nối có hỗ trợ' },
  { name: 'Zalo', desc: 'Nhận tin nhắn qua Zalo Bot chính thức. Trả lời tự động đang thử nghiệm.', state: 'Thử nghiệm' },
  { name: 'Widget website', desc: 'Khung chat gắn lên website của shop bằng một đoạn mã.', state: 'Kết nối có hỗ trợ' },
];

export function Channels() {
  const { store } = useStore();
  return (
    <>
      <PageHead title="Kênh bán" sub={`Nơi khách của ${store.name} nhắn tin với trợ lý AI.`} />
      <Notice>Trong giai đoạn thử nghiệm, đội TIEN404 kết nối từng kênh cùng bạn để kiểm tra quyền truy cập và chạy thử trước khi trả lời khách thật.</Notice>
      <div className="channel-grid">
        {CHANNELS.map(c => (
          <section key={c.name} className="panel channel">
            <h2>{c.name}</h2>
            <p className="muted">{c.desc}</p>
            <p><span className="pill">Chưa kết nối</span> <span className="pill soft">{c.state}</span></p>
            <a className="btn btn-ghost" href={`${SITE_HOME}contact.html?goi=cua-hang`} target="_blank" rel="noopener">Nhờ TIEN404 kết nối</a>
          </section>
        ))}
      </div>
    </>
  );
}
