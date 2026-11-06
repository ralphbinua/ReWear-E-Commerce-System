import io
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from PIL import Image
from rest_framework import serializers

from apps.catalog.models import Listing

from .models import Order, PaymentProof, Review


class OrderListingSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    title = serializers.CharField()
    slug = serializers.CharField()
    cover_image = serializers.SerializerMethodField()

    def get_cover_image(self, obj):
        image = next(iter(obj.images.all()), None)
        if image is None:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(image.image.url) if request else image.image.url


class ReviewSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.CharField(source="reviewer.display_name", read_only=True)
    reviewee_name = serializers.CharField(source="reviewee.display_name", read_only=True)

    class Meta:
        model = Review
        fields = (
            "id",
            "reviewer",
            "reviewer_name",
            "reviewee",
            "reviewee_name",
            "rating",
            "comment",
            "created_at",
        )
        read_only_fields = ("id", "reviewer", "reviewee", "created_at")


class OrderSerializer(serializers.ModelSerializer):
    listing = OrderListingSerializer(read_only=True)
    buyer_name = serializers.CharField(source="buyer.display_name", read_only=True)
    seller_name = serializers.CharField(source="seller.display_name", read_only=True)
    latest_proof = serializers.SerializerMethodField()
    payout_accounts = serializers.SerializerMethodField()
    reviews = ReviewSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = (
            "id",
            "order_number",
            "listing",
            "buyer",
            "buyer_name",
            "seller",
            "seller_name",
            "status",
            "item_price",
            "shipping_fee",
            "platform_fee",
            "total",
            "payment_method",
            "payment_verified_at",
            "courier",
            "tracking_number",
            "created_at",
            "paid_at",
            "shipped_at",
            "delivered_at",
            "completed_at",
            "cancel_reason",
            "latest_proof",
            "payout_accounts",
            "reviews",
        )

    def get_payout_accounts(self, obj):
        """Only the buyer receives the seller's payment destinations."""
        request = self.context.get("request")
        if request is None or request.user.id != obj.buyer_id:
            return []
        return [
            {
                "method": account.method,
                "method_label": account.get_method_display(),
                "account_name": account.account_name,
                "account_number": account.account_number,
            }
            for account in obj.seller.payout_accounts.all()
        ]

    def get_latest_proof(self, obj):
        proof = obj.payment_proofs.order_by("-created_at").first()
        if proof is None:
            return None
        return {
            "id": proof.id,
            "method": proof.method,
            "reference": proof.reference,
            "status": proof.status,
            "screenshot": self.context["request"].build_absolute_uri(proof.screenshot.url)
            if proof.screenshot
            else None,
        }


class CheckoutSerializer(serializers.Serializer):
    listing = serializers.UUIDField()

    def create(self, validated_data):
        request = self.context["request"]
        buyer = request.user
        listing_id = validated_data["listing"]

        with transaction.atomic():
            listing = Listing.objects.select_for_update().get(pk=listing_id)
            if listing.seller_id == buyer.id:
                raise serializers.ValidationError("You can't buy your own listing.")
            if listing.status != Listing.Status.ACTIVE:
                raise serializers.ValidationError("This listing is no longer available.")
            if listing.type != Listing.Type.FIXED:
                raise serializers.ValidationError("Auctions are bought by winning the auction.")

            rate = settings.PLATFORM_FEE_RATE
            platform_fee = (listing.price * rate).quantize(Decimal("0.01"))
            shipping_fee = Decimal("0.00")

            return Order.objects.create(
                listing=listing,
                buyer=buyer,
                seller=listing.seller,
                item_price=listing.price,
                shipping_fee=shipping_fee,
                platform_fee=platform_fee,
                total=listing.price + shipping_fee,
            )


class PaymentProofSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentProof
        fields = ("method", "reference", "screenshot")

    def validate_screenshot(self, value):
        if value is None:
            return value
        if not getattr(value, "content_type", "").startswith("image/"):
            raise serializers.ValidationError("Only image files are accepted.")
        try:
            img = Image.open(io.BytesIO(value.read()))
            img.verify()
        except Exception as exc:
            raise serializers.ValidationError("The uploaded file is not a valid image.") from exc
        finally:
            value.seek(0)
        return value
