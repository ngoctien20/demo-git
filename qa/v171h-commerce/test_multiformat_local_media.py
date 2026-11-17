#!/usr/bin/env python3
"""V17.1H: real encoded raster bytes, generated local fixture pixels only."""
import hashlib
import importlib.util
import io
import unittest
from pathlib import Path

from PIL import Image

spec = importlib.util.spec_from_file_location(
    "v171h", Path(__file__).with_name("multiformat-local-media.py"))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
normalize = mod.normalize_local_media
Denied = mod.MediaDenied

SCOPE = {"tenantId": "T_QA_01", "storeId": "S_QA_A"}
URL = "https://img.shop-example.vn/photo/p-001.webp"
NOW = 1794873600000


def picture(fmt="WEBP", color=(85, 90, 150), size=(24, 24),
            exif=None, mode="RGB"):
    im = Image.new(mode, size, color if mode != "RGBA" else (*color, 180))
    out = io.BytesIO()
    args = {}
    if exif is not None:
        args["exif"] = exif
    im.save(out, format=fmt, **args)
    return out.getvalue()


def context(data=None, fmt="WEBP"):
    if data is None:
        data = picture(fmt)
    reference = {
        **SCOPE, "itemId": "P_A_001", "sku": "QA-F-001",
        "sourceType": "PRODUCTS_IMAGE_URL", "kind": "IMAGE_URL",
        "url": URL, "mediaId": None}
    registry = {**SCOPE, "version": mod.REGISTRY_VERSION,
                "references": [reference], "catalogRevision": 8}
    grant = {
        "source": "MERCHANT_MEDIA_DECLARATION_QA_ONLY", **SCOPE,
        "itemId": "P_A_001", "sku": "QA-F-001", "imageUrl": URL,
        "rightsDeclared": True, "commercialUseConsent": True,
        "metadataMayBeDiscarded": True, "rightsEvidenceRef": "RIGHTS_QA",
        "expectedSha256": hashlib.sha256(data).hexdigest(),
        "reviewedAtMs": NOW - 1000, "expiresAtMs": NOW + 60000}
    mime = {"WEBP": "image/webp", "PNG": "image/png",
            "JPEG": "image/jpeg", "GIF": "image/gif"}[fmt]
    return dict(image_bytes=data, claimed_mime=mime, registry=registry,
                reference=reference, grant=grant, now_ms=NOW)


def run(ctx=None, **overrides):
    return normalize(**(dict(context() if ctx is None else ctx, **overrides)))


class TestMedia(unittest.TestCase):
    def denied(self, code, ctx=None, **overrides):
        with self.assertRaisesRegex(Denied, code):
            run(ctx, **overrides)

    def test_01_real_webp_file_decoded(self):
        r = run()
        self.assertEqual(r["mediaMime"], "image/webp")
        self.assertTrue(r["realRasterDecodePerformed"])
        self.assertEqual(r["pixelCount"], 24 * 24)

    def test_02_real_jpeg_file_decoded(self):
        r = run(context(picture("JPEG"), "JPEG"))
        self.assertEqual(r["mediaMime"], "image/jpeg")

    def test_03_real_png_file_decoded(self):
        r = run(context(picture("PNG"), "PNG"))
        self.assertEqual(r["mediaMime"], "image/png")

    def test_04_real_rgba_webp_converted_into_rgb_descriptor(self):
        r = run(context(picture("WEBP", mode="RGBA")))
        self.assertEqual(len(r["descriptor"]), 16)

    def test_05_spatial_descriptors_reflect_actual_pixel_difference(self):
        a = run(context(picture("PNG", color=(245, 245, 245)), "PNG"))
        b = run(context(picture("PNG", color=(5, 10, 15)), "PNG"))
        self.assertNotEqual(a["descriptor"], b["descriptor"])

    def test_06_output_no_image_bytes_or_private_source_url(self):
        r = run()
        self.assertNotIn("image_bytes", r)
        self.assertNotIn("imageUrl", r)
        self.assertTrue(r["imageMetadataDiscardedFromResult"])

    def test_07_results_cannot_certify_real_photo_rights(self):
        r = run()
        self.assertFalse(r["realMerchantRightsIndependentlyVerified"])
        self.assertFalse(r["merchantPhotoOriginIndependentlyVerified"])

    def test_08_results_cannot_certify_store_ownership(self):
        self.assertFalse(run()["storeOwnershipIndependentlyVerified"])

    def test_09_results_not_semantic_vision_and_cannot_send_order(self):
        r = run()
        self.assertFalse(r["semanticVisionInferencePerformed"])
        self.assertEqual(r["modelCalls"], 0)
        self.assertEqual(r["hostedWrites"], 0)
        self.assertEqual(r["providerSends"], 0)

    def test_10_requires_explicit_customer_sku_and_final_confirm(self):
        r = run()
        self.assertTrue(r["requiresCustomerSkuSelection"])
        self.assertTrue(r["requiresFinalOrderConfirmation"])

    def test_11_wrong_store_reference_denied(self):
        ctx = context()
        ctx["reference"] = {**ctx["reference"], "storeId": "S_QA_B"}
        self.denied("MEDIA_STORE_OR_REFERENCE_SCOPE_DENIED", ctx)

    def test_12_wrong_tenant_registry_denied(self):
        ctx = context()
        ctx["registry"]["tenantId"] = "T_OTHER"
        self.denied("MEDIA_STORE_OR_REFERENCE_SCOPE_DENIED", ctx)

    def test_13_foreign_item_grant_denied(self):
        ctx = context()
        ctx["grant"]["itemId"] = "P_A_002"
        self.denied("MEDIA_RIGHTS_OR_HASH_DECLARATION_MISSING", ctx)

    def test_14_foreign_sku_grant_denied(self):
        ctx = context()
        ctx["grant"]["sku"] = "QA-F-002"
        self.denied("MEDIA_RIGHTS_OR_HASH_DECLARATION_MISSING", ctx)

    def test_15_foreign_store_grant_denied(self):
        ctx = context()
        ctx["grant"]["storeId"] = "S_QA_B"
        self.denied("MEDIA_RIGHTS_OR_HASH_DECLARATION_MISSING", ctx)

    def test_16_media_reference_not_in_catalog_registry_denied(self):
        ctx = context()
        ctx["registry"]["references"] = []
        self.denied("MEDIA_STORE_OR_REFERENCE_SCOPE_DENIED", ctx)

    def test_17_product_page_not_direct_image(self):
        ctx = context()
        ctx["reference"]["kind"] = "PRODUCT_PAGE_URL"
        self.denied("MEDIA_STORE_OR_REFERENCE_SCOPE_DENIED", ctx)

    def test_18_declared_rights_false_denied(self):
        ctx = context()
        ctx["grant"]["rightsDeclared"] = False
        self.denied("MEDIA_RIGHTS_OR_HASH_DECLARATION_MISSING", ctx)

    def test_19_no_commercial_consent_denied(self):
        ctx = context()
        ctx["grant"]["commercialUseConsent"] = False
        self.denied("MEDIA_RIGHTS_OR_HASH_DECLARATION_MISSING", ctx)

    def test_20_metadata_discard_permission_missing_denied(self):
        ctx = context()
        ctx["grant"]["metadataMayBeDiscarded"] = False
        self.denied("MEDIA_RIGHTS_OR_HASH_DECLARATION_MISSING", ctx)

    def test_21_false_signed_receipt_marker_denied(self):
        ctx = context()
        ctx["grant"]["source"] = "INDEPENDENTLY_VERIFIED"
        self.denied("MEDIA_RIGHTS_OR_HASH_DECLARATION_MISSING", ctx)

    def test_22_expired_media_rights_denied(self):
        ctx = context()
        ctx["grant"]["expiresAtMs"] = NOW - 5
        self.denied("MEDIA_RIGHTS_OR_HASH_DECLARATION_MISSING", ctx)

    def test_23_future_rights_review_denied(self):
        ctx = context()
        ctx["grant"]["reviewedAtMs"] = NOW + 5
        self.denied("MEDIA_RIGHTS_OR_HASH_DECLARATION_MISSING", ctx)

    def test_24_overlong_approval_window_denied(self):
        ctx = context()
        ctx["grant"]["expiresAtMs"] = NOW + 172800000
        self.denied("MEDIA_RIGHTS_OR_HASH_DECLARATION_MISSING", ctx)

    def test_25_wrong_media_url_grant_denied(self):
        ctx = context()
        ctx["grant"]["imageUrl"] = "https://other.example/photo.webp"
        self.denied("MEDIA_RIGHTS_OR_HASH_DECLARATION_MISSING", ctx)

    def test_26_wrong_image_sha_denied(self):
        ctx = context()
        ctx["grant"]["expectedSha256"] = "a" * 64
        self.denied("MEDIA_CONTENT_HASH_CHANGED", ctx)

    def test_27_spoofed_mime_jpeg_as_png_denied(self):
        ctx = context(picture("JPEG"), "JPEG")
        ctx["claimed_mime"] = "image/png"
        self.denied("MEDIA_MIME_MAGIC_MISMATCH", ctx)

    def test_28_gif_format_rejected(self):
        self.denied("MEDIA_MIME_NOT_SUPPORTED",
                    context(picture("GIF"), "GIF"))

    def test_29_html_and_svg_payload_denied(self):
        for raw in [b"<html>bad</html>" * 8,
                    b"<svg><script>bad</script></svg>" * 4]:
            self.denied("MEDIA_UNSUPPORTED_OR_SPOOFED_SIGNATURE",
                        context(raw, "PNG"))

    def test_30_truncated_webp_rejected(self):
        data = picture("WEBP", size=(128, 128))
        self.denied("MEDIA_PIXEL_DECODE_REJECTED",
                    context(data[:-15], "WEBP"))

    def test_31_truncated_jpeg_rejected(self):
        data = picture("JPEG")
        self.denied("MEDIA_PIXEL_DECODE_REJECTED",
                    context(data[:100], "JPEG"))

    def test_32_image_dimensions_beyond_limit_rejected(self):
        raw = picture("PNG", size=(1100, 800))
        self.denied("MEDIA_DIMENSIONS_ANIMATION_OR_FORMAT_DENIED",
                    context(raw, "PNG"))

    def test_33_decompression_ratio_bomb_blocked_by_pixel_bounds(self):
        raw = picture("PNG", size=(1024, 1024))
        self.denied("MEDIA_DIMENSIONS_ANIMATION_OR_FORMAT_DENIED",
                    context(raw, "PNG"))

    def test_34_missing_bytes_denied(self):
        self.denied("MEDIA_BYTES_OR_LENGTH_DENIED", image_bytes=b"")

    def test_35_oversized_blob_denied_before_decode(self):
        self.denied("MEDIA_BYTES_OR_LENGTH_DENIED",
                    image_bytes=b"a" * (mod.MAX_BYTES + 1))

    def test_36_forged_image_metadata_never_exposed(self):
        exif = Image.Exif()
        exif[315] = "PRIVATE_MERCHANT_PHOTO_AUTHOR"
        ctx = context(picture("JPEG", exif=exif), "JPEG")
        r = run(ctx)
        self.assertNotIn("PRIVATE_MERCHANT_PHOTO_AUTHOR", str(r))
        self.assertTrue(r["imageMetadataDiscardedFromResult"])

    def test_37_animated_webp_is_rejected(self):
        a = Image.new("RGB", (24, 24), "red")
        b = Image.new("RGB", (24, 24), "blue")
        sink = io.BytesIO()
        a.save(sink, format="WEBP", save_all=True,
               append_images=[b], duration=150, loop=0)
        self.denied("MEDIA_DIMENSIONS_ANIMATION_OR_FORMAT_DENIED",
                    context(sink.getvalue(), "WEBP"))

    def test_38_file_extension_never_trusted_over_mime_magic(self):
        ctx = context()
        ctx["reference"]["url"] = "https://img.shop-example.vn/photo/changed.jpg"
        ctx["grant"]["imageUrl"] = ctx["reference"]["url"]
        self.assertEqual(run(ctx)["mediaMime"], "image/webp")

    def test_39_reference_emitted_by_other_store_not_accepted(self):
        ctx = context()
        ctx["registry"]["storeId"] = "S_OTHER"
        self.denied("MEDIA_STORE_OR_REFERENCE_SCOPE_DENIED", ctx)

    def test_40_does_not_call_live_network_or_provider(self):
        r = run()
        self.assertEqual(r["actualExternalHttpRequests"], 0)
        self.assertFalse(r["readyForRealVisionUat"])


if __name__ == "__main__":
    unittest.main()
