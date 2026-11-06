"""Serializers for the auction bid API."""

from decimal import Decimal

from rest_framework import serializers

from .models import Bid
from .services import minimum_bid, top_bid


def mask_name(name: str | None) -> str:
    """Public bid history shows partial names only (``r***a``)."""
    name = (name or "Bidder").strip()
    if len(name) <= 2:
        return f"{name[:1]}***"
    return f"{name[0]}***{name[-1]}"


class BidSerializer(serializers.ModelSerializer):
    bidder_name = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = Bid
        fields = ("id", "amount", "bidder_name", "is_mine", "created_at")

    def get_bidder_name(self, obj):
        return mask_name(obj.bidder.display_name)

    def get_is_mine(self, obj):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and request.user.id == obj.bidder_id)


class BidCreateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)

    def validate_amount(self, value: Decimal) -> Decimal:
        if value <= 0:
            raise serializers.ValidationError("Enter a bid above zero.")
        return value


class AuctionStateSerializer(serializers.Serializer):
    """Everything the listing page needs to render and place a bid."""

    current_bid = serializers.SerializerMethodField()
    minimum_bid = serializers.SerializerMethodField()
    min_increment = serializers.DecimalField(max_digits=10, decimal_places=2)
    bid_count = serializers.SerializerMethodField()
    is_live = serializers.BooleanField(source="is_auction_live", read_only=True)
    end_at = serializers.DateTimeField()
    extended_count = serializers.IntegerField()
    bids = serializers.SerializerMethodField()

    def get_current_bid(self, obj):
        highest = top_bid(obj)
        amount = highest.amount if highest is not None else obj.starting_bid
        return str(amount) if amount is not None else None

    def get_minimum_bid(self, obj):
        return str(minimum_bid(obj))

    def get_bid_count(self, obj):
        return obj.bids.count()

    def get_bids(self, obj):
        recent = obj.bids.select_related("bidder").order_by("-amount", "-created_at")[:50]
        return BidSerializer(recent, many=True, context=self.context).data
