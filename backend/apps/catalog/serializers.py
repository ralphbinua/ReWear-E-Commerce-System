from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from apps.accounts.serializers import UserSummarySerializer

from .models import Brand, Category, Listing, ListingImage, Size


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "slug", "parent", "order")


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ("id", "name", "slug")


class SizeSerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)

    class Meta:
        model = Size
        fields = ("id", "kind", "kind_label", "name", "order")


class ListingImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListingImage
        fields = ("id", "image", "alt_text", "position", "is_primary")
        read_only_fields = ("id",)


class ListingListSerializer(serializers.ModelSerializer):
    cover_image = serializers.SerializerMethodField()
    category_name = serializers.CharField(source="category.name", read_only=True)
    brand_name = serializers.CharField(source="brand.name", read_only=True, default=None)
    seller = UserSummarySerializer(read_only=True)
    bid_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Listing
        fields = (
            "id",
            "title",
            "slug",
            "type",
            "status",
            "price",
            "condition",
            "audience",
            "category_name",
            "brand_name",
            "seller",
            "cover_image",
            "bid_count",
            "end_at",
            "created_at",
        )

    def get_cover_image(self, obj):
        image = next(iter(obj.images.all()), None)
        if image is None:
            return None
        request = self.context.get("request")
        url = image.image.url
        return request.build_absolute_uri(url) if request else url


class ListingDetailSerializer(ListingListSerializer):
    images = ListingImageSerializer(many=True, read_only=True)
    size_label = serializers.CharField(source="size.name", read_only=True, default=None)
    current_bid = serializers.SerializerMethodField()
    minimum_bid = serializers.SerializerMethodField()
    is_live = serializers.BooleanField(source="is_auction_live", read_only=True)

    class Meta(ListingListSerializer.Meta):
        fields = ListingListSerializer.Meta.fields + (
            "description",
            "size_label",
            "color",
            "location",
            "is_negotiable",
            "starting_bid",
            "current_bid",
            "minimum_bid",
            "is_live",
            "min_increment",
            "start_at",
            "extended_count",
            "view_count",
            "updated_at",
            "images",
        )

    def _top_bid(self, obj):
        annotated = getattr(obj, "highest_bid", None)
        if annotated is not None:
            return annotated
        if obj.type != Listing.Type.AUCTION:
            return None
        return obj.bids.order_by("-amount", "-created_at").values_list("amount", flat=True).first()

    def get_current_bid(self, obj):
        if obj.type != Listing.Type.AUCTION:
            return None
        highest = self._top_bid(obj)
        amount = highest if highest is not None else obj.starting_bid
        if amount is None:
            return None
        return str(Decimal(amount).quantize(Decimal("0.01")))

    def get_minimum_bid(self, obj):
        if obj.type != Listing.Type.AUCTION:
            return None
        from apps.auctions.services import minimum_bid

        return str(minimum_bid(obj))


class ListingWriteSerializer(serializers.ModelSerializer):
    # The Sell form always includes auction fields, sending null for fixed listings.
    # The model column is non-nullable with a default, so treat null as "use default".
    min_increment = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, allow_null=True
    )

    class Meta:
        model = Listing
        fields = (
            "id",
            "title",
            "description",
            "category",
            "brand",
            "size",
            "condition",
            "audience",
            "color",
            "type",
            "price",
            "is_negotiable",
            "starting_bid",
            "reserve_price",
            "min_increment",
            "start_at",
            "end_at",
            "location",
        )
        read_only_fields = ("id",)

    def validate(self, attrs):
        instance = self.instance

        # `null` for a non-nullable field with a default: keep the default/existing value.
        if "min_increment" in attrs and attrs["min_increment"] is None:
            attrs.pop("min_increment")

        def current(name, default=None):
            if name in attrs:
                return attrs[name]
            if instance is not None:
                return getattr(instance, name)
            return default

        listing_type = current("type", Listing.Type.FIXED)
        price = current("price", Decimal("0.00")) or Decimal("0.00")

        if listing_type == Listing.Type.FIXED and price <= 0:
            raise serializers.ValidationError(
                {"price": "Fixed-price listings need a price above zero."}
            )

        if listing_type == Listing.Type.AUCTION:
            starting_bid = current("starting_bid")
            end_at = current("end_at")
            start_at = current("start_at")
            reserve = current("reserve_price")
            errors: dict[str, str] = {}

            if not starting_bid or starting_bid <= 0:
                errors["starting_bid"] = "Auctions need a starting bid above zero."
            if not end_at:
                errors["end_at"] = "Auctions need an end time."
            elif end_at <= timezone.now():
                errors["end_at"] = "The auction must end in the future."
            elif start_at and end_at <= start_at:
                errors["end_at"] = "The auction must end after it starts."
            if reserve is not None and starting_bid and reserve < starting_bid:
                errors["reserve_price"] = "The reserve cannot be below the starting bid."

            if errors:
                raise serializers.ValidationError(errors)

            # Keep price in sync so sorting/filtering behaves.
            attrs["price"] = starting_bid

        if listing_type == Listing.Type.DONATION:
            attrs["price"] = Decimal("0.00")

        return attrs
