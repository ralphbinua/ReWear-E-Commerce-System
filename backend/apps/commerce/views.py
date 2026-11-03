from django.conf import settings
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.catalog.models import Listing
from apps.core.services import audit, notify

from .models import Order, PaymentProof, PlatformFee
from .serializers import (
    CheckoutSerializer,
    OrderSerializer,
    PaymentProofSerializer,
)


def _mark_sale(listing):
    listing.status = Listing.Status.SOLD
    listing.save(update_fields=["status", "updated_at"])


class OrderViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields: list[str] = []

    def get_queryset(self):
        user = self.request.user
        qs = (
            Order.objects.select_related("listing", "buyer", "seller")
            .prefetch_related("listing__images")
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
