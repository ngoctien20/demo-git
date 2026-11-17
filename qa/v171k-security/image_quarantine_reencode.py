#!/usr/bin/env python3
"""TIEN404 V17.1K-S1: untrusted image byte reconstruction, OFFLINE source-only.

IMPORTANT: run only in an externally isolated disposable worker with no
network, secrets, shared file system, or hosted DB access. A decoder can have
security bugs even when bounds are checked. This module is NOT the worker.
Never call with untrusted customer/merchant data on the n8n server.
"""
from __future__ import annotations
import hashlib
import io
import re
import warnings
from PIL import Image, ImageOps, UnidentifiedImageError

VERSION = "T404_V171K_S1_UNTRUSTED_IMAGE_RECONSTRUCTION_V1"
MAX_INPUT_BYTES = 2 * 1024 * 1024
MAX_OUTPUT_BYTES = 4 * 1024 * 1024
MAX_PIXELS = 1024 * 768
MAX_EDGE = 1024
FORMATS = {"image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WEBP"}
ID = re.compile(r"^[A-Za-z0-9_-]{2,90}$")
HEX = re.compile(r"^[a-f0-9]{64}$")


class QuarantineDenied(ValueError):
    """No raw input, filenames or URLs in exception messages."""


def deny(code):
    raise QuarantineDenied(code)


def valid_id(x):
    return isinstance(x, str) and bool(ID.fullmatch(x))


def mime_from_magic(data):
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(data) >= 3 and data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    deny("IMAGE_MAGIC_INVALID_OR_UNSUPPORTED")


def reconstruct_quarantined_image(*, raw_bytes, declared_mime,
                                   tenant_id, store_id, item_id, sku,
                                   expected_sha256, source_kind,
                                   workflow_mode):
    """Decode, strip all source metadata, and re-encode pixel-only PNG.

    Output sanitized_bytes only to PRIVATE quarantine storage, NEVER an
    in-app preview/attachment/LLM/webhook. Actual sandbox isolation, malware
    scanning, Store authorization and upload-intent verification must be done
    by an independently audited backend before/after this call.
    """
    if workflow_mode != "OFFLINE_DISPOSABLE_SANDBOX_FIXTURE_ONLY":
        deny("ISOLATED_SANDBOX_NOT_VERIFIED")
    if (not all(valid_id(x) for x in [tenant_id, store_id, item_id, sku])
            or source_kind not in ("STAFF_UPLOADED_BYTES",
                                   "MERCHANT_PROVIDED_FILE")
            or not isinstance(expected_sha256, str)
            or not HEX.fullmatch(expected_sha256)):
        deny("QUARANTINE_STORE_SOURCE_OR_HASH_INVALID")
    if not isinstance(raw_bytes, bytes):
        deny("QUARANTINE_BYTES_REQUIRED")
    if not 64 <= len(raw_bytes) <= MAX_INPUT_BYTES:
        deny("QUARANTINE_INPUT_BYTES_LIMIT")
    if declared_mime not in FORMATS:
        deny("QUARANTINE_UNSUPPORTED_MIME")
    if mime_from_magic(raw_bytes) != declared_mime:
        deny("QUARANTINE_MIME_MAGIC_MISMATCH")
    raw_sha = hashlib.sha256(raw_bytes).hexdigest()
    if raw_sha != expected_sha256:
        deny("QUARANTINE_SOURCE_HASH_MISMATCH")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw_bytes)) as probe:
                if (probe.format != FORMATS[declared_mime]
                        or getattr(probe, "n_frames", 1) != 1
                        or probe.width < 4 or probe.height < 4
                        or probe.width > MAX_EDGE or probe.height > MAX_EDGE
                        or probe.width * probe.height > MAX_PIXELS):
                    deny("QUARANTINE_FORMAT_FRAMES_OR_PIXEL_BOUNDS")
                probe.verify()
            with Image.open(io.BytesIO(raw_bytes)) as image:
                if getattr(image, "n_frames", 1) != 1:
                    deny("QUARANTINE_ANIMATED_IMAGE_REFUSED")
                image.load()
                oriented = ImageOps.exif_transpose(image)
                if (oriented.width > MAX_EDGE or oriented.height > MAX_EDGE
                        or oriented.width * oriented.height > MAX_PIXELS):
                    deny("QUARANTINE_POST_ORIENTATION_PIXEL_BOUNDS")
                if "A" in oriented.getbands() or "transparency" in oriented.info:
                    rgba = oriented.convert("RGBA")
                    clean = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
                    clean.alpha_composite(rgba)
                    clean = clean.convert("RGB")
                else:
                    clean = oriented.convert("RGB")
                # Recreate a brand-new pixel-only image; never copy EXIF,
                # comments, ICC chunks, text metadata, or filename.
                flat = Image.new("RGB", clean.size)
                flat.paste(clean)
                out = io.BytesIO()
                flat.save(out, format="PNG", optimize=False, compress_level=6)
                sanitized = out.getvalue()
                width, height = flat.size
    except QuarantineDenied:
        raise
    except (OSError, ValueError, SyntaxError, UnidentifiedImageError,
            Image.DecompressionBombError, Image.DecompressionBombWarning):
        deny("QUARANTINE_DECODER_REJECTED")
    if not 64 <= len(sanitized) <= MAX_OUTPUT_BYTES:
        deny("QUARANTINE_REENCODE_OUTPUT_LIMIT")
    return {
        "version": VERSION,
        "mode": "OFFLINE_SANITIZED_FILE_QUARANTINE_ONLY",
        "tenantId": tenant_id, "storeId": store_id,
        "itemId": item_id, "sku": sku,
        "sourceSha256": raw_sha,
        "sanitizedSha256": hashlib.sha256(sanitized).hexdigest(),
        "sanitizedMime": "image/png",
        "width": width, "height": height,
        "sanitizedByteCount": len(sanitized),
        # This field is a private worker-to-quarantine payload; do not
        # serialize to JSON, logs, workflow nodes, Sheets, or any public API.
        "sanitizedBytesForPrivateWorkerOnly": sanitized,
        "originalBytesInOutput": False,
        "sourceMetadataPropagated": False,
        "sandboxIsolationIndependentlyVerified": False,
        "antivirusOrMalwareScanIndependentlyVerified": False,
        "independentStoreAuthorizationVerified": False,
        "merchantLicenseVerified": False,
        "protectedStorageReceiptVerified": False,
        "safeToServePublicly": False,
        "readyForModelVision": False,
        "realNetworkRequests": 0,
        "hostedWrites": 0,
        "providerSends": 0,
    }
