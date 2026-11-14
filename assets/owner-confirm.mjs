// Mount after the authenticated dashboard obtains a pending claim for its current shop.
export function mountOwnerConfirmation(root, claim, confirm) {
  const panel = document.createElement('section');
  const title = document.createElement('h3');
  title.textContent = 'Xác nhận ghép Bot Zalo';
  const details = document.createElement('p');
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  panel.append(title, details, status);
  root.replaceChildren(panel);
  if (claim?.status === 'PENDING_OWNER_CONFIRMATION' && claim.shopName && claim.botName
      && /^[a-f0-9]{8,16}$/.test(claim.recipientFingerprint) && claim.challengeId && typeof confirm === 'function') {
    details.textContent = [claim.shopName, claim.botName, 'Dấu nhận diện ' + claim.recipientFingerprint].join(' · ');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Xác nhận đúng tài khoản';
    panel.append(button);
    button.onclick = async () => {
      if (button.disabled || !root.contains(panel)) return;
      button.disabled = true;
      try {
        const result = await confirm(claim.challengeId);
        if (!root.contains(panel)) return;
        if (result?.status !== 'PAIRED' || result.challengeId !== claim.challengeId) throw Error();
        status.textContent = 'Đã ghép nối.';
      } catch {
        if (root.contains(panel)) status.textContent = 'Chưa xác minh được kết quả. Hãy tải lại trạng thái ghép nối.';
      }
    };
  } else {
    status.textContent = 'Chưa có yêu cầu ghép nối cần xác nhận.';
  }
  return () => panel.remove();
}
