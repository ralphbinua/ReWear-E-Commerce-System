from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import Address, PayoutAccount, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ("-date_joined",)
    list_display = (
        "email",
        "display_name",
        "is_email_verified",
        "is_id_verified",
        "is_staff",
        "date_joined",
    )
    list_filter = ("is_staff", "is_superuser", "is_email_verified", "is_id_verified")
    search_fields = ("email", "first_name", "last_name", "phone")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name", "phone", "avatar", "bio")}),
        (
            "Verification & ratings",
            {"fields": ("is_email_verified", "is_id_verified", "rating_avg", "rating_count")},
        ),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "password1", "password2", "is_staff"),
            },
        ),
    )


@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ("user", "label", "city", "province", "is_default")
    search_fields = ("user__email", "recipient_name", "city")


@admin.register(PayoutAccount)
class PayoutAccountAdmin(admin.ModelAdmin):
    list_display = ("user", "method", "account_name", "is_verified", "created_at")
    list_filter = ("method", "is_verified")
    search_fields = ("user__email", "account_name", "account_number")
