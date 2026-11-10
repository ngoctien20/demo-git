"""Staging-only n8n HMAC handshake; no tenant data or business writes.

The process-local replay cache is not a distributed replay defense. Production
requires an atomic shared nonce store; this endpoint is deliberately QA-only.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import re
import threading
import time
from fastapi import HTTPException

MAX_BODY = 1024
MAX_SKEW_SECONDS = 90

class ReplayCache:
    def __init__(self):
        self._lock = threading.Lock()
        self._seen: dict[str, float] = {}

    def mark_first_use(self, nonce: str, now: float) -> bool:
        with self._lock:
            self._seen = {n: expiry for n, expiry in self._seen.items() if expiry > now}
            if nonce in self._seen or len(self._seen) >= 4096:
                return False
            self._seen[nonce] = now + 2 * MAX_SKEW_SECONDS
            return True

def verify_request(*, secret: str, raw: bytes, timestamp: str | None,
                   nonce: str | None, signature: str | None,
                   cache: ReplayCache, now: float | None = None) -> dict:
    if not secret or len(secret) < 32:
        raise HTTPException(503, 'N8N_STAGING_GATEWAY_NOT_CONFIGURED')
    if len(raw) == 0 or len(raw) > MAX_BODY:
        raise HTTPException(413, 'INVALID_BODY_SIZE')
    if not timestamp or not re.fullmatch(r'\d{10}', timestamp):
        raise HTTPException(401, 'INVALID_SIGNATURE')
    now = time.time() if now is None else now
    if abs(now - int(timestamp)) > MAX_SKEW_SECONDS:
        raise HTTPException(401, 'INVALID_SIGNATURE')
    if not nonce or not re.fullmatch(r'[a-zA-Z0-9_-]{16,100}', nonce):
        raise HTTPException(401, 'INVALID_SIGNATURE')
    if not signature or not re.fullmatch(r'[a-f0-9]{64}', signature):
        raise HTTPException(401, 'INVALID_SIGNATURE')
    material = timestamp.encode() + b'.' + nonce.encode() + b'.' + raw
    digest = hmac.new(secret.encode('utf-8'), material, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, digest):
        raise HTTPException(401, 'INVALID_SIGNATURE')
    try:
        body = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(422, 'INVALID_PAYLOAD') from None
    if not isinstance(body, dict) or set(body) != {'action', 'scope', 'request_id'}:
        raise HTTPException(422, 'INVALID_PAYLOAD')
    if body.get('action') != 'PING' or body.get('scope') != 'STAGING_READ_ONLY' or body.get('request_id') != nonce:
        raise HTTPException(403, 'ACTION_NOT_ALLOWED')
    if not cache.mark_first_use(nonce, now):
        raise HTTPException(409, 'REQUEST_REPLAYED_OR_LIMITED')
    return body
