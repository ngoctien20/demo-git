"""Local staging internal entitlement check: no provider webhook or production channel hooked up.

Caller must be a controlled server adapter that already verified platform provenance;
this HMAC is ONLY a service-to-service assertion, not Messenger/LINE/Zalo auth.
"""
from __future__ import annotations
import datetime as dt
import hashlib
import hmac
import json
from .core import AccessDenied,Invalid,CHANNELS,now_utc
_GATEWAY_PROOF=object()
class VerifiedGatewayRequest:
    __slots__=('platform','account_ref','request_id')
    def __init__(self,platform,account_ref,request_id,proof):
        if proof is not _GATEWAY_PROOF:raise AccessDenied('unverified gateway assertion')
        self.platform=platform;self.account_ref=account_ref;self.request_id=request_id

def verify_internal_gateway_request(secret,raw_body,timestamp,signature,at=None):
    if not secret or len(secret)<32:raise AccessDenied('missing or weak gateway secret')
    if len(raw_body)>2048:raise Invalid('request too large')
    at=at or now_utc()
    try:ts=int(timestamp)
    except (TypeError,ValueError):raise AccessDenied('bad request timestamp')
    if abs(at.timestamp()-ts)>90:raise AccessDenied('stale gateway assertion')
    expected=hmac.new(secret,timestamp.encode()+b'.'+raw_body,hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected,str(signature)):raise AccessDenied('bad gateway HMAC')
    try:payload=json.loads(raw_body)
    except (UnicodeDecodeError,ValueError):raise Invalid('malformed gateway JSON')
    if not isinstance(payload,dict) or set(payload)!={'platform','account_ref','request_id','purpose'}:
        raise Invalid('exact gateway schema required; tenant_id is not accepted from callers')
    if payload['purpose']!='CHECK_ENTITLEMENT' or payload['platform'] not in CHANNELS or not isinstance(payload['account_ref'],str) or not 1<=len(payload['account_ref'])<=180 or not isinstance(payload['request_id'],str) or not 8<=len(payload['request_id'])<=100:
        raise Invalid('gateway payload invalid')
    return VerifiedGatewayRequest(payload['platform'],payload['account_ref'],payload['request_id'],_GATEWAY_PROOF)