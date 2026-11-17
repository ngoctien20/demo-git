"""V17.1I merchant photo evidence and capped Vision provider execution PLAN.

No merchant images or vendor calls are executed here. Photo ownership, blinded
labels, provider pricing and bills require independent verification. All costs
are worst-case caller-supplied estimates expressed as integer micro-USD.
"""
from __future__ import annotations
import re
from typing import Any
VERSION = "T404_V171I_CORPUS_AND_BUDGET_PLAN_V1"
ID = re.compile(r"^[A-Za-z0-9_-]{2,90}$")
HEX = re.compile(r"^[a-f0-9]{64}$")
MAX_CASES = 60
MIN_KNOWN = 30
MIN_UNKNOWN = 15

class VisionAdmissionDenied(ValueError):
    pass

def deny(code):
    raise VisionAdmissionDenied(code)

def valid_id(x):
    return isinstance(x, str) and bool(ID.fullmatch(x))

def valid_hash(x):
    return isinstance(x, str) and bool(HEX.fullmatch(x))

def prepare_corpus_evidence(*, tenant_id, store_id, catalog_revision,
                            products, images, cases, now_ms):
    if (not valid_id(tenant_id) or not valid_id(store_id) or
        type(catalog_revision) is not int or catalog_revision < 1 or
        type(now_ms) is not int or now_ms <= 0 or
        not isinstance(products, list) or not 1 <= len(products) <= 100 or
        not isinstance(images, list) or not isinstance(cases, list) or
        len(images) > 100 or len(cases) > MAX_CASES):
        deny("VISION_CORPUS_SCOPE_INVALID")
    # Canonical catalog is an injected fixture, NOT hosted ownership proof.
    sku_map = {}
    for p in products:
        if (not isinstance(p, dict) or p.get("tenantId") != tenant_id or
            p.get("storeId") != store_id or not valid_id(p.get("itemId")) or
            not valid_id(p.get("sku")) or p.get("active") is not True or
            p["sku"] in sku_map):
            deny("VISION_CORPUS_CATALOG_MISMATCH")
        sku_map[p["sku"]] = p["itemId"]
    image_hashes = set()
    image_ids = set()
    prepared = []
    for image in images:
        if (not isinstance(image, dict) or
            image.get("tenantId") != tenant_id or
            image.get("storeId") != store_id or
            image.get("catalogRevision") != catalog_revision or
            not valid_id(image.get("mediaId")) or
            not valid_id(image.get("sku")) or
            image.get("itemId") != sku_map.get(image.get("sku")) or
            not valid_hash(image.get("sha256")) or
            not valid_id(image.get("rightsEvidenceRef")) or
            not valid_id(image.get("merchantDeclarationRef")) or
            image.get("commercialUseConsent") is not True or
            image.get("sourceType") not in ("DIRECT_UPLOAD", "WEBSITE_IMAGE") or
            type(image.get("retentionUntilMs")) is not int or
            not now_ms < image["retentionUntilMs"] <= now_ms + 365*86400000):
            deny("VISION_CORPUS_IMAGE_RIGHTS_OR_STORE_MISMATCH")
        if image["sha256"] in image_hashes or image["mediaId"] in image_ids:
            deny("VISION_DUPLICATE_IMAGE_OR_MEDIA_ID")
        image_hashes.add(image["sha256"])
        image_ids.add(image["mediaId"])
        prepared.append({
            "tenantId": tenant_id, "storeId": store_id,
            "sku": image["sku"], "itemId": image["itemId"],
            "mediaId": image["mediaId"], "sha256": image["sha256"],
            "rightsEvidenceRef": image["rightsEvidenceRef"],
            "retentionUntilMs": image["retentionUntilMs"],
            "realMerchantRightsIndependentlyVerified": False,
            "humanReviewStatus": "PENDING_INDEPENDENT_REVIEW"
        })
    image_skus = {item["sku"] for item in prepared}
    seen_ids = set()
    seen_hashes = set()
    known = unknown = 0
    eval_cases = []
    for case in cases:
        if (not isinstance(case, dict) or
            case.get("tenantId") != tenant_id or
            case.get("storeId") != store_id or
            not valid_id(case.get("caseId")) or
            case["caseId"] in seen_ids or
            not valid_hash(case.get("querySha256")) or
            case["querySha256"] in seen_hashes or
            case["querySha256"] in image_hashes or
            not valid_id(case.get("labelReviewerRef")) or
            case.get("split") != "BLIND_EVAL" or
            (case.get("expectedSku") is not None and
             case.get("expectedSku") not in image_skus)):
            deny("VISION_EVAL_CASE_OR_LEAKAGE_DENIED")
        seen_ids.add(case["caseId"])
        seen_hashes.add(case["querySha256"])
        if case["expectedSku"] is None:
            unknown += 1
        else:
            known += 1
        eval_cases.append({
            "caseId": case["caseId"], "querySha256": case["querySha256"],
            "expectedSku": case["expectedSku"],
            "labelReviewerRef": case["labelReviewerRef"]
        })
    return {
        "version": VERSION, "mode": "UNVERIFIED_MERCHANT_EVIDENCE_QUARANTINE",
        "tenantId": tenant_id, "storeId": store_id,
        "catalogRevision": catalog_revision,
        "catalogSkuCount": len(sku_map),
        "imageCount": len(prepared), "cases": eval_cases,
        "images": prepared, "knownCases": known, "unknownCases": unknown,
        "proposedMinimumSampleSatisfied": known >= MIN_KNOWN and unknown >= MIN_UNKNOWN,
        "actualMerchantPhotosIndependentlyVerified": False,
        "labelsIndependentlyVerified": False,
        "permissionsIndependentlyVerified": False,
        "readyToCallVision": False, "canPublish": False,
        "modelCalls": 0, "hostedWrites": 0, "providerSends": 0
    }


def bound_vision_budget(*, corpus, provider_name, model_id,
                        max_calls, max_total_micro_usd,
                        per_call_max_micro_usd, approved_budget_ref=None):
    """Fail-closed quote preparation, never a paid model call or balance lookup."""
    if (not isinstance(corpus, dict) or corpus.get("version") != VERSION or
        not valid_id(corpus.get("tenantId")) or
        not valid_id(corpus.get("storeId")) or
        not isinstance(corpus.get("cases"), list) or
        not valid_id(provider_name) or not valid_id(model_id) or
        type(max_calls) is not int or not 1 <= max_calls <= MAX_CASES or
        type(max_total_micro_usd) is not int or
        not 1 <= max_total_micro_usd <= 10_000_000 or
        type(per_call_max_micro_usd) is not int or
        not 1 <= per_call_max_micro_usd <= 1_000_000 or
        len(corpus["cases"]) > max_calls):
        deny("VISION_BUDGET_INPUT_OR_CALL_CAP_INVALID")
    proposed_upper_bound = len(corpus["cases"]) * per_call_max_micro_usd
    if proposed_upper_bound > max_total_micro_usd:
        deny("VISION_BUDGET_WORST_CASE_EXCEEDS_MAX")
    return {
        "version": VERSION, "mode": "QUOTE_ONLY_NEVER_CALL_PROVIDER",
        "tenantId": corpus["tenantId"], "storeId": corpus["storeId"],
        "providerName": provider_name, "modelId": model_id,
        "caseCount": len(corpus["cases"]), "maxCalls": max_calls,
        "perCallMaxMicroUsd": per_call_max_micro_usd,
        "proposedHardCapMicroUsd": max_total_micro_usd,
        "worstCaseMicroUsd": proposed_upper_bound,
        "approvedBudgetRefPresent": bool(approved_budget_ref),
        "providerRateAndBalanceIndependentlyVerified": False,
        "merchantRightsAndLabelsIndependentlyVerified": False,
        "merchantSampleSufficient": corpus["proposedMinimumSampleSatisfied"],
        "approvedForBilling": False, "canInvokeModel": False,
        "actualProviderCalls": 0, "providerSends": 0, "hostedWrites": 0,
        "requiresHumanApprovalAndServerSideEnforcedMeter": True
    }


def inspect_unverified_receipts(*, corpus, quote, receipts):
    """Compute metrics for explicitly unverified provider claims; NO RELEASE."""
    if (not isinstance(corpus, dict) or corpus.get("version") != VERSION or
        not isinstance(quote, dict) or quote.get("mode") !=
        "QUOTE_ONLY_NEVER_CALL_PROVIDER" or
        corpus.get("tenantId") != quote.get("tenantId") or
        corpus.get("storeId") != quote.get("storeId") or
        not isinstance(receipts, list) or
        len(receipts) != len(corpus.get("cases", []))):
        deny("VISION_RECEIPT_QUOTE_SCOPE_INVALID")
    allowed_skus = {x["sku"] for x in corpus["images"]}
    case_map = {c["caseId"]: c for c in corpus["cases"]}
    if len(case_map) != len(corpus["cases"]):
        deny("VISION_RECEIPT_CASE_DUPLICATE")
    seen = set()
    seen_requests = set()
    known = unknown = r1 = r3 = unknown_candidates = violations = 0
    claimed_spend = 0
    for r in receipts:
        if (not isinstance(r, dict) or r.get("caseId") not in case_map or
            r["caseId"] in seen or
            r.get("tenantId") != corpus["tenantId"] or
            r.get("storeId") != corpus["storeId"] or
            not valid_id(r.get("requestId")) or
            r["requestId"] in seen_requests or
            r.get("querySha256") != case_map[r["caseId"]]["querySha256"] or
            r.get("providerName") != quote["providerName"] or
            r.get("modelId") != quote["modelId"] or
            type(r.get("claimedMicroUsd")) is not int or
            not 0 <= r["claimedMicroUsd"] <= quote["perCallMaxMicroUsd"] or
            not isinstance(r.get("candidates"), list) or
            len(r["candidates"]) > 3 or
            any(not valid_id(s) for s in r["candidates"]) or
            len(set(r["candidates"])) != len(r["candidates"])):
            deny("VISION_RECEIPT_ROW_INVALID")
        seen.add(r["caseId"])
        seen_requests.add(r["requestId"])
        claimed_spend += r["claimedMicroUsd"]
        case = case_map[r["caseId"]]
        violations += sum(s not in allowed_skus for s in r["candidates"])
        if case["expectedSku"] is None:
            unknown += 1
            unknown_candidates += bool(r["candidates"])
        else:
            known += 1
            r1 += bool(r["candidates"]) and r["candidates"][0] == case["expectedSku"]
            r3 += case["expectedSku"] in r["candidates"][:3]
    if claimed_spend > quote["proposedHardCapMicroUsd"]:
        deny("VISION_CLAIMED_COST_EXCEEDS_CAP")
    return {
        "version": VERSION, "mode": "CLAIMED_METRICS_NOT_A_REAL_MODEL_RUN",
        "tenantId": corpus["tenantId"], "storeId": corpus["storeId"],
        "knownCases": known, "unknownCases": unknown,
        "recallAt1": r1 / known if known else None,
        "recallAt3": r3 / known if known else None,
        "unknownCandidateRate": unknown_candidates / unknown if unknown else None,
        "outOfStoreOrUnboundSkuCandidates": violations,
        "claimedMicroUsd": claimed_spend,
        "billingIndependentlyVerified": False,
        "humanLabelsIndependentlyVerified": False,
        "realMerchantPhotosIndependentlyVerified": False,
        "eligibleForLiveRelease": False, "canAutoSelectSku": False,
        "providerCallsByModule": 0,
        "requiresCustomerSkuSelection": True,
        "requiresFinalOrderConfirmation": True
    }
