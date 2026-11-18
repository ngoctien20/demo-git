"""P0W source-only: pinned key retrieval and Auth getUser negative tests.

All HTTP is intercepted by httpx.MockTransport. Signing keys, users and
bearers are generated synthetic fixtures; no network/credentials/customer data.
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from datetime import datetime, timezone

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec, rsa

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parents[1] / "v180-p0u"))
from pinned_jwks_source import PinnedJwksSource, TrustedKeySourceDenied
from pinned_auth_user_source import PinnedSupabaseAuthUserSource, LiveAuthUserDenied
from pinned_jwks_verifier import verify_cloudflare_access_jwt, verify_supabase_owner_jwt, SignatureDenied

NOW = 1_800_000_000
CF_ISS = "https://synthetic-qa.cloudflareaccess.com"
SB_ISS = "https://synthetic-qa.supabase.co/auth/v1"
SB_ORIGIN = "https://synthetic-qa.supabase.co"
SB_KEY = "sb_publishable_SYNTHETIC_QA_ONLY_123456789"
CF_EXPECT = CF_ISS + "/cdn-cgi/access/certs"
SB_EXPECT = SB_ISS + "/.well-known/jwks.json"
OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
SESSION = "11111111-1111-4111-8111-111111111111"


@pytest.fixture(scope="module")
def certs():
    rsa_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    ec_key = ec.generate_private_key(ec.SECP256R1())
    rsa_public = jwt.algorithms.RSAAlgorithm.to_jwk(rsa_key.public_key(), as_dict=True)
    rsa_public.update(kid="synthetic-rsa-1", use="sig", alg="RS256")
    ec_public = jwt.algorithms.ECAlgorithm.to_jwk(ec_key.public_key(), as_dict=True)
    ec_public.update(kid="synthetic-ec-1", use="sig", alg="ES256")
    return {"rsa": rsa_key, "ec": ec_key, "rsa_public": rsa_public, "ec_public": ec_public}


def async_run(coro):
    return asyncio.run(coro)


def public_response(keys):
    return httpx.Response(200, json={"keys": keys}, headers={"content-type": "application/json"})


def mocked(handler):
    return httpx.MockTransport(handler)


def cf_source(transport, clock=lambda: NOW):
    return PinnedJwksSource(
        provider="cloudflare_access", issuer=CF_ISS, transport=transport, clock=clock,
    )


def sb_source(transport, clock=lambda: NOW):
    return PinnedJwksSource(
        provider="supabase", issuer=SB_ISS, transport=transport, clock=clock,
    )


def user_source(transport, clock=lambda: datetime.fromtimestamp(NOW, timezone.utc)):
    return PinnedSupabaseAuthUserSource(
        project_origin=SB_ORIGIN, publishable_key=SB_KEY, transport=transport, clock=clock,
    )


def fake_bearer():
    return "SYNTHETIC_OFFLINE_BEARER_FOR_TESTING_NOT_A_REAL_JWT_123456789"


def fake_user(**overrides):
    result = {
        "id": OWNER, "role": "authenticated", "is_anonymous": False,
        "deleted_at": None, "banned_until": None,
        "email": "synthetic-user@example.invalid", "phone": "SYNTHETIC_PHONE",
        "user_metadata": {"private": "DO_NOT_FORWARD"},
    }
    result.update(overrides)
    return result


def test_cloudflare_pinned_origin_and_cache_are_server_owned(certs):
    state={"calls": 0}
    def handler(request):
        assert str(request.url)==CF_EXPECT and request.method=="GET"
        assert "authorization" not in request.headers
        state["calls"]+=1
        return public_response([certs["rsa_public"]])
    source=cf_source(mocked(handler))
    assert source.pinned_url==CF_EXPECT
    result=async_run(source.get_keys())
    assert len(result["keys"])==1 and state["calls"]==1
    result["keys"][0]["kid"]="ATTACKER_MUTATION"
    assert async_run(source.get_keys())["keys"][0]["kid"]=="synthetic-rsa-1"
    assert state["calls"]==1


def test_supabase_pinned_origin_retrieves_rsa_and_ec(certs):
    def handler(request):
        assert str(request.url)==SB_EXPECT
        return public_response([certs["rsa_public"],certs["ec_public"]])
    out=async_run(sb_source(mocked(handler)).get_keys())
    assert {key["alg"] for key in out["keys"]}=={"RS256","ES256"}


def test_jwks_source_verifies_real_rsa_signature_synthetic_keys(certs):
    source=cf_source(mocked(lambda request:public_response([certs["rsa_public"]])))
    keys=async_run(source.get_keys())
    token=jwt.encode(
        {"iss":CF_ISS,"aud":["synthetic-aud"],"sub":"synthetic-access-owner-a",
         "iat":NOW-20,"nbf":NOW-20,"exp":NOW+100},
        certs["rsa"],algorithm="RS256",headers={"kid":"synthetic-rsa-1"}
    )
    result=verify_cloudflare_access_jwt(
        token,pinned_keys=keys,team_issuer=CF_ISS,app_audience="synthetic-aud",now=NOW
    )
    assert result["signature_verified"] is True


def test_jwks_source_verifies_real_es256_signature_synthetic_keys(certs):
    source=sb_source(mocked(lambda request:public_response([certs["ec_public"]])))
    keys=async_run(source.get_keys())
    token=jwt.encode(
        {"iss":SB_ISS,"aud":"authenticated","sub":OWNER,"session_id":SESSION,
         "iat":NOW-20,"nbf":NOW-20,"exp":NOW+100,
         "role":"authenticated","is_anonymous":False},
        certs["ec"],algorithm="ES256",headers={"kid":"synthetic-ec-1"}
    )
    result=verify_supabase_owner_jwt(token,pinned_keys=keys,supabase_issuer=SB_ISS,now=NOW)
    assert result["signature_verified"] is True and result["session_id"]==SESSION


@pytest.mark.parametrize("provider,issuer",[
    ("cloudflare_access","https://evil.example.net"),
    ("supabase","http://synthetic-qa.supabase.co/auth/v1"),
    ("supabase","https://synthetic-qa.supabase.co/auth/v1/../user"),
    ("supabase","https://user@synthetic-qa.supabase.co/auth/v1"),
    ("supabase","https://synthetic-qa.supabase.co/auth/v1?q=exfil"),
    ("unknown","https://synthetic-qa.supabase.co/auth/v1"),
    ("cloudflare_access","https://synthetic-qa.cloudflareaccess.com.evil.invalid")
])
def test_reject_arbitrary_endpoints_and_ssrf(provider, issuer):
    with pytest.raises(TrustedKeySourceDenied,match="JWKS_CONFIG_INVALID"):
        PinnedJwksSource(provider=provider,issuer=issuer)


@pytest.mark.parametrize("bad",[-1,0,3,121,True,"60",None])
def test_reject_unbounded_cache_settings(bad):
    with pytest.raises(TrustedKeySourceDenied,match="JWKS_CONFIG_INVALID"):
        PinnedJwksSource(provider="cloudflare_access",issuer=CF_ISS,ttl_seconds=bad)


@pytest.mark.parametrize("response",[
    httpx.Response(302,headers={"Location":"https://evil.example.net/jwks"}),
    httpx.Response(401,text="unauthorized"),
    httpx.Response(429,text="rate limited"),
    httpx.Response(500,text="provider outage"),
    httpx.Response(200,text="bad-json",headers={"content-type":"application/json"}),
    httpx.Response(200,json={"keys":[]}),
    httpx.Response(200,json={"keys":{}}),
    httpx.Response(200,json={"keys":[{}]}),
    httpx.Response(200,json={"keys":[{"kid":"x","kty":"oct","k":"fake"}]}),
    httpx.Response(200,text="x"*33000,headers={"content-type":"application/json"}),
    httpx.Response(200,json={"keys":[{"kid":"k1","kty":"RSA"}]},headers={"content-type":"text/html"}),
])
def test_unavailable_or_malformed_key_source_fails_closed(response):
    src=cf_source(mocked(lambda request:response))
    with pytest.raises(TrustedKeySourceDenied):
        async_run(src.get_keys())


@pytest.mark.parametrize("change",[
    {"alg":"HS256"},
    {"kty":"oct"},
    {"use":"enc"},
    {"kid":"slash/escape"},
    {"kid":None},
    {"d":"PRIVKEY"},
])
def test_cloudflare_rejects_bad_public_key_metadata(certs,change):
    key={**certs["rsa_public"],**change}
    src=cf_source(mocked(lambda request:public_response([key])))
    with pytest.raises(TrustedKeySourceDenied):
        async_run(src.get_keys())


def test_duplicate_key_ids_fail_closed(certs):
    jwk=certs["rsa_public"]
    src=cf_source(mocked(lambda request:public_response([jwk,jwk])))
    with pytest.raises(TrustedKeySourceDenied):
        async_run(src.get_keys())


def test_expired_cached_public_keys_must_refresh_or_deny(certs):
    state={"clock":NOW,"fetch":0}
    def handler(req):
        state["fetch"]+=1
        return public_response([certs["rsa_public"]]) if state["fetch"]==1 else httpx.Response(503)
    src=cf_source(mocked(handler),clock=lambda:state["clock"])
    assert len(async_run(src.get_keys())["keys"])==1
    state["clock"]=NOW+70
    with pytest.raises(TrustedKeySourceDenied):
        async_run(src.get_keys())
    assert state["fetch"]==2


def test_failed_provider_refresh_does_not_extend_cache(certs):
    clock=[NOW]
    def handler(req):
        return httpx.Response(503)
    src=cf_source(mocked(handler),clock=lambda:clock[0])
    for _ in range(2):
        with pytest.raises(TrustedKeySourceDenied):
            async_run(src.get_keys())


def test_untrusted_clock_blocks_key_fetch():
    src=cf_source(mocked(lambda req:httpx.Response(200,json={})),clock=lambda:None)
    with pytest.raises(TrustedKeySourceDenied):
        async_run(src.get_keys())


def test_live_auth_getuser_pinned_and_redacted():
    calls=[]
    def handler(req):
        calls.append(req)
        assert str(req.url)==SB_ORIGIN+"/auth/v1/user"
        assert req.headers["authorization"]=="Bearer "+fake_bearer()
        assert req.headers["apikey"]==SB_KEY
        assert req.method=="GET"
        return httpx.Response(200,json=fake_user())
    src=user_source(mocked(handler))
    result=async_run(src.get_live_user(fake_bearer()))
    assert len(calls)==1
    assert result=={"verified":True,"disabled":False,"id":OWNER,
                    "live_session_and_store_authorized":False}
    assert "synthetic-user" not in json.dumps(result)
    assert "phone" not in json.dumps(result)


@pytest.mark.parametrize("response",[
    httpx.Response(302,headers={"Location":"https://evil.example.net"}),
    httpx.Response(401,json={"error":"unauthorized"}),
    httpx.Response(403,json={"error":"forbidden"}),
    httpx.Response(429,json={"error":"rate_limited"}),
    httpx.Response(500,json={"error":"outage"}),
    httpx.Response(200,text="not json",headers={"content-type":"application/json"}),
    httpx.Response(200,json=[fake_user()]),
    httpx.Response(200,json=fake_user(id="invalid-uuid")),
    httpx.Response(200,json=fake_user(role="anon")),
    httpx.Response(200,json=fake_user(is_anonymous=True)),
    httpx.Response(200,json=fake_user(is_anonymous=None)),
    httpx.Response(200,json=fake_user(deleted_at="2026-11-18")),
    httpx.Response(200,json=fake_user(banned_until="2026-11-19")),
    httpx.Response(200,json=fake_user(),headers={"content-type":"text/html"}),
    httpx.Response(200,text="x"*17000,headers={"content-type":"application/json"}),
])
def test_live_auth_wrong_user_or_provider_error_denied(response):
    src=user_source(mocked(lambda req:response))
    with pytest.raises(LiveAuthUserDenied):
        async_run(src.get_live_user(fake_bearer()))


@pytest.mark.parametrize("origin,key",[
    ("https://evil.example.net",SB_KEY),
    ("http://synthetic-qa.supabase.co",SB_KEY),
    ("https://synthetic-qa.supabase.co/path",SB_KEY),
    (SB_ORIGIN,"sb_secret_SIMULATED_FORBIDDEN"),
    (SB_ORIGIN,""),
    (SB_ORIGIN,None),
    (SB_ORIGIN,"eyJlegacyservice"),
])
def test_live_auth_misconfigured_origin_or_privileged_key_denied(origin,key):
    with pytest.raises(LiveAuthUserDenied,match="LIVE_AUTH_SOURCE_NOT_CONFIGURED"):
        PinnedSupabaseAuthUserSource(project_origin=origin,publishable_key=key)


@pytest.mark.parametrize("bearer",[
    None,"","a"*5000,"line\nbreak"+"X"*40," " * 60,
    "SYNTHETIC_"+"😎"*30,
])
def test_live_auth_rejects_bad_bearer_without_http(bearer):
    invoked=[0]
    def handler(req):
        invoked[0]+=1
        return httpx.Response(200,json=fake_user())
    src=user_source(mocked(handler))
    with pytest.raises(LiveAuthUserDenied):
        async_run(src.get_live_user(bearer))
    assert invoked[0]==0


def test_live_auth_provider_exception_is_redacted():
    def handler(req):
        raise httpx.ConnectError("SYNTHETIC_SECRET_PRIVATE_URL",request=req)
    src=user_source(mocked(handler))
    with pytest.raises(LiveAuthUserDenied) as err:
        async_run(src.get_live_user(fake_bearer()))
    assert "SECRET" not in str(err.value)
