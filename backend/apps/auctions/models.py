from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.catalog.models import Listing


class Bid(models.Model):
    """An immutable bid. Corrections are new bids, never edits."""

    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="bids")
    bidder = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bids"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-amount", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["listing", "amount"], name="unique_bid_amount_per_listing"
            )
        ]
        indexes = [models.Index(fields=["listing", "-amount"])]

    def __str__(self) -> str:
        return f"{self.amount} on {self.listing_id} by {self.bidder_id}"


class AuctionResult(models.Model):
    listing = models.OneToOneField(Listing, on_delete=models.CASCADE, related_name="auction_result")
    winner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="auctions_won",
    )
    final_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    reserve_met = models.BooleanField(default=False)
    bid_count = models.PositiveIntegerField(default=0)
    closed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-closed_at"]

    def __str__(self) -> str:
        return f"Result for {self.listing_id}"

    @property
    def is_sold(self) -> bool:
        return self.winner_id is not None and self.final_amount is not None
