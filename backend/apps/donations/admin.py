from django.contrib import admin

from .models import Donation, PartnerOrg


@admin.register(PartnerOrg)
class PartnerOrgAdmin(admin.ModelAdmin):
    list_display = ("name", "contact_email", "is_active", "verified_at")
    list_filter = ("is_active",)
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ("name", "contact_email")


@admin.register(Donation)
class DonationAdmin(admin.ModelAdmin):
    list_display = ("receipt_code", "donor", "partner", "status", "scheduled_for")
    list_filter = ("status", "partner")
    search_fields = ("receipt_code", "donor__email", "partner__name")
    readonly_fields = ("receipt_code", "created_at")
