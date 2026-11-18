"""V17.2C.40D synthetic-only owner decision and alias crosswalk contract.

No I/O, cryptographic verification, database lookup, identity resolution,
permission grant, JWT validation, migration, or provider operation occurs here.
The maximum positive result is SYNTHETIC_REVIEW_ELIGIBLE_ONLY.
"""
from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Any

OWNER_SOURCES = frozenset({"SYNTHETIC_ONLY"})
ALIAS_SOURCES = frozenset({
    "SYNTHETIC_N8N_COMMERCE_TENANTS",
    "SYNTHETIC_N8N_COMMERCE_CHANNELS",
    "SYNTHETIC_SUPABASE_R1_QA",
    "SYNTHETIC_N8N_G05_QA",
})
SENSITIVE_KEYS = frozenset({
    "jwt", "access_token", "refresh_token", "token", "password", "secret",
    "api_key", "provider_token", "credential", "credentials", "phone",
    "email", "customer", "recipient", "private_key", "cookie",
    "authorization", "session_id", "auth_user_id", "user_id",
    "secret_ref", "credential_ref", "oauth_code", "client_secret",
    "provider_secret", "auth_token", "session_token",
})


def _key_name(key: Any) -> str:
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", str(key)).lower().replace("-", "_")


def _has_sensitive_key(value: Any) -> bool:
    if isinstance(value, dict):
        for key, child in value.items():
            if _key_name(key) in SENSITIVE_KEYS or _has_sensitive_key(child):
                return True
    elif isinstance(value, list):
        return any(_has_sensitive_key(child) for child in value)
    return False


def _synthetic(value: Any, prefix: str) -> bool:
    return isinstance(value, str) and value.startswith(prefix) and len(value) > len(prefix)


def _time(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(timezone.utc)


def _base_result(reasons: set[str]) -> dict[str, Any]:
    return {
        "preflight": "BLOCKED" if reasons else "SYNTHETIC_REVIEW_ELIGIBLE_ONLY",
        "authority_granted": False,
        "store_membership_granted": False,
        "real_auth_uat_admitted": False,
        "real_ab_uat_admitted": False,
        "migration_admitted": False,
        "production_send_admitted": False,
        "reasons": sorted(reasons),
    }


def inspect_owner_decision(proposal: dict[str, Any]) -> dict[str, Any]:
    """Validate the *shape* of a synthetic S1/S2/S3 owner decision."""
    reasons: set[str] = set()
    if not isinstance(proposal, dict):
        return _base_result({"INVALID_INPUT"})
    if _has_sensitive_key(proposal):
        reasons.add("FORBIDDEN_PRIVATE_DATA_FIELD")
    if proposal.get("contract") != "TIEN404_V17_2C40D_OWNER_DECISION":
        reasons.add("UNKNOWN_OWNER_DECISION_CONTRACT")
    if proposal.get("scope") != "SYNTHETIC_ONLY":
        reasons.add("NON_SYNTHETIC_SCOPE")
    if proposal.get("authority_effect") != "NONE":
        reasons.add("AUTHORITY_EFFECT_MUST_BE_NONE")
    if proposal.get("real_authority_requested") is not False:
        reasons.add("REAL_AUTHORITY_PROHIBITED")
    if proposal.get("status") != "OWNER_DECISION_DRAFT":
        reasons.add("OWNER_DECISION_NOT_DRAFT")
    decision = proposal.get("decision")
    if decision not in ("S1", "S2", "S3"):
        reasons.add("INVALID_OWNER_SCENARIO")
    tenant = proposal.get("tenant_ref")
    if not _synthetic(tenant, "synthetic-tenant-"):
        reasons.add("INVALID_SYNTHETIC_TENANT")
    evaluated = _time(proposal.get("evaluated_at"))
    if evaluated is None:
        reasons.add("INVALID_EVALUATION_TIME")

    stores = proposal.get("store_refs")
    consents = proposal.get("owner_consents")
    if not isinstance(stores, list):
        reasons.add("INVALID_STORE_LIST")
        stores = []
    if not isinstance(consents, list):
        reasons.add("INVALID_OWNER_CONSENT_LIST")
        consents = []
    if any(not _synthetic(s, "synthetic-store-") for s in stores):
        reasons.add("NON_SYNTHETIC_STORE_REF")
    string_stores = [s for s in stores if isinstance(s, str)]
    if len(string_stores) != len(set(string_stores)):
        reasons.add("DUPLICATE_STORE_REF")
    # Discard malformed objects after recording the failure so adversarial
    # JSON cannot trigger an unhashable-type exception in later set logic.
    stores = string_stores

    if decision == "S3":
        reasons.add("OWNER_DECISION_UNRESOLVED")
        if stores or consents:
            reasons.add("S3_MUST_NOT_CARRY_STORE_GRANTS")
        return _base_result(reasons)

    if decision == "S1" and len(stores) != 1:
        reasons.add("S1_REQUIRES_EXACTLY_ONE_STORE")
    if decision == "S2" and len(stores) != 2:
        reasons.add("S2_REQUIRES_EXACTLY_TWO_STORES")
    if not consents:
        reasons.add("MISSING_PRIVATE_OWNER_CONSENT")

    owners_by_store: dict[str, set[str]] = {}
    owner_session_refs: set[str] = set()
    approval_pairs: set[tuple[str, str]] = set()
    for row in consents:
        if not isinstance(row, dict):
            reasons.add("INVALID_OWNER_CONSENT_RECORD")
            continue
        owner = row.get("owner_ref")
        store = row.get("store_ref")
        if not _synthetic(owner, "synthetic-owner-"):
            reasons.add("INVALID_SYNTHETIC_OWNER_REF")
            continue
        if not isinstance(store, str) or store not in stores:
            reasons.add("OWNER_STORE_SCOPE_MISMATCH")
            continue
        if row.get("tenant_ref") != tenant:
            reasons.add("OWNER_TENANT_SCOPE_MISMATCH")
        if row.get("decision_ref") != proposal.get("decision_ref"):
            reasons.add("OWNER_DECISION_REF_MISMATCH")
        if row.get("role") != "owner" or row.get("scope") != "STORE_BOUNDARY_DECISION":
            reasons.add("OWNER_ROLE_OR_SCOPE_NOT_EXPLICIT")
        if row.get("source") not in OWNER_SOURCES:
            reasons.add("UNTRUSTED_OWNER_EVIDENCE_SOURCE")
        required_true = (
            "explicit_owner_consent", "auth_session_verified_by_server",
            "challenge_confirmed", "challenge_consumed", "nonce_consumed",
            "independent_reviewer_verified", "signature_verified_by_trusted_server",
        )
        if not all(row.get(k) is True for k in required_true):
            reasons.add("INCOMPLETE_SIGNED_OWNER_PROVENANCE")
        reviewer = row.get("reviewer_ref")
        if not _synthetic(reviewer, "synthetic-reviewer-") or reviewer == owner:
            reasons.add("INVALID_OR_NONINDEPENDENT_REVIEWER")
        session_ref = row.get("auth_session_ref")
        if not _synthetic(session_ref, "synthetic-session-"):
            reasons.add("MISSING_VERIFIED_SESSION_REF")
        elif session_ref in owner_session_refs:
            reasons.add("OWNER_SESSION_REUSE")
        else:
            owner_session_refs.add(session_ref)
        if not _synthetic(row.get("membership_snapshot_ref"), "synthetic-membership-"):
            reasons.add("MISSING_MEMBERSHIP_SNAPSHOT_REF")
        if not _synthetic(row.get("challenge_ref"), "synthetic-challenge-"):
            reasons.add("MISSING_CHALLENGE_REF")
        if not _synthetic(row.get("signature_ref"), "synthetic-signature-"):
            reasons.add("MISSING_SIGNATURE_REF")
        if not _synthetic(row.get("signature_profile_ref"), "synthetic-signature-profile-"):
            reasons.add("MISSING_SIGNATURE_PROFILE_REF")
        digest = row.get("signed_payload_sha256")
        if not isinstance(digest, str) or not re.fullmatch(r"sha256:[0-9a-f]{64}", digest):
            reasons.add("INVALID_SIGNED_PAYLOAD_DIGEST")

        issued = _time(row.get("issued_at"))
        expires = _time(row.get("expires_at"))
        if evaluated is None or issued is None or expires is None or not (issued <= evaluated < expires):
            reasons.add("OWNER_EVIDENCE_NOT_CURRENT")
        if "revoked_at" not in row or row.get("revoked_at") is not None:
            reasons.add("OWNER_EVIDENCE_REVOKED_OR_REVOCATION_UNKNOWN")
        pair = (owner, store)
        if pair in approval_pairs:
            reasons.add("DUPLICATE_OWNER_STORE_APPROVAL")
        approval_pairs.add(pair)
        owners_by_store.setdefault(store, set()).add(owner)

    if stores and set(stores) != set(owners_by_store):
        reasons.add("STORE_WITHOUT_OWNER_DECISION_CONSENT")
    all_owners = set().union(*owners_by_store.values()) if owners_by_store else set()
    if decision == "S1":
        if len(all_owners) < 2:
            reasons.add("S1_REQUIRES_TWO_DISTINCT_COOWNERS")
        if len(owners_by_store.get(stores[0], set())) < 2 if stores else True:
            reasons.add("S1_COOWNER_CONSENT_INCOMPLETE")
    if decision == "S2":
        if len(all_owners) < 2:
            reasons.add("S2_REQUIRES_TWO_DISTINCT_OWNERS")
        if len(stores) == 2:
            a, b = owners_by_store.get(stores[0], set()), owners_by_store.get(stores[1], set())
            if not a or not b:
                reasons.add("S2_STORE_OWNER_CONSENT_INCOMPLETE")
            if a & b:
                reasons.add("S2_AB_TEST_REQUIRES_DISTINCT_OWNER_IDENTITIES")
    return _base_result(reasons)


def inspect_alias_crosswalk(proposal: dict[str, Any]) -> dict[str, Any]:
    """Check namespace-qualified synthetic mappings; never resolves real aliases."""
    reasons: set[str] = set()
    if not isinstance(proposal, dict):
        return _base_result({"INVALID_INPUT"})
    if _has_sensitive_key(proposal):
        reasons.add("FORBIDDEN_PRIVATE_DATA_FIELD")
    if proposal.get("contract") != "TIEN404_V17_2C40D_ALIAS_CROSSWALK":
        reasons.add("UNKNOWN_ALIAS_CROSSWALK_CONTRACT")
    if proposal.get("scope") != "SYNTHETIC_ONLY":
        reasons.add("NON_SYNTHETIC_SCOPE")
    if proposal.get("authority_effect") != "NONE":
        reasons.add("AUTHORITY_EFFECT_MUST_BE_NONE")
    if proposal.get("real_authority_requested") is not False:
        reasons.add("REAL_AUTHORITY_PROHIBITED")
    if proposal.get("status") != "CROSSWALK_DRAFT":
        reasons.add("CROSSWALK_NOT_DRAFT")
    decision = proposal.get("owner_decision")
    if decision not in ("S1", "S2"):
        reasons.add("OWNER_DECISION_NOT_ADMITTED")
    if decision == "S3":
        reasons.add("OWNER_DECISION_UNRESOLVED")
    tenant = proposal.get("tenant_ref")
    if not _synthetic(tenant, "synthetic-tenant-"):
        reasons.add("INVALID_SYNTHETIC_TENANT")
    evaluated = _time(proposal.get("evaluated_at"))
    if evaluated is None:
        reasons.add("INVALID_EVALUATION_TIME")
    rows = proposal.get("mappings")
    if not isinstance(rows, list) or not rows:
        reasons.add("MISSING_ALIAS_MAPPING_EVIDENCE")
        rows = []

    alias_targets: dict[tuple[str, str, str, str], tuple[str, str | None]] = {}
    installation_targets: dict[str, tuple[str, str]] = {}
    mapping_ids: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            reasons.add("INVALID_ALIAS_RECORD")
            continue
        source = row.get("source_system")
        namespace = row.get("namespace")
        kind = row.get("alias_kind")
        alias = row.get("alias_ref")
        tenant_target = row.get("tenant_ref")
        store_target = row.get("store_ref")
        mapping_id = row.get("mapping_ref")
        if not isinstance(source, str) or source not in ALIAS_SOURCES:
            reasons.add("UNRECOGNIZED_SOURCE_NAMESPACE")
        if not isinstance(namespace, str) or not namespace.startswith("synthetic:"):
            reasons.add("UNSCOPED_ALIAS_NAMESPACE")
        if kind not in ("tenant", "store", "installation"):
            reasons.add("INVALID_ALIAS_KIND")
        if not _synthetic(alias, "fixture-alias-"):
            reasons.add("UNVERIFIED_EXTERNAL_ALIAS")
        if not _synthetic(tenant_target, "synthetic-tenant-") or tenant_target != tenant:
            reasons.add("ALIAS_CANONICAL_TENANT_MISMATCH")
        if kind == "tenant" and store_target is not None:
            reasons.add("TENANT_ALIAS_MUST_NOT_INFER_STORE")
        if kind in ("store", "installation") and not _synthetic(store_target, "synthetic-store-"):
            reasons.add("STORE_ALIAS_WITHOUT_CANONICAL_STORE")
        if not _synthetic(mapping_id, "synthetic-mapping-"):
            reasons.add("MISSING_MAPPING_REVISION_REF")
        elif mapping_id in mapping_ids:
            reasons.add("DUPLICATE_MAPPING_REVISION_REF")
        else:
            mapping_ids.add(mapping_id)
        for field, prefix, reason in (
            ("source_revision_ref", "synthetic-source-revision-", "MISSING_SOURCE_REVISION_REF"),
            ("evidence_ref", "synthetic-evidence-", "MISSING_PRIVATE_EVIDENCE_REF"),
            ("owner_decision_ref", "synthetic-decision-", "MISSING_OWNER_DECISION_REF"),
            ("signature_ref", "synthetic-signature-", "MISSING_SIGNATURE_REF"),
            ("signature_profile_ref", "synthetic-signature-profile-", "MISSING_SIGNATURE_PROFILE_REF"),
            ("reviewer_ref", "synthetic-reviewer-", "MISSING_INDEPENDENT_REVIEWER_REF"),
        ):
            if not _synthetic(row.get(field), prefix):
                reasons.add(reason)
        digest = row.get("signed_payload_sha256")
        if not isinstance(digest, str) or not re.fullmatch(r"sha256:[0-9a-f]{64}", digest):
            reasons.add("INVALID_SIGNED_PAYLOAD_DIGEST")
        if not all(row.get(k) is True for k in (
            "source_provenance_verified_by_server",
            "signature_verified_by_trusted_server",
            "independent_reviewer_verified",
        )):
            reasons.add("UNVERIFIED_ALIAS_EVIDENCE")
        if row.get("source_status") != "ACTIVE":
            reasons.add("ALIAS_SOURCE_NOT_ACTIVE")
        if "revoked_at" not in row or row.get("revoked_at") is not None:
            reasons.add("ALIAS_REVOKED_OR_REVOCATION_UNKNOWN")
        valid_from = _time(row.get("valid_from"))
        expires = _time(row.get("expires_at"))
        if evaluated is None or valid_from is None or expires is None or not (valid_from <= evaluated < expires):
            reasons.add("ALIAS_EVIDENCE_NOT_CURRENT")
        if row.get("owner_decision_ref") != proposal.get("owner_decision_ref"):
            reasons.add("ALIAS_OWNER_DECISION_REF_MISMATCH")

        if isinstance(source, str) and isinstance(namespace, str) and isinstance(kind, str) and isinstance(alias, str):
            key = (source, namespace, kind, alias)
            target = (str(tenant_target), store_target if isinstance(store_target, str) else None)
            if key in alias_targets:
                if alias_targets[key] != target:
                    reasons.add("ALIAS_COLLISION_MULTIPLE_CANONICAL_TARGETS")
                else:
                    reasons.add("DUPLICATE_ACTIVE_ALIAS_MAPPING")
            alias_targets[key] = target

        installation = row.get("installation_ref")
        if kind == "installation":
            if not _synthetic(installation, "synthetic-installation-"):
                reasons.add("MISSING_PROVIDER_INSTALLATION_REF")
            else:
                target = (str(tenant_target), str(store_target))
                if installation in installation_targets and installation_targets[installation] != target:
                    reasons.add("INSTALLATION_COLLISION_MULTIPLE_STORES")
                installation_targets[installation] = target
                if not _synthetic(row.get("provider_proof_ref"), "synthetic-provider-proof-"):
                    reasons.add("MISSING_PROVIDER_INSTALLATION_PROOF")
        elif installation is not None and not _synthetic(installation, "synthetic-installation-"):
            reasons.add("INVALID_INSTALLATION_REF")

    return _base_result(reasons)
