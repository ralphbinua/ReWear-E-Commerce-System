from django.contrib import admin

from .models import TradeItem, TradeOffer


class TradeItemInline(admin.TabularInline):
    model = TradeItem
    extra = 1


@admin.register(TradeOffer)
class TradeOfferAdmin(admin.ModelAdmin):
    list_display = ("listing", "proposer", "cash_top_up", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("listing__title", "proposer__email")
    inlines = [TradeItemInline]
