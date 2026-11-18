"""P0T synthetic-only negative QA. No real JWTs, tenant IDs, accounts or network."""
import asyncio
import json
import sys
from pathlib import Path
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent))
from protected_auth_candidate import AdmissionDenied, ProtectedAuthCandidate
from fastapi_nohost_denial_router import build_nohost_denial_router, PRIVATE_CANDIDATE_PATH

NOW = 1_800_000_000
TENANT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
AUTH_ISSUER = "https://synthetic-auth.invalid/auth/v1"
ACCESS_ISSUER = "https://synthetic-access.invalid"
AUDIENCE = "tien404-private-qa"
PAIR = "private_pair_challenge_123"
OWNERS = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]
SESSIONS = ["11111111-1111-4111-8111-111111111111",
            "22222222-2222-4222-8222-222222222222"]
BEARERS = ["SYNTHETIC_TEST_NO_REAL_USER_BEARER_AAAA",
           "SYNTHETIC_TEST_NO_REAL_USER_BEARER_BBBB"]
ACCESS_ASSERTIONS = ["SYNTHETIC_TEST_ACCESS_PROOF_ALPHA_01",
                     "SYNTHETIC_TEST_ACCESS_PROOF_BRAVO_02"]
CONSENTS = ["qa_owner_alpha_consent_123",
            "qa_owner_bravo_consent_123"]


class FakeTrustedPorts:
    """Only synthetic dicts. Returning True is NOT real cryptographic verification."""

    def __init__(self):
        self.access = [
            {"signature_verified": True, "issuer": ACCESS_ISSUER,
             "audience": AUDIENCE, "expires_at": NOW + 300,
             "principal_id": "synthetic-access-principal-a"},
            {"signature_verified": True, "issuer": ACCESS_ISSUER,
             "audience": AUDIENCE, "expires_at": NOW + 300,
             "principal_id": "synthetic-access-principal-b"},
        ]
        self.binding = [{"active": True, "auth_user_id": u} for u in OWNERS]
        self.claims = [
            {"signature_verified": True, "iss": AUTH_ISSUER, "aud": "authenticated",
             "role": "authenticated", "sub": u, "session_id": SESSIONS[i],
             "iat": NOW - 20, "exp": NOW + 300, "is_anonymous": False}
            for i, u in enumerate(OWNERS)
        ]
        self.user = [{"verified": True, "disabled": False, "id": u} for u in OWNERS]
        self.session = [
            {"exists": True, "revoked": False, "id": SESSIONS[i],
             "user_id": u, "expires_at": NOW + 600}
            for i, u in enumerate(OWNERS)
        ]
        self.member = [
            {"active": True, "tenant_id": TENANT, "user_id": u, "role": "owner"}
            for u in OWNERS
        ]
        self.consent = [
            {"verified": True, "approved_by_owner": True, "used": False,
             "scope": "read_only_identity", "user_id": u,
             "pairing_handle": PAIR, "expires_at": NOW + 200}
            for u in OWNERS
        ]
        self.fail_port = None

    def _maybe_fail(self, port):
        if port == self.fail_port:
            raise RuntimeError("PRIVATE_SYNTHETIC_PROVIDER_ERROR_SHOULD_NOT_LEAK")

    async def verify_protected_access(self, token):
        self._maybe_fail("access")
        return self.access[ACCESS_ASSERTIONS.index(token)] if token in ACCESS_ASSERTIONS else None

    async def lookup_access_subject_binding(self, principal):
        self._maybe_fail("binding")
        idx = next((i for i, a in enumerate(self.access) if a["principal_id"] == principal), -1)
        return self.binding[idx] if idx >= 0 else None

    async def verify_signed_auth_claims(self, token):
        self._maybe_fail("claims")
        return self.claims[BEARERS.index(token)] if token in BEARERS else None

    async def fetch_live_auth_user(self, token):
        self._maybe_fail("user")
        return self.user[BEARERS.index(token)] if token in BEARERS else None

    async def lookup_current_auth_session(self, sid, verified_subject_id):
        self._maybe_fail("session")
        return next((s for s in self.session if s["id"] == sid and s["user_id"] == verified_subject_id), None)

    async def lookup_current_owner_membership(self, tenant, user):
        self._maybe_fail("membership")
        return next((m for m in self.member if m["tenant_id"] == tenant and m["user_id"] == user), None)

    async def lookup_independent_owner_consent(self, handle, user, pairing):
        self._maybe_fail("consent")
        idx = CONSENTS.index(handle) if handle in CONSENTS else -1
        if idx == -1:
            return None
        c = self.consent[idx]
        return c if c["user_id"] == user and c["pairing_handle"] == pairing else None


def fresh(ports=None, clock=lambda: NOW):
    ports = ports or FakeTrustedPorts()
    return ProtectedAuthCandidate(
        ports, auth_issuer=AUTH_ISSUER, access_issuer=ACCESS_ISSUER,
        access_audience=AUDIENCE, tenant_scope=TENANT, clock=clock
    )


def args(i):
    return dict(bearer=BEARERS[i], access_assertion=ACCESS_ASSERTIONS[i],
                consent_handle=CONSENTS[i], pairing_handle=PAIR)


def admit(candidate, i=0):
    return asyncio.run(candidate.admit_actor(**args(i)))


def denies(candidate, code, actor=0):
    with pytest.raises(AdmissionDenied) as exc:
        admit(candidate, actor)
    assert exc.value.code == code
    assert str(exc.value) == code


def pair(candidate):
    async def run():
        a = await candidate.admit_actor(**args(0))
        b = await candidate.admit_actor(**args(1))
        return await candidate.correlate_pair(a, b)
    return asyncio.run(run())


def test_synthetic_pair_only_returns_no_authority_candidate():
    output = pair(fresh())
    assert output["status"] == "IN_MEMORY_PAIR_CORRELATION_CANDIDATE"
    assert all(value is False for k, value in output.items() if k != "status" and k != "synthetic_or_unverified_ports")
    assert output["synthetic_or_unverified_ports"] is True
    for sensitive in [*OWNERS, *SESSIONS, *BEARERS, *ACCESS_ASSERTIONS]:
        assert sensitive not in json.dumps(output)


def test_opaque_actor_handle_does_not_export_user_or_session():
    h = admit(fresh())
    assert not hasattr(h, "__dict__")
    for key in ("user_id", "session_id", "jwt", "bearer"):
        assert not hasattr(h, key)


@pytest.mark.parametrize("changed,code", [
 ("signature_verified", "PRIVATE_ACCESS_DENIED"),
 ("issuer", "PRIVATE_ACCESS_DENIED"),
 ("audience", "PRIVATE_ACCESS_DENIED"),
 ("expires_at", "PRIVATE_ACCESS_DENIED"),
 ("principal_id", "PRIVATE_ACCESS_DENIED"),
])
def test_access_admission_fail_closed(changed, code):
    ports = FakeTrustedPorts()
    ports.access[0][changed] = {
        "signature_verified": False,
        "issuer": "https://other.invalid",
        "audience": "wrong-audience",
        "expires_at": NOW - 1,
        "principal_id": ""
    }[changed]
    denies(fresh(ports), code)


@pytest.mark.parametrize("changed,value", [
 ("active", False),
 ("auth_user_id", OWNERS[1]),
])
def test_access_owner_binding_fail_closed(changed, value):
    ports = FakeTrustedPorts()
    ports.binding[0][changed] = value
    expected = "ACCESS_OWNER_BINDING_DENIED" if changed == "active" else "SIGNED_CLAIMS_DENIED"
    denies(fresh(ports), expected)


@pytest.mark.parametrize("key,value", [
 ("signature_verified", False),
 ("iss", "https://fake.invalid/auth/v1"),
 ("aud", "unexpected"),
 ("role", "anon"),
 ("sub", OWNERS[1]),
 ("session_id", "BAD"),
 ("iat", NOW + 999),
 ("iat", None),
 ("exp", NOW - 10),
 ("exp", True),
 ("is_anonymous", True),
 ("is_anonymous", None),
])
def test_untrusted_claims_fail_closed(key, value):
    ports = FakeTrustedPorts()
    ports.claims[0][key] = value
    denies(fresh(ports), "SIGNED_CLAIMS_DENIED")


@pytest.mark.parametrize("key,value", [
 ("verified", False),
 ("disabled", True),
 ("id", OWNERS[1]),
])
def test_live_user_fail_closed(key, value):
    ports = FakeTrustedPorts()
    ports.user[0][key] = value
    denies(fresh(ports), "LIVE_AUTH_USER_DENIED")


@pytest.mark.parametrize("key,value", [
 ("exists", False),
 ("revoked", True),
 ("id", SESSIONS[1]),
 ("user_id", OWNERS[1]),
 ("expires_at", NOW - 1),
])
def test_stale_or_spoofed_session_fail_closed(key, value):
    ports = FakeTrustedPorts()
    ports.session[0][key] = value
    denies(fresh(ports), "SESSION_REVOKED_OR_MISMATCHED")


@pytest.mark.parametrize("key,value", [
 ("active", False),
 ("role", "manager"),
 ("tenant_id", OWNERS[1]),
 ("user_id", OWNERS[1]),
])
def test_tenant_owner_fail_closed(key, value):
    ports = FakeTrustedPorts()
    ports.member[0][key] = value
    denies(fresh(ports), "TENANT_OWNER_DENIED")


@pytest.mark.parametrize("key,value", [
 ("verified", False),
 ("approved_by_owner", False),
 ("used", True),
 ("scope", "store_read"),
 ("expires_at", NOW - 1),
 ("pairing_handle", "unexpected_pairing_123"),
 ("user_id", OWNERS[1]),
])
def test_independent_consent_fail_closed(key, value):
    ports = FakeTrustedPorts()
    ports.consent[0][key] = value
    denies(fresh(ports), "OWNER_CONSENT_DENIED")


@pytest.mark.parametrize("port", ["access", "binding", "claims", "user", "session", "membership", "consent"])
def test_trusted_ports_error_redacted_and_fail_closed(port):
    ports = FakeTrustedPorts()
    ports.fail_port = port
    denies(fresh(ports), "TRUSTED_PORT_UNAVAILABLE")


def test_access_actor_a_cannot_reuse_owner_b_bearer():
    candidate = fresh()
    req = args(0)
    req["bearer"] = BEARERS[1]
    with pytest.raises(AdmissionDenied) as exc:
        asyncio.run(candidate.admit_actor(**req))
    assert exc.value.code == "SIGNED_CLAIMS_DENIED"


def test_invalid_inputs_fail_before_port_use():
    v = fresh()
    for invalid in [
        {**args(0), "bearer": ""},
        {**args(0), "access_assertion": ""},
        {**args(0), "consent_handle": "x"},
        {**args(0), "pairing_handle": ""},
    ]:
        with pytest.raises(AdmissionDenied) as exc:
            asyncio.run(v.admit_actor(**invalid))
        assert exc.value.code == "INPUT_NOT_ADMISSIBLE"


def test_missing_trusted_port_rejected():
    with pytest.raises(AdmissionDenied, match="VERIFIER_NOT_CONFIGURED"):
        fresh(ports=object())


def test_wrong_tenant_scope_rejected():
    with pytest.raises(AdmissionDenied, match="VERIFIER_NOT_CONFIGURED"):
        ProtectedAuthCandidate(FakeTrustedPorts(), auth_issuer=AUTH_ISSUER,
                               access_issuer=ACCESS_ISSUER, access_audience=AUDIENCE,
                               tenant_scope="caller-selected-tenant")


def test_clock_failure_blocks_admission():
    with pytest.raises(AdmissionDenied, match="TRUSTED_CLOCK_UNAVAILABLE"):
        admit(fresh(clock=lambda: True))


@pytest.mark.parametrize("failure,reason", [
    ("revoked_session", "PAIR_SESSION_REVOKED"),
    ("lost_owner", "PAIR_OWNER_REVOKED"),
    ("revoked_consent", "PAIR_CONSENT_REVOKED"),
])
def test_pair_correlation_rechecks_current_permissions(failure, reason):
    async def run():
        ports = FakeTrustedPorts()
        v = fresh(ports)
        a = await v.admit_actor(**args(0))
        b = await v.admit_actor(**args(1))
        if failure == "revoked_session":
            ports.session[1]["revoked"] = True
        elif failure == "lost_owner":
            ports.member[1]["active"] = False
        else:
            ports.consent[1]["used"] = True
        with pytest.raises(AdmissionDenied) as exc:
            await v.correlate_pair(a, b)
        assert exc.value.code == reason
    asyncio.run(run())


def test_pair_correlation_rejects_same_actor():
    async def run():
        v = fresh()
        a = await v.admit_actor(**args(0))
        b = await v.admit_actor(**args(0))
        with pytest.raises(AdmissionDenied) as exc:
            await v.correlate_pair(a, b)
        assert exc.value.code == "PAIR_NOT_INDEPENDENT"
    asyncio.run(run())


def test_pair_correlation_rejects_untrusted_handle():
    async def run():
        v = fresh()
        a = await v.admit_actor(**args(0))
        with pytest.raises(AdmissionDenied) as exc:
            await v.correlate_pair(a, object())
        assert exc.value.code == "PAIR_EVIDENCE_UNTRUSTED"
    asyncio.run(run())


def test_pair_expired_evidence_fails_closed():
    async def run():
        current = [NOW]
        v = fresh(clock=lambda: current[0])
        a = await v.admit_actor(**args(0))
        b = await v.admit_actor(**args(1))
        current[0] = NOW + 500
        with pytest.raises(AdmissionDenied) as exc:
            await v.correlate_pair(a, b)
        assert exc.value.code == "PAIR_EVIDENCE_EXPIRED"
    asyncio.run(run())


def test_local_replay_rejected_after_candidate_and_no_receipt_issued():
    async def run():
        v = fresh()
        a = await v.admit_actor(**args(0))
        b = await v.admit_actor(**args(1))
        result = await v.correlate_pair(a, b)
        assert result["signed_receipt_issued"] is False
        with pytest.raises(AdmissionDenied) as exc:
            await v.correlate_pair(a, b)
        assert exc.value.code == "PAIR_EVIDENCE_UNTRUSTED"
    asyncio.run(run())


def test_in_process_race_does_not_authorize_two_replays():
    async def run():
        v = fresh()
        a = await v.admit_actor(**args(0))
        b = await v.admit_actor(**args(1))
        results = await asyncio.gather(
            v.correlate_pair(a, b), v.correlate_pair(a, b), return_exceptions=True
        )
        assert sum(isinstance(v, dict) for v in results) == 1
        assert sum(isinstance(v, AdmissionDenied) for v in results) == 1
    asyncio.run(run())


def test_fastapi_candidate_router_is_never_a_real_auth_endpoint():
    app = FastAPI(openapi_url=None, docs_url=None, redoc_url=None)
    app.include_router(build_nohost_denial_router())
    with TestClient(app) as client:
        for headers in [
            {},
            {"Authorization": BEARERS[0]},
            {"CF-Access-Jwt-Assertion": ACCESS_ASSERTIONS[0]},
            {"Authorization": BEARERS[0], "CF-Access-Jwt-Assertion": ACCESS_ASSERTIONS[0]},
        ]:
            response = client.post(
                PRIVATE_CANDIDATE_PATH,
                headers=headers, json={"consent_handle": CONSENTS[0]}
            )
            assert response.status_code == 404
            assert response.json() == {"detail": "NOT_FOUND"}
            assert response.headers.get("location") is None


def test_fastapi_candidate_router_does_not_appear_in_schema():
    app = FastAPI()
    app.include_router(build_nohost_denial_router())
    assert PRIVATE_CANDIDATE_PATH not in app.openapi()["paths"]
