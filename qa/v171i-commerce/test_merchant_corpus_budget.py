"""V17.1I evidence, budget, mocked receipt tests — never paid inference."""
import importlib.util
import pathlib
import unittest

p=pathlib.Path(__file__).with_name("merchant_corpus_budget.py")
s=importlib.util.spec_from_file_location("bud",p)
m=importlib.util.module_from_spec(s)
s.loader.exec_module(m)
NOW=1794873600000
SCOPE={"tenant_id":"T_QA_01","store_id":"S_QA_A","catalog_revision":2,"now_ms":NOW}
SHA1="1"*64
SHA2="2"*64
SHA3="3"*64
def product(sku="QA_F_001",item="P_A_001",store="S_QA_A"):
    return {"tenantId":"T_QA_01","storeId":store,"itemId":item,"sku":sku,"active":True}
def image(sku="QA_F_001", item="P_A_001", sha=SHA1, media="IMG_001"):
    return {"tenantId":"T_QA_01","storeId":"S_QA_A",
            "catalogRevision":2,"mediaId":media,"sku":sku,"itemId":item,
            "sha256":sha,"rightsEvidenceRef":"RIGHTS_QA",
            "merchantDeclarationRef":"M_DECL_QA","commercialUseConsent":True,
            "sourceType":"WEBSITE_IMAGE","retentionUntilMs":NOW+60000}
def case(case_id="CASE_001",sha=SHA2,expected="QA_F_001"):
    return {"tenantId":"T_QA_01","storeId":"S_QA_A",
            "caseId":case_id,"querySha256":sha,"expectedSku":expected,
            "labelReviewerRef":"BLIND_QA","split":"BLIND_EVAL"}
def corpus(images=None,cases=None,products=None,**kwargs):
    return m.prepare_corpus_evidence(**{**SCOPE,
      "products":[product()] if products is None else products,
      "images":[image()] if images is None else images,
      "cases":[case(),case("CASE_002",SHA3,None)] if cases is None else cases,
       **kwargs})
def quote(c=None,**kwargs):
    return m.bound_vision_budget(**{"corpus":corpus() if c is None else c,
        "provider_name":"EXAMPLE_PROVIDER","model_id":"VISION_QA_PROPOSED",
        "max_calls":4,"max_total_micro_usd":80000,
        "per_call_max_micro_usd":20000,**kwargs})
def receipts(c=None):
    x=corpus() if c is None else c
    result=[]
    for i,v in enumerate(x["cases"]):
        result.append({"caseId":v["caseId"],"querySha256":v["querySha256"],
           "tenantId":x["tenantId"],"storeId":x["storeId"],
           "requestId":"REQ_"+str(i+1),"providerName":"EXAMPLE_PROVIDER",
           "modelId":"VISION_QA_PROPOSED","claimedMicroUsd":7000,
           "candidates":[v["expectedSku"]] if v["expectedSku"] else []})
    return result
class BudgetTests(unittest.TestCase):
    def denied(self,pattern,fn):
        with self.assertRaisesRegex(m.VisionAdmissionDenied,pattern):fn()
    def test_01_corpus_prepare_has_expected_store_and_sku(self):
        c=corpus()
        self.assertEqual(c["storeId"],"S_QA_A")
        self.assertEqual(c["images"][0]["sku"],"QA_F_001")
    def test_02_no_real_merchant_rights_or_labels_certified(self):
        c=corpus()
        self.assertFalse(c["actualMerchantPhotosIndependentlyVerified"])
        self.assertFalse(c["labelsIndependentlyVerified"])
        self.assertFalse(c["readyToCallVision"])
    def test_03_separate_photo_query_hashes_required(self):
        c=corpus()
        self.assertEqual(len(c["cases"]),2)
        self.assertNotEqual(c["images"][0]["sha256"],c["cases"][0]["querySha256"])
    def test_04_unknown_cases_are_explicit(self):
        c=corpus()
        self.assertEqual(c["knownCases"],1)
        self.assertEqual(c["unknownCases"],1)
    def test_05_small_fixture_not_sufficient(self):
        self.assertFalse(corpus()["proposedMinimumSampleSatisfied"])
    def test_06_store_B_product_denied(self):
        self.denied("CATALOG",lambda:corpus(products=[product(store="S_QA_B")]))
    def test_07_cross_store_image_denied(self):
        bad=image();bad["storeId"]="S_QA_B"
        self.denied("IMAGE_RIGHTS",lambda:corpus(images=[bad]))
    def test_08_sku_to_wrong_product_id_denied(self):
        bad=image();bad["itemId"]="P_A_999"
        self.denied("IMAGE_RIGHTS",lambda:corpus(images=[bad]))
    def test_09_missing_commercial_consent_denied(self):
        bad=image();bad["commercialUseConsent"]=False
        self.denied("IMAGE_RIGHTS",lambda:corpus(images=[bad]))
    def test_10_expired_retention_denied(self):
        bad=image();bad["retentionUntilMs"]=NOW-1
        self.denied("IMAGE_RIGHTS",lambda:corpus(images=[bad]))
    def test_11_retention_more_than_year_denied(self):
        bad=image();bad["retentionUntilMs"]=NOW+366*86400000
        self.denied("IMAGE_RIGHTS",lambda:corpus(images=[bad]))
    def test_12_duplicate_photo_content_denied(self):
        second=image(media="IMG_002")
        self.denied("DUPLICATE_IMAGE",lambda:corpus(images=[image(),second]))
    def test_13_duplicate_media_id_denied(self):
        second=image(sha=SHA3)
        self.denied("DUPLICATE_IMAGE",lambda:corpus(images=[image(),second]))
    def test_14_eval_photo_leaks_exact_reference_sha_denied(self):
        self.denied("LEAKAGE",lambda:corpus(cases=[case(sha=SHA1)]))
    def test_15_eval_query_repeat_denied(self):
        self.denied("LEAKAGE",lambda:corpus(cases=[case(),case("CASE_002",SHA2,None)]))
    def test_16_duplicate_case_id_denied(self):
        self.denied("LEAKAGE",lambda:corpus(cases=[case(),case("CASE_001",SHA3,None)]))
    def test_17_cross_store_eval_case_denied(self):
        bad=case();bad["storeId"]="S_QA_B"
        self.denied("LEAKAGE",lambda:corpus(cases=[bad]))
    def test_18_expected_sku_not_pictured_denied(self):
        p2=product(sku="QA_F_002",item="P_A_002")
        self.denied("LEAKAGE",lambda:corpus(products=[product(),p2],cases=[case(expected="QA_F_002")]))
    def test_19_not_blind_eval_split_denied(self):
        bad=case();bad["split"]="TRAIN"
        self.denied("LEAKAGE",lambda:corpus(cases=[bad]))
    def test_20_budget_quote_worst_case_integers(self):
        q=quote()
        self.assertEqual(q["worstCaseMicroUsd"],40000)
        self.assertEqual(q["proposedHardCapMicroUsd"],80000)
    def test_21_budget_never_authorizes_billing(self):
        q=quote(approved_budget_ref="APPROVAL_QA")
        self.assertFalse(q["approvedForBilling"])
        self.assertFalse(q["canInvokeModel"])
        self.assertEqual(q["actualProviderCalls"],0)
    def test_22_calls_lower_than_number_cases_denied(self):
        self.denied("CALL_CAP",lambda:quote(max_calls=1))
    def test_23_proposed_cost_over_hard_cap_denied(self):
        self.denied("WORST_CASE",lambda:quote(max_total_micro_usd=39999))
    def test_24_negative_or_zero_price_denied(self):
        for n in (0,-1):
            self.denied("INPUT_OR_CALL",lambda n=n:quote(per_call_max_micro_usd=n))
    def test_25_float_budget_inputs_denied(self):
        self.denied("INPUT_OR_CALL",lambda:quote(max_total_micro_usd=80000.0))
    def test_26_boolean_cap_inputs_denied(self):
        self.denied("INPUT_OR_CALL",lambda:quote(max_calls=True))
    def test_27_up_to_60_model_calls_allowed_as_quote_only(self):
        q=quote(max_calls=60)
        self.assertEqual(q["maxCalls"],60)
        self.assertFalse(q["canInvokeModel"])
    def test_28_unverified_vendor_receipt_quality_stats(self):
        c=corpus();q=quote(c)
        r=m.inspect_unverified_receipts(corpus=c,quote=q,receipts=receipts(c))
        self.assertEqual(r["recallAt1"],1.0)
        self.assertEqual(r["unknownCandidateRate"],0.0)
        self.assertFalse(r["eligibleForLiveRelease"])
    def test_29_unknown_image_hallucinated_candidate_detected(self):
        c=corpus();rows=receipts(c)
        rows[1]["candidates"]=["QA_F_001"]
        r=m.inspect_unverified_receipts(corpus=c,quote=quote(c),receipts=rows)
        self.assertEqual(r["unknownCandidateRate"],1.0)
    def test_30_out_of_store_candidate_counted_not_silent(self):
        c=corpus();rows=receipts(c)
        rows[0]["candidates"]=["QA_OTHER"]
        r=m.inspect_unverified_receipts(corpus=c,quote=quote(c),receipts=rows)
        self.assertEqual(r["outOfStoreOrUnboundSkuCandidates"],1)
    def test_31_receipt_wrong_store_denied(self):
        c=corpus();rows=receipts(c);rows[0]["storeId"]="S_QA_B"
        self.denied("RECEIPT_ROW",lambda:m.inspect_unverified_receipts(corpus=c,quote=quote(c),receipts=rows))
    def test_32_receipt_wrong_query_photo_sha_denied(self):
        c=corpus();rows=receipts(c);rows[0]["querySha256"]=SHA3
        self.denied("RECEIPT_ROW",lambda:m.inspect_unverified_receipts(corpus=c,quote=quote(c),receipts=rows))
    def test_33_duplicate_provider_request_id_denied(self):
        c=corpus();rows=receipts(c);rows[1]["requestId"]=rows[0]["requestId"]
        self.denied("RECEIPT_ROW",lambda:m.inspect_unverified_receipts(corpus=c,quote=quote(c),receipts=rows))
    def test_34_receipt_claimed_per_case_excess_denied(self):
        c=corpus();rows=receipts(c);rows[0]["claimedMicroUsd"]=30000
        self.denied("RECEIPT_ROW",lambda:m.inspect_unverified_receipts(corpus=c,quote=quote(c),receipts=rows))
    def test_35_duplicate_case_claim_denied(self):
        c=corpus();rows=receipts(c);rows[1]["caseId"]=rows[0]["caseId"]
        self.denied("RECEIPT_ROW",lambda:m.inspect_unverified_receipts(corpus=c,quote=quote(c),receipts=rows))
    def test_36_source_models_and_customer_order_remain_not_approved(self):
        c=corpus();q=quote(c)
        r=m.inspect_unverified_receipts(corpus=c,quote=q,receipts=receipts(c))
        self.assertFalse(r["billingIndependentlyVerified"])
        self.assertFalse(r["realMerchantPhotosIndependentlyVerified"])
        self.assertFalse(r["canAutoSelectSku"])
        self.assertTrue(r["requiresFinalOrderConfirmation"])
if __name__=="__main__":
    unittest.main()
