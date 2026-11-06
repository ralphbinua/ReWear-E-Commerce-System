from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Listing
from apps.core.services import audit, notify

from .models import Conversation, Message
from .serializers import (
    ConversationDetailSerializer,
    ConversationListSerializer,
    MessageSerializer,
    MessageWriteSerializer,
)


def _get_visible_listing(request, listing_id):
    listing = (
        Listing.objects.select_related("seller")
        .prefetch_related("images")
        .filter(pk=listing_id)
        .first()
    )
    if listing is None:
        return None

    public_statuses = [
        Listing.Status.ACTIVE,
        Listing.Status.SOLD,
        Listing.Status.ENDED,
    ]
    if request.user.is_authenticated and (
        listing.status in public_statuses or listing.seller_id == request.user.id
    ):
        return listing
    return None


def _get_or_create_conversation(user, listing):
    if listing.seller_id == user.id:
        return None

    conversation, created = Conversation.objects.get_or_create(
        listing=listing,
        buyer=user,
        seller=listing.seller,
        defaults={"last_message_at": None},
    )
    return conversation, created


def _conversation_queryset(user):
    return (
        Conversation.objects.select_related("listing", "buyer", "seller")
        .prefetch_related("listing__images", "messages__sender")
        .filter(Q(buyer=user) | Q(seller=user))
        .annotate(
            unread_count=Count(
                "messages",
                filter=Q(messages__is_read=False) & ~Q(messages__sender=user),
            )
        )
        .order_by("-last_message_at", "-created_at")
    )


def _serialize_conversation(conversation, request, detail=True):
    serializer_class = ConversationDetailSerializer if detail else ConversationListSerializer
    return serializer_class(conversation, context={"request": request}).data


def _mark_messages_read(conversation, user):
    Message.objects.filter(
        conversation=conversation,
        is_read=False,
    ).exclude(sender=user).update(is_read=True)


def _send_message(conversation, sender, body):
    recipient = conversation.seller if sender.id == conversation.buyer_id else conversation.buyer

    with transaction.atomic():
        message = Message.objects.create(
            conversation=conversation,
            sender=sender,
            body=body,
            is_read=False,
        )
        conversation.last_message_at = timezone.now()
        conversation.save(update_fields=["last_message_at"])

        notify(
            recipient,
            "message",
            "New message",
            f"{sender.display_name}: {body[:120]}",
            f"/messages/{conversation.id}",
        )
        audit(sender, "message.sent", "conversation", conversation.id, {"message_id": message.id})

    return message


class ListingConversationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, listing_id):
        listing = _get_visible_listing(request, listing_id)
        if listing is None:
            return Response({"detail": "Listing not found."}, status=status.HTTP_404_NOT_FOUND)

        conversation = (
            Conversation.objects.select_related("listing", "buyer", "seller")
            .prefetch_related("listing__images", "messages__sender")
            .filter(listing=listing, buyer=request.user, seller=listing.seller)
            .first()
        )
        if conversation is None:
            return Response({"detail": "No conversation yet."}, status=status.HTTP_404_NOT_FOUND)

        _mark_messages_read(conversation, request.user)
        conversation = (
            Conversation.objects.select_related("listing", "buyer", "seller")
            .prefetch_related("listing__images", "messages__sender")
            .get(pk=conversation.pk)
        )
        return Response(_serialize_conversation(conversation, request))

    def post(self, request, listing_id):
        listing = _get_visible_listing(request, listing_id)
        if listing is None:
            return Response({"detail": "Listing not found."}, status=status.HTTP_404_NOT_FOUND)
        if listing.seller_id == request.user.id:
            return Response(
                {"detail": "You can't message yourself about your own listing."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        conversation, created = _get_or_create_conversation(request.user, listing)
        return Response(
            _serialize_conversation(conversation, request),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class ListingConversationMessagesView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, listing_id):
        listing = _get_visible_listing(request, listing_id)
        if listing is None:
            return Response({"detail": "Listing not found."}, status=status.HTTP_404_NOT_FOUND)
        if listing.seller_id == request.user.id:
            return Response(
                {"detail": "You can't message yourself about your own listing."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = MessageWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        conversation, _ = _get_or_create_conversation(request.user, listing)
        message = _send_message(conversation, request.user, serializer.validated_data["body"])
        output = MessageSerializer(message, context={"request": request})

        return Response(output.data, status=status.HTTP_201_CREATED)


class ConversationViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return _conversation_queryset(self.request.user)

    def get_serializer_class(self):
        if self.action == "list":
            return ConversationListSerializer
        return ConversationDetailSerializer

    def retrieve(self, request, *args, **kwargs):
        conversation = self.get_object()
        _mark_messages_read(conversation, request.user)
        conversation = self.get_queryset().get(pk=conversation.pk)
        serializer = self.get_serializer(conversation)
        return Response(serializer.data)

    @action(detail=True, methods=["get", "post"], url_path="messages")
    def messages(self, request, pk=None):
        conversation = self.get_object()

        if request.method == "GET":
            _mark_messages_read(conversation, request.user)
            conversation = self.get_queryset().get(pk=conversation.pk)
            return Response(
                ConversationDetailSerializer(
                    conversation,
                    context=self.get_serializer_context(),
                ).data
            )

        serializer = MessageWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = _send_message(conversation, request.user, serializer.validated_data["body"])
        output = MessageSerializer(message, context=self.get_serializer_context())
        return Response(output.data, status=status.HTTP_201_CREATED)
