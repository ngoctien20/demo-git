// High-confidence request for software creation, scoped to the Shop candidate.
export function shopScopeReply(text) {
  if (typeof text !== 'string' || text.length > 1800) return null;
  const words = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
    .replaceAll('đ', 'd').replace(/\s+/g, ' ').trim();
  const build = /^(?:(?:ban|shop|bot|hay|vui long|lam on)\s+)*(?:code|lap trinh|viet code|viet|tao|thiet ke)\s+(?:(?:giup|cho)\s+(?:minh|toi|anh|em)\s+)?(?:(?:mot|1)\s+)?(?:trang web|website|web app|ung dung web)\b/;
  if (!build.test(words)) return null;
  return 'Em hỗ trợ xem mẫu, kiểm tra giá và chọn size của shop. Anh/chị muốn xem mẫu nào ạ?';
}
