from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework import status

from apps.accounts.models import User
from apps.auctions.models import Bid
from apps.catalog.models import Listing
from apps.core.models import Notification

pytestmark = pytest.mark.django_db


def make_auction(seller, category, **overrides):
    defaults = {
        "seller": seller,
        "title": "Vintage denim jacket",
        "description": "Deadstock 90s jacket, no flaws.",
        "category": category,
        "condition": Listing.Condition.GOOD,
        "type": Listing.Type.AUCTION,
        "starting_bid": Decimal("500.00"),
        "min_increment": Decimal("50.00"),
        "price": Decimal("500.00"),
        "end_at": timezone.now() + timedelta(days=1),
    }
    defaults.update(overrides)
    return Listing.objects.create(**defaults)


def bid_url(listing):
    return f"/api/v1/listings/{listing.id}/bids/"


def test_first_bid_at_starting_price(other_client, other_user, user, category):
    listing = make_auction(user, category)

    response = other_client.post(bid_url(listing), {"amount": "500.00"}, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["current_bid"] == "500.00"
    assert response.data["minimum_bid"] == "550.00"
    assert response.data["bid_count"] == 1
    assert response.data["extended"] is False
    assert Bid.objects.filter(listing=listing, bidder=other_user).exists()


def test_bid_must_clear_min_increment(other_client, user, category):
    listing = make_auction(user, category)
    Bid.objects.create(listing=listing, bidder=user, amount=Decimal("500.00"))

    response = other_client.post(bid_url(listing), {"amount": "525.00"}, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "550.00" in response.data["detail"]
    assert Bid.objects.filter(listing=listing).count() == 1


def test_seller_cannot_bid_on_own_auction(auth_client, user, category):
    listing = make_auction(user, category)

    response = auth_client.post(bid_url(listing), {"amount": "500.00"}, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "own listing" in response.data["detail"]


def test_cannot_bid_on_fixed_listing(other_client, listing):
    response = other_client.post(bid_url(listing), {"amount": "100.00"}, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "isn't an auction" in response.data["detail"]


def test_cannot_bid_after_auction_ends(other_client, user, category):
    listing = make_auction(user, category, end_at=timezone.now() - timedelta(minutes=1))

    response = other_client.post(bid_url(listing), {"amount": "500.00"}, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "ended" in response.data["detail"].lower()


def test_anonymous_can_read_bid_history(other_client, user, category, api_client):
    listing = make_auction(user, category)
    Bid.objects.create(listing=listing, bidder=user, amount=Decimal("500.00"))

    response = api_client.get(bid_url(listing))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["current_bid"] == "500.00"
    assert response.data["bid_count"] == 1
    assert response.data["bids"][0]["bidder_name"] == "S***r"


def test_bid_history_hides_bidder_identity(other_client, user, category, api_client):
    listing = make_auction(user, category)
    Bid.objects.create(listing=listing, bidder=user, amount=Decimal("500.00"))

    payload = api_client.get(bid_url(listing)).content.decode()

    assert "seller@example.com" not in payload
    assert "Sara" not in payload


def test_anti_snipe_extends_auction_end(other_client, user, category):
    listing = make_auction(user, category, end_at=timezone.now() + timedelta(seconds=60))
    original_end = listing.end_at

    response = other_client.post(bid_url(listing), {"amount": "500.00"}, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["extended"] is True
    listing.refresh_from_db()
    assert listing.end_at > original_end
    assert listing.extended_count == 1


def test_outbid_notification_goes_to_previous_leader(other_client, user, category):
    listing = make_auction(user, category)
    Bid.objects.create(listing=listing, bidder=user, amount=Decimal("500.00"))
    third = User.objects.create_user(email="third@example.com", password="Str0ngPass!23")

    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=third)
    response = client.post(bid_url(listing), {"amount": "550.00"}, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    assert Notification.objects.filter(user=user, kind="outbid").exists()


def test_listing_detail_exposes_live_bid_state(other_client, user, category, api_client):
    listing = make_auction(user, category)
    other_client.post(bid_url(listing), {"amount": "500.00"}, format="json")

    response = api_client.get(f"/api/v1/listings/{listing.id}/")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["current_bid"] == "500.00"
    assert response.data["minimum_bid"] == "550.00"
    assert response.data["is_live"] is True
