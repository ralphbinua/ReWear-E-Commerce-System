from django.contrib import admin

from .models import ModerationAction, Report


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ("reason", "target_type", "target_id", "reporter", "status", "created_at")
    list_filter = ("status", "reason", "target_type")
    search_fields = ("target_id", "reporter__email", "details")


@admin.register(ModerationAction)
class ModerationActionAdmin(admin.ModelAdmin):
    list_display = ("action", "moderator", "target_type", "target_id", "created_at")
    list_filter = ("action",)
    search_fields = ("target_id", "moderator__email", "notes")
