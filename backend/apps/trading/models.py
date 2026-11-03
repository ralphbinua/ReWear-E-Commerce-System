from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.catalog.models import Listing


class TradeOffer(models.Model):
    """Proposer offers one or more of their listings for the target listing."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        DECLINED = "declined", "Declined"
        WITHDRAWN = "withdrawn", "Withdrawn"
        EXPIRED = "expired", "Expired"

    listing = models.ForeignKey(
        Listing, on_delete=models.CASCADE, related_name="trade_offers_received"
    )
    proposer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="trade_offers"
    )
    message = models.CharField(max_length=500, blank=True)
    cash_top_up = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Trade for {self.listing_id}"


class TradeItem(models.Model):
    trade_offer = models.ForeignKey(TradeOffer, on_delete=models.CASCADE, related_name="items")
    listing = models.ForeignKey(
        Listing, on_delete=models.CASCADE, related_name="trade_offers_given"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["trade_offer", "listing"], name="unique_item_per_trade")
        ]

    def __str__(self) -> str:
        return f"{self.trade_offer_id} <- {self.listing_id}"
