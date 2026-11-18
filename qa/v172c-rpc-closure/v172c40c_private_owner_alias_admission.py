"""V17.2C.40C — synthetic-only private authority admission preflight.

This is NOT an actual identity verifier, permission grant, JWT validator or
production resolver. It only checks the shape/consistency of disposable
synthetic proposals before a human-controlled private review. It never
returns APPROVED or grants access, even when all fixtures are consistent.
"""
from __future__ import annotations

from collections import defaultdict
import re
from typing import Any

SAFE_SOURCES = frozenset({
    "SYNTHETIC_N8N_COMMERCE_TENANTS",
    "SYNTHETIC_N8N_COMMERCE_CHANNELS",
    "SYNTHETIC_SUPABASE_R1_QA",
})
SENSITIVE_KEYS = frozenset({
    "jwt", "access_token", "refresh_token", "token", "password",
    "secret", "api_key", "provider_token", "credential", "credentials",
    "phone", "email", "customer", "recipient", "private_key",
    "cookie", "authorization", "session_id", "auth_user_id",
    "secret_ref", "credential_ref", "oauth_code", "client_secret",
    "provider_secret", "auth_token", "session_token",
})


def _sensitive_keys_found(value: Any) -> bool:
    if isinstance(value, dict):
        for key, child in value.items():
            normalized = re.sub(r"([a-z0-9])([A-Z])", r"\\1_\\2", str(key)).lower().replace("-", "_")
            if normalized in SENSITIVE_KEYS or _sensitive_keys_found(child):
                return True
    if isinstance(value, list):
        return any(_sensitive_keys_found(child) for child in value)
    return False


def inspect_synthetic_proposal(proposal: dict[str, Any]) -> dict[str, Any]:
    """Fail closed; no I/O, no identity resolution, no external API calls."""
    reasons: set[str] = set()
    if not isinstance(proposal, dict):
        return {
            "preflight": "BLOCKED", "authority_granted": False,
            "real_ab_uat_admitted": False, "reasons": ["INVALID_INPUT"]
        }

    if _sensitive_keys_found(proposal):
        reasons.add("FORBIDDEN_PRIVATE_DATA_FIELD")
    if proposal.get("scope") != "SYNTHETIC_ONLY":
        reasons.add("NON_SYNTHETIC_SCOPE")
    if proposal.get("real_authority_requested") is True:
        reasons.add("REAL_AUTHORITY_PROHIBITED")
    if proposal.get("authority_granted") is True:
        reasons.add("INJECTED_AUTHORITY_PROHIBITED")

    decision = proposal.get("owner_scenario")
    if decision not in ("S1", "S2"):
        reasons.add("OWNER_DECISION_NOT_CONFIRMED")
    stores = proposal.get("store_refs", [])
    if (
        not isinstance(stores, list) or not stores
        or not all(isinstance(s, str) and s.startswith("synthetic-store-") for s in stores)
        or len(stores) != len(set(stores))
    ):
        reasons.add("INVALID_SYNTHETIC_STORE_SET")
        stores = []
    if decision == "S1" and len(stores) != 1:
        reasons.add("COOWNER_ONE_STORE_REQUIRED")
    if decision == "S2" and len(stores) < 2:
        reasons.add("TWO_DISTINCT_STORES_REQUIRED")
    tenant = proposal.get("tenant_ref")
    if not isinstance(tenant, str) or not tenant.startswith("synthetic-tenant-"):
        reasons.add("INVALID_SYNTHETIC_TENANT")

    approvals = proposal.get("owner_consents", [])
    if not isinstance(approvals, list) or not approvals:
        reasons.add("MISSING_PRIVATE_OWNER_CONSENT")
        approvals = []
    grant_keys: set[tuple[str, str]] = set()
    covered_stores: set[str] = set()
    owner_by_store: dict[str, set[str]] = defaultdict(set)
    for row in approvals:
        if not isinstance(row, dict):
            reasons.add("INVALID_OWNER_CONSENT_RECORD")
            continue
        ref, store = row.get("owner_ref"), row.get("store_ref")
        if not isinstance(ref, str) or not ref.startswith("synthetic-owner-"):
            reasons.add("OWNER_NOT_SYNTHETIC_OR_UNKNOWN")
            continue
        if not isinstance(store, str) or store not in stores:
            reasons.add("OWNER_STORE_SCOPE_MISMATCH")
            continue
        if (ref, store) in grant_keys:
            reasons.add("DUPLICATE_OWNER_CONSENT")
        grant_keys.add((ref, store))
        owner_by_store[store].add(ref)
        if row.get("tenant_ref") != tenant:
            reasons.add("OWNER_TENANT_SCOPE_MISMATCH")
        if not all(row.get(k) is True for k in (
            "explicit_owner_consent", "challenge_confirmed",
            "challenge_consumed", "current_session_attested",
            "independent_reviewer_attested",
        )):
            reasons.add("INCOMPLETE_OWNER_PROVENANCE")
        if row.get("revoked") is True or row.get("expired") is True:
            reasons.add("REVOKED_OR_EXPIRED_OWNER_EVIDENCE")
        if row.get("source") != "SYNTHETIC_ONLY":
            reasons.add("UNTRUSTED_OWNER_EVIDENCE_SOURCE")
        covered_stores.add(store)
    if stores and set(stores) != covered_stores:
        reasons.add("STORE_WITHOUT_OWNER_CONSENT")
    if decision == "S2" and len(stores) >= 2:
        # This specific A/B preflight requires two distinct owners for two
        # distinct stores; a single tenant owner is not automatically both.
        candidates = [owner_by_store.get(s, set()) for s in stores[:2]]
        if not candidates[0] or not candidates[1] or not (
            any(a != b for a in candidates[0] for b in candidates[1])
        ):
            reasons.add("INDEPENDENT_AB_OWNERS_NOT_PROVEN")

    aliases = proposal.get("alias_mappings", [])
    if not isinstance(aliases, list) or not aliases:
        reasons.add("MISSING_ALIAS_PROVENANCE")
        aliases = []
    alias_to_target: dict[tuple[str, str, str], tuple[str, str]] = {}
    installation_to_store: dict[str, tuple[str, str]] = {}
    seen_mapping: set[tuple[str, str, str, str, str]] = set()
    mapped_stores: set[str] = set()
    for mapping in aliases:
        if not isinstance(mapping, dict):
            reasons.add("INVALID_ALIAS_RECORD")
            continue
        source, namespace = mapping.get("source"), mapping.get("namespace")
        alias = mapping.get("external_alias")
        store = mapping.get("store_ref")
        inst = mapping.get("installation_ref")
        if not isinstance(source, str) or source not in SAFE_SOURCES:
            reasons.add("UNRECOGNIZED_SOURCE_NAMESPACE")
        if not isinstance(namespace, str) or not namespace.startswith("synthetic:"):
            reasons.add("UNSCOPED_ALIAS_NAMESPACE")
        if not isinstance(alias, str) or not alias.startswith("fixture-"):
            reasons.add("UNVERIFIED_EXTERNAL_ALIAS")
        if not isinstance(inst, str) or not inst.startswith("fixture-install-"):
            reasons.add("UNVERIFIED_INSTALLATION_REF")
        if mapping.get("tenant_ref") != tenant or store not in stores:
            reasons.add("ALIAS_CANONICAL_SCOPE_MISMATCH")
        if not all(mapping.get(k) is True for k in (
            "origin_provenance_attested", "private_reviewer_attested",
            "source_binding_attested", "current_provider_proof_attested",
        )):
            reasons.add("UNVERIFIED_ALIAS_EVIDENCE")
        if mapping.get("revoked") is True or mapping.get("expired") is True:
            reasons.add("REVOKED_OR_EXPIRED_ALIAS")
        if not isinstance(namespace, str) or not isinstance(alias, str) or not isinstance(inst, str):
            continue
        alias_key = (str(source), namespace, alias)
        target = (str(mapping.get("tenant_ref")), str(store))
        if alias_key in alias_to_target and alias_to_target[alias_key] != target:
            reasons.add("ALIAS_COLLISION_MULTIPLE_STORES")
        alias_to_target[alias_key] = target
        # Installation is globally scoped: never accept two Store claims
        # because a message-supplied Store would be unsafe.
        if inst in installation_to_store and installation_to_store[inst] != target:
            reasons.add("INSTALLATION_COLLISION_MULTIPLE_STORES")
        installation_to_store[inst] = target
        mapping_key = alias_key + target
        if mapping_key in seen_mapping:
            reasons.add("DUPLICATE_ALIAS_EVIDENCE")
        seen_mapping.add(mapping_key)
        mapped_stores.add(str(store))
    if stores and set(stores) != mapped_stores:
        reasons.add("STORE_WITHOUT_ALIAS_EVIDENCE")

    # This assessment is advisory even for fully formed synthetic fixtures.
    # No branch ever returns GRANTED/APPROVED or admits real UAT.
    return {
        "preflight": "BLOCKED" if reasons else "SYNTHETIC_REVIEW_ELIGIBLE_ONLY",
        "authority_granted": False,
        "real_ab_uat_admitted": False,
        "migration_admitted": False,
        "production_send_admitted": False,
        "reasons": sorted(reasons),
    }
