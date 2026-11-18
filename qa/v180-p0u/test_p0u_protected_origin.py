"""P0U real CRYPTOGRAPHIC signatures over entirely SYNTHETIC actors/keys.

NO real Supabase/Cloudflare account, network, credentials, session, user or order.
Pytest only imports isolated QA modules, never deployed ops/data-platform.
"""
from __future__ import annotations
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from uuid import UUID
from copy import deepcopy
import asyncio

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parents[1] / "v180-p0t"))
from pinned_jwks_verifier import (
    verify_cloudflare_access_jwt, verify_supabase_owner_jwt, SignatureDenied,
)
from server_session_snapshot import assess_current_session_snapshot, CurrentSessionDenied
from nohost_origin_gate import build_isolated_nohost_app, PATH
from protected_auth_candidate import ProtectedAuthCandidate, AdmissionDenied

NOW = 1_800_000_000
CF_ISS = "https://synthetic-qa.cloudflareaccess.com"
CF_AUD = "t404-private-qa-aud"
SB_ISS = "https://synthetic-sb-project.supabase.co/auth/v1"
A, B = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
SA, SB = "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"
TENANT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
PAIR = "synthetic_pair_qa_12345678"
CONSENTS = ["owner_a_consent_12345678", "owner_b_consent_12345678"]


@pytest.fixture(scope="module")
def keys():
    cf = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    fake = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    sb = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    ec_key = ec.generate_private_key(ec.SECP256R1())
    cf_jwk = jwt.algorithms.RSAAlgorithm.to_jwk(cf.public_key(), as_dict=True)
    cf_jwk.update(kid="cf-k1", use="sig", alg="RS256")
    fake_jwk = jwt.algorithms.RSAAlgorithm.to_jwk(fake.public_key(), as_dict=True)
    fake_jwk.update(kid="cf-k1", use="sig", alg="RS256")
    sb_jwk = jwt.algorithms.RSAAlgorithm.to_jwk(sb.public_key(), as_dict=True)
    sb_jwk.update(kid="sb-rsa", use="sig", alg="RS256")
    ec_jwk = jwt.algorithms.ECAlgorithm.to_jwk(ec_key.public_key(), as_dict=True)
    ec_jwk.update(kid="sb-ec", use="sig", alg="ES256")
    return dict(cf=cf, sb=sb, ec=ec_key, fake=fake, cf_keys={"keys": [cf_jwk]},
                fake_keys={"keys": [fake_jwk]}, sb_keys={"keys": [sb_jwk, ec_jwk]})


def cf_payload(actor="access-qa-actor-a", **overrides):
    return dict(iss=CF_ISS, aud=[CF_AUD], sub=actor, iat=NOW - 10,
                nbf=NOW - 10, exp=NOW + 120, **overrides)


def sb_payload(actor=A, session=SA, **overrides):
    return dict(iss=SB_ISS, aud="authenticated", sub=actor,
                session_id=session, iat=NOW - 10, nbf=NOW - 10,
                exp=NOW + 120, role="authenticated", is_anonymous=False,
                **overrides)


def sign_cf(keys, payload=None, *, signer=None, kid="cf-k1", alg="RS256"):
    return jwt.encode(payload or cf_payload(), signer or keys["cf"], algorithm=alg,
                      headers={"kid": kid})


def sign_sb(keys, payload=None, *, alg="RS256", kid=None):
    return jwt.encode(payload or sb_payload(),
                      keys["ec"] if alg == "ES256" else keys["sb"],
                      algorithm=alg, headers={"kid": kid or ("sb-ec" if alg == "ES256" else "sb-rsa")})


def cf_check(keys, token, jwks=None, aud=CF_AUD, issuer=CF_ISS, now=NOW):
    return verify_cloudflare_access_jwt(token, pinned_keys=jwks or keys["cf_keys"],
                                        team_issuer=issuer, app_audience=aud, now=now)


def sb_check(keys, token, jwks=None, issuer=SB_ISS, now=NOW):
    return verify_supabase_owner_jwt(token, pinned_keys=jwks or keys["sb_keys"],
                                     supabase_issuer=issuer, now=now)


def deny(fn):
    with pytest.raises(SignatureDenied):
        fn()


def test_real_rsa_signature_access_roundtrip_with_only_synthetic_key(keys):
    result = cf_check(keys, sign_cf(keys))
    assert result["signature_verified"] is True
    assert result["issuer"] == CF_ISS
    assert result["audience"] == CF_AUD


def test_real_rsa_signature_supabase_roundtrip_with_only_synthetic_key(keys):
    output = sb_check(keys, sign_sb(keys))
    assert output["signature_verified"] is True and output["session_id"] == SA


def test_real_ec_p256_supabase_signature_roundtrip(keys):
    output = sb_check(keys, sign_sb(keys, alg="ES256"))
    assert output["signature_verified"] is True and output["sub"] == A


@pytest.mark.parametrize("edit", [
    {"iss": "https://fake.cloudflareaccess.com"},
    {"aud": ["wrong-application"]},
    {"exp": NOW - 1},
    {"nbf": NOW + 70},
    {"iat": NOW + 70},
    {"exp": NOW + 9999},
    {"sub": ""},
    {"sub": "a"},
])
def test_invalid_cf_claims_denied(keys, edit):
    data = cf_payload()
    data.update(edit)
    deny(lambda: cf_check(keys, sign_cf(keys, data)))


@pytest.mark.parametrize("edit", [
    {"iss": "https://fake.supabase.co/auth/v1"},
    {"aud": "anon"},
    {"exp": NOW - 1},
    {"nbf": NOW + 70},
    {"iat": NOW + 70},
    {"exp": NOW + 3601},
    {"role": "anon"},
    {"session_id": "bad-id"},
    {"sub": "bad-id"},
    {"is_anonymous": True},
    {"is_anonymous": None},
])
def test_invalid_supabase_claims_denied(keys, edit):
    data = sb_payload()
    data.update(edit)
    deny(lambda: sb_check(keys, sign_sb(keys, data)))


def test_forged_cf_signature_denied_even_if_kid_matches(keys):
    token = sign_cf(keys, signer=keys["fake"])
    deny(lambda: cf_check(keys, token))


def test_untrusted_cf_jwks_fails_on_legitimate_token(keys):
    deny(lambda: cf_check(keys, sign_cf(keys), jwks=keys["fake_keys"]))


def test_unknown_or_duplicate_kid_is_denied(keys):
    deny(lambda: cf_check(keys, sign_cf(keys, kid="unknown")))
    both = {"keys": keys["cf_keys"]["keys"] * 2}
    deny(lambda: cf_check(keys, sign_cf(keys), jwks=both))


def test_algorithm_confusion_hs256_is_denied(keys):
    token = jwt.encode(cf_payload(), "UNTRUSTED_SYNTHETIC_KEY", algorithm="HS256",
                       headers={"kid": "cf-k1"})
    deny(lambda: cf_check(keys, token))


def test_no_unsigned_jwt_accepted(keys):
    token = jwt.encode(cf_payload(), key=None, algorithm="none", headers={"kid": "cf-k1"})
    deny(lambda: cf_check(keys, token))


def test_missing_required_claims_are_denied(keys):
    for claim in ("exp", "iat", "nbf", "session_id", "role"):
        payload = sb_payload()
        del payload[claim]
        deny(lambda p=payload: sb_check(keys, sign_sb(keys, p)))


def test_supabase_invalid_jwks_or_es256_key_confusion_denied(keys):
    token = sign_sb(keys, alg="ES256")
    wrong_keys = {"keys": [dict(keys["sb_keys"]["keys"][1], crv="P-384")]}
    deny(lambda: sb_check(keys, token, jwks=wrong_keys))
    deny(lambda: sb_check(keys, token, jwks={"keys": []}))


def test_cf_oversized_or_unconfigured_params_denied(keys):
    token = sign_cf(keys)
    deny(lambda: cf_check(keys, token + "a" * 9000))
    deny(lambda: cf_check(keys, token, issuer="http://unsafe.example"))
    deny(lambda: cf_check(keys, token, aud=""))


def snapshot_rows(*, uid=A, sid=SA, expires_at=None):
    return [{"id": sid, "user_id": uid, "not_after": expires_at}]


def check_session(rows, uid=A, sid=SA, now=NOW):
    return assess_current_session_snapshot(
        rows=rows, verified_subject_id=uid, requested_session_id=sid,
        now_utc=datetime.fromtimestamp(now, timezone.utc)
    )


def test_trusted_session_row_pair_snapshot_minimal_evidence():
    result = check_session(snapshot_rows(expires_at=datetime.fromtimestamp(NOW + 100, timezone.utc)))
    assert result["exists"] and result["revoked"] is False
    assert result["signature_or_bearer_possession_verified"] is False
    assert result["store_authority_verified"] is False


@pytest.mark.parametrize("rows", [None, [], [{}, {}], [{}],
 {"id": SA, "user_id": A}, [{"id": SA, "user_id": B, "not_after": None}],
 [{"id": SB, "user_id": A, "not_after": None}],
 [{"id": SA, "user_id": A, "not_after": datetime.fromtimestamp(NOW - 1,timezone.utc)}],
 [{"id": SA, "user_id": A, "not_after": datetime(2027,1,1)}]])
def test_missing_wrong_stale_or_untrusted_session_rows_denied(rows):
    with pytest.raises(CurrentSessionDenied):
        check_session(rows)


def test_null_not_after_is_accepted_for_still_existing_session_only():
    s = check_session(snapshot_rows())
    assert s["exists"] is True and s["expires_at"] is None


def test_snapshot_bad_user_and_session_identifiers_fail_closed():
    for uid, sid in [("spoofed", SA), (A, "spoofed")]:
        with pytest.raises(CurrentSessionDenied):
            check_session(snapshot_rows(), uid=uid, sid=sid)


def test_origin_gateway_missing_or_spoofed_access_denied_for_any_host(keys):
    app = build_isolated_nohost_app(pinned_access_keys=keys["cf_keys"],
                                    access_issuer=CF_ISS, access_audience=CF_AUD,
                                    clock=lambda: NOW)
    with TestClient(app) as client:
        for host in ("tien404-data-staging.onrender.com",
                     "private-qa.example.invalid"):
            for h in ({}, {"Cf-Access-Jwt-Assertion": "CLIENT_SAYS_VERIFIED"}):
                r = client.post(PATH,headers={**h,"Host":host,"Origin":"https://approved.example.invalid"},
                                json={"token":"UNTRUSTED_IGNORE"})
                assert r.status_code == 403 and r.json() == {"detail": "ACCESS_DENIED"}
                assert r.headers.get("cache-control") == "no-store"


def test_origin_gateway_valid_signed_access_still_does_not_enable_auth(keys):
    app = build_isolated_nohost_app(pinned_access_keys=keys["cf_keys"],
                                    access_issuer=CF_ISS, access_audience=CF_AUD,
                                    clock=lambda: NOW)
    with TestClient(app) as client:
        r = client.post(PATH, headers={"Cf-Access-Jwt-Assertion": sign_cf(keys),
            "Host":"tien404-data-staging.onrender.com",
            "Authorization": "Bearer SYNTHETIC_NOT_CONSUMED"},json={"owner":"ignored"})
        assert r.status_code == 503
        assert r.json() == {"detail": "PRIVATE_VERIFIER_NOT_DEPLOYED"}
        assert "authorization" not in str(r.json()).lower()


class SignedSyntheticPorts:
    """Real RSA signature checks with entirely synthetic trust, data, and sessions."""

    def __init__(self, keys):
        self.keys = keys
        self.revoked_b = False
        self.consent_b = True

    async def verify_protected_access(self, assertion):
        return cf_check(self.keys, assertion)

    async def lookup_access_subject_binding(self, principal):
        user = {"access-qa-actor-a": A, "access-qa-actor-b": B}.get(principal)
        return {"active": user is not None, "auth_user_id": user}

    async def verify_signed_auth_claims(self, bearer):
        return sb_check(self.keys, bearer)

    async def fetch_live_auth_user(self, bearer):
        sub = sb_check(self.keys, bearer)["sub"]
        return {"verified": True, "disabled": False, "id": sub}

    async def lookup_current_auth_session(self, session_id):
        sub = {SA: A, SB: B}.get(session_id)
        if sub is None or (session_id == SB and self.revoked_b):
            return {}
        return check_session(snapshot_rows(uid=sub,sid=session_id),uid=sub,sid=session_id)

    async def lookup_current_owner_membership(self, tenant_id, user_id):
        return {"active": True, "tenant_id":tenant_id, "user_id":user_id, "role":"owner"}

    async def lookup_independent_owner_consent(self, handle, user_id, pair):
        index = CONSENTS.index(handle) if handle in CONSENTS else -1
        return {"verified": True, "approved_by_owner": self.consent_b if index==1 else True,
                "used": False, "scope": "read_only_identity", "user_id":user_id,
                "pairing_handle":pair, "expires_at":NOW+100} if index != -1 else {}


def make_candidate(ports):
    return ProtectedAuthCandidate(ports,auth_issuer=SB_ISS,access_issuer=CF_ISS,
        access_audience=CF_AUD,tenant_scope=TENANT,clock=lambda:NOW)


def real_signed_actor_args(keys,idx):
    return dict(bearer=sign_sb(keys,sb_payload(actor=(A,B)[idx],session=(SA,SB)[idx])),
                access_assertion=sign_cf(keys,cf_payload(actor=("access-qa-actor-a","access-qa-actor-b")[idx])),
                pairing_handle=PAIR,consent_handle=CONSENTS[idx])


def test_end_to_end_candidate_uses_real_crypto_synthetic_actors_only(keys):
    async def run():
        v=make_candidate(SignedSyntheticPorts(keys))
        a=await v.admit_actor(**real_signed_actor_args(keys,0))
        b=await v.admit_actor(**real_signed_actor_args(keys,1))
        result=await v.correlate_pair(a,b)
        assert result["status"]=="IN_MEMORY_PAIR_CORRELATION_CANDIDATE"
        assert result["trusted_live_auth_confirmed"] is False
        assert result["signed_receipt_issued"] is False
        assert result["store_read_authorized"] is False
        assert result["orders_read_authorized"] is False
        assert result["provider_send_authorized"] is False
    asyncio.run(run())


def test_end_to_end_candidate_denies_revocation_after_admission(keys):
    async def run():
        p=SignedSyntheticPorts(keys); v=make_candidate(p)
        a=await v.admit_actor(**real_signed_actor_args(keys,0))
        b=await v.admit_actor(**real_signed_actor_args(keys,1))
        p.revoked_b=True
        with pytest.raises(AdmissionDenied) as exc:
            await v.correlate_pair(a,b)
        assert exc.value.code=="PAIR_SESSION_REVOKED"
    asyncio.run(run())


def test_end_to_end_candidate_denies_independent_consent_reversal(keys):
    async def run():
        p=SignedSyntheticPorts(keys); v=make_candidate(p)
        a=await v.admit_actor(**real_signed_actor_args(keys,0))
        b=await v.admit_actor(**real_signed_actor_args(keys,1))
        p.consent_b=False
        with pytest.raises(AdmissionDenied) as exc:
            await v.correlate_pair(a,b)
        assert exc.value.code=="PAIR_CONSENT_REVOKED"
    asyncio.run(run())
