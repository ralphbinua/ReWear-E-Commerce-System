from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.catalog.models import Listing
from apps.commerce.models import Order, PlatformFee
from apps.core.services import audit, notify

from .models import AuctionResult, Bid

# Anti-snipe: a bid inside the last two minutes moves the end time forward.
ANTI_SNIPE_WINDOW = timedelta(seconds=120)
ANTI_SNIPE_EXTENSION = timedelta(seconds=120)
MAX_AUCTION_EXTENSIONS = 15  # 15 x 2 min = at most 30 extra minutes
CENT = Decimal("0.01")


class BidError(Exception):
    """A bid the auction rules reject. Rendered as HTTP 400 by the view."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def top_bid(listing):
    """Highest bid on a listing, or None. Expects listing to be locked if writing."""
    return listing.bids.order_by("-amount", "-created_at").first()


def minimum_bid(listing):
    """Smallest amount the next bidder may offer."""
    highest = top_bid(listing)
    if highest is not None:
        increment = listing.min_increment or Decimal("0.00")
        return (highest.amount + increment).quantize(CENT)
    start = listing.starting_bid or Decimal("0.00")
    return start.quantize(CENT)


def place_bid(listing, bidder, amount: Decimal):
    """Validate and store one bid, serialized against concurrent bidders.

    Returns ``(bid, listing, extended)`` where ``extended`` says whether the
    anti-snipe rule pushed the auction's end time.
    """
    amount = Decimal(amount).quantize(CENT)

    with transaction.atomic():
        listing = Listing.objects.select_for_update().get(pk=listing.pk)
        now = timezone.now()

        if listing.type != Listing.Type.AUCTION:
            raise BidError("This listing isn't an auction.")
        if listing.status != Listing.Status.ACTIVE:
            raise BidError("This auction is no longer active.")
        if not listing.end_at or listing.end_at <= now:
            raise BidError("This auction has ended.")
        if listing.start_at and listing.start_at > now:
            raise BidError("This auction hasn't started yet.")
        if listing.seller_id == bidder.id:
            raise BidError("You can't bid on your own listing.")
        if amount <= 0:
            raise BidError("Enter a bid above zero.")

        highest = top_bid(listing)
        required = minimum_bid(listing)
        if amount < required:
            raise BidError(f"The minimum bid is ₱{required:,.2f}.")
        if listing.bids.filter(amount=amount).exists():
            raise BidError("Someone already bid that exact amount. Try a higher amount.")

        bid = Bid.objects.create(listing=listing, bidder=bidder, amount=amount)

        # Anti-snipe: extend only while the cap allows, otherwise let it end.
        extended = False
        if (
            listing.end_at - now <= ANTI_SNIPE_WINDOW
            and listing.extended_count < MAX_AUCTION_EXTENSIONS
        ):
            listing.end_at = now + ANTI_SNIPE_EXTENSION
            listing.extended_count += 1
            extended = True

        # Keep the denormalized price in step with the live bid for browse/sort.
        listing.price = amount
        update_fields = ["price", "updated_at"]
        if extended:
            update_fields += ["end_at", "extended_count"]
        listing.save(update_fields=update_fields)

        if highest is not None and highest.bidder_id != bidder.id:
            notify(
                highest.bidder,
                "outbid",
                "You've been outbid",
                f"{listing.title} is now at ₱{amount:,.2f}. Bid again to stay in front.",
                f"/listing/{listing.id}",
            )

        audit(
            bidder,
            "auction.bid_placed",
            "listing",
            listing.id,
            {"amount": str(amount), "extended": extended},
        )

        return bid, listing, extended


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
