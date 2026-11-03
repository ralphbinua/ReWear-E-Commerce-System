from __future__ import annotations

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalog.models import Category, Listing


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture(autouse=True)
def isolated_media_root(settings, tmp_path):
    """Keep test uploads out of the working tree."""
    settings.MEDIA_ROOT = tmp_path / "media"
    return settings.MEDIA_ROOT


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def user(db) -> User:
    return User.objects.create_user(
        email="seller@example.com",
        password="Str0ngPass!23",
        first_name="Sara",
        last_name="Seller",
    )


@pytest.fixture
def other_user(db) -> User:
    return User.objects.create_user(
        email="buyer@example.com",
        password="Str0ngPass!23",
        first_name="Ben",
        last_name="Buyer",
    )


@pytest.fixture
def auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def other_client(other_user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=other_user)
    return client


@pytest.fixture
def category(db) -> Category:
    return Category.objects.create(name="Tops")


@pytest.fixture
def listing(db, user, category) -> Listing:
    return Listing.objects.create(
        seller=user,
        title="Vintage denim jacket",
        description="Deadstock 90s jacket, no flaws.",
        category=category,
        condition=Listing.Condition.GOOD,
        type=Listing.Type.FIXED,
        price="1200.00",
    )
