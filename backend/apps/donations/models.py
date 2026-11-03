import uuid

from django.conf import settings
from django.db import models

from apps.catalog.models import Listing


class PartnerOrg(models.Model):
    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=180, unique=True)
    description = models.TextField(blank=True)
    logo = models.ImageField(upload_to="partners/", blank=True, null=True)
    website = models.URLField(blank=True)
    contact_email = models.EmailField(blank=True)
    is_active = models.BooleanField(default=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "partner organization"

    def __str__(self) -> str:
        return self.name


class Donation(models.Model):
    class Status(models.TextChoices):
        REQUESTED = "requested", "Requested"
        SCHEDULED = "scheduled", "Pickup scheduled"
        PICKED_UP = "picked_up", "Picked up"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    donor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="donations"
    )
    partner = models.ForeignKey(PartnerOrg, on_delete=models.PROTECT, related_name="donations")
    listing = models.ForeignKey(
        Listing,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="donations",
    )
    items_description = models.TextField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.REQUESTED)
    pickup_address = models.JSONField(default=dict, blank=True)
    scheduled_for = models.DateTimeField(null=True, blank=True)
    receipt_code = models.CharField(max_length=24, unique=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.receipt_code} → {self.partner.name}"

    def save(self, *args, **kwargs):
        if not self.receipt_code:
            self.receipt_code = f"DON-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)
