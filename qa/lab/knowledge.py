"""Offline Training Lab retrieval. The caller supplies reviewed records and a trusted scope.
Never use this module as the merchant authentication or buyer ownership boundary.
"""
import unicodedata


def terms(text):
    folded = unicodedata.normalize("NFD", text.casefold().replace("đ", "d"))
    return set("".join(c if c.isalnum() else " " for c in folded
                       if not unicodedata.combining(c)).split())


def retrieve(question, records, *, tenant, industry):
    if not isinstance(tenant, str) or not tenant.strip():
        return None
    if not isinstance(question, str):
        return None
    question_terms = terms(question)
    ranked = []
    for record in records:
        if not isinstance(record, dict) or record.get("status") != "approved":
            continue
        if any(not isinstance(record.get(key), str) or not record[key].strip()
               for key in ("id", "version", "topic", "answer")):
            continue
        scope = record.get("scope")
        if scope == "shop":
            if record.get("tenant") != tenant:
                continue
        elif scope == "industry":
            if record.get("tenant") is not None or not industry or record.get("industry") != industry:
                continue
        else:
            continue
        matched = terms(record["topic"])
        if matched and matched <= question_terms:
            ranked.append(((len(matched), scope == "shop"), record))
    if not ranked:
        return None
    highest = max(rank for rank, _ in ranked)
    best = [record for rank, record in ranked if rank == highest]
    if len(best) != 1:
        return None
    record = best[0]
    return {k: record[k] for k in ("id", "version", "answer")}
