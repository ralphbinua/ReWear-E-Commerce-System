import io
from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image
from rest_framework import status

from apps.catalog.models import Listing

pytestmark = pytest.mark.django_db

LISTINGS_URL = "/api/v1/listings/"


def make_listing_payload(category, **overrides):
    payload = {
        "title": "Levi's 501 jeans",
        "description": "Mid-wash, straight leg, no rips.",
        "category": category.id,
        "condition": "good",
        "type": "fixed",
        "price": "950.00",
    }
    payload.update(overrides)
    return payload


def test_browse_is_public_and_hides_drafts(api_client, listing):
    draft = Listing.objects.create(
        seller=listing.seller,
        title="Secret draft",
        description="Not ready",
        category=listing.category,
        condition=Listing.Condition.GOOD,
        status=Listing.Status.DRAFT,
        price="10.00",
    )

    response = api_client.get(LISTINGS_URL)

    assert response.status_code == status.HTTP_200_OK
    ids = [row["id"] for row in response.data["results"]]
    assert str(listing.id) in ids
    assert str(draft.id) not in ids


def test_sold_listing_detail_stays_visible(auth_client, other_client, api_client, listing):
    listing.status = Listing.Status.SOLD
    listing.save(update_fields=["status"])

    # The buyer and anonymous visitors can still open a sold item.
    assert other_client.get(f"{LISTINGS_URL}{listing.id}/").status_code == status.HTTP_200_OK
    assert api_client.get(f"{LISTINGS_URL}{listing.id}/").status_code == status.HTTP_200_OK
    assert auth_client.get(f"{LISTINGS_URL}{listing.id}/").status_code == status.HTTP_200_OK


def test_draft_listing_detail_stays_private(auth_client, other_client, listing):
    listing.status = Listing.Status.DRAFT
    listing.save(update_fields=["status"])

    assert (
        other_client.get(f"{LISTINGS_URL}{listing.id}/").status_code
        == status.HTTP_404_NOT_FOUND
    )
    assert auth_client.get(f"{LISTINGS_URL}{listing.id}/").status_code == status.HTTP_200_OK


def test_create_requires_authentication(api_client, category):
    response = api_client.post(LISTINGS_URL, make_listing_payload(category), format="json")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_create_sets_seller_and_auto_approves_in_dev(auth_client, user, category):
    response = auth_client.post(LISTINGS_URL, make_listing_payload(category), format="json")

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["status"] == Listing.Status.ACTIVE
    created = Listing.objects.get(id=response.data["id"])
    assert created.seller == user
    assert created.slug


def test_create_fixed_listing_accepts_null_auction_fields(auth_client, category):
    """The Sell form always sends auction fields, using null for fixed listings."""
    response = auth_client.post(
        LISTINGS_URL,
        make_listing_payload(
            category,
            starting_bid=None,
            reserve_price=None,
            min_increment=None,
            end_at=None,
        ),
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED, response.data
    created = Listing.objects.get(id=response.data["id"])
    assert created.type == Listing.Type.FIXED
    assert created.min_increment == Listing._meta.get_field("min_increment").get_default()


def test_fixed_price_requires_positive_price(auth_client, category):
    response = auth_client.post(
        LISTINGS_URL,
        make_listing_payload(category, price="0.00"),
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "price" in response.data


def test_auction_requires_starting_bid_and_end_time(auth_client, category):
    response = auth_client.post(
        LISTINGS_URL,
        make_listing_payload(category, type="auction", price="0.00"),
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "starting_bid" in response.data
    assert "end_at" in response.data


def test_auction_creation(auth_client, category):
    response = auth_client.post(
        LISTINGS_URL,
        make_listing_payload(
            category,
            type="auction",
            starting_bid="500.00",
            min_increment="50.00",
            end_at=(timezone.now() + timedelta(days=3)).isoformat(),
        ),
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["type"] == "auction"
    assert response.data["price"] == "500.00"


def test_filter_by_type(api_client, listing, user, category):
    Listing.objects.create(
        seller=user,
        title="Auction piece",
        description="Rare",
        category=category,
        condition=Listing.Condition.LIKE_NEW,
        type=Listing.Type.AUCTION,
        starting_bid="100.00",
        price="100.00",
        end_at=timezone.now() + timedelta(days=1),
    )

    response = api_client.get(LISTINGS_URL, {"type": "auction"})

    assert response.status_code == status.HTTP_200_OK
    assert response.data["count"] == 1


def test_non_owner_cannot_update(api_client, listing, other_user):
    api_client.force_authenticate(user=other_user)

    response = api_client.patch(
        f"{LISTINGS_URL}{listing.id}/", {"title": "Hijacked"}, format="json"
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_owner_can_update(auth_client, listing):
    response = auth_client.patch(
        f"{LISTINGS_URL}{listing.id}/",
        {"title": "Levi's 501 — rare", "price": "1100.00"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    listing.refresh_from_db()
    assert listing.price == 1100
    assert listing.title == "Levi's 501 — rare"


def test_mine_only_returns_own_listings(auth_client, listing, other_user, category):
    Listing.objects.create(
        seller=other_user,
        title="Someone else's coat",
        description="Wool",
        category=category,
        condition=Listing.Condition.GOOD,
        price="800.00",
    )

    response = auth_client.get(f"{LISTINGS_URL}mine/")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == str(listing.id)


def test_image_upload(auth_client, listing):
    buffer = io.BytesIO()
    Image.new("RGB", (8, 8), (76, 122, 52)).save(buffer, format="PNG")
    buffer.seek(0)
    upload = SimpleUploadedFile("jacket.png", buffer.read(), content_type="image/png")

    response = auth_client.post(
        f"{LISTINGS_URL}{listing.id}/images/",
        {"image": upload},
        format="multipart",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["is_primary"] is True
    assert listing.images.count() == 1


def test_toggle_watch(auth_client, listing, other_user):
    url = f"{LISTINGS_URL}{listing.id}/watch/"

    first = auth_client.post(url)
    assert first.status_code == status.HTTP_200_OK
    assert first.data["watching"] is True

    second = auth_client.post(url)
    assert second.data["watching"] is False


def test_categories_are_public(api_client, category):
    response = api_client.get("/api/v1/categories/")

    assert response.status_code == status.HTTP_200_OK
    assert response.data[0]["name"] == "Tops"
