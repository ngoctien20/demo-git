-- Read-only reconciliation. The oracle uses the operator's view of orders.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
DO $$
DECLARE
  shop uuid;
  actor uuid;
  days integer;
  expected jsonb;
  actual jsonb;
  today_vn date := (current_timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
BEGIN
  FOREACH shop IN ARRAY ARRAY['9c8c524c-88db-4771-8ab0-a4316298494c'::uuid,
                              '4b12fc28-4fc3-4b06-bbf1-72a1f62ad5c5'::uuid] LOOP
    SELECT user_id INTO STRICT actor FROM public.tenant_memberships WHERE
      tenant_id=shop AND active AND role='owner' ORDER BY user_id LIMIT 1;
    FOREACH days IN ARRAY ARRAY[7,30] LOOP
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.order_day) INTO expected FROM (
        SELECT shop AS tenant_id, (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS order_day,
          count(*) AS order_count, sum(CASE WHEN status='paid' THEN 1 ELSE 0 END) AS paid_count,
          sum(CASE WHEN status='paid' THEN total_vnd ELSE 0 END)::text AS paid_vnd
        FROM public.orders WHERE tenant_id=shop
        AND (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN today_vn-days+1 AND today_vn
        GROUP BY 2
      ) r;
      IF expected IS NULL THEN RAISE EXCEPTION 'missing positive order control'; END IF;
      PERFORM set_config('request.jwt.claim.sub',actor::text,true);
      SET LOCAL ROLE authenticated;
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.order_day) INTO actual
        FROM public.merchant_paid_orders_daily(shop,days) r;
      RESET ROLE;
      IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'daily report mismatch'; END IF;
    END LOOP;
  END LOOP;
END $$;
ROLLBACK;
