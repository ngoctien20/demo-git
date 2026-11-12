"""No live n8n or customers. All HMAC payloads are synthetic."""
from pathlib import Path
import hashlib
import hmac
import json
import sys
import time
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from app.main import Settings, create_app

SECRET='TEST_STAGING_ONLY_'+('p'*48)
PATH='/api/v1/internal/n8n/handshake'

def make_signed(nonce=None, payload=None, ts=None, secret=SECRET):
    nonce=nonce or uuid.uuid4().hex
    ts=str(int(time.time())) if ts is None else str(ts)
    payload=payload if payload is not None else {'action':'PING','scope':'STAGING_READ_ONLY','request_id':nonce}
    raw=json.dumps(payload, separators=(',',':')).encode()
    sig=hmac.new(secret.encode(),ts.encode()+b'.'+nonce.encode()+b'.'+raw,hashlib.sha256).hexdigest()
    return raw, {'content-type':'application/json','X-TIEN404-Timestamp':ts,
                 'X-TIEN404-Nonce':nonce, 'X-TIEN404-Signature':sig}

def client(monkeypatch, secret=SECRET):
    if secret is None:monkeypatch.delenv('TIEN404_N8N_STAGING_SECRET',raising=False)
    else:monkeypatch.setenv('TIEN404_N8N_STAGING_SECRET',secret)
    return TestClient(create_app(Settings()))

def test_hmac_handshake_and_replay_blocked(monkeypatch):
    with client(monkeypatch) as c:
        body,headers=make_signed()
        r=c.post(PATH,content=body,headers=headers)
        assert r.status_code==200
        result=r.json()
        assert result['status']=='STAGING_N8N_VERIFIED'
        assert result['writes_enabled'] is False and result['tenant_access'] is False
        assert c.post(PATH,content=body,headers=headers).status_code==409

def test_no_secret_and_bad_signature_fail_closed(monkeypatch):
    body,headers=make_signed()
    with client(monkeypatch,None) as c:
        assert c.post(PATH,content=body,headers=headers).status_code==503
    with client(monkeypatch) as c:
        headers['X-TIEN404-Signature']='0'*64
        res=c.post(PATH,content=body,headers=headers)
        assert res.status_code==401 and SECRET not in res.text

def test_stale_request_tenant_forgery_and_mutations_denied(monkeypatch):
    with client(monkeypatch) as c:
        body,headers=make_signed(ts=int(time.time())-200)
        assert c.post(PATH,content=body,headers=headers).status_code==401
        body,headers=make_signed(payload={'action':'PING','scope':'STAGING_READ_ONLY','request_id':'nope','tenant_id':'FAKE'})
        assert c.post(PATH,content=body,headers=headers).status_code==422
        body,headers=make_signed(payload={'action':'CREATE_ORDER','scope':'STAGING_READ_ONLY','request_id':'ignored'})
        assert c.post(PATH,content=body,headers=headers).status_code==403
        body,headers=make_signed()
        assert c.post(PATH,content=body,headers={**headers,'content-type':'text/plain'}).status_code==415

def test_invalid_body_and_unsigned_anonymous_rejected(monkeypatch):
    with client(monkeypatch) as c:
        assert c.post(PATH,json={'action':'PING'}).status_code==401
        body,headers=make_signed()
        assert c.post(PATH,content=body+b' '*2000,headers=headers).status_code==413


def test_chunked_overflow_stops_consuming_stream(monkeypatch):
    import asyncio
    from starlette.requests import Request
    from fastapi import HTTPException
    from app.signed_n8n import MAX_BODY

    app = create_app(Settings())
    endpoint = next(route.endpoint for route in app.routes if route.path == PATH)
    chunks = iter([b'x' * MAX_BODY, b'x'])
    async def receive():
        return {"type": "http.request", "body": next(chunks), "more_body": True}
    request = Request({"type": "http", "headers": [(b"content-type", b"application/json")]}, receive)
    try:
        asyncio.run(endpoint(request))
    except HTTPException as exc:
        assert exc.status_code == 413
    else:
        raise AssertionError("Expected early rejection")
