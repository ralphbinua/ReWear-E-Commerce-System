import pytest
from rest_framework import status

from apps.catalog.models import Listing
from apps.commerce.models import Offer, PlatformFee
from apps.core.models import Notification

pytestmark = pytest.mark.django_db

OFFERS_URL = "/api/v1/offers/"


def negotiable_listing(user, category, price="1200.00"):
    listing = Listing.objects.create(
        seller=user,
        title="Vintage denim jacket",
        description="Deadstock 90s jacket, no flaws.",
        category=category,
        condition=Listing.Condition.GOOD,
        type=Listing.Type.FIXED,
        price=price,
        is_negotiable=True,
    )
    return listing


def test_buyer_can_make_offer(auth_client, other_client, user, category):
    listing = negotiable_listing(user, category)

    response = other_client.post(
        OFFERS_URL,
        {"listing": str(listing.id), "amount": "950.00", "message": "Can you do 950?"},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED, response.data
    assert response.data["amount"] == "950.00"
    assert response.data["status"] == Offer.Status.PENDING
    assert Notification.objects.filter(user=user, kind="trade_offer").exists()


def test_seller_cannot_offer_on_own_listing(auth_client, user, category):
    listing = negotiable_listing(user, category)

    response = auth_client.post(
        OFFERS_URL,
        {"listing": str(listing.id), "amount": "950.00"},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


def test_offer_must_be_below_asking_price(other_client, user, category):
    listing = negotiable_listing(user, category)

    response = other_client.post(
        OFFERS_URL,
        {"listing": str(listing.id), "amount": "1200.00"},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


def test_duplicate_pending_offer_is_rejected(other_client, user, category):
    listing = negotiable_listing(user, category)
    payload = {"listing": str(listing.id), "amount": "950.00"}

    first = other_client.post(OFFERS_URL, payload, format="json")
    second = other_client.post(OFFERS_URL, payload, format="json")

    assert first.status_code == status.HTTP_201_CREATED
    assert second.status_code == status.HTTP_409_CONFLICT


def test_seller_accept_creates_order(auth_client, other_client, user, other_user, category):
    listing = negotiable_listing(user, category)
    offer = other_client.post(
        OFFERS_URL,
        {"listing": str(listing.id), "amount": "950.00"},
        format="json",
    ).data

    response = auth_client.post(f"{OFFERS_URL}{offer['id']}/accept/", {}, format="json")

    assert response.status_code == status.HTTP_200_OK, response.data
    assert response.data["offer"]["status"] == Offer.Status.ACCEPTED
    order = response.data["order"]
    assert order["item_price"] == "950.00"
    assert order["buyer"] == other_user.id

    listing.refresh_from_db()
    assert listing.status == Listing.Status.SOLD
    assert PlatformFee.objects.filter(order__id=order["id"]).exists()


def test_seller_can_decline_offer(auth_client, other_client, user, category):
    listing = negotiable_listing(user, category)
    offer = other_client.post(
        OFFERS_URL,
        {"listing": str(listing.id), "amount": "950.00"},
        format="json",
    ).data

    response = auth_client.post(f"{OFFERS_URL}{offer['id']}/decline/", {}, format="json")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["status"] == Offer.Status.DECLINED


def test_buyer_can_withdraw_pending_offer(other_client, user, category):
    listing = negotiable_listing(user, category)
    offer = other_client.post(
        OFFERS_URL,
        {"listing": str(listing.id), "amount": "950.00"},
        format="json",
    ).data

    response = other_client.post(f"{OFFERS_URL}{offer['id']}/cancel/", {}, format="json")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["status"] == Offer.Status.CANCELLED


def test_stranger_cannot_see_offer(api_client, other_client, user, category):
    listing = negotiable_listing(user, category)
    offer = other_client.post(
        OFFERS_URL,
        {"listing": str(listing.id), "amount": "950.00"},
        format="json",
    ).data

    response = api_client.get(f"{OFFERS_URL}{offer['id']}/")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
