"""V17.1I isolated acquisition adapter: pinned IP HTTPS, bounded bytes and no redirects.

This module is NOT connected to n8n or deployed. Real network access is never
performed unless a caller explicitly invokes acquire_image with a trusted
owner authorizer and a reviewed source. Its authorization callback is an
integration boundary, not independent proof supplied by this module.
"""
from __future__ import annotations

import hashlib
import http.client
import ipaddress
import re
import socket
import ssl
from html.parser import HTMLParser
from typing import Callable, Any
from urllib.parse import urlsplit, urljoin

VERSION = "T404_V171I_SECURE_ACQUISITION_CANDIDATE_V1"
REF_VERSION = "T404_V171F_SHOP_MEDIA_REFERENCE_REGISTRY_V1"
MIME = ("image/png", "image/jpeg", "image/webp")
MAX_IMAGE = 2 * 1024 * 1024
MAX_HTML = 256 * 1024
MAX_DNS_ANSWERS = 16
TIMEOUT_SEC = 3.0
ID = re.compile(r"^[A-Za-z0-9_-]{2,90}$")
DOMAIN = re.compile(r"^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$")


class AcquisitionDenied(ValueError):
    pass


def deny(code: str) -> None:
    raise AcquisitionDenied(code)


def host_allowed(host: str, allowed: Any) -> bool:
    if (not isinstance(host, str) or len(host) > 253 or
            not DOMAIN.fullmatch(host) or "." not in host or ".." in host or
            host.endswith((".local", ".internal", ".localhost")) or
            not isinstance(allowed, (tuple, list)) or not 1 <= len(allowed) <= 12 or
            any(not isinstance(h, str) or h != h.lower() or
                not DOMAIN.fullmatch(h) or "." not in h or ".." in h
                for h in allowed) or
            host not in allowed):
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        return True


def validate_url(url: str, hosts: list[str]) -> tuple[str, str]:
    if (not isinstance(url, str) or len(url) > 2048 or len(url) < 12 or
            url != url.strip() or any(ord(ch) < 33 or ord(ch) == 127 for ch in url)
            or chr(92) in url):
        deny("ACQ_URL_INVALID")
    try:
        u = urlsplit(url)
        hostname = u.hostname
        port = u.port
    except ValueError:
        deny("ACQ_URL_INVALID")
    if (u.scheme != "https" or not hostname or hostname != hostname.lower()
            or u.username is not None or u.password is not None
            or u.query or u.fragment or u.path in ("", "/") or
            port not in (None, 443) or
            not host_allowed(hostname, hosts) or
            "@" in u.netloc or "%" in u.netloc or
            any(x in u.path.lower() for x in ("%00", "%0a", "%0d", "%7f"))):
        deny("ACQ_URL_HOST_OR_TOKEN_DENIED")
    return hostname, u.path


def global_ips(addresses: Any) -> list[str]:
    if not isinstance(addresses, (tuple, list)) or not 1 <= len(addresses) <= MAX_DNS_ANSWERS:
        deny("ACQ_DNS_EMPTY_OR_EXCESSIVE")
    normalized: list[str] = []
    for raw in addresses:
        if not isinstance(raw, str):
            deny("ACQ_DNS_INVALID_ADDRESS")
        try:
            addr = ipaddress.ip_address(raw)
        except ValueError:
            deny("ACQ_DNS_INVALID_ADDRESS")
        if (not addr.is_global or addr.is_multicast or
                addr.is_unspecified or addr.is_loopback or
                addr.is_link_local or addr.is_reserved or
                (addr.version == 6 and addr.ipv4_mapped is not None)):
            deny("ACQ_DNS_NON_GLOBAL_OR_PRIVATE_DENIED")
        normalized.append(str(addr))
    return sorted(set(normalized), key=lambda x: (ipaddress.ip_address(x).version, x))


def system_resolve(hostname: str) -> list[str]:
    # No DNS used in CI: tests inject a deterministic offline resolver.
    records = socket.getaddrinfo(hostname, 443, type=socket.SOCK_STREAM)
    return [entry[4][0] for entry in records]


class PinnedHttpsConnection(http.client.HTTPSConnection):
    """Direct socket to validated DNS IP, TLS SNI/certificate on original hostname."""
    def __init__(self, hostname: str, pinned_ip: str, timeout: float):
        context = ssl.create_default_context()
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        super().__init__(hostname, port=443, timeout=timeout, context=context)
        self.pinned_ip = pinned_ip

    def connect(self) -> None:
        # No proxies or CONNECT tunnels are supported by this connector.
        raw = socket.create_connection((self.pinned_ip, 443), timeout=self.timeout)
        try:
            peer = raw.getpeername()[0]
            if ipaddress.ip_address(peer) != ipaddress.ip_address(self.pinned_ip):
                deny("ACQ_CONNECTED_PEER_NOT_PINNED")
            self.sock = self._context.wrap_socket(raw, server_hostname=self.host)
        except BaseException:
            raw.close()
            raise


def pinned_transport(plan: dict):
    conn = PinnedHttpsConnection(plan["hostname"], plan["pinnedIp"], TIMEOUT_SEC)
    try:
        conn.request("GET", plan["path"], headers={
            "Host": plan["hostname"], "Accept": plan["accept"],
            "Accept-Encoding": "identity", "Connection": "close",
            "User-Agent": "TIEN404-MerchantMediaQA/1.0"
        })
        response = conn.getresponse()
        return _read_bounded(response, plan["maxBytes"])
    finally:
        conn.close()


def _headers(response) -> dict[str, str]:
    result = {}
    for name, value in response.getheaders():
        key = name.lower()
        if key in ("content-type", "content-length", "content-encoding",
                   "transfer-encoding", "location") and key in result:
            deny("ACQ_DUPLICATE_UNTRUSTED_HEADER")
        result[key] = value.strip()
    return result


def _read_bounded(response, max_bytes: int) -> tuple[str, bytes]:
    if response.status != 200:
        deny("ACQ_NON_200_OR_REDIRECT_DENIED")
    headers = _headers(response)
    mime = headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if mime not in MIME and mime != "text/html":
        deny("ACQ_MIME_DENIED")
    if headers.get("content-encoding", "identity").lower() != "identity":
        deny("ACQ_COMPRESSION_DENIED")
    if headers.get("location"):
        deny("ACQ_REDIRECT_HEADER_DENIED")
    if headers.get("transfer-encoding", "").lower() not in ("", "chunked"):
        deny("ACQ_TRANSFER_ENCODING_DENIED")
    raw_length = headers.get("content-length")
    if raw_length is not None:
        if not raw_length.isdecimal() or int(raw_length) > max_bytes:
            deny("ACQ_CONTENT_LENGTH_DENIED")
        if headers.get("transfer-encoding"):
            deny("ACQ_FRAMING_CONFLICT_DENIED")
    data = bytearray()
    while True:
        part = response.read(min(65536, max_bytes + 1 - len(data)))
        if not isinstance(part, bytes):
            deny("ACQ_RESPONSE_BYTES_INVALID")
        if not part:
            break
        data.extend(part)
        if len(data) > max_bytes:
            deny("ACQ_STREAM_BODY_CAP_EXCEEDED")
    if not data or (raw_length is not None and len(data) != int(raw_length)):
        deny("ACQ_STREAM_BODY_TRUNCATED")
    return mime, bytes(data)


def authorize_reference(registry: dict, reference: dict, proof: dict,
                        owner_authorizer: Callable, now_ms: int) -> list[str]:
    if (not isinstance(registry, dict) or
        registry.get("version") != REF_VERSION or
        not isinstance(registry.get("references"), list) or
        not isinstance(reference, dict) or reference not in registry["references"] or
        reference.get("kind") != "IMAGE_URL" or
        reference.get("sourceType") not in ("PRODUCTS_IMAGE_URL", "PRODUCT_MEDIA") or
        reference.get("tenantId") != registry.get("tenantId") or
        reference.get("storeId") != registry.get("storeId") or
        not isinstance(reference.get("sku"), str) or
        not ID.fullmatch(reference["sku"]) or
        not isinstance(reference.get("itemId"), str) or
        not ID.fullmatch(reference["itemId"]) or
        not isinstance(proof, dict) or
        proof.get("tenantId") != registry["tenantId"] or
        proof.get("storeId") != registry["storeId"] or
        proof.get("sku") != reference["sku"] or
        proof.get("itemId") != reference["itemId"] or
        proof.get("imageUrl") != reference.get("url") or
        proof.get("merchantConsent") is not True or
        not isinstance(proof.get("allowedHosts"), list) or
        type(now_ms) is not int or now_ms <= 0 or
        type(proof.get("expiresAtMs")) is not int or
        proof["expiresAtMs"] <= now_ms or
        proof["expiresAtMs"] - now_ms > 3600_000 or
        not callable(owner_authorizer)):
        deny("ACQ_OWNER_STORE_OR_RIGHTS_AUTHORITY_MISSING")
    # NEVER accept a caller-provided proof as signed authorization.
    # Hosting service must implement real owner/domain/media permission checks.
    if owner_authorizer(registry, reference, proof, now_ms) is not True:
        deny("ACQ_INDEPENDENT_OWNER_AUTHORIZATION_DENIED")
    return proof["allowedHosts"]


def acquire_image(registry: dict, reference: dict, proof: dict,
                  owner_authorizer: Callable, now_ms: int,
                  resolver: Callable = system_resolve,
                  transport: Callable = pinned_transport) -> dict:
    """Acquire one known Store-image. No call sites in published workflows."""
    allowed_hosts = authorize_reference(
        registry, reference, proof, owner_authorizer, now_ms)
    hostname, path = validate_url(reference["url"], allowed_hosts)
    if not callable(resolver) or not callable(transport):
        deny("ACQ_TRANSPORT_NOT_AVAILABLE")
    ips = global_ips(resolver(hostname))
    chosen = ips[0]
    plan = {"hostname": hostname, "path": path,
            "pinnedIp": chosen, "accept": ", ".join(MIME),
            "maxBytes": MAX_IMAGE, "timeoutSeconds": TIMEOUT_SEC,
            "noProxy": True, "noRedirects": True, "tlsPeerVerify": True}
    mime, payload = transport(plan)
    if mime not in MIME or not isinstance(payload, bytes) or not 64 <= len(payload) <= MAX_IMAGE:
        deny("ACQ_IMAGE_BYTES_MIME_INVALID")
    # actual raster signature/pixels are validated by V17.1H, not a URL suffix.
    return {
        "version": VERSION, "mode": "QUARANTINE_NO_PROVIDER_NO_STORAGE",
        "tenantId": registry["tenantId"], "storeId": registry["storeId"],
        "itemId": reference["itemId"], "sku": reference["sku"],
        "mime": mime, "sha256": hashlib.sha256(payload).hexdigest(),
        "byteLength": len(payload),
        "bytesForIsolatedDecoderOnly": payload,
        "ownerVerifiedByThisModule": False,
        "shopDomainVerifiedByThisModule": False,
        "imageLicenseVerifiedByThisModule": False,
        "modelCalls": 0, "providerSends": 0, "hostedWrites": 0,
        "readyForVisionBenchmark": False
    }


class ImageMetaParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.images = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "meta":
            return
        values = dict((k.lower(), v) for k, v in attrs if k and isinstance(v, str))
        if values.get("property", "").lower() in ("og:image", "og:image:secure_url"):
            if values.get("content"):
                self.images.append(values["content"])


def proposed_page_image(page_url: str, html_bytes: bytes,
                        allowed_page_hosts: list[str],
                        allowed_image_hosts: list[str]) -> dict:
    """Untrusted HTML candidate: NEVER promote image/sku to trusted catalog."""
    validate_url(page_url, allowed_page_hosts)
    if not isinstance(html_bytes, bytes) or not 1 <= len(html_bytes) <= MAX_HTML:
        deny("ACQ_HTML_BYTES_INVALID")
    try:
        html = html_bytes.decode("utf-8", errors="strict")
        parser = ImageMetaParser()
        parser.feed(html)
    except (UnicodeDecodeError, ValueError):
        deny("ACQ_HTML_PARSE_DENIED")
    if not parser.images or len(parser.images) > 8:
        deny("ACQ_HTML_MISSING_OR_AMBIGUOUS_IMAGE")
    candidates = []
    for image in parser.images:
        absolute = urljoin(page_url, image)
        validate_url(absolute, allowed_image_hosts)
        if absolute not in candidates:
            candidates.append(absolute)
    if len(candidates) != 1:
        deny("ACQ_HTML_MULTIPLE_OG_IMAGE_CHOICES")
    return {
        "status": "PAGE_IMAGE_CANDIDATE_REQUIRES_INDEPENDENT_SKU_REVIEW",
        "candidateImageUrl": candidates[0],
        "sourcePage": page_url,
        "skuInferredFromPage": False,
        "readyForModel": False,
        "modelCalls": 0, "hostedWrites": 0, "providerSends": 0
    }
