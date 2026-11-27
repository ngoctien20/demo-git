-- Supabase tien404-staging only. Synthetic dry-run writer. Every trial rolls back.
DO $qa$
DECLARE
  fixture record;
  scenario text;
  expected text;
  observed text;
  total bigint;
BEGIN
  SELECT c.* INTO STRICT fixture
  FROM tien404_r1_qa.catalog c
  JOIN tien404_r1_qa.shop_bots b USING (tenant_key,store_key,bot_key)
  WHERE b.identity_status='synthetic_qa' AND b.enabled_mode='dry_run'
    AND c.stock>=1 AND c.price_vnd>0
    AND NOT EXISTS (SELECT 1 FROM tien404_r1_qa.owner_bindings o
      WHERE (o.tenant_key,o.store_key,o.bot_key)=(c.tenant_key,c.store_key,c.bot_key)
        AND o.status='paired' AND o.expires_at>now())
  ORDER BY c.tenant_key,c.store_key,c.sku LIMIT 1;
  FOREACH scenario IN ARRAY ARRAY['no_confirmation','missing_total','stale_total','unpaired'] LOOP
    expected := CASE scenario WHEN 'no_confirmation' THEN 'CONFIRMATION_REQUIRED'
      WHEN 'unpaired' THEN 'OWNER_NOT_PAIRED' ELSE 'PRICE_MISMATCH' END;
    total := CASE scenario WHEN 'missing_total' THEN NULL
      WHEN 'stale_total' THEN fixture.price_vnd-1 ELSE fixture.price_vnd END;
    BEGIN
      PERFORM * FROM tien404_r1_qa.commit_order_qa(fixture.tenant_key,fixture.store_key,fixture.bot_key,
        'QA-PR519-GUARD','qa-session-pr519',fixture.sku,1,total,'qa-confirm-pr519','qa-replay-pr519',
        scenario<>'no_confirmation');
      RAISE EXCEPTION 'UNEXPECTED_ACCEPT';
    EXCEPTION WHEN OTHERS THEN
      observed := SQLERRM;
    END;
    IF observed IS DISTINCT FROM expected THEN
      RAISE EXCEPTION 'guard % returned unexpected outcome',scenario;
    END IF;
  END LOOP;
END
$qa$;
SELECT '4/4' AS synthetic_create_writer_guards;
