#!/usr/bin/env python3
"""TIEN404 V17.1H — bounded REAL JPEG/WebP/PNG local byte normalization.

This processes actual encoded raster bytes through Pillow; it does not retrieve
merchant websites, establish merchant photo rights, call AI, persist images,
prove identity/RLS or authorize Messenger/Zalo responses. All source records
are untrusted pending independent external authority and release approval.
"""
from __future__ import annotations

import hashlib
import io
import re
import warnings
from typing import Any

from PIL import Image, ImageOps, UnidentifiedImageError

VERSION = "T404_V171H_MULTI_FORMAT_LOCAL_MEDIA_V1"
REGISTRY_VERSION = "T404_V171F_SHOP_MEDIA_REFERENCE_REGISTRY_V1"
MAX_BYTES = 2 * 1024 * 1024
MAX_PIXELS = 1024 * 768
MAX_DIMENSION = 1024
FORMATS = {"image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WEBP"}
ID = re.compile(r"^[A-Za-z0-9_-]{2,90}$")
HEX = re.compile(r"^[a-f0-9]{64}$")


class MediaDenied(ValueError):
    """Fail-closed media admission denial; never include media content."""


def deny(code: str):
    raise MediaDenied(code)


def valid_id(value: Any) -> bool:
    return isinstance(value, str) and bool(ID.fullmatch(value))


def valid_sha(value: Any) -> bool:
    return isinstance(value, str) and bool(HEX.fullmatch(value))


def valid_ms(value: Any) -> bool:
    return type(value) is int and 0 < value < 10**15


def detect_mime(data: bytes) -> str:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    deny("MEDIA_UNSUPPORTED_OR_SPOOFED_SIGNATURE")


def validate_media_bindings(registry: dict, reference: dict,
                            grant: dict, now_ms: int) -> None:
    if (not isinstance(registry, dict)
            or registry.get("version") != REGISTRY_VERSION
            or not valid_id(registry.get("tenantId"))
            or not valid_id(registry.get("storeId"))
            or not isinstance(registry.get("references"), list)
            or not isinstance(reference, dict)
            or reference not in registry["references"]
            or reference.get("kind") != "IMAGE_URL"
            or reference.get("sourceType") not in
            {"PRODUCTS_IMAGE_URL", "PRODUCT_MEDIA"}
            or reference.get("tenantId") != registry["tenantId"]
            or reference.get("storeId") != registry["storeId"]
            or not valid_id(reference.get("itemId"))
            or not valid_id(reference.get("sku"))
            or not isinstance(reference.get("url"), str)
            or not reference["url"].startswith("https://")
            or not valid_ms(now_ms)):
        deny("MEDIA_STORE_OR_REFERENCE_SCOPE_DENIED")
    # This is a DECLARATION, not a signature or independent rights authority.
    if (not isinstance(grant, dict)
            or grant.get("source") != "MERCHANT_MEDIA_DECLARATION_QA_ONLY"
            or grant.get("tenantId") != registry["tenantId"]
            or grant.get("storeId") != registry["storeId"]
            or grant.get("itemId") != reference["itemId"]
            or grant.get("sku") != reference["sku"]
            or grant.get("imageUrl") != reference["url"]
            or grant.get("rightsDeclared") is not True
            or grant.get("commercialUseConsent") is not True
            or grant.get("metadataMayBeDiscarded") is not True
            or not valid_id(grant.get("rightsEvidenceRef"))
            or not valid_sha(grant.get("expectedSha256"))
            or not valid_ms(grant.get("reviewedAtMs"))
            or not valid_ms(grant.get("expiresAtMs"))
            or grant["reviewedAtMs"] > now_ms
            or grant["expiresAtMs"] <= now_ms
            or grant["expiresAtMs"] - grant["reviewedAtMs"] > 86400000):
        deny("MEDIA_RIGHTS_OR_HASH_DECLARATION_MISSING")


def descriptor16(rgb: Image.Image) -> list[float]:
    # Ordinary spatial color features — NOT embeddings or semantic AI Vision.
    width, height = rgb.size
    quadrant_sums = [[0.0, 0.0, 0.0, 0.0] for _ in range(4)]
    counts = [0, 0, 0, 0]
    pixels = rgb.load()
    for y in range(height):
        for x in range(width):
            r, g, b = pixels[x, y]
            quadrant = (2 if y >= height / 2 else 0) + (
                1 if x >= width / 2 else 0)
            values = quadrant_sums[quadrant]
            values[0] += r / 255
            values[1] += g / 255
            values[2] += b / 255
            values[3] += (r + g + b < 320)
            counts[quadrant] += 1
    return [round(v / counts[q], 6) for q in range(4)
            for v in quadrant_sums[q]]


def normalize_local_media(image_bytes: bytes, claimed_mime: str,
                          registry: dict, reference: dict, grant: dict,
                          now_ms: int) -> dict:
    """Analyze an already authorized LOCAL byte buffer (never download URL).

    The caller MUST use independent Store/Auth/domain/media rights verification
    before any live deployment. Only metadata, hash and 16D color summary return.
    """
    validate_media_bindings(registry, reference, grant, now_ms)
    if (not isinstance(image_bytes, bytes)
            or not 64 <= len(image_bytes) <= MAX_BYTES):
        deny("MEDIA_BYTES_OR_LENGTH_DENIED")
    if claimed_mime not in FORMATS:
        deny("MEDIA_MIME_NOT_SUPPORTED")
    actual_mime = detect_mime(image_bytes)
    if actual_mime != claimed_mime:
        deny("MEDIA_MIME_MAGIC_MISMATCH")
    sha256 = hashlib.sha256(image_bytes).hexdigest()
    if sha256 != grant["expectedSha256"]:
        deny("MEDIA_CONTENT_HASH_CHANGED")

    try:
        # Bound dimensions before decoding full pixels or loading metadata.
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(image_bytes)) as probe:
                if (probe.format != FORMATS[claimed_mime]
                        or getattr(probe, "n_frames", 1) != 1
                        or probe.width < 4 or probe.height < 4
                        or probe.width > MAX_DIMENSION
                        or probe.height > MAX_DIMENSION
                        or probe.width * probe.height > MAX_PIXELS):
                    deny("MEDIA_DIMENSIONS_ANIMATION_OR_FORMAT_DENIED")
                probe.verify()
            with Image.open(io.BytesIO(image_bytes)) as img:
                img.load()
                if getattr(img, "n_frames", 1) != 1:
                    deny("MEDIA_ANIMATION_DENIED")
                rgb = ImageOps.exif_transpose(img).convert("RGB")
                if (rgb.width * rgb.height > MAX_PIXELS
                        or rgb.width > MAX_DIMENSION
                        or rgb.height > MAX_DIMENSION):
                    deny("MEDIA_TRANSFORM_BOUNDS_DENIED")
                values = descriptor16(rgb)
                width, height = rgb.size
    except MediaDenied:
        raise
    except (OSError, ValueError, SyntaxError, UnidentifiedImageError,
            Image.DecompressionBombError, Image.DecompressionBombWarning):
        deny("MEDIA_PIXEL_DECODE_REJECTED")

    return {
        "version": VERSION,
        "mode": "LOCAL_REAL_RASTER_BYTES_NO_HOSTED_STORAGE",
        "tenantId": registry["tenantId"], "storeId": registry["storeId"],
        "itemId": reference["itemId"], "sku": reference["sku"],
        "mediaMime": actual_mime,
        "sha256": sha256, "width": width, "height": height,
        "pixelCount": width * height, "descriptor": values,
        "rightsEvidenceRef": grant["rightsEvidenceRef"],
        "realRasterDecodePerformed": True,
        "imageMetadataDiscardedFromResult": True,
        "bytesRetainedInOutput": False,
        "merchantPhotoOriginIndependentlyVerified": False,
        "realMerchantRightsIndependentlyVerified": False,
        "storeOwnershipIndependentlyVerified": False,
        "actualMerchantPhotoBenchmarked": False,
        "semanticVisionInferencePerformed": False,
        "providerSends": 0, "hostedWrites": 0,
        "actualExternalHttpRequests": 0, "modelCalls": 0,
        "readyForRealVisionUat": False,
        "requiresCustomerSkuSelection": True,
        "requiresFinalOrderConfirmation": True
    }
