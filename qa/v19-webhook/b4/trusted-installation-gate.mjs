// TIEN404 V19.0-B4 — source-only, disposable QA registry review.
// IMPORTANT: This gate does not establish real Zalo provider identity, approved
// merchant Store ownership, Supabase JWT/RLS or permission to read/write commerce.
// It is NOT wired to a Cloudflare Worker or live webhook. No network, secrets or PII.
const SAFE_INSTALL = /^qa-install-[A-Za-z0-9_-]{8,64}$/;
const SAFE_REF = /^qa-(?:tenant|store)-[A-Za-z0-9_-]{6,64}$/;
const SAFE_SHA = /^[a-f0-9]{64}$/;

export const REGISTRY_SQL = [
  "SELECT installation_ref,provider,environment,tenant_ref,store_ref,",
  "status,proof_kind,binding_sha256,registry_revision,effective_from_ms,expires_at_ms",
  "FROM v19_b4_installation_registry",
  "WHERE installation_ref=?1 AND provider=?2 AND environment=?3 LIMIT 2"
].join(" ");

const deny = (reason) => Object.freeze({
  contract: "TIEN404_V19_B4_REGISTRY_QA_ONLY",
  decision: "DENY",
  reason,
  syntheticRegistryMatched: false,
  providerIdentityVerified: false,
  storeAuthorityVerified: false,
  ownerMembershipVerified: false,
  customerIdentityVerified: false,
  commerceReadAllowed: false,
  commerceWriteAllowed: false,
  providerSendAllowed: false,
  webhookPublishAllowed: false
});

const review = Object.freeze({
  contract: "TIEN404_V19_B4_REGISTRY_QA_ONLY",
  decision: "QA_REGISTRY_MATCH_ONLY",
  reason: "SYNTHETIC_REGISTRY_BINDING_MATCH",
  syntheticRegistryMatched: true,
  providerIdentityVerified: false,
  storeAuthorityVerified: false,
  ownerMembershipVerified: false,
  customerIdentityVerified: false,
  commerceReadAllowed: false,
  commerceWriteAllowed: false,
  providerSendAllowed: false,
  webhookPublishAllowed: false
});

function equalFingerprint(a,b) {
  if (!SAFE_SHA.test(a||"") || !SAFE_SHA.test(b||"")) return false;
  const ta=new TextEncoder().encode(a),tb=new TextEncoder().encode(b);
  let mismatch=ta.length^tb.length;
  for(let i=0;i<64;i++) mismatch|=(ta[i]||0)^(tb[i]||0);
  return mismatch===0;
}

/**
 * Only server-owned config can choose an installationRef or provide a credential
 * binding fingerprint. Do not wire this function to fields from a provider
 * payload, URL, user header, LLM output or mutable frontend.
 *
 * The record must explicitly say SYNTHETIC_FIXTURE_ONLY. That marker must not
 * be promoted to genuine provider or merchant authorization.
 */
export async function reviewSyntheticInstallationBinding({
  db,
  trustedInstallationRef,
  trustedCredentialBindingSha256,
  provider = "zalo_bot",
  environment = "staging",
  nowMs
} = {}) {
  if (!SAFE_INSTALL.test(trustedInstallationRef||"") ||
      !SAFE_SHA.test(trustedCredentialBindingSha256||"") ||
      provider !== "zalo_bot" ||
      environment !== "staging" ||
      !Number.isSafeInteger(nowMs) ||
      typeof db?.prepare !== "function") return deny("UNTRUSTED_OR_MISSING_QA_INPUT");
  let recordset;
  try {
    recordset=await db.prepare(REGISTRY_SQL)
      .bind(trustedInstallationRef,provider,environment).all();
  } catch {
    return deny("REGISTRY_QUERY_FAILED");
  }
  if (recordset?.success!==true || !Array.isArray(recordset.results)) {
    return deny("REGISTRY_QUERY_FAILED");
  }
  if (recordset.results.length!==1) {
    return deny(recordset.results.length===0 ? "INSTALLATION_NOT_REGISTERED" : "AMBIGUOUS_INSTALLATION");
  }
  const r=recordset.results[0];
  if (!r || r.installation_ref!==trustedInstallationRef ||
      r.provider!==provider || r.environment!==environment) return deny("REGISTRY_SCOPE_CONFLICT");
  if (r.status!=="QA_LOCKED" || r.proof_kind!=="SYNTHETIC_FIXTURE_ONLY") {
    return deny("REGISTRY_NOT_DISPOSABLE_QA");
  }
  if (!SAFE_REF.test(r.tenant_ref||"") ||
      !r.tenant_ref.startsWith("qa-tenant-") ||
      !SAFE_REF.test(r.store_ref||"") ||
      !r.store_ref.startsWith("qa-store-") ||
      !Number.isSafeInteger(r.registry_revision) || r.registry_revision<1 ||
      !Number.isSafeInteger(r.effective_from_ms) ||
      !Number.isSafeInteger(r.expires_at_ms) ||
      r.effective_from_ms>nowMs || r.expires_at_ms<=nowMs ||
      r.expires_at_ms-r.effective_from_ms>86_400_000) {
    return deny("REGISTRY_ROW_INVALID_OR_EXPIRED");
  }
  if (!equalFingerprint(r.binding_sha256,trustedCredentialBindingSha256)) {
    return deny("BINDING_FINGERPRINT_MISMATCH");
  }
  return review;
}

// Never route an incoming request through this candidate: it is a pure
// read-only registry reviewer and its output never permits commerce actions.
export default { fetch() { return new Response(null,{status:423}); } };
