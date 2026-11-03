"""Supabase Storage adapter for Django's storage API.

Works against the plain Supabase REST API (no extra dependencies beyond
``requests``), which means listing photos can move from local disk to a
Supabase bucket without changing model code.

Activation is automatic: if ``SUPABASE_URL`` and ``SUPABASE_SERVICE_KEY`` are
set, ``default`` file storage uses this class; otherwise Django falls back to
local disk (development).
"""

from __future__ import annotations

import logging
import re
import unicodedata
import uuid
from urllib.parse import quote

import requests
from django.conf import settings
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible

logger = logging.getLogger(__name__)

_SAFE_SEGMENT = re.compile(r"[^A-Za-z0-9._-]+")


def _safe_segment(segment: str) -> str:
    segment = unicodedata.normalize("NFKD", segment).encode("ascii", "ignore").decode()
    segment = segment.strip(".").replace(" ", "_")
    segment = _SAFE_SEGMENT.sub("_", segment)
    return segment or "file"


def _public_base() -> str:
    return settings.SUPABASE_URL.rstrip("/")


def _admin_headers() -> dict[str, str]:
    key = settings.SUPABASE_SERVICE_KEY
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
    }


@deconstructible
class SupabaseStorage(Storage):
    """Simple, deconstructible Supabase Storage implementation."""

    def __init__(self, bucket: str | None = None, path_prefix: str = ""):
        self.bucket = bucket or getattr(settings, "SUPABASE_STORAGE_BUCKET", "listings")
        self.path_prefix = path_prefix.strip("/")

    # -- helpers -----------------------------------------------------------
    def _path(self, name: str) -> str:
        name = name.replace("\\", "/").lstrip("/")
        parts = [_safe_segment(p) for p in name.split("/") if p and p != "."]
        if not parts:
            parts = [uuid.uuid4().hex]
        if self.path_prefix:
            parts.insert(0, self.path_prefix)
        return "/".join(parts)

    def _url_for(self, path: str) -> str:
        base = _public_base()
        return f"{base}/storage/v1/object/public/{self.bucket}/{quote(path, safe='/')}"

    # -- Storage interface -------------------------------------------------
    def _open(self, name, mode="rb"):
        url = f"{_public_base()}/storage/v1/object/{self.bucket}/{quote(name, safe='/')}"
        response = requests.get(url, headers=_admin_headers(), timeout=30)
        response.raise_for_status()
        from django.core.files.base import ContentFile

        return ContentFile(response.content)

    def _save(self, name, content):
        path = self._path(name)
        content_type = getattr(content, "content_type", None) or "application/octet-stream"

        response = requests.post(
            f"{_public_base()}/storage/v1/object/{self.bucket}/{quote(path, safe='/')}",
            headers={**_admin_headers(), "Content-Type": content_type, "x-upsert": "true"},
            data=content.read(),
            timeout=60,
        )
        if response.status_code not in (200, 201):
            logger.error("Supabase upload failed: %s %s", response.status_code, response.text)
            raise OSError(
                f"Supabase Storage upload failed ({response.status_code}). "
                "Check SUPABASE_URL, SUPABASE_SERVICE_KEY and the bucket name."
            )
        return path

    def delete(self, name):
        if not name:
            return
        path = self._path(name)
        requests.delete(
            f"{_public_base()}/storage/v1/object/{self.bucket}/{quote(path, safe='/')}",
            headers=_admin_headers(),
            timeout=30,
        )

    def exists(self, name):
        path = self._path(name)
        response = requests.head(
            f"{_public_base()}/storage/v1/object/{self.bucket}/{quote(path, safe='/')}",
            headers=_admin_headers(),
            timeout=15,
        )
        return response.status_code == 200

    def size(self, name):
        path = self._path(name)
        response = requests.head(
            f"{_public_base()}/storage/v1/object/{self.bucket}/{quote(path, safe='/')}",
            headers=_admin_headers(),
            timeout=15,
        )
        try:
            return int(response.headers.get("Content-Length", 0))
        except (TypeError, ValueError):
            return 0

    def url(self, name):
        return self._url_for(self._path(name))

    def get_available_name(self, name, max_length=None):
        # Name comes from ImageField(upload_to=...); keep it intact but unique.
        if not self.exists(name):
            return name
        stem, dot, ext = name.rpartition(".")
        stem = stem or name
        return f"{stem}-{uuid.uuid4().hex[:8]}{'.' if dot else ''}{ext}"
