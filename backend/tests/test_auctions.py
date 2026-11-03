from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework import status

from apps.auctions.models import AuctionResult, Bid
from apps.auctions.services import close_expired_auctions
from apps.catalog.models import Listing
from apps.commerce.models import Order, PlatformFee
from apps.core.models import Notification

pytestmark = pytest.mark.django_db

CRON_URL = "/api/v1/cron/close-auctions/"


def expired_auction(user, category, **overrides):
    defaults = {
        "seller": user,
        "title": "Vintage camera",
        "description": "Leica M6-ish. With a story.",
        "category": category,
        "condition": Listing.Condition.LIKE_NEW,
        "type": Listing.Type.AUCTION,
        "starting_bid": Decimal("500.00"),
        "reserve_price": Decimal("1000.00"),
        "min_increment": Decimal("50.00"),
        "price": Decimal("500.00"),
        "end_at": timezone.now() - timedelta(hours=1),
    }
    defaults.update(overrides)
    return Listing.objects.create(**defaults)


def test_close_auction_as_sale(user, other_user, category):
    listing = expired_auction(user, category)
    Bid.objects.create(listing=listing, bidder=other_user, amount=Decimal("1200.00"))

    assert close_expired_auctions() == 1

    listing.refresh_from_db()
    assert listing.status == Listing.Status.SOLD

    result = AuctionResult.objects.get(listing=listing)
    assert result.winner == other_user
    assert result.final_amount == Decimal("1200.00")
    assert result.reserve_met is True

    order = Order.objects.get(listing=listing)
    assert order.total == Decimal("1200.00")
    assert order.status == Order.Status.PENDING_PAYMENT
    assert PlatformFee.objects.get(order=order).amount == Decimal("84.00")

    assert Notification.objects.filter(user=other_user, kind="auction_won").exists()


def test_close_auction_below_reserve(user, other_user, category):
    listing = expired_auction(user, category, reserve_price=Decimal("5000.00"))
    Bid.objects.create(listing=listing, bidder=other_user, amount=Decimal("1200.00"))

    assert close_expired_auctions() == 1

    listing.refresh_from_db()
    assert listing.status == Listing.Status.ENDED
    assert AuctionResult.objects.get(listing=listing).reserve_met is False
    assert not Order.objects.filter(listing=listing).exists()
    assert Notification.objects.filter(user=user, kind="auction_lost").exists()


def test_close_auction_with_no_bids(user, category):
    listing = expired_auction(user, category)

    assert close_expired_auctions() == 1

    assert listing.__class__.objects.get(pk=listing.pk).status == Listing.Status.ENDED
    assert not Order.objects.filter(listing=listing).exists()


def test_unexpired_auction_is_untouched(user, category, other_user):
    listing = expired_auction(
        user,
        category,
        end_at=timezone.now() + timedelta(days=2),
    )

    assert close_expired_auctions() == 0
    listing.refresh_from_db()
    assert listing.status == Listing.Status.ACTIVE
    assert not AuctionResult.objects.filter(listing=listing).exists()


def test_close_expired_auctions_is_idempotent(user, other_user, category):
    listing = expired_auction(user, category)
    Bid.objects.create(listing=listing, bidder=other_user, amount=Decimal("1200.00"))

    assert close_expired_auctions() == 1
    assert close_expired_auctions() == 0
    assert Order.objects.filter(listing=listing).count() == 1


def test_cron_endpoint_refuses_when_secret_missing(api_client, settings):
    settings.CRON_SECRET = ""
    response = api_client.get(CRON_URL)
    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE


def test_cron_endpoint_requires_bearer(api_client, settings):
    settings.CRON_SECRET = "s3cr3t"
    assert api_client.get(CRON_URL).status_code == status.HTTP_401_UNAUTHORIZED


def test_cron_endpoint_closes_auctions(api_client, settings, user, other_user, category):
    settings.CRON_SECRET = "s3cr3t"
    listing = expired_auction(user, category)
    Bid.objects.create(listing=listing, bidder=other_user, amount=Decimal("1200.00"))

    response = api_client.get(CRON_URL, HTTP_AUTHORIZATION="Bearer s3cr3t")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["closed_auctions"] == 1
    assert Order.objects.filter(listing=listing).exists()
