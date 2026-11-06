import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.core.models import Notification
from apps.messaging.models import Conversation, Message

pytestmark = pytest.mark.django_db


def listing_conversation_url(listing):
    return f"/api/v1/listings/{listing.id}/conversation/"


def listing_messages_url(listing):
    return f"/api/v1/listings/{listing.id}/conversation/messages/"


def test_buyer_can_send_message_to_seller(auth_client, other_client, user, other_user, listing):
    response = other_client.post(
        listing_messages_url(listing),
        {"body": "Is this still available?"},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED, response.data
    assert response.data["body"] == "Is this still available?"
    assert response.data["sender_id"] == other_user.id
    assert response.data["is_mine"] is True

    conversation = Conversation.objects.get(pk=response.data["conversation_id"])
    assert conversation.listing == listing
    assert conversation.buyer == other_user
    assert conversation.seller == user
    assert conversation.last_message_at is not None
    assert Message.objects.filter(conversation=conversation).count() == 1

    notification = Notification.objects.get(user=user, kind="message")
    assert notification.url == f"/messages/{conversation.id}"


def test_seller_can_reply_and_thread_marks_messages_read(
    auth_client, other_client, user, other_user, listing
):
    conversation = other_client.post(
        listing_messages_url(listing),
        {"body": "Hi, is the price negotiable?"},
        format="json",
    ).data["conversation_id"]

    reply = auth_client.post(
        f"/api/v1/conversations/{conversation}/messages/",
        {"body": "Yes, open to offers."},
        format="json",
    )
    assert reply.status_code == status.HTTP_201_CREATED, reply.data
    assert reply.data["is_mine"] is True

    detail = auth_client.get(f"/api/v1/conversations/{conversation}/")
    assert detail.status_code == status.HTTP_200_OK
    assert [message["body"] for message in detail.data["messages"]] == [
        "Hi, is the price negotiable?",
        "Yes, open to offers.",
    ]
    assert detail.data["messages"][0]["is_read"] is True

    buyer_detail = other_client.get(f"/api/v1/conversations/{conversation}/")
    assert buyer_detail.data["messages"][1]["is_read"] is True


def test_seller_cannot_message_own_listing(auth_client, listing):
    response = auth_client.post(
        listing_messages_url(listing),
        {"body": "Hello?"},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert not Conversation.objects.exists()


def test_empty_message_is_rejected(other_client, listing):
    response = other_client.post(listing_messages_url(listing), {"body": "  "}, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert not Conversation.objects.exists()


def test_stranger_cannot_open_conversation(other_client, listing):
    conversation = other_client.post(
        listing_messages_url(listing),
        {"body": "Hello"},
        format="json",
    ).data["conversation_id"]

    stranger = APIClient()
    stranger.force_authenticate(
        user=User.objects.create_user(email="nosy@example.com", password="Pass123!")
    )

    response = stranger.get(f"/api/v1/conversations/{conversation}/")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert stranger.get("/api/v1/conversations/").data == []


def test_conversation_endpoints_require_auth(api_client, listing):
    conversation = Conversation.objects.create(
        listing=listing,
        buyer=User.objects.create_user(email="member@example.com", password="Pass123!"),
        seller=listing.seller,
    )

    assert api_client.get("/api/v1/conversations/").status_code == status.HTTP_401_UNAUTHORIZED
    assert (
        api_client.get(f"/api/v1/conversations/{conversation.id}/").status_code
        == status.HTTP_401_UNAUTHORIZED
    )
    assert (
        api_client.get(listing_conversation_url(listing)).status_code
        == status.HTTP_401_UNAUTHORIZED
    )
