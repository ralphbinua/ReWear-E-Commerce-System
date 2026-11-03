from django.contrib import admin

from .models import Brand, Category, Listing, ListingImage, Size, Watchlist


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "parent", "order")
    list_filter = ("parent",)
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ("name",)


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ("name",)


@admin.register(Size)
class SizeAdmin(admin.ModelAdmin):
    list_display = ("name", "kind", "order")
    list_filter = ("kind",)


class ListingImageInline(admin.TabularInline):
    model = ListingImage
    extra = 0
    fields = ("image", "alt_text", "position", "is_primary")


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "seller",
        "type",
        "price",
        "status",
        "category",
        "end_at",
        "created_at",
    )
    list_filter = ("status", "type", "condition", "audience", "category")
    search_fields = ("title", "description", "seller__email", "brand__name")
    autocomplete_fields = ("brand",)
    readonly_fields = ("id", "slug", "view_count", "extended_count", "created_at", "updated_at")
    inlines = [ListingImageInline]
    actions = ("approve_listings", "remove_listings")

    @admin.action(description="Approve selected listings")
    def approve_listings(self, request, queryset):
        updated = queryset.update(status=Listing.Status.ACTIVE)
        self.message_user(request, f"Approved {updated} listing(s).")

    @admin.action(description="Remove selected listings")
    def remove_listings(self, request, queryset):
        updated = queryset.update(status=Listing.Status.REMOVED)
        self.message_user(request, f"Removed {updated} listing(s).")


@admin.register(ListingImage)
class ListingImageAdmin(admin.ModelAdmin):
    list_display = ("listing", "position", "is_primary", "created_at")
    list_filter = ("is_primary",)


@admin.register(Watchlist)
class WatchlistAdmin(admin.ModelAdmin):
    list_display = ("user", "listing", "created_at")
    search_fields = ("user__email", "listing__title")
