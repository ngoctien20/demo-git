"""V18.0-P0U — trusted server session row assessor, source-only.

No database credentials, connection or SQL execution here. Caller MUST retrieve
auth.sessions exclusively from a separately reviewed server-side least-privilege
backend. Never expose auth.sessions or this adapter through public RPC/RLS.
"""
from __future__ import annotations
from datetime import datetime, timezone
from collections.abc import Mapping
from uuid import UUID


class CurrentSessionDenied(Exception):
    def __init__(self, code="CURRENT_SESSION_DENIED"):
        self.code = code
        super().__init__(code)


def _uuid(value):
    if not isinstance(value, str):
        return False
    try:
        return str(UUID(value)) == value.lower()
    except (ValueError, TypeError, AttributeError):
        return False


def _utc_timestamp(value):
    if value is None:
        return None
    if not isinstance(value, datetime) or value.tzinfo is None:
        raise CurrentSessionDenied("SESSION_EXPIRY_UNTRUSTED")
    return value.astimezone(timezone.utc).timestamp()


def assess_current_session_snapshot(*, rows, requested_session_id,
                                    verified_subject_id, now_utc):
    """Validate exactly one trusted row; returned proof is only an *input* for P0T.

    A session row alone does not authenticate JWT possession or prove owner consent.
    Rows must come from a trusted server query with a subject/session exact filter.
    Deletion after this snapshot needs a fresh check at correlation/receipt time.
    """
    if not (_uuid(requested_session_id) and _uuid(verified_subject_id)
            and isinstance(now_utc, datetime) and now_utc.tzinfo is not None):
        raise CurrentSessionDenied("SESSION_INPUT_UNTRUSTED")
    if not isinstance(rows, (list, tuple)) or len(rows) != 1:
        raise CurrentSessionDenied()
    row = rows[0]
    if not isinstance(row, Mapping):
        raise CurrentSessionDenied()
    if row.get("id") != requested_session_id or row.get("user_id") != verified_subject_id:
        raise CurrentSessionDenied()
    expiry = _utc_timestamp(row.get("not_after"))
    if expiry is not None and expiry <= now_utc.timestamp():
        raise CurrentSessionDenied()
    return {
        "exists": True, "revoked": False,
        "id": requested_session_id, "user_id": verified_subject_id,
        "expires_at": expiry,
        # Never mistake this flag for a real signed Auth/consent proof:
        "signature_or_bearer_possession_verified": False,
        "store_authority_verified": False,
        "provider_send_authorized": False,
    }
