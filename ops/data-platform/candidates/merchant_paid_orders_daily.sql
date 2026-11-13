-- Derive daily value from the creation date and current order status (Vietnam time).
CREATE FUNCTION public.merchant_paid_orders_daily(p_tenant uuid, p_days integer)
RETURNS TABLE(tenant_id uuid, order_day date, order_count bigint, paid_count bigint, paid_vnd text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE today_vn date := (current_timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
BEGIN
  IF p_days IS NULL OR p_days NOT IN (7,30) THEN
    RAISE EXCEPTION 'invalid_period' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id=p_tenant
                 AND m.user_id=(SELECT auth.uid()) AND m.active AND m.role IN ('owner','manager')) THEN
    RAISE EXCEPTION 'access_denied' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
    SELECT p_tenant,(o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,count(*),
           count(*) FILTER (WHERE o.status='paid'),
           coalesce(sum(o.total_vnd) FILTER (WHERE o.status='paid'),0)::text
    FROM public.orders o
    WHERE o.tenant_id=p_tenant AND o.created_at>=((today_vn+1-p_days)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
      AND o.created_at<((today_vn+1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
    GROUP BY 2 ORDER BY 2 DESC;
END $$;
REVOKE ALL ON FUNCTION public.merchant_paid_orders_daily(uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_paid_orders_daily(uuid,integer) TO authenticated;
