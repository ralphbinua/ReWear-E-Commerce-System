from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.catalog.models import Listing
from apps.commerce.models import Order, PlatformFee
from apps.core.services import audit, notify

from .models import AuctionResult, Bid


def close_expired_auctions(now=None):
    """Close every ACTIVE auction whose end time has passed.

    Idempotent: safe to call from a Vercel Cron endpoint every few minutes.
    Returns the number of auctions closed in this run.
    """
    now = now or timezone.now()
    candidates = list(
        Listing.objects.filter(
            type=Listing.Type.AUCTION,
            status=Listing.Status.ACTIVE,
            end_at__lte=now,
        ).values_list("id", flat=True)
    )

    closed = 0
    for listing_id in candidates:
        with transaction.atomic():
            listing = Listing.objects.select_for_update().get(pk=listing_id)
            if listing.status != Listing.Status.ACTIVE:
                continue
            if listing.end_at and listing.end_at > now:
                continue

            bids = list(Bid.objects.filter(listing=listing).order_by("-amount", "created_at"))
            winner_bid = bids[0] if bids else None
            reserve = listing.reserve_price
            reserve_met = winner_bid is not None and (
                reserve is None or winner_bid.amount >= reserve
            )

            if winner_bid and reserve_met:
                _close_as_sale(listing, winner_bid, bids)
            else:
                _close_without_sale(listing, bids, reserve_met=False)
            closed += 1

    return closed


def _close_as_sale(listing, winner_bid, bids):
    item_price = winner_bid.amount
    shipping_fee = Decimal("0.00")
    rate = settings.PLATFORM_FEE_RATE
    platform_fee = (item_price * rate).quantize(Decimal("0.01"))

    listing.status = Listing.Status.SOLD
    listing.save(update_fields=["status", "updated_at"])

    AuctionResult.objects.create(
        listing=listing,
        winner=winner_bid.bidder,
        final_amount=item_price,
        reserve_met=True,
        bid_count=len(bids),
    )

    order = Order.objects.create(
        listing=listing,
        buyer=winner_bid.bidder,
        seller=listing.seller,
        item_price=item_price,
        shipping_fee=shipping_fee,
        platform_fee=platform_fee,
        total=item_price + shipping_fee,
    )
    PlatformFee.objects.create(order=order, rate=rate, amount=platform_fee)

    notify(
        winner_bid.bidder,
        "auction_won",
        "You won the auction!",
        f"{listing.title} — pay via GCash/Maya with order {order.order_number}.",
        f"/orders/{order.id}",
    )
    notify(
        listing.seller,
        "auction_won",
        "Your auction closed",
        f"{listing.title} sold for {item_price}. Waiting for the buyer's payment proof.",
        f"/orders/{order.id}",
    )
    audit(
        None,
        "auction.closed_as_sale",
        "listing",
        listing.id,
        {
            "winner": str(winner_bid.bidder_id),
            "amount": str(item_price),
            "order": order.order_number,
        },
    )


def _close_without_sale(listing, bids, reserve_met):
    listing.status = Listing.Status.ENDED
    listing.save(update_fields=["status", "updated_at"])

    AuctionResult.objects.create(
        listing=listing,
        winner=None,
        final_amount=None,
        reserve_met=False,
        bid_count=len(bids),
    )

    if not bids:
        title = "Auction ended with no bids"
        body = f"{listing.title} ended without any bids. Relist or lower the starting bid."
        kind = "auction_lost"
    else:
        title = "Auction ended below reserve"
        body = (
            f"{listing.title} ended at {bids[0].amount}, below the hidden reserve. "
            "Lower the reserve and relist if you want another shot."
        )
        kind = "auction_lost"

    notify(listing.seller, kind, title, body, f"/listings/{listing.id}")
    audit(
        None,
        "auction.closed_without_sale",
        "listing",
        listing.id,
        {"bid_count": len(bids)},
    )
