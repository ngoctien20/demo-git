-- Commerce candidate. Inclusive Vietnam dates; amounts remain exact when consumed by JavaScript.
BEGIN;
CREATE FUNCTION public.merchant_revenue_v3(p_shop uuid,p_start date,p_end date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE days integer; report jsonb;
BEGIN
  IF NOT EXISTS (SELECT FROM public.tenant_memberships WHERE tenant_id=p_shop AND active
    AND user_id=(SELECT auth.uid()) AND role IN ('owner','manager')) THEN
    RAISE insufficient_privilege; END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_end<p_start OR p_end-p_start>=366 THEN
    RAISE invalid_parameter_value; END IF;
  days:=p_end-p_start+1;
  WITH cohort AS (
    SELECT o.id,o.total_vnd,o.status,
      CASE WHEN o.created_at >= (p_start::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') THEN 'current' ELSE 'previous' END period
    FROM public.orders o WHERE o.tenant_id=p_shop AND
      o.created_at >= ((p_start-days)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AND
      o.created_at < ((p_end+1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
  ), stats AS (
    SELECT p.period,count(c.id) orders,count(*) FILTER(WHERE status='pending') pending,
      count(*) FILTER(WHERE status='paid') paid,count(*) FILTER(WHERE status='cancelled') cancelled,
      coalesce(sum(total_vnd),0)::text order_face_value_vnd,
      coalesce(sum(total_vnd) FILTER(WHERE status='paid'),0)::text paid_order_value_vnd,
      coalesce(sum(total_vnd) FILTER(WHERE status IN ('pending','confirmed')),0)::text unpaid_order_value_vnd,
      round(avg(total_vnd) FILTER(WHERE status='paid'))::text avg_paid_order_vnd
    FROM (VALUES ('current'),('previous')) p(period) LEFT JOIN cohort c USING(period) GROUP BY p.period
  ), top_skus AS (
    SELECT p.sku,sum(i.quantity) units,sum(i.quantity::numeric*i.unit_price_vnd)::text paid_line_vnd
    FROM cohort c JOIN public.order_items i ON i.order_id=c.id AND i.tenant_id=p_shop
    JOIN public.products p ON p.id=i.product_id AND p.tenant_id=i.tenant_id
    WHERE c.period='current' AND c.status='paid' GROUP BY p.sku ORDER BY sum(i.quantity) DESC,p.sku LIMIT 10
  )
  SELECT jsonb_build_object('timezone','Asia/Ho_Chi_Minh','basis','created_at_current_status',
    'start',p_start,'end',p_end,'previous_start',p_start-days,'previous_end',p_start-1,
    'periods',(SELECT jsonb_object_agg(period,to_jsonb(stats)-'period') FROM stats),
    'top_skus_by_units',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY units DESC,sku) FROM top_skus t),'[]'::jsonb),
    'cash_received_vnd',NULL,'gross_profit_vnd',NULL,'debt_vnd',NULL) INTO report;
  RETURN report;
END $$;
REVOKE ALL ON FUNCTION public.merchant_revenue_v3(uuid,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.merchant_revenue_v3(uuid,date,date) TO authenticated;
COMMIT;
