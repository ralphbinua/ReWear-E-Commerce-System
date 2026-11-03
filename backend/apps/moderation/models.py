from django.conf import settings
from django.db import models


class Report(models.Model):
    class TargetType(models.TextChoices):
        LISTING = "listing", "Listing"
        USER = "user", "User"
        MESSAGE = "message", "Message"

    class Reason(models.TextChoices):
        COUNTERFEIT = "counterfeit", "Counterfeit"
        PROHIBITED = "prohibited", "Prohibited item"
        SCAM = "scam", "Scam or fraud"
        HARASSMENT = "harassment", "Harassment"
        SPAM = "spam", "Spam"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        REVIEWING = "reviewing", "Reviewing"
        ACTIONED = "actioned", "Actioned"
        DISMISSED = "dismissed", "Dismissed"

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reports_filed"
    )
    target_type = models.CharField(max_length=12, choices=TargetType.choices)
    target_id = models.CharField(max_length=64)
    reason = models.CharField(max_length=20, choices=Reason.choices)
    details = models.TextField(blank=True)
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.OPEN, db_index=True
    )
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reports_resolved",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["target_type", "target_id"])]

    def __str__(self) -> str:
        return f"{self.get_reason_display()} ({self.target_type}:{self.target_id})"


class ModerationAction(models.Model):
    class Action(models.TextChoices):
        WARN = "warn", "Warn user"
        REMOVE_LISTING = "remove_listing", "Remove listing"
        SUSPEND_USER = "suspend_user", "Suspend user"
        BAN_USER = "ban_user", "Ban user"
        DISMISS = "dismiss", "Dismiss report"

    moderator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="moderation_actions"
    )
    report = models.ForeignKey(
        Report,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="actions",
    )
    action = models.CharField(max_length=24, choices=Action.choices)
    target_type = models.CharField(max_length=12, blank=True)
    target_id = models.CharField(max_length=64, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.get_action_display()} by {self.moderator_id}"
