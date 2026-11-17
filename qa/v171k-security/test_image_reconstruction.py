#!/usr/bin/env python3
"""V17.1K-S1 offline hostile image test fixtures; synthetic pixels only."""
import hashlib
import importlib.util
import io
import unittest
from pathlib import Path
from PIL import Image

spec=importlib.util.spec_from_file_location(
 "secure",Path(__file__).with_name("image_quarantine_reencode.py"))
secure=importlib.util.module_from_spec(spec)
spec.loader.exec_module(secure)
SCOPE={"tenant_id":"TENANT_A","store_id":"STORE_A","item_id":"ITEM_A","sku":"SKU_A"}
MODE="OFFLINE_DISPOSABLE_SANDBOX_FIXTURE_ONLY"

def image_file(fmt="PNG", size=(24,24),color=(50,80,140),exif=None,mode="RGB"):
 image=Image.new(mode,size,color if mode=="RGB" else (*color,180))
 sink=io.BytesIO()
 args={"exif":exif} if exif is not None else {}
 image.save(sink,format=fmt,**args)
 return sink.getvalue()

def context(data=None,mime="image/png",**overrides):
 if data is None:data=image_file()
 return {"raw_bytes":data,"declared_mime":mime,**SCOPE,
   "expected_sha256":hashlib.sha256(data).hexdigest(),
   "source_kind":"STAFF_UPLOADED_BYTES","workflow_mode":MODE,**overrides}

def run(**overrides):
 return secure.reconstruct_quarantined_image(**context(**overrides))

class HostileMediaTests(unittest.TestCase):
 def denied(self,error,**kwargs):
  with self.assertRaisesRegex(secure.QuarantineDenied,error):
   run(**kwargs)
 def test_01_real_png_reconstructed(self):
  r=run()
  self.assertEqual(r["sanitizedMime"],"image/png")
  self.assertEqual(r["width"],24)
 def test_02_jpeg_reencoded_not_original(self):
  data=image_file("JPEG")
  r=run(data=data,mime="image/jpeg")
  self.assertNotEqual(r["sanitizedBytesForPrivateWorkerOnly"],data)
  self.assertEqual(r["sanitizedMime"],"image/png")
 def test_03_webp_reencoded_png(self):
  data=image_file("WEBP")
  r=run(data=data,mime="image/webp")
  self.assertEqual(r["sanitizedMime"],"image/png")
 def test_04_rgba_alpha_flattened(self):
  data=image_file("PNG",mode="RGBA")
  r=run(data=data)
  with Image.open(io.BytesIO(r["sanitizedBytesForPrivateWorkerOnly"])) as i:
   self.assertEqual(i.mode,"RGB")
 def test_05_exif_author_removed_from_reencoded(self):
  e=Image.Exif()
  e[315]="UNTRUSTED_PRIVATE_AUTHOR_SECRET"
  data=image_file("JPEG",exif=e)
  r=run(data=data,mime="image/jpeg")
  self.assertNotIn(b"UNTRUSTED_PRIVATE_AUTHOR_SECRET",
    r["sanitizedBytesForPrivateWorkerOnly"])
 def test_06_php_style_trailing_content_not_transferred(self):
  data=image_file("PNG")+b"<?php echo SECRET_BACKDOOR_MARKER; ?>"
  r=run(data=data)
  self.assertNotIn(b"SECRET_BACKDOOR_MARKER",
    r["sanitizedBytesForPrivateWorkerOnly"])
 def test_07_original_sha_and_sanitized_sha_differ(self):
  data=image_file("JPEG")
  r=run(data=data,mime="image/jpeg")
  self.assertNotEqual(r["sourceSha256"],r["sanitizedSha256"])
 def test_08_wrong_mime_denied(self):
  self.denied("MIME_MAGIC_MISMATCH",declared_mime="image/jpeg")
 def test_09_svg_markup_denied(self):
  data=(b'<svg><script>alert(1)</script></svg>')*4
  self.denied("MAGIC_INVALID_OR_UNSUPPORTED",data=data)
 def test_10_html_markup_denied(self):
  self.denied("MAGIC_INVALID_OR_UNSUPPORTED",data=b"<html>malicious</html>"*8)
 def test_11_gif_denied(self):
  self.denied("UNSUPPORTED_MIME",data=image_file("GIF"),declared_mime="image/gif")
 def test_12_animated_webp_denied(self):
  a=Image.new("RGB",(24,24),"red")
  b=Image.new("RGB",(24,24),"blue")
  sink=io.BytesIO()
  a.save(sink,format="WEBP",save_all=True,append_images=[b],duration=100)
  self.denied("FRAMES_OR_PIXEL_BOUNDS",data=sink.getvalue(),declared_mime="image/webp")
 def test_13_oversize_bytes_denied_before_decode(self):
  data=image_file()+b"x"*(secure.MAX_INPUT_BYTES+1)
  self.denied("INPUT_BYTES_LIMIT",data=data)
 def test_14_modified_source_hash_denied(self):
  self.denied("SOURCE_HASH_MISMATCH",expected_sha256="a"*64)
 def test_15_bad_tenant_id_denied(self):
  self.denied("STORE_SOURCE_OR_HASH",tenant_id="invalid/tenant")
 def test_16_bad_store_id_denied(self):
  self.denied("STORE_SOURCE_OR_HASH",store_id="..")
 def test_17_bad_sku_denied(self):
  self.denied("STORE_SOURCE_OR_HASH",sku="../../file")
 def test_18_remote_url_source_denied(self):
  self.denied("STORE_SOURCE_OR_HASH",source_kind="REMOTE_IMAGE_URL")
 def test_19_no_verified_sandbox_mode_denied(self):
  self.denied("ISOLATED_SANDBOX",workflow_mode="HOSTED_LIVE")
 def test_20_png_short_magic_invalid_denied(self):
  self.denied("INPUT_BYTES_LIMIT",data=b"\x89PNG\r\n\x1a\n")
 def test_21_bomb_dimensions_denied(self):
  self.denied("FRAMES_OR_PIXEL_BOUNDS",data=image_file(size=(1024,1024)))
 def test_22_width_exceeding_limit_denied(self):
  self.denied("FRAMES_OR_PIXEL_BOUNDS",data=image_file(size=(1100,20)))
 def test_23_tiny_1px_image_denied(self):
  self.denied("FRAMES_OR_PIXEL_BOUNDS",data=image_file(size=(1,1)))
 def test_24_exif_orientation_applied_then_stripped(self):
  ex=Image.Exif()
  ex[274]=6
  data=image_file("JPEG",size=(12,24),exif=ex)
  r=run(data=data,mime="image/jpeg")
  self.assertEqual((r["width"],r["height"]),(24,12))
  with Image.open(io.BytesIO(r["sanitizedBytesForPrivateWorkerOnly"])) as clean:
   self.assertNotIn("exif",clean.info)
 def test_25_truncated_jpeg_denied(self):
  data=image_file("JPEG")
  self.denied("DECODER_REJECTED",data=data[:100],declared_mime="image/jpeg")
 def test_26_no_claim_of_malware_clean_or_hosted_storage(self):
  r=run()
  self.assertFalse(r["antivirusOrMalwareScanIndependentlyVerified"])
  self.assertFalse(r["protectedStorageReceiptVerified"])
  self.assertFalse(r["safeToServePublicly"])
 def test_27_no_network_model_or_sends(self):
  r=run()
  self.assertEqual(r["realNetworkRequests"]+r["hostedWrites"]+r["providerSends"],0)
 def test_28_reconstructed_file_contains_no_original_exif_keys(self):
  ex=Image.Exif()
  ex[270]="GPS_AND_PHONE_PRIVATE_RECORD"
  data=image_file("JPEG",exif=ex)
  r=run(data=data,mime="image/jpeg")
  with Image.open(io.BytesIO(r["sanitizedBytesForPrivateWorkerOnly"])) as clean:
   self.assertEqual(clean.info,{})
 def test_29_png_is_decodable_and_has_no_frames(self):
  r=run()
  with Image.open(io.BytesIO(r["sanitizedBytesForPrivateWorkerOnly"])) as clean:
   clean.verify()
  with Image.open(io.BytesIO(r["sanitizedBytesForPrivateWorkerOnly"])) as clean:
   self.assertEqual(getattr(clean,"n_frames",1),1)
 def test_30_stable_sanitization_of_same_pixels(self):
  self.assertEqual(run()["sanitizedSha256"],run()["sanitizedSha256"])
 def test_31_fake_image_header_with_nonimage_body_rejected(self):
  data=b"\x89PNG\r\n\x1a\n"+b"\x01"*100
  self.denied("DECODER_REJECTED",data=data)

if __name__=="__main__":
 unittest.main()
