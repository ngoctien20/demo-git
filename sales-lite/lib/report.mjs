import { period } from '../../assets/merchant-revenue-v3.mjs';
import { money, reject } from './protocol.mjs';

// The existing calendar helper defines Vietnamese dates. Creation counts and cash receipts use different clocks.
export async function revenue(db, scope, key, asOf = new Date()) {
  if (!['today', 'week', 'month'].includes(key)) reject('INVALID_PERIOD');
  const [start, end] = period(key, asOf);
  const query = `
    WITH bounds AS (SELECT $4::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh' AS lo,
                            ($5::date+1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh' AS hi),
    scoped AS (SELECT r.status,r.total_vnd,r.created_at,p.paid_at,p.amount_vnd,p.verified,
        (p.verified IS TRUE AND p.amount_vnd=r.total_vnd AND isfinite(p.paid_at)
         AND p.paid_at>=r.created_at AND p.paid_at<=$6::timestamptz AND length(btrim(p.payment_ref))>0) AS valid_payment
      FROM sales_lite_qa.requests r LEFT JOIN sales_lite_qa.payment_evidence p
        ON (p.tenant,p.store,p.bot,p.request_id)=(r.tenant,r.store,r.bot,r.id)
      WHERE (r.tenant,r.store,r.bot)=($1,$2,$3) AND r.created_at<=$6::timestamptz),
    stats AS (SELECT s.*, created_at>=lo AND created_at<hi AS created_in, paid_at>=lo AND paid_at<hi AS paid_in FROM scoped s CROSS JOIN bounds)
    SELECT count(*) FILTER(WHERE created_in)::int AS requests,
      count(*) FILTER(WHERE created_in AND status='NEW_PENDING_OWNER')::int AS pending,
      count(*) FILTER(WHERE created_in AND status='OWNER_CONFIRMED')::int AS confirmed,
      count(*) FILTER(WHERE created_in AND status='CANCELLED')::int AS cancelled,
      count(*) FILTER(WHERE created_in AND status='PAID')::int AS marked_paid,
      coalesce(sum(total_vnd) FILTER(WHERE created_in),0)::text AS requested_vnd,
      count(*) FILTER(WHERE status='PAID' AND valid_payment AND paid_in)::int AS receipts,
      coalesce(sum(amount_vnd) FILTER(WHERE status='PAID' AND valid_payment AND paid_in),0)::text AS verified_vnd,
      count(*) FILTER(WHERE status='PAID' AND valid_payment IS NOT TRUE AND (paid_at IS NULL OR paid_in OR created_in))::int AS incomplete
    FROM stats`;
  const {
    rows: [r]
  } = await db.query(query, [...scope, start, end, asOf]);
  return {
    ...r,
    paid_vnd: r.incomplete ? null : r.verified_vnd,
    start,
    end,
    timezone: 'Asia/Ho_Chi_Minh',
    origin: 'synthetic_qa'
  };
}
export function formatRevenue(r) {
  return [
    r.start === r.end ? r.start : r.start + ' – ' + r.end,
    'Chờ xử lý ' + r.pending + ' · Đã xác nhận ' + r.confirmed + ' · Đã hủy ' + r.cancelled,
    r.paid_vnd === null
      ? 'Tiền đã thu: thiếu chứng cứ thanh toán.'
      : 'Tiền đã thu: ' + money(r.paid_vnd) + ' (' + r.receipts + ' giao dịch)',
    'Giá trị yêu cầu tạo trong kỳ: ' + money(r.requested_vnd)
  ].join('\n');
}
