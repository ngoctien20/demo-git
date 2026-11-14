"""Private, synthetic-only adapter for the protected V1 normalizer's output shape."""
import hashlib
import hmac
import re
from uuid import UUID


def claim_from_fixture(db, trusted_route, event, fixture_key):
    """Caller derives trusted_route from ingress. No public handler or live chat IDs."""
    if (not isinstance(fixture_key, bytes) or len(fixture_key) < 32 or
            not isinstance(event, dict) or event.get("stage") != "READ_ONLY" or
            event.get("accepted") is not True or event.get("eventName") != "message.text.received" or
            event.get("chatType") != "PRIVATE"):
        return False
    chat, mid, text = (event.get(k) for k in ("chatId","messageId","text"))
    if not all(isinstance(v,str) and re.fullmatch(r"qa-[a-z0-9-]{1,60}",v) for v in (chat,mid)):
        return False
    match = re.fullmatch(r"GHÉP ([0-9a-f-]{36}) ([0-9a-f]{32})",text) if isinstance(text,str) else None
    if not match:
        return False
    try:
        challenge = UUID(match[1])
    except ValueError:
        return False

    def pseudonym(kind, value):
        material = "\x1f".join((*trusted_route,kind,value)).encode()
        return "qa-" + kind + "-" + hmac.new(fixture_key,material,hashlib.sha256).hexdigest()

    return db.execute(
        "select tien404_r1_qa.claim_owner_pairing_v3_synthetic(%s,%s,%s,%s,%s,%s,%s)",
        (*trusted_route,challenge,match[2],pseudonym("recipient",chat),pseudonym("event",mid))
    ).fetchone()[0]
