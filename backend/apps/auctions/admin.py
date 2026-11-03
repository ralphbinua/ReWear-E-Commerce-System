from django.contrib import admin

from .models import AuctionResult, Bid


@admin.register(Bid)
class BidAdmin(admin.ModelAdmin):
    list_display = ("listing", "bidder", "amount", "created_at")
    search_fields = ("listing__title", "bidder__email")
    readonly_fields = ("listing", "bidder", "amount", "created_at")

    def has_add_permission(self, request) -> bool:
        return False


@admin.register(AuctionResult)
class AuctionResultAdmin(admin.ModelAdmin):
    list_display = ("listing", "winner", "final_amount", "reserve_met", "closed_at")
    list_filter = ("reserve_met",)
    search_fields = ("listing__title", "winner__email")
