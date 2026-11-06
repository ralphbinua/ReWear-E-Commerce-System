from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.catalog.serializers import ListingDetailSerializer
from apps.commerce.models import Dispute
from apps.commerce.serializers import OrderSerializer

from .models import ModerationAction, Report


class SystemSummarySerializer(serializers.Serializer):
    pending_listings = serializers.IntegerField()
    active_listings = serializers.IntegerField()
    sold_listings = serializers.IntegerField()
    open_reports = serializers.IntegerField()
    active_users = serializers.IntegerField()
    total_orders = serializers.IntegerField()
    disputed_orders = serializers.IntegerField()
    platform_revenue = serializers.DecimalField(max_digits=10, decimal_places=2)


class AdminListingSerializer(ListingDetailSerializer):
    bid_count = serializers.IntegerField(read_only=True, default=0)
    order_count = serializers.IntegerField(read_only=True, default=0)

    class Meta(ListingDetailSerializer.Meta):
        fields = ListingDetailSerializer.Meta.fields + ("bid_count", "order_count")


class SystemReportSerializer(serializers.ModelSerializer):
    reporter_name = serializers.CharField(source="reporter.display_name", read_only=True)
    reporter_email = serializers.CharField(source="reporter.email", read_only=True)

    class Meta:
        model = Report
        fields = (
            "id",
            "reporter",
            "reporter_name",
            "reporter_email",
            "target_type",
            "target_id",
            "reason",
            "details",
            "status",
            "resolved_by",
            "resolved_at",
            "created_at",
        )
        read_only_fields = fields


class ResolveReportSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["actioned", "dismissed"])
    action = serializers.ChoiceField(
        choices=["", "warn", "remove_listing", "suspend_user", "ban_user", "dismiss"],
        required=False,
        allow_blank=True,
    )
    notes = serializers.CharField(max_length=1000, required=False, allow_blank=True)


class SystemUserSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)
    listings_count = serializers.IntegerField(read_only=True, default=0)
    sales_count = serializers.IntegerField(read_only=True, default=0)
    purchases_count = serializers.IntegerField(read_only=True, default=0)
    reports_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = get_user_model()
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "display_name",
            "phone",
            "is_active",
            "is_staff",
            "is_superuser",
            "rating_avg",
            "rating_count",
            "date_joined",
            "listings_count",
            "sales_count",
            "purchases_count",
            "reports_count",
        )
        read_only_fields = fields


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ("username", "email", "first_name", "last_name", "phone", "is_active", "is_staff")
        extra_kwargs = {field: {"required": False} for field in fields}


class AdminPasswordResetSerializer(serializers.Serializer):
    password = serializers.CharField(
        required=False,
        allow_blank=True,
        min_length=12,
        max_length=128,
        trim_whitespace=False,
    )


class SystemDisputeSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    opened_by_name = serializers.CharField(source="opened_by.display_name", read_only=True)
    order_status = serializers.CharField(source="order.status", read_only=True)

    class Meta:
        model = Dispute
        fields = (
            "id",
            "order",
            "order_number",
            "order_status",
            "opened_by",
            "opened_by_name",
            "reason",
            "description",
            "status",
            "resolution_note",
            "resolved_by",
            "resolved_at",
            "created_at",
        )
        read_only_fields = fields


class ResolveDisputeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=["resolved_buyer", "resolved_seller", "closed"]
    )
    resolution_note = serializers.CharField(max_length=2000, required=False, allow_blank=True)


class ModerationActionSerializer(serializers.ModelSerializer):
    moderator_name = serializers.CharField(source="moderator.display_name", read_only=True)

    class Meta:
        model = ModerationAction
        fields = (
            "id",
            "moderator",
            "moderator_name",
            "report",
            "action",
            "target_type",
            "target_id",
            "notes",
            "created_at",
        )
        read_only_fields = fields


class AdminOrderSerializer(OrderSerializer):
    pass
