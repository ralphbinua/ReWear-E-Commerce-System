import re

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    """Email-first user manager; buyers/sellers also get a public username."""

    use_in_migrations = True

    @staticmethod
    def _generate_username(email):
        base = re.sub(r"[^a-z0-9_]+", "_", email.split("@", 1)[0].lower()).strip("_")
        if not base:
            base = "user"
        username = base[:30]
        counter = 1
        while User.objects.filter(username__iexact=username).exists():
            suffix = f"_{counter}"
            username = f"{base[: 30 - len(suffix)]}{suffix}"
            counter += 1
        return username

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("An email address is required.")
        email = self.normalize_email(email)
        extra_fields.setdefault("username", self._generate_username(email))
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    username = models.CharField(max_length=30, unique=True, null=True, blank=True)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True)
    avatar = models.ImageField(upload_to="avatars/%Y/%m/", blank=True, null=True)
    bio = models.TextField(max_length=500, blank=True)

    is_email_verified = models.BooleanField(default=False)
    is_id_verified = models.BooleanField(default=False)

    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    rating_count = models.PositiveIntegerField(default=0)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    objects = UserManager()

    class Meta:
        ordering = ["-date_joined"]

    def __str__(self) -> str:
        return self.email

    @property
    def display_name(self) -> str:
        return self.get_full_name() or self.email.split("@")[0]


class Address(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="addresses")
    label = models.CharField(max_length=40, default="Home")
    recipient_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=20)
    line1 = models.CharField(max_length=255)
    line2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=120)
    province = models.CharField(max_length=120)
    postal_code = models.CharField(max_length=12)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-is_default", "-created_at"]
        verbose_name_plural = "addresses"

    def __str__(self) -> str:
        return f"{self.label} — {self.city}"


class PayoutAccount(models.Model):
    """Where a seller receives GCash/Maya/bank transfers."""

    class Method(models.TextChoices):
        GCASH = "gcash", "GCash"
        MAYA = "maya", "Maya"
        BANK = "bank", "Bank transfer"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="payout_accounts")
    method = models.CharField(max_length=16, choices=Method.choices)
    account_name = models.CharField(max_length=120)
    account_number = models.CharField(max_length=64)
    is_verified = models.BooleanField(default=False)
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.get_method_display()} — {self.account_number[-4:]}"
