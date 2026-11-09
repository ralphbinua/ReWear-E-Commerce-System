from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Avg, Count, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.catalog.models import Listing
from apps.core.services import audit, notify

from .models import Offer, Order, PaymentProof, PlatformFee, Review
from .serializers import (
    CheckoutSerializer,
    OfferCreateSerializer,
    OfferSerializer,
    OrderSerializer,
    PaymentProofSerializer,
    ReviewSerializer,
)


def _money(value):
    return str((value or Decimal("0.00")).quantize(Decimal("0.01")))


def _mark_sale(listing):
    listing.status = Listing.Status.SOLD
    listing.save(update_fields=["status", "updated_at"])


def _recalculate_rating(user):
    """Recompute a user's average rating from their received reviews."""
    stats = user.reviews_received.aggregate(avg=Avg("rating"), count=Count("id"))
    average = Decimal(str(stats["avg"] or 0)).quantize(Decimal("0.01"))
    user.rating_avg = average
    user.rating_count = stats["count"] or 0
    user.save(update_fields=["rating_avg", "rating_count"])


class OrderViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields: list[str] = []

    @action(detail=False, methods=["get"], url_path="seller-dashboard")
    def seller_dashboard(self, request):
        seller = request.user
        sales = Order.objects.filter(seller=seller)

        paid_statuses = [
            Order.Status.PAID,
            Order.Status.SHIPPED,
            Order.Status.DELIVERED,
            Order.Status.COMPLETED,
        ]
        paid_sales = sales.filter(status__in=paid_statuses)
        paid_totals = paid_sales.aggregate(
            gross=Sum("item_price"),
            fees=Sum("platform_fee"),
            count=Count("id"),
            average=Avg("item_price"),
        )
        gross_revenue = paid_totals["gross"] or Decimal("0.00")
        platform_fees = paid_totals["fees"] or Decimal("0.00")

        pending_totals = sales.filter(status=Order.Status.PENDING_PAYMENT).aggregate(
            amount=Sum("item_price"),
            count=Count("id"),
        )
        review_totals = sales.filter(status=Order.Status.PAYMENT_REVIEW).aggregate(
            amount=Sum("item_price"),
            count=Count("id"),
        )
        orders_by_status = {
            status_value: sales.filter(status=status_value).count()
            for status_value in Order.Status.values
        }

        listings = Listing.objects.filter(seller=seller)
        listing_stats = listings.aggregate(
            active_listings=Count(
                "id", filter=Q(status=Listing.Status.ACTIVE)
            ),
            sold_listings=Count("id", filter=Q(status=Listing.Status.SOLD)),
            ended_listings=Count("id", filter=Q(status=Listing.Status.ENDED)),
            total_listings=Count("id"),
            total_views=Sum("view_count"),
        )

        top_listings = (
            listings.annotate(
                bid_count=Count("bids", distinct=True),
                order_count=Count("orders", distinct=True),
            )
            .order_by("-view_count", "-order_count", "-created_at")[:5]
        )
        top_listings_data = [
            {
                "id": str(listing.id),
                "title": listing.title,
                "type": listing.type,
                "status": listing.status,
                "price": _money(listing.price),
                "view_count": listing.view_count,
                "bid_count": listing.bid_count,
                "order_count": listing.order_count,
            }
            for listing in top_listings
        ]

        recent_sales = (
            sales.select_related("listing", "buyer", "seller")
            .prefetch_related("listing__images", "reviews__reviewer")
            .order_by("-created_at")[:5]
        )
        recent_sales_data = OrderSerializer(
            recent_sales, many=True, context={"request": request}
        ).data

        payout_accounts = [
            {
                "id": account.id,
                "method": account.method,
                "method_label": account.get_method_display(),
                "account_name": account.account_name,
                "account_number": account.account_number,
                "is_verified": account.is_verified,
            }
            for account in seller.payout_accounts.all()
        ]

        return Response(
            {
                "seller": {
                    "id": seller.id,
                    "display_name": seller.display_name,
                    "rating_avg": _money(seller.rating_avg),
                    "rating_count": seller.rating_count,
                },
                "stats": {
                    "active_listings": listing_stats["active_listings"] or 0,
                    "sold_listings": listing_stats["sold_listings"] or 0,
                    "ended_listings": listing_stats["ended_listings"] or 0,
                    "total_listings": listing_stats["total_listings"] or 0,
                    "total_views": listing_stats["total_views"] or 0,
                    "total_sales": sales.count(),
                    "paid_sales": paid_totals["count"] or 0,
                    "completed_sales": sales.filter(
                        status=Order.Status.COMPLETED
                    ).count(),
                    "pending_payment_orders": pending_totals["count"] or 0,
                    "payment_review_orders": review_totals["count"] or 0,
                    "paid_orders": sales.filter(status=Order.Status.PAID).count(),
                    "gross_revenue": _money(gross_revenue),
                    "platform_fees": _money(platform_fees),
                    "net_earnings": _money(gross_revenue - platform_fees),
                    "pending_amount": _money(pending_totals["amount"]),
                    "review_amount": _money(review_totals["amount"]),
                    "average_sale_price": _money(paid_totals["average"]),
                },
                "orders_by_status": orders_by_status,
                "recent_sales": recent_sales_data,
                "top_listings": top_listings_data,
                "payout_accounts": payout_accounts,
            }
        )

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return (
                Order.objects.select_related("listing", "buyer", "seller")
                .prefetch_related("listing__images", "reviews__reviewer")
                .order_by("-created_at")
            )
        qs = (
            Order.objects.select_related("listing", "buyer", "seller")
            .prefetch_related(
                "listing__images",
                "seller__payout_accounts",
                "reviews__reviewer",
            )
            .filter(Q(buyer=user) | Q(seller=user))
        )
        role = self.request.query_params.get("role")
        if role == "buyer":
            qs = qs.filter(buyer=user)
        elif role == "seller":
            qs = qs.filter(seller=user)
        return qs.order_by("-created_at")

    @action(detail=False, methods=["post"])
    def checkout(self, request):
        serializer = CheckoutSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        _mark_sale(order.listing)
        notify(
            order.seller,
            "order_update",
            "Someone bought your item!",
            f"{order.listing.title} — waiting for their GCash proof.",
            f"/orders/{order.id}",
        )
        return Response(OrderSerializer(order, context={"request": request}).data, status=201)

    @action(
        detail=True,
        methods=["post"],
        parser_classes=[MultiPartParser, FormParser],
        url_path="payment-proof",
    )
    def payment_proof(self, request, pk=None):
        order = get_object_or_404(self.get_queryset(), pk=pk)
        if order.buyer_id != request.user.id:
            return Response({"detail": "Only the buyer can upload payment proof."}, status=403)
        if order.status not in {Order.Status.PENDING_PAYMENT, Order.Status.PAYMENT_REVIEW}:
            return Response(
                {"detail": "This order is no longer awaiting payment."},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = PaymentProofSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        proof = PaymentProof.objects.create(
            order=order,
            method=serializer.validated_data["method"],
            reference=serializer.validated_data.get("reference") or None,
            screenshot=serializer.validated_data.get("screenshot"),
        )
        order.payment_method = proof.method
        order.status = Order.Status.PAYMENT_REVIEW
        order.save(update_fields=["payment_method", "status", "updated_at"])

        notify(
            order.seller,
            "payment_review",
            "Payment proof to review",
            f"Buyer uploaded proof for {order.order_number}.",
            f"/orders/{order.id}",
        )
        return Response(OrderSerializer(order, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="verify-payment")
    def verify_payment(self, request, pk=None):
        order = get_object_or_404(self.get_queryset(), pk=pk)
        if order.seller_id != request.user.id and not request.user.is_staff:
            return Response({"detail": "Only the seller or staff can verify payment."}, status=403)
        if order.status != Order.Status.PAYMENT_REVIEW:
            return Response({"detail": "Order is not in payment review."}, status=409)

        decision = request.data.get("decision")
        proof = order.payment_proofs.order_by("-created_at").first()

        if decision == "verified":
            now = timezone.now()
            if proof:
                proof.status = PaymentProof.Status.VERIFIED
                proof.verified_by = request.user
                proof.verified_at = now
                proof.save(update_fields=["status", "verified_by", "verified_at"])
            order.status = Order.Status.PAID
            order.payment_verified_at = now
            order.paid_at = now
            order.save(update_fields=["status", "payment_verified_at", "paid_at", "updated_at"])
            notify(
                order.buyer,
                "order_update",
                "Payment verified",
                f"Payment for {order.order_number} is verified — the seller will ship it.",
                f"/orders/{order.id}",
            )
            audit(request.user, "order.payment_verified", "order", order.id, {})
        elif decision == "rejected":
            reason = request.data.get("reason", "Invalid proof")
            if proof:
                proof.status = PaymentProof.Status.REJECTED
                proof.rejection_reason = reason[:255]
                proof.verified_by = request.user
                proof.verified_at = timezone.now()
                proof.save(
                    update_fields=["status", "rejection_reason", "verified_by", "verified_at"]
                )
            order.status = Order.Status.PENDING_PAYMENT
            order.save(update_fields=["status", "updated_at"])
            notify(
                order.buyer,
                "order_update",
                "Payment rejected",
                f"Seller couldn't verify your proof for {order.order_number}: "
                f"{reason}. Please resubmit.",
                f"/orders/{order.id}",
            )
            audit(
                request.user,
                "order.payment_rejected",
                "order",
                order.id,
                {"reason": reason},
            )
        else:
            return Response({"detail": "decision must be 'verified' or 'rejected'."}, status=400)

        return Response(OrderSerializer(order, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="ship")
    def ship(self, request, pk=None):
        order = get_object_or_404(self.get_queryset(), pk=pk)
        if order.seller_id != request.user.id and not request.user.is_staff:
            return Response({"detail": "Only the seller or staff can ship."}, status=403)
        if order.status != Order.Status.PAID:
            return Response({"detail": "Payment must be verified first."}, status=409)

        courier = request.data.get("courier")
        tracking_number = request.data.get("tracking_number", "").strip()
        if not courier:
            return Response({"detail": "Courier is required."}, status=400)

        order.courier = courier
        order.tracking_number = tracking_number
        order.status = Order.Status.SHIPPED
        order.shipped_at = timezone.now()
        order.save(
            update_fields=["courier", "tracking_number", "status", "shipped_at", "updated_at"]
        )
        notify(
            order.buyer,
            "order_update",
            "Your order is on the way",
            f"{order.order_number} shipped via {courier} {tracking_number}.",
            f"/orders/{order.id}",
        )
        audit(request.user, "order.shipped", "order", order.id, {"courier": courier})
        return Response(OrderSerializer(order, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="confirm")
    def confirm(self, request, pk=None):
        order = get_object_or_404(self.get_queryset(), pk=pk)
        if order.buyer_id != request.user.id and not request.user.is_staff:
            return Response({"detail": "Only the buyer can confirm delivery."}, status=403)
        if order.status not in {Order.Status.SHIPPED, Order.Status.DELIVERED}:
            return Response({"detail": "Order can only be confirmed after shipping."}, status=409)

        now = timezone.now()
        order.delivered_at = order.delivered_at or now
        order.status = Order.Status.COMPLETED
        order.completed_at = now
        order.save(update_fields=["delivered_at", "status", "completed_at", "updated_at"])

        rate = settings.PLATFORM_FEE_RATE
        PlatformFee.objects.update_or_create(
            order=order,
            defaults={
                "rate": rate,
                "amount": order.platform_fee,
                "status": PlatformFee.Status.PENDING,
            },
        )
        notify(
            order.seller,
            "order_update",
            "Order completed",
            f"Buyer confirmed {order.order_number}. Fee ₱{order.platform_fee} is due "
            "from your next payout.",
            f"/orders/{order.id}",
        )
        audit(request.user, "order.completed", "order", order.id, {})
        return Response(OrderSerializer(order, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="review")
    def review(self, request, pk=None):
        order = get_object_or_404(self.get_queryset(), pk=pk)
        if request.user.id not in {order.buyer_id, order.seller_id}:
            return Response(
                {"detail": "Only the buyer or seller can review this order."},
                status=403,
            )
        if order.status not in {Order.Status.COMPLETED, Order.Status.DELIVERED}:
            return Response(
                {"detail": "You can review after the order is completed."},
                status=status.HTTP_409_CONFLICT,
            )
        if Review.objects.filter(order=order, reviewer=request.user).exists():
            return Response(
                {"detail": "You already reviewed this order."},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = ReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reviewee = order.seller if request.user.id == order.buyer_id else order.buyer
        review = serializer.save(order=order, reviewer=request.user, reviewee=reviewee)
        _recalculate_rating(reviewee)

        notify(
            reviewee,
            "order_update",
            f"You received a {review.rating}-star review",
            f"{request.user.display_name} reviewed {order.order_number}.",
            f"/orders/{order.id}",
        )
        audit(
            request.user,
            "order.reviewed",
            "order",
            order.id,
            {"rating": review.rating},
        )
        return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        order = get_object_or_404(self.get_queryset(), pk=pk)
        user_is_seller = order.seller_id == request.user.id
        user_is_buyer = order.buyer_id == request.user.id
        if not (user_is_buyer or user_is_seller):
            return Response({"detail": "You are not a party to this order."}, status=403)
        if order.status not in {Order.Status.PENDING_PAYMENT, Order.Status.PAYMENT_REVIEW}:
            return Response({"detail": "Only unpaid orders can be cancelled."}, status=409)

        reason = request.data.get("reason", "Cancelled")[:255]
        order.status = Order.Status.CANCELLED
        order.cancel_reason = reason
        order.cancelled_at = timezone.now()
        order.save(update_fields=["status", "cancel_reason", "cancelled_at", "updated_at"])

        if order.listing.status == Listing.Status.SOLD:
            order.listing.status = Listing.Status.ACTIVE
            order.listing.save(update_fields=["status", "updated_at"])

        notify(
            order.seller if user_is_buyer else order.buyer,
            "order_update",
            "Order cancelled",
            f"{order.order_number} was cancelled: {reason}",
            f"/orders/{order.id}",
        )
        return Response(OrderSerializer(order, context={"request": request}).data)


class OfferViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Buyer offers on negotiable fixed-price listings."""

    serializer_class = OfferSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        queryset = (
            Offer.objects.select_related("listing", "listing__seller", "buyer")
            .prefetch_related("listing__images")
            .filter(Q(buyer=user) | Q(listing__seller=user))
            .order_by("-created_at")
        )
        listing_id = self.request.query_params.get("listing")
        if listing_id:
            queryset = queryset.filter(listing_id=listing_id)
        offer_status = self.request.query_params.get("status")
        if offer_status:
            queryset = queryset.filter(status=offer_status)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = OfferCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        listing_id = serializer.validated_data["listing"]
        amount = serializer.validated_data["amount"].quantize(Decimal("0.01"))
        message = serializer.validated_data.get("message", "")

        with transaction.atomic():
            listing = Listing.objects.select_for_update().get(pk=listing_id)
            if request.user.is_staff:
                return Response(
                    {"detail": "Staff accounts can't make offers."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if listing.seller_id == request.user.id:
                return Response(
                    {"detail": "You can't make an offer on your own listing."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if listing.type != Listing.Type.FIXED or not listing.is_negotiable:
                return Response(
                    {"detail": "This listing isn't open to offers."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if listing.status != Listing.Status.ACTIVE:
                return Response(
                    {"detail": "This listing is no longer available."},
                    status=status.HTTP_409_CONFLICT,
                )
            if amount <= 0 or amount >= listing.price:
                return Response(
                    {"detail": "Offer an amount below the asking price."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if Offer.objects.filter(
                listing=listing,
                buyer=request.user,
                status=Offer.Status.PENDING,
            ).exists():
                return Response(
                    {"detail": "You already have a pending offer on this listing."},
                    status=status.HTTP_409_CONFLICT,
                )

            offer = Offer.objects.create(
                listing=listing,
                buyer=request.user,
                amount=amount,
                message=message,
            )

        notify(
            listing.seller,
            "trade_offer",
            "New price offer",
            f"{request.user.display_name} offered ₱{amount:,.2f} for {listing.title}.",
            f"/listing/{listing.id}",
        )
        audit(request.user, "offer.created", "offer", offer.id, {"amount": str(amount)})
        return Response(
            OfferSerializer(offer, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="accept")
    def accept(self, request, pk=None):
        offer = get_object_or_404(self.get_queryset(), pk=pk)
        if offer.listing.seller_id != request.user.id:
            return Response(
                {"detail": "Only the seller can accept an offer."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if offer.status != Offer.Status.PENDING:
            return Response(
                {"detail": "This offer is no longer pending."},
                status=status.HTTP_409_CONFLICT,
            )

        with transaction.atomic():
            listing = Listing.objects.select_for_update().get(pk=offer.listing_id)
            offer = Offer.objects.select_for_update().get(pk=offer.pk)
            if listing.status != Listing.Status.ACTIVE:
                return Response(
                    {"detail": "This listing is no longer available."},
                    status=status.HTTP_409_CONFLICT,
                )

            offer.status = Offer.Status.ACCEPTED
            offer.responded_at = timezone.now()
            offer.save(update_fields=["status", "responded_at"])

            Offer.objects.filter(
                listing=listing,
                buyer=offer.buyer,
                status=Offer.Status.PENDING,
            ).exclude(pk=offer.pk).update(
                status=Offer.Status.EXPIRED, responded_at=timezone.now()
            )

            rate = settings.PLATFORM_FEE_RATE
            platform_fee = (offer.amount * rate).quantize(Decimal("0.01"))
            order = Order.objects.create(
                listing=listing,
                buyer=offer.buyer,
                seller=listing.seller,
                item_price=offer.amount,
                shipping_fee=Decimal("0.00"),
                platform_fee=platform_fee,
                total=offer.amount,
            )
            listing.status = Listing.Status.SOLD
            listing.save(update_fields=["status", "updated_at"])
            PlatformFee.objects.create(order=order, rate=rate, amount=platform_fee)

        notify(
            offer.buyer,
            "order_update",
            "Offer accepted",
            f"The seller accepted your ₱{offer.amount:,.2f} offer for {listing.title}.",
            f"/orders/{order.id}",
        )
        audit(request.user, "offer.accepted", "offer", offer.id, {"order": order.order_number})
        return Response(
            {
                "offer": OfferSerializer(offer, context={"request": request}).data,
                "order": OrderSerializer(order, context={"request": request}).data,
            }
        )

    @action(detail=True, methods=["post"], url_path="decline")
    def decline(self, request, pk=None):
        offer = get_object_or_404(self.get_queryset(), pk=pk)
        if offer.listing.seller_id != request.user.id:
            return Response(
                {"detail": "Only the seller can decline an offer."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if offer.status != Offer.Status.PENDING:
            return Response(
                {"detail": "This offer is no longer pending."},
                status=status.HTTP_409_CONFLICT,
            )

        offer.status = Offer.Status.DECLINED
        offer.responded_at = timezone.now()
        offer.save(update_fields=["status", "responded_at"])

        notify(
            offer.buyer,
            "trade_offer",
            "Offer declined",
            f"The seller declined your ₱{offer.amount:,.2f} offer for {offer.listing.title}.",
            f"/listing/{offer.listing.id}",
        )
        audit(request.user, "offer.declined", "offer", offer.id, {})
        return Response(OfferSerializer(offer, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        offer = get_object_or_404(self.get_queryset(), pk=pk)
        if offer.buyer_id != request.user.id:
            return Response(
                {"detail": "Only the buyer can withdraw an offer."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if offer.status != Offer.Status.PENDING:
            return Response(
                {"detail": "This offer is no longer pending."},
                status=status.HTTP_409_CONFLICT,
            )

        offer.status = Offer.Status.CANCELLED
        offer.responded_at = timezone.now()
        offer.save(update_fields=["status", "responded_at"])

        notify(
            offer.listing.seller,
            "trade_offer",
            "Offer withdrawn",
            f"{request.user.display_name} withdrew their offer for {offer.listing.title}.",
            f"/listing/{offer.listing.id}",
        )
        audit(request.user, "offer.cancelled", "offer", offer.id, {})
        return Response(OfferSerializer(offer, context={"request": request}).data)
