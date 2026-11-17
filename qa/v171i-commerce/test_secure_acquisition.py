"""Offline security tests for V17.1I acquisition. No real DNS or HTTPS."""
import hashlib
import importlib.util
import io
import pathlib
import unittest
from PIL import Image

BASE = pathlib.Path(__file__).resolve().parent
p = importlib.util.spec_from_file_location("acq", BASE / "secure_merchant_fetch.py")
acq = importlib.util.module_from_spec(p)
p.loader.exec_module(acq)
old = importlib.util.spec_from_file_location("raster", BASE.parent / "v171h-commerce" / "multiformat-local-media.py")
raster = importlib.util.module_from_spec(old)
old.loader.exec_module(raster)
NOW = 1794873600000
HOST = "images.shop-example.vn"
URL = "https://images.shop-example.vn/photos/white.jpg"
SCOPE = {"tenantId":"T_QA_01","storeId":"S_QA_A"}

def jpeg():
    out = io.BytesIO()
    Image.new("RGB",(32,32), (120,130,140)).save(out,format="JPEG")
    return out.getvalue()

def fixture():
    reference = {**SCOPE, "kind":"IMAGE_URL",
                 "sourceType":"PRODUCTS_IMAGE_URL", "url":URL,
                 "itemId":"P_A_001","sku":"QA_F_001"}
    registry = {**SCOPE, "version":acq.REF_VERSION,
                "references":[reference]}
    proof = {**SCOPE, "sku":"QA_F_001", "itemId":"P_A_001",
             "imageUrl":URL, "merchantConsent":True,
             "allowedHosts":[HOST], "expiresAtMs":NOW+60000}
    return {"registry":registry, "reference":reference, "proof":proof,
            "owner_authorizer":lambda r,x,p,t: True, "now_ms":NOW,
            "resolver":lambda h:["1.1.1.1","8.8.8.8"],
            "transport":lambda req:("image/jpeg",jpeg())}

def get(**updates):
    return acq.acquire_image(**{**fixture(),**updates})

class FakeResponse:
    def __init__(self,data,headers=None,status=200):
        self.data=data
        self.headers=headers if headers is not None else [("Content-Type","image/jpeg"),("Content-Length",str(len(data)))]
        self.pos=0
        self.status=status
    def getheaders(self):return self.headers
    def read(self,n):
        part=self.data[self.pos:self.pos+n];self.pos+=len(part);return part

class AcquisitionTests(unittest.TestCase):
    def blocked(self, pattern, fn):
        with self.assertRaisesRegex(acq.AcquisitionDenied,pattern):fn()
    def test_01_https_image_host_allowed(self):
        self.assertEqual(acq.validate_url(URL,[HOST]),(HOST,"/photos/white.jpg"))
    def test_02_http_url_denied(self):
        self.blocked("URL_HOST",lambda:acq.validate_url("http://"+HOST+"/p.jpg",[HOST]))
    def test_03_credentials_denied(self):
        self.blocked("URL_HOST",lambda:acq.validate_url("https://u:p@"+HOST+"/a.jpg",[HOST]))
    def test_04_signed_query_url_denied(self):
        self.blocked("URL_HOST",lambda:acq.validate_url(URL+"?token=PRIVATE",[HOST]))
    def test_05_fragment_denied(self):
        self.blocked("URL_HOST",lambda:acq.validate_url(URL+"#anchor",[HOST]))
    def test_06_root_path_denied(self):
        self.blocked("URL_HOST",lambda:acq.validate_url("https://"+HOST+"/",[HOST]))
    def test_07_unapproved_cdn_denied(self):
        self.blocked("URL_HOST",lambda:acq.validate_url(URL,["different.example"]))
    def test_08_local_hostname_denied(self):
        self.blocked("URL_HOST",lambda:acq.validate_url("https://router.local/a.png",["router.local"]))
    def test_09_ip_literal_denied(self):
        self.blocked("URL_HOST",lambda:acq.validate_url("https://127.0.0.1/a.jpg",["127.0.0.1"]))
    def test_10_backslash_url_denied(self):
        self.blocked("URL_INVALID",lambda:acq.validate_url("https://"+HOST+"/x\\a.png",[HOST]))
    def test_11_bad_port_denied(self):
        self.blocked("URL_HOST",lambda:acq.validate_url("https://"+HOST+":444/a.jpg",[HOST]))
    def test_12_ipv4_public_dns_accepted(self):
        self.assertEqual(acq.global_ips(["8.8.8.8","1.1.1.1"]),["1.1.1.1","8.8.8.8"])
    def test_13_private_dns_mixed_good_denied(self):
        self.blocked("DNS_NON_GLOBAL",lambda:acq.global_ips(["1.1.1.1","192.168.1.1"]))
    def test_14_linklocal_metadata_dns_denied(self):
        self.blocked("DNS_NON_GLOBAL",lambda:acq.global_ips(["169.254.169.254"]))
    def test_15_loopback_ipv6_denied(self):
        self.blocked("DNS_NON_GLOBAL",lambda:acq.global_ips(["::1"]))
    def test_16_ipv6_mapped_ipv4_private_denied(self):
        self.blocked("DNS_NON_GLOBAL",lambda:acq.global_ips(["::ffff:127.0.0.1"]))
    def test_17_cgnat_denied(self):
        self.blocked("DNS_NON_GLOBAL",lambda:acq.global_ips(["100.64.1.1"]))
    def test_18_empty_dns_denied(self):
        self.blocked("DNS_EMPTY",lambda:acq.global_ips([]))
    def test_19_many_dns_denied(self):
        self.blocked("DNS_EMPTY",lambda:acq.global_ips(["1.1.1.1"]*17))
    def test_20_bad_dns_address_denied(self):
        self.blocked("DNS_INVALID",lambda:acq.global_ips(["evil-string"]))
    def test_21_no_owner_callback_denied_before_dns(self):
        self.blocked("OWNER",lambda:get(owner_authorizer=None))
    def test_22_owner_authorizer_denies_before_dns(self):
        self.blocked("INDEPENDENT_OWNER",lambda:get(owner_authorizer=lambda *args:False))
    def test_23_store_mismatch_denied(self):
        f=fixture();f["proof"]["storeId"]="S_QA_B"
        self.blocked("OWNER",lambda:acq.acquire_image(**f))
    def test_24_sku_mismatch_denied(self):
        f=fixture();f["proof"]["sku"]="QA_F_002"
        self.blocked("OWNER",lambda:acq.acquire_image(**f))
    def test_25_expired_consent_denied(self):
        f=fixture();f["proof"]["expiresAtMs"]=NOW-1
        self.blocked("OWNER",lambda:acq.acquire_image(**f))
    def test_26_product_page_reference_not_image_denied(self):
        f=fixture();f["reference"]["kind"]="PRODUCT_PAGE_URL"
        self.blocked("OWNER",lambda:acq.acquire_image(**f))
    def test_27_empty_registry_reference_denied(self):
        f=fixture();f["registry"]["references"]=[]
        self.blocked("OWNER",lambda:acq.acquire_image(**f))
    def test_28_rejected_dns_prevents_transport_invocation(self):
        def no_transport(plan):raise AssertionError("transport should not be called")
        self.blocked("DNS_NON_GLOBAL",lambda:get(resolver=lambda h:["127.0.0.1"],transport=no_transport))
    def test_29_pinned_plan_host_and_ip(self):
        seen=[]
        f=fixture()
        def cap(req):
            seen.append(req);return "image/jpeg",jpeg()
        out=acq.acquire_image(**{**f,"transport":cap})
        self.assertEqual(seen[0]["pinnedIp"],"1.1.1.1")
        self.assertEqual(seen[0]["hostname"],HOST)
        self.assertTrue(seen[0]["noProxy"] and seen[0]["noRedirects"] and seen[0]["tlsPeerVerify"])
        self.assertEqual(out["mode"],"QUARANTINE_NO_PROVIDER_NO_STORAGE")
    def test_30_bytes_can_pass_to_old_real_raster_decoder(self):
        f=fixture()
        r=get(**f)
        grant={"source":"MERCHANT_MEDIA_DECLARATION_QA_ONLY",**SCOPE,
               "itemId":"P_A_001","sku":"QA_F_001","imageUrl":URL,
               "rightsDeclared":True,"commercialUseConsent":True,
               "metadataMayBeDiscarded":True,"rightsEvidenceRef":"EVID_QA_1",
               "expectedSha256":r["sha256"],
               "reviewedAtMs":NOW-1000,"expiresAtMs":NOW+20000}
        decoded=raster.normalize_local_media(
            r["bytesForIsolatedDecoderOnly"],r["mime"],
            f["registry"],f["reference"],grant,NOW)
        self.assertEqual(decoded["pixelCount"],32*32)
        self.assertFalse(decoded["readyForRealVisionUat"])
    def test_31_mock_acquired_image_not_verified_rights_or_inference(self):
        r=get()
        self.assertFalse(r["ownerVerifiedByThisModule"])
        self.assertFalse(r["imageLicenseVerifiedByThisModule"])
        self.assertEqual(r["modelCalls"],0)
    def test_32_bad_image_length_denied(self):
        self.blocked("IMAGE_BYTES",lambda:get(transport=lambda p:("image/jpeg",b"hi")))
    def test_33_mime_mismatch_rejected_by_isolated_raster_decoder(self):
        f=fixture()
        out=get(transport=lambda p:("image/png",jpeg()))
        grant={"source":"MERCHANT_MEDIA_DECLARATION_QA_ONLY",**SCOPE,
               "itemId":"P_A_001","sku":"QA_F_001","imageUrl":URL,
               "rightsDeclared":True,"commercialUseConsent":True,
               "metadataMayBeDiscarded":True,"rightsEvidenceRef":"EVID_QA_1",
               "expectedSha256":out["sha256"],
               "reviewedAtMs":NOW-1000,"expiresAtMs":NOW+20000}
        with self.assertRaisesRegex(raster.MediaDenied,"MEDIA_MIME_MAGIC_MISMATCH"):
            raster.normalize_local_media(out["bytesForIsolatedDecoderOnly"],
                                         out["mime"],f["registry"],f["reference"],grant,NOW)
    def test_34_redirect_status_denied(self):
        self.blocked("NON_200",lambda:acq._read_bounded(FakeResponse(b"x"*80,status=302),acq.MAX_IMAGE))
    def test_35_duplicate_content_type_denied(self):
        response=FakeResponse(b"x"*80,[("Content-Type","image/png"),("content-type","image/jpeg")])
        self.blocked("DUPLICATE",lambda:acq._read_bounded(response,acq.MAX_IMAGE))
    def test_36_gzip_content_encoding_denied(self):
        response=FakeResponse(b"x"*80,[("Content-Type","image/png"),("Content-Encoding","gzip")])
        self.blocked("COMPRESSION",lambda:acq._read_bounded(response,acq.MAX_IMAGE))
    def test_37_content_length_too_large_denied(self):
        response=FakeResponse(b"x"*80,[("Content-Type","image/png"),("Content-Length","3000000")])
        self.blocked("CONTENT_LENGTH",lambda:acq._read_bounded(response,acq.MAX_IMAGE))
    def test_38_chunked_plus_content_length_denied(self):
        response=FakeResponse(b"x"*80,[("Content-Type","image/png"),("Content-Length","80"),("Transfer-Encoding","chunked")])
        self.blocked("FRAMING",lambda:acq._read_bounded(response,acq.MAX_IMAGE))
    def test_39_stream_body_cap_denied(self):
        self.blocked("STREAM_BODY_CAP",lambda:acq._read_bounded(FakeResponse(b"x"*101,headers=[("Content-Type","image/png")]),100))
    def test_40_truncated_stream_denied(self):
        response=FakeResponse(b"x"*80,[("Content-Type","image/png"),("Content-Length","81")])
        self.blocked("STREAM_BODY_TRUNCATED",lambda:acq._read_bounded(response,acq.MAX_IMAGE))
    def test_41_disallowed_content_type_denied(self):
        response=FakeResponse(b"<svg>evil</svg>",[("Content-Type","image/svg+xml")])
        self.blocked("MIME_DENIED",lambda:acq._read_bounded(response,acq.MAX_IMAGE))
    def test_42_clean_og_image_candidate_not_automatically_approved(self):
        html=b'<meta property="og:image" content="/photos/front.jpg">'
        r=acq.proposed_page_image("https://shop-example.vn/products/sku-1",html,
                   ["shop-example.vn"],["shop-example.vn"])
        self.assertTrue(r["candidateImageUrl"].endswith("/photos/front.jpg"))
        self.assertFalse(r["skuInferredFromPage"])
        self.assertFalse(r["readyForModel"])
    def test_43_og_image_cross_domain_denied(self):
        html=b'<meta property="og:image" content="https://attacker.example/x.png">'
        self.blocked("URL_HOST",lambda:acq.proposed_page_image(
            "https://shop-example.vn/product/test",html,
            ["shop-example.vn"],["shop-example.vn"]))
    def test_44_multiple_og_images_denied(self):
        html=b'<meta property="og:image" content="/a.png"><meta property="og:image" content="/b.png">'
        self.blocked("HTML_MULTIPLE",lambda:acq.proposed_page_image(
            "https://shop-example.vn/product/test",html,
            ["shop-example.vn"],["shop-example.vn"]))
    def test_45_no_og_image_denied(self):
        self.blocked("HTML_MISSING",lambda:acq.proposed_page_image(
            "https://shop-example.vn/product/test",b"<html>hello</html>",
            ["shop-example.vn"],["shop-example.vn"]))
    def test_46_oversized_html_denied(self):
        self.blocked("HTML_BYTES",lambda:acq.proposed_page_image(
            "https://shop-example.vn/product/test",b"x"*(acq.MAX_HTML+1),
            ["shop-example.vn"],["shop-example.vn"]))

if __name__=="__main__":
    unittest.main()
