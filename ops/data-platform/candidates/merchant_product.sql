-- Candidate only. Apply as a single transaction after staging permission review.
BEGIN;
CREATE FUNCTION public.save_merchant_product(
  p_tenant uuid, p_sku text, p_name text, p_price bigint, p_active boolean,
  p_initial_stock integer, p_expected_updated_at timestamptz
) RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid();
  changed_at timestamptz;
BEGIN
  PERFORM 1 FROM public.tenant_memberships
    WHERE tenant_id = p_tenant AND user_id = actor AND active AND role IN ('owner', 'manager')
    FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'access_denied' USING ERRCODE='42501'; END IF;
  IF p_sku IS NULL OR length(trim(p_sku)) NOT BETWEEN 1 AND 80 OR p_sku <> trim(p_sku)
     OR p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 250
     OR p_price IS NULL OR p_price NOT BETWEEN 0 AND 1000000000000 OR p_active IS NULL THEN
    RAISE EXCEPTION 'invalid_product' USING ERRCODE='22023';
  END IF;
  IF p_expected_updated_at IS NULL THEN
    IF p_initial_stock IS NULL OR p_initial_stock < 0 THEN
      RAISE EXCEPTION 'invalid_initial_stock' USING ERRCODE='22023';
    END IF;
    INSERT INTO public.products(tenant_id,sku,name,price_vnd,is_active,stock_on_hand)
      VALUES(p_tenant,p_sku,trim(p_name),p_price,p_active,p_initial_stock)
      RETURNING updated_at INTO changed_at;
  ELSE
    IF p_initial_stock IS NOT NULL THEN RAISE EXCEPTION 'stock_is_managed_separately' USING ERRCODE='22023'; END IF;
    UPDATE public.products SET name=trim(p_name),price_vnd=p_price,is_active=p_active,
      updated_at=greatest(clock_timestamp(),updated_at + interval '1 microsecond')
      WHERE tenant_id=p_tenant AND sku=p_sku AND updated_at=p_expected_updated_at
      RETURNING updated_at INTO changed_at;
    IF NOT FOUND THEN RAISE SQLSTATE 'PT409' USING MESSAGE='product_changed_or_missing'; END IF;
  END IF;
  INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,metadata)
    VALUES(p_tenant,actor,CASE WHEN p_expected_updated_at IS NULL THEN 'product_create' ELSE 'product_edit' END,
           jsonb_build_object('sku',p_sku));
  RETURN changed_at;
END $$;
REVOKE ALL ON FUNCTION public.save_merchant_product(uuid,text,text,bigint,boolean,integer,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_merchant_product(uuid,text,text,bigint,boolean,integer,timestamptz) TO authenticated;
COMMIT;
