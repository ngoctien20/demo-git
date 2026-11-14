import { mountOwnerConfirmation } from './owner-confirm.mjs';

// Call with the verified active shop and existing signed-in Supabase client.
export function mountOwnerPairing(root, client, shop) {
  const section = document.createElement('section');
  const heading = document.createElement('h3');
  heading.textContent = 'Ghép tài khoản với Bot Zalo';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const actions = document.createElement('div');
  const command = document.createElement('code');
  const confirmation = document.createElement('div');
  section.append(heading, status, command, actions, confirmation);
  root.append(section);
  let generation = 0;
  let timer;
  let challengeId = null;
  const attached = () => root.contains(section);
  const rpc = async (action, id) => {
    const {data, error} = await client.rpc('qa_owner_pairing', {
      p_shop: shop.id, p_action: action, p_challenge: id
    });
    if (error || !data) throw Error('pairing unavailable');
    return data;
  };
  function button(label, action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.onclick = () => refresh(action);
    actions.append(b);
  }
  async function refresh(action) {
    const turn = ++generation;
    actions.replaceChildren();
    confirmation.replaceChildren();
    status.textContent = 'Đang kiểm tra…';
    try {
      const reply = await rpc(action, action === 'issue' ? null : challengeId);
      if (!attached() || turn !== generation) return;
      const expires = Date.parse(reply.expiresAt);
      if (reply.state === 'NO_CURRENT_CHALLENGE' || reply.state === 'CLOSED' || expires <= Date.now()) {
        clearTimeout(timer);
        challengeId = null;
        command.textContent = '';
        status.textContent = reply.state === 'CLOSED' ? 'Yêu cầu đã đóng.' : 'Chưa có mã đang dùng.';
        button('Tạo mã ghép nối', 'issue');
        return;
      }
      if (!Number.isFinite(expires) || !reply.challengeId) throw Error();
      challengeId = reply.challengeId;
      clearTimeout(timer);
      timer = setTimeout(() => {
        generation++;
        command.textContent = '';
        confirmation.replaceChildren();
        actions.replaceChildren();
        status.textContent = 'Mã ghép nối đã hết hạn.';
        if (attached()) button('Kiểm tra lại', 'status');
      }, Math.min(expires - Date.now(), 300000));
      if (reply.state === 'PENDING_OWNER_CONFIRMATION') {
        command.textContent = '';
        status.textContent = 'Kiểm tra tài khoản trước khi xác nhận.';
        mountOwnerConfirmation(confirmation, {status:reply.state, challengeId,
          shopName:shop.name, botName:reply.bot, recipientFingerprint:reply.recipientFingerprint},
          id => rpc('confirm', id));
      } else if (reply.state === 'WAITING_FOR_BOT') {
        if (action === 'issue' && /^[0-9a-f]{32}$/.test(reply.code)) {
          command.textContent = 'GHÉP ' + challengeId + ' ' + reply.code;
        }
        status.textContent = command.textContent ? 'Gửi dòng bên dưới trong chat riêng với Bot của shop.' :
          'Đang chờ Bot nhận mã. Mã chỉ hiển thị khi tạo.';
      } else throw Error();
      button('Kiểm tra trạng thái', 'status');
    } catch {
      if (!attached() || turn !== generation) return;
      command.textContent = '';
      status.textContent = 'Chưa xác minh được trạng thái. Hãy kiểm tra lại.';
      button('Kiểm tra lại', 'status');
    }
  }
  refresh('status');
  return () => { generation++; clearTimeout(timer); section.remove(); };
}
