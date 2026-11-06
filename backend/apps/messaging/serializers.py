from rest_framework import serializers

from apps.accounts.serializers import UserSummarySerializer

from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.display_name", read_only=True)
    sender_id = serializers.IntegerField(read_only=True)
    conversation_id = serializers.IntegerField(read_only=True)
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = (
            "id",
            "conversation_id",
            "sender_id",
            "sender_name",
            "is_mine",
            "body",
            "is_read",
            "created_at",
        )
        read_only_fields = fields

    def get_is_mine(self, obj):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and obj.sender_id == request.user.id)


class MessageWriteSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=2000, trim_whitespace=True, allow_blank=False)


class ConversationListingSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    title = serializers.CharField(read_only=True)
    type = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    price = serializers.DecimalField(read_only=True, max_digits=10, decimal_places=2)
    cover_image = serializers.SerializerMethodField()

    def get_cover_image(self, obj):
        image = next(iter(obj.images.all()), None)
        if image is None:
            return None
        request = self.context.get("request")
        url = image.image.url
        return request.build_absolute_uri(url) if request else url


def _other_party(conversation, request=None):
    if request is not None and request.user.is_authenticated:
        if request.user.id == conversation.seller_id:
            return conversation.buyer
        if request.user.id == conversation.buyer_id:
            return conversation.seller
    return conversation.seller


class ConversationBaseSerializer(serializers.ModelSerializer):
    listing = ConversationListingSerializer(read_only=True)
    other_party = serializers.SerializerMethodField()
    other_party_display_name = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = (
            "id",
            "listing",
            "other_party",
            "other_party_display_name",
            "last_message_at",
            "created_at",
        )
        read_only_fields = fields

    def get_other_party(self, obj):
        request = self.context.get("request")
        return UserSummarySerializer(_other_party(obj, request)).data

    def get_other_party_display_name(self, obj):
        request = self.context.get("request")
        return _other_party(obj, request).display_name


class ConversationListSerializer(ConversationBaseSerializer):
    last_message_body = serializers.SerializerMethodField()
    last_message_at = serializers.DateTimeField(read_only=True)
    unread_count = serializers.IntegerField(read_only=True, default=0)

    class Meta(ConversationBaseSerializer.Meta):
        fields = ConversationBaseSerializer.Meta.fields + (
            "last_message_body",
            "unread_count",
        )

    def get_last_message_body(self, obj):
        messages = obj.messages.all()
        latest = messages[-1] if messages else None
        if latest is None:
            return None
        return latest.body


class ConversationDetailSerializer(ConversationBaseSerializer):
    messages = MessageSerializer(many=True, read_only=True)

    class Meta(ConversationBaseSerializer.Meta):
        fields = ConversationBaseSerializer.Meta.fields + ("messages",)
