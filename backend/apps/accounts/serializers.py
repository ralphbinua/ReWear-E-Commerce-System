from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Address, PayoutAccount

User = get_user_model()


class UserSummarySerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ("id", "display_name", "avatar", "rating_avg", "rating_count")


class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "display_name",
            "phone",
            "avatar",
            "bio",
            "is_email_verified",
            "is_id_verified",
            "is_staff",
            "rating_avg",
            "rating_count",
            "date_joined",
        )
        read_only_fields = (
            "id",
            "username",
            "email",
            "is_email_verified",
            "is_id_verified",
            "is_staff",
            "rating_avg",
            "rating_count",
            "date_joined",
        )


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, validators=[validate_password])

    class Meta:
        model = User
        fields = ("username", "email", "password", "first_name", "last_name", "phone")
        extra_kwargs = {
            "username": {"required": False, "allow_blank": True},
            "first_name": {"required": False},
            "last_name": {"required": False},
            "phone": {"required": False},
        }

    def create(self, validated_data):
        if not validated_data.get("username"):
            validated_data.pop("username", None)
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    """Buyer/seller login by username; staff login by email."""

    login_type = serializers.ChoiceField(
        choices=["user", "admin"], required=False, default="user"
    )
    username = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)
    email = serializers.EmailField(required=False, allow_blank=True, trim_whitespace=True)
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        login_type = attrs.get("login_type") or (
            "admin" if attrs.get("email") else "user"
        )
        password = attrs["password"]
        user = None

        if login_type == "admin":
            email = (attrs.get("email") or "").strip()
            if not email:
                raise serializers.ValidationError(
                    {"email": "Admin login requires an email address."}
                )
            user = User.objects.filter(email__iexact=email).first()
            if not user or not user.check_password(password):
                raise serializers.ValidationError(
                    {"detail": "Invalid email or password."}
                )
            if not user.is_staff:
                raise serializers.ValidationError(
                    {"detail": "This account is not an admin."}
                )
        else:
            username = (attrs.get("username") or "").strip()
            if not username:
                raise serializers.ValidationError(
                    {"username": "Username is required for buyer/seller login."}
                )
            user = User.objects.filter(username__iexact=username).first()
            if not user or not user.check_password(password):
                raise serializers.ValidationError(
                    {"detail": "Invalid username or password."}
                )
            if user.is_staff:
                raise serializers.ValidationError(
                    {"detail": "Admins use the admin login page."}
                )

        if user is None or not user.is_active:
            raise serializers.ValidationError(
                {"detail": "This account is inactive."}
            )

        refresh = RefreshToken.for_user(user)
        return {
            "user": UserSerializer(user).data,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = (
            "id",
            "label",
            "recipient_name",
            "phone",
            "line1",
            "line2",
            "city",
            "province",
            "postal_code",
            "is_default",
            "created_at",
        )
        read_only_fields = ("id", "created_at")

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        if validated_data.get("is_default"):
            Address.objects.filter(user=validated_data["user"]).update(is_default=False)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if validated_data.get("is_default"):
            Address.objects.filter(user=instance.user).exclude(pk=instance.pk).update(
                is_default=False
            )
        return super().update(instance, validated_data)


class PayoutAccountSerializer(serializers.ModelSerializer):
    method_label = serializers.CharField(source="get_method_display", read_only=True)

    class Meta:
        model = PayoutAccount
        fields = (
            "id",
            "method",
            "method_label",
            "account_name",
            "account_number",
            "is_verified",
            "created_at",
        )
        read_only_fields = ("id", "is_verified", "created_at")

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)
