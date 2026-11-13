"""Offline Messenger adapter. Caller supplies a trusted page mapping and per-app signing secret."""
import hashlib
import hmac
import json


def verified_messages(raw, signature, secret, page_bindings):
    if not isinstance(secret, bytes) or not secret or len(raw)>262144 or not isinstance(signature,str):
        raise ValueError("invalid envelope")
    expected="sha256="+hmac.new(secret,raw,hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature.encode(),expected.encode()):
        raise ValueError("invalid signature")
    envelope=json.loads(raw)
    if envelope.get('object')!='page': raise ValueError("invalid source")
    events=[]
    for entry in envelope['entry']:
        page=entry['id']
        if page not in page_bindings: raise ValueError("unknown page")
        for item in entry.get('messaging',[]):
            msg=item.get('message',{})
            if not msg or msg.get('is_echo'): continue
            sender=item.get('sender',{}).get('id')
            mid=msg.get('mid')
            if item.get('recipient',{}).get('id')!=page or not isinstance(sender,str) or not sender or not isinstance(mid,str) or not mid:
                raise ValueError("invalid routing")
            events.append((page_bindings[page],page,sender,mid,msg.get('text','')))
    return events
