from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

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
            "email",
            "first_name",
            "last_name",
            "display_name",
            "phone",
            "avatar",
            "bio",
            "is_email_verified",
            "is_id_verified",
            "rating_avg",
            "rating_count",
            "date_joined",
        )
        read_only_fields = (
            "id",
            "email",
            "is_email_verified",
            "is_id_verified",
            "rating_avg",
            "rating_count",
            "date_joined",
        )


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, validators=[validate_password])

    class Meta:
        model = User
        fields = ("email", "password", "first_name", "last_name", "phone")
        extra_kwargs = {
            "first_name": {"required": False},
            "last_name": {"required": False},
            "phone": {"required": False},
        }

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class LoginSerializer(TokenObtainPairSerializer):
    """Adds the user object to the standard access/refresh response."""

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


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
