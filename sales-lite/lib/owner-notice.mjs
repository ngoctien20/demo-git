// Render only verified QA readback. This pure function is also deployed in the manual n8n regression.
export function ownerNotice(request, outbox, binding, enabled) {
  const fail = code => { throw Object.assign(new Error(code), {code}); };
  if (!enabled || !request || !outbox || !binding) fail('RECIPIENT_UNAVAILABLE');
  for (const field of ['tenant','store','bot']) {
    if (!request[field] || request[field] !== outbox[field] || request[field] !== binding[field]) fail('RECIPIENT_UNAVAILABLE');
  }
  if (!binding.owner_ref || !binding.recipient_ref || binding.owner_ref !== outbox.owner_ref ||
      binding.recipient_ref !== outbox.recipient_ref || !request.id || request.id !== outbox.request_id ||
      request.source !== 'qa_inbound' || outbox.event_kind !== 'request_saved' || outbox.channel !== 'zalo_bot') fail('RECIPIENT_UNAVAILABLE');
  const labels = {NEW_PENDING_OWNER:'Chờ chủ shop xác nhận', OWNER_CONFIRMED:'Đã xác nhận', CANCELLED:'Đã từ chối', PAID:'Đã thanh toán'};
  if (!Object.hasOwn(labels, request.status) || !/^T404-[0-9A-F]{16}$/.test(request.code) ||
      !/^[A-Z]{1,4}\d{2,6}$/.test(request.sku) || typeof request.product_label !== 'string' ||
      !request.product_label.trim() || request.product_label.length > 120 || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e]/u.test(request.product_label) ||
      !Number.isInteger(request.quantity) || request.quantity < 1 || request.quantity > 9999 ||
      !/^[1-9]\d{0,15}$/.test(String(request.unit_vnd)) || !/^[1-9]\d{0,15}$/.test(String(request.total_vnd))) fail('INVALID_READBACK');
  const total = BigInt(request.unit_vnd) * BigInt(request.quantity);
  if (total > 9007199254740991n || total !== BigInt(request.total_vnd)) fail('INVALID_READBACK');
  return ['TIEN404 · Yêu cầu đặt hàng thử nghiệm',request.code,request.sku+' — '+request.product_label,
    'Số lượng: '+request.quantity,'Tạm tính: '+total.toLocaleString('vi-VN')+'đ','Trạng thái: '+labels[request.status]].join('\n');
}
