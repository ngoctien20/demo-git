-- TIEN404 V19.0-B4: disposable synthetic registry schema only.
-- This is NOT the production installation registry or canonical Commerce Store schema.
-- No real provider Bot IDs, real tenants/stores, credentials, tokens or customer data.
-- Never apply to Supabase/Commerce or any production database.
CREATE TABLE IF NOT EXISTS v19_b4_installation_registry (
  installation_ref TEXT NOT NULL CHECK(installation_ref LIKE 'qa-install-%'),
  provider TEXT NOT NULL CHECK(provider='zalo_bot'),
  environment TEXT NOT NULL CHECK(environment='staging'),
  tenant_ref TEXT NOT NULL CHECK(tenant_ref LIKE 'qa-tenant-%'),
  store_ref TEXT NOT NULL CHECK(store_ref LIKE 'qa-store-%'),
  status TEXT NOT NULL CHECK(status='QA_LOCKED'),
  proof_kind TEXT NOT NULL CHECK(proof_kind='SYNTHETIC_FIXTURE_ONLY'),
  binding_sha256 TEXT NOT NULL CHECK(length(binding_sha256)=64),
  registry_revision INTEGER NOT NULL CHECK(registry_revision>=1),
  effective_from_ms INTEGER NOT NULL CHECK(effective_from_ms>0),
  expires_at_ms INTEGER NOT NULL CHECK(expires_at_ms>effective_from_ms),
  PRIMARY KEY (installation_ref,provider,environment)
);
-- This database is reused from V18.2.2 disposable QA. Existing
-- qa_canary_once and _cf_KV tables MUST remain untouched.
-- No DELETE/DROP or automated cleanup in this review.
