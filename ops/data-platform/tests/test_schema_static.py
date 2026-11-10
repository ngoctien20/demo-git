from pathlib import Path

SCHEMA=Path(__file__).parents[1]/'schema.staging.sql'

def test_all_public_tables_have_rls_and_revoked_writes():
    s=SCHEMA.read_text()
    public=['tenants','tenant_memberships','products','customers','orders','order_items','conversations','messages']
    for name in public:
        assert f'ALTER TABLE public.{name} ENABLE ROW LEVEL SECURITY;' in s
        assert f'ALTER TABLE public.{name} FORCE ROW LEVEL SECURITY;' in s
    assert 'REVOKE ALL ON TABLE' in s
    assert 'GRANT SELECT ON TABLE' in s
    assert 'GRANT INSERT' not in s.upper()
    assert 'GRANT UPDATE' not in s.upper()
    assert 'GRANT DELETE' not in s.upper()

def test_tenant_fk_and_private_secrets_are_not_exposed():
    s=SCHEMA.read_text()
    assert 'FOREIGN KEY (tenant_id, order_id)' in s
    assert 'FOREIGN KEY (tenant_id, product_id)' in s
    assert 'REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated' in s
    assert 'CREATE TABLE IF NOT EXISTS app_private.channel_secrets' in s
    assert 'REFERENCES auth.users(id)' in s