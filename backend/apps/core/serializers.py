from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)

    class Meta:
        model = Notification
        fields = (
            "id",
            "kind",
            "kind_label",
            "title",
            "body",
            "url",
            "is_read",
            "created_at",
        )
        read_only_fields = fields
