// TIEN404 V25 Daily Briefing sender. Draft only; publish needs the n8n credential
// credential "T404 briefing key" (Templated custom auth: {"headers":{"x-t404-briefing-key":"{{briefing_key}}"}}, value = Vault secret t404_briefing_sender_key).
import { workflow, node, trigger, newCredential, expr } from '@n8n/workflow-sdk';

const BASE = 'https://ifxlvrhyjhbzbrkdsida.supabase.co/rest/v1/rpc/';
const APIKEY = 'sb_publishable_e7L9qkumVD6Y57RSLaWsaQ_tRjF7OvF'; // public publishable key (same as the App)
const keyCred = newCredential('T404 briefing key');

const every15 = trigger({
  type: 'n8n-nodes-base.scheduleTrigger', version: 1.4,
  config: { name: 'Mỗi 15 phút', parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 15 }] } } }
});

const claim = node({
  type: 'n8n-nodes-base.httpRequest', version: 4.5,
  config: {
    name: 'Lấy shop đến giờ gửi',
    parameters: {
      method: 'POST', url: BASE + 'briefing_claim_due_v1',
      authentication: 'genericCredentialType', genericAuthType: 'httpTemplatedCustomAuth',
      sendHeaders: true, headerParameters: { parameters: [{ name: 'apikey', value: APIKEY }] },
      sendBody: true, specifyBody: 'json', jsonBody: '{}',
      options: { timeout: 20000 }
    },
    credentials: { httpTemplatedCustomAuth: keyCred }
  }
});

const build = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: {
    name: 'Soạn email',
    parameters: {
      mode: 'runOnceForEachItem', language: 'javaScript',
      jsCode: `const r = $json;
const L = { conv_messenger: 'Hội thoại Messenger', conv_web: 'Hội thoại web', conv_zalo: 'Hội thoại Zalo', handoff: 'Khách cần người trả lời', orders: 'Đơn mới', revenue: 'Doanh thu đã xác nhận', contact_requests: 'Yêu cầu liên hệ', top_questions: 'Câu hỏi nhiều nhất', incidents: 'Sự cố' };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (k, v) => v === null || v === undefined ? 'chưa có dữ liệu' : k === 'revenue' ? Number(v).toLocaleString('vi-VN') + ' đ' : String(v);
const d = String(r.local_date).split('-').reverse().join('/');
const rows = Object.keys(r.metrics || {}).map(k => '<tr><td style="padding:4px 12px 4px 0">' + esc(L[k] || k) + '</td><td style="padding:4px 0"><b>' + esc(fmt(k, r.metrics[k])) + '</b></td></tr>').join('');
const html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#111"><p>Chào anh/chị,</p><p>Báo cáo 24 giờ qua của <b>' + esc(r.store_name) + '</b>:</p><table>' + rows + '</table><p style="color:#666;font-size:12px">Chỉ gồm số liệu có nguồn đã xác minh. Đổi giờ gửi hoặc tắt trong App, mục Báo cáo.</p></div>';
return { json: { delivery_id: r.delivery_id, to: (r.recipients || []).join(','), subject: 'Báo cáo sáng ' + d + ' – ' + r.store_name, html } };`
    }
  }
});

const send = node({
  type: 'n8n-nodes-base.gmail', version: 2.2,
  config: {
    name: 'Gửi Gmail', onError: 'continueRegularOutput',
    parameters: {
      resource: 'message', operation: 'send',
      sendTo: expr('{{ $json.to }}'), subject: expr('{{ $json.subject }}'),
      emailType: 'html', message: expr('{{ $json.html }}'),
      options: { appendAttribution: false, senderName: 'TIEN404 AI' }
    },
    credentials: { gmailOAuth2: { id: '8L4YHdveGXEB0ZbY', name: 'Gmail account' } }
  }
});

const report = node({
  type: 'n8n-nodes-base.httpRequest', version: 4.5,
  config: {
    name: 'Ghi kết quả gửi',
    parameters: {
      method: 'POST', url: BASE + 'briefing_report_v1',
      authentication: 'genericCredentialType', genericAuthType: 'httpTemplatedCustomAuth',
      sendHeaders: true, headerParameters: { parameters: [{ name: 'apikey', value: APIKEY }] },
      sendBody: true, specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ p_delivery: $(\'Soạn email\').item.json.delivery_id, p_ok: !$json.error && !!$json.id, p_error: $json.error ? String($json.error.message || $json.error).slice(0, 300) : null }) }}'),
      options: { timeout: 20000 }
    },
    credentials: { httpTemplatedCustomAuth: keyCred }
  }
});

export default workflow('t404-v25-briefing', 'TIEN404 V25 – Báo cáo sáng (email)')
  .add(every15).to(claim).to(build).to(send).to(report);
