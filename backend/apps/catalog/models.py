import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils.text import slugify


class Category(models.Model):
    name = models.CharField(max_length=80)
    slug = models.SlugField(max_length=90, unique=True, blank=True)
    parent = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, related_name="children"
    )
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "name"]
        verbose_name_plural = "categories"

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class Brand(models.Model):
    name = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=90, unique=True, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class Size(models.Model):
    class Kind(models.TextChoices):
        TOP = "top", "Top"
        BOTTOM = "bottom", "Bottom"
        SHOES = "shoes", "Shoes"
        ONE_SIZE = "one_size", "One size"

    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.TOP)
    name = models.CharField(max_length=20)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["kind", "order", "name"]
        constraints = [
            models.UniqueConstraint(fields=["kind", "name"], name="unique_size_per_kind")
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.get_kind_display()})"


class Listing(models.Model):
    class Type(models.TextChoices):
        FIXED = "fixed", "Fixed price"
        AUCTION = "auction", "Auction"
        TRADE = "trade", "Trade"
        DONATION = "donation", "Donation"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PENDING_REVIEW = "pending_review", "Pending review"
        ACTIVE = "active", "Active"
        SOLD = "sold", "Sold"
        ENDED = "ended", "Ended"
        REMOVED = "removed", "Removed"

    class Condition(models.TextChoices):
        NEW_WITH_TAGS = "new_with_tags", "New with tags"
        LIKE_NEW = "like_new", "Like new"
        GOOD = "good", "Good"
        FAIR = "fair", "Fair"

    class Audience(models.TextChoices):
        WOMEN = "women", "Women"
        MEN = "men", "Men"
        UNISEX = "unisex", "Unisex"
        KIDS = "kids", "Kids"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="listings"
    )

    title = models.CharField(max_length=140)
    slug = models.SlugField(max_length=180, unique=True, blank=True)
    description = models.TextField()
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="listings")
    brand = models.ForeignKey(
        Brand, on_delete=models.SET_NULL, null=True, blank=True, related_name="listings"
    )
    size = models.ForeignKey(
        Size, on_delete=models.SET_NULL, null=True, blank=True, related_name="listings"
    )
    condition = models.CharField(max_length=20, choices=Condition.choices)
    audience = models.CharField(max_length=10, choices=Audience.choices, default=Audience.UNISEX)
    color = models.CharField(max_length=40, blank=True)

    type = models.CharField(max_length=10, choices=Type.choices, default=Type.FIXED)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    is_negotiable = models.BooleanField(default=True)

    # Auction-only fields
    starting_bid = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    reserve_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    min_increment = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("20.00"))
    start_at = models.DateTimeField(null=True, blank=True)
    end_at = models.DateTimeField(null=True, blank=True, db_index=True)
    extended_count = models.PositiveSmallIntegerField(default=0)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING_REVIEW)
    location = models.CharField(max_length=120, blank=True)
    view_count = models.PositiveIntegerField(default=0)
    boosted_until = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["type", "status"]),
            models.Index(fields=["category", "status"]),
        ]

    def __str__(self) -> str:
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title)[:60] or "listing"
            self.slug = f"{base}-{uuid.uuid4().hex[:8]}"
        if (
            self._state.adding
            and self.status == self.Status.PENDING_REVIEW
            and settings.AUTO_APPROVE_LISTINGS
        ):
            self.status = self.Status.ACTIVE
        super().save(*args, **kwargs)

    @property
    def is_auction_live(self) -> bool:
        from django.utils import timezone

        if self.type != self.Type.AUCTION or self.status != self.Status.ACTIVE:
            return False
        if not self.end_at:
            return False
        return self.end_at > timezone.now()


class ListingImage(models.Model):
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="listings/%Y/%m/")
    alt_text = models.CharField(max_length=160, blank=True)
    position = models.PositiveSmallIntegerField(default=0)
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self) -> str:
        return f"{self.listing.title} image #{self.position}"

    def save(self, *args, **kwargs):
        if self.is_primary:
            ListingImage.objects.filter(listing=self.listing).exclude(pk=self.pk).update(
                is_primary=False
            )
        super().save(*args, **kwargs)


class Watchlist(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="watchlist"
    )
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="watchers")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "listing"], name="unique_watch_per_user")
        ]

    def __str__(self) -> str:
        return f"{self.user} watching {self.listing}"
