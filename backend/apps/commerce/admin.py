from django.contrib import admin

from .models import (
    Dispute,
    Offer,
    Order,
    PaymentProof,
    PlatformFee,
    Review,
    Shipment,
)


class PaymentProofInline(admin.TabularInline):
    model = PaymentProof
    extra = 0
    fields = ("method", "reference", "screenshot", "status", "verified_by")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "order_number",
        "buyer",
        "seller",
        "status",
        "total",
        "payment_method",
        "created_at",
    )
    list_filter = ("status", "payment_method", "created_at")
    search_fields = ("order_number", "buyer__email", "seller__email", "listing__title")
    readonly_fields = ("order_number", "created_at", "updated_at")
    inlines = [PaymentProofInline]


@admin.register(PaymentProof)
class PaymentProofAdmin(admin.ModelAdmin):
    list_display = ("order", "method", "reference", "status", "verified_by", "created_at")
    list_filter = ("status", "method")
    search_fields = ("order__order_number", "reference")


@admin.register(PlatformFee)
class PlatformFeeAdmin(admin.ModelAdmin):
    list_display = ("order", "rate", "amount", "status", "settled_at")
    list_filter = ("status",)


@admin.register(Shipment)
class ShipmentAdmin(admin.ModelAdmin):
    list_display = ("order", "courier", "tracking_number", "status", "shipped_at")
    list_filter = ("status", "courier")
    search_fields = ("order__order_number", "tracking_number")


@admin.register(Dispute)
class DisputeAdmin(admin.ModelAdmin):
    list_display = ("order", "opened_by", "reason", "status", "created_at")
    list_filter = ("status", "reason")
    search_fields = ("order__order_number", "opened_by__email")


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("order", "reviewer", "reviewee", "rating", "created_at")
    list_filter = ("rating",)
    search_fields = ("order__order_number", "reviewer__email", "reviewee__email")


@admin.register(Offer)
class OfferAdmin(admin.ModelAdmin):
    list_display = ("listing", "buyer", "amount", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("listing__title", "buyer__email")
