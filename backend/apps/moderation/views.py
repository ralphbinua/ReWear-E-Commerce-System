import secrets
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Brand, Category, Listing, Size
from apps.catalog.serializers import BrandSerializer, CategorySerializer, SizeSerializer
from apps.commerce.models import Dispute, Order, PlatformFee
from apps.commerce.serializers import OrderSerializer
from apps.core.models import AuditLog
from apps.core.services import audit, notify

from .models import ModerationAction, Report
from .serializers import (
    AdminListingSerializer,
    AdminPasswordResetSerializer,
    AdminUserUpdateSerializer,
    AuditLogSerializer,
    ResolveDisputeSerializer,
    ResolveReportSerializer,
    SystemDisputeSerializer,
    SystemReportSerializer,
    SystemSummarySerializer,
    SystemUserSerializer,
)

User = get_user_model()


class SystemSummaryView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        summary = {
            "pending_listings": Listing.objects.filter(
                status=Listing.Status.PENDING_REVIEW
            ).count(),
            "active_listings": Listing.objects.filter(status=Listing.Status.ACTIVE).count(),
            "sold_listings": Listing.objects.filter(status=Listing.Status.SOLD).count(),
            "open_reports": Report.objects.filter(
                status=Report.Status.OPEN
            ).count(),
            "active_users": User.objects.filter(is_active=True).count(),
            "total_orders": Order.objects.count(),
            "disputed_orders": Order.objects.filter(status=Order.Status.DISPUTED).count(),
            "platform_revenue": PlatformFee.objects.filter(
                status=PlatformFee.Status.SETTLED
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00"),
            "platform_fee_rate": settings.PLATFORM_FEE_RATE,
        }
        return Response(SystemSummarySerializer(summary).data)


class AdminListingViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAdminUser]
    serializer_class = AdminListingSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = (
            Listing.objects.select_related("seller", "category", "brand", "size")
            .prefetch_related("images")
            .annotate(
                bid_count=Count("bids", distinct=True),
                order_count=Count("orders", distinct=True),
            )
            .order_by("-created_at")
        )
        listing_status = self.request.query_params.get("status")
        if listing_status:
            queryset = queryset.filter(status=listing_status)
        search = self.request.query_params.get("q")
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(description__icontains=search)
            )
        return queryset

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        listing = self.get_object()
        listing.status = Listing.Status.ACTIVE
        listing.save(update_fields=["status", "updated_at"])
        audit(request.user, "listing.approved", "listing", listing.id, {})
        return Response(self.get_serializer(listing).data)

    @action(detail=True, methods=["post"], url_path="remove")
    def remove(self, request, pk=None):
        listing = self.get_object()
        listing.status = Listing.Status.REMOVED
        listing.save(update_fields=["status", "updated_at"])
        audit(request.user, "listing.removed", "listing", listing.id, {})
        return Response(self.get_serializer(listing).data)

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, pk=None):
        listing = self.get_object()
        listing.status = Listing.Status.PENDING_REVIEW
        listing.save(update_fields=["status", "updated_at"])
        audit(request.user, "listing.restored", "listing", listing.id, {})
        return Response(self.get_serializer(listing).data)


class ReportViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAdminUser]
    serializer_class = SystemReportSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = Report.objects.select_related("reporter", "resolved_by").order_by("-created_at")
        report_status = self.request.query_params.get("status")
        if report_status:
            queryset = queryset.filter(status=report_status)
        target_type = self.request.query_params.get("target_type")
        if target_type:
            queryset = queryset.filter(target_type=target_type)
        return queryset

    @action(detail=True, methods=["post"], url_path="resolve")
    def resolve(self, request, pk=None):
        report = self.get_object()
        serializer = ResolveReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action_name = serializer.validated_data.get("action") or ""
        notes = serializer.validated_data.get("notes", "")

        if (
            action_name == ModerationAction.Action.REMOVE_LISTING
            and report.target_type == "listing"
        ):
            Listing.objects.filter(pk=report.target_id).update(
                status=Listing.Status.REMOVED
            )
        elif action_name in {
            ModerationAction.Action.SUSPEND_USER,
            ModerationAction.Action.BAN_USER,
        } and report.target_type == "user":
            try:
                target_user = User.objects.get(pk=report.target_id)
                if not target_user.is_superuser:
                    target_user.is_active = False
                    target_user.save(update_fields=["is_active"])
            except User.DoesNotExist:
                pass

        report.status = serializer.validated_data["status"]
        report.resolved_by = request.user
        report.resolved_at = timezone.now()
        report.save(update_fields=["status", "resolved_by", "resolved_at"])

        moderation_action = None
        if action_name:
            moderation_action = ModerationAction.objects.create(
                moderator=request.user,
                report=report,
                action=action_name,
                target_type=report.target_type,
                target_id=report.target_id,
                notes=notes,
            )

        audit(
            request.user,
            "report.resolved",
            "report",
            report.id,
            {"status": report.status, "action": action_name},
        )

        data = SystemReportSerializer(report).data
        if moderation_action:
            data["moderation_action_id"] = moderation_action.id
        return Response(data)


class AdminUserViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAdminUser]
    serializer_class = SystemUserSerializer
    pagination_class = None

    def get_serializer_class(self):
        if self.action in {"update", "partial_update"}:
            return AdminUserUpdateSerializer
        return SystemUserSerializer

    def update(self, request, *args, **kwargs):
        target = self.get_object()
        serializer = self.get_serializer(target, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        if (
            target.id == request.user.id
            and (
                serializer.validated_data.get("is_active") is False
                or serializer.validated_data.get("is_staff") is False
            )
        ):
            return Response(
                {"detail": "You can't deactivate or remove staff access from your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if (
            target.is_superuser
            and not request.user.is_superuser
            and (
                "is_staff" in serializer.validated_data
                or "is_active" in serializer.validated_data
            )
        ):
            return Response(
                {"detail": "Only a superuser can change a superuser account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer.save()
        audit(
            request.user,
            "user.updated",
            "user",
            target.id,
            {"fields": list(serializer.validated_data)},
        )
        return Response(SystemUserSerializer(target).data)

    def get_queryset(self):
        queryset = (
            User.objects.annotate(
                listings_count=Count("listings", distinct=True),
                sales_count=Count("sales", distinct=True),
                purchases_count=Count("purchases", distinct=True),
                reports_count=Count("reports_filed", distinct=True),
            )
            .order_by("-date_joined")
        )
        search = self.request.query_params.get("q")
        if search:
            queryset = queryset.filter(
                Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )
        return queryset

    @action(detail=True, methods=["post"], url_path="suspend")
    def suspend(self, request, pk=None):
        target = self.get_object()
        if target.id == request.user.id or target.is_superuser:
            return Response(
                {"detail": "You can't suspend yourself or a superuser."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        target.is_active = False
        target.save(update_fields=["is_active"])
        notify(
            target,
            "system",
            "Account suspended",
            "Your ReWear account has been temporarily suspended.",
            "/login",
        )
        audit(request.user, "user.suspended", "user", target.id, {})
        return Response(self.get_serializer(target).data)

    @action(detail=True, methods=["post"], url_path="activate")
    def activate(self, request, pk=None):
        target = self.get_object()
        target.is_active = True
        target.save(update_fields=["is_active"])
        notify(
            target,
            "system",
            "Account restored",
            "Your ReWear account is active again.",
            "/browse",
        )
        audit(request.user, "user.activated", "user", target.id, {})
        return Response(self.get_serializer(target).data)

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        target = self.get_object()
        if target.is_superuser and not request.user.is_superuser:
            return Response(
                {"detail": "Only a superuser can reset a superuser password."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = AdminPasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        password = serializer.validated_data.get("password") or secrets.token_urlsafe(18)

        target.set_password(password)
        target.save(update_fields=["password"])

        notify(
            target,
            "system",
            "Password reset",
            "An admin reset your ReWear password. Sign in with the temporary "
            "password you were given.",
            "/rewear/login",
        )
        audit(
            request.user,
            "user.password_reset",
            "user",
            target.id,
            {"password_provided": bool(serializer.validated_data.get("password"))},
        )
        return Response(
            {
                "user": SystemUserSerializer(target).data,
                "temporary_password": password,
            }
        )


class AdminDisputeViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAdminUser]
    serializer_class = SystemDisputeSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = (
            Dispute.objects.select_related("order", "opened_by", "resolved_by")
            .order_by("-created_at")
        )
        dispute_status = self.request.query_params.get("status")
        if dispute_status:
            queryset = queryset.filter(status=dispute_status)
        return queryset

    @action(detail=True, methods=["post"], url_path="resolve")
    def resolve(self, request, pk=None):
        dispute = self.get_object()
        serializer = ResolveDisputeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        dispute.status = serializer.validated_data["status"]
        dispute.resolution_note = serializer.validated_data.get("resolution_note", "")
        dispute.resolved_by = request.user
        dispute.resolved_at = timezone.now()
        dispute.save(
            update_fields=["status", "resolution_note", "resolved_by", "resolved_at"]
        )

        audit(request.user, "dispute.resolved", "dispute", dispute.id, {"status": dispute.status})
        return Response(self.get_serializer(dispute).data)


class AdminOrderViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAdminUser]
    serializer_class = OrderSerializer
    pagination_class = None

    def get_queryset(self):
        return (
            Order.objects.select_related("listing", "buyer", "seller")
            .prefetch_related("listing__images", "reviews__reviewer")
            .order_by("-created_at")
        )


class AdminCategoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]
    serializer_class = CategorySerializer
    pagination_class = None
    queryset = Category.objects.all().order_by("order", "name")


class AdminBrandViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]
    serializer_class = BrandSerializer
    pagination_class = None
    queryset = Brand.objects.all().order_by("name")


class AdminSizeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]
    serializer_class = SizeSerializer
    pagination_class = None
    queryset = Size.objects.all().order_by("kind", "order", "name")


class AuditLogViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAdminUser]
    serializer_class = AuditLogSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = AuditLog.objects.select_related("actor").order_by("-created_at")
        action_name = self.request.query_params.get("action")
        if action_name:
            queryset = queryset.filter(action=action_name)
        search = self.request.query_params.get("q")
        if search:
            queryset = queryset.filter(
                Q(action__icontains=search)
                | Q(target_type__icontains=search)
                | Q(target_id__icontains=search)
            )
        return queryset
