import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework import status

from apps.core.models import Notification

pytestmark = pytest.mark.django_db

NOTIFICATIONS_URL = "/api/v1/notifications/"
CHECKOUT_URL = "/api/v1/orders/checkout/"


def png_bytes():
    buffer = io.BytesIO()
    Image.new("RGB", (8, 8), (76, 122, 52)).save(buffer, format="PNG")
    return buffer.getvalue()


def test_seller_is_notified_when_buyer_uploads_proof(auth_client, other_client, listing):
    order = other_client.post(
        CHECKOUT_URL, {"listing": str(listing.id)}, format="json"
    ).data

    response = other_client.post(
        f"/api/v1/orders/{order['id']}/payment-proof/",
        {
            "method": "gcash",
            "reference": "GC-1",
            "screenshot": SimpleUploadedFile(
                "proof.png", png_bytes(), content_type="image/png"
            ),
        },
        format="multipart",
    )
    assert response.status_code == status.HTTP_200_OK

    notifications = auth_client.get(NOTIFICATIONS_URL).data
    payment_notes = [note for note in notifications if note["kind"] == "payment_review"]
    assert len(payment_notes) == 1
    note = payment_notes[0]
    assert note["url"] == f"/orders/{order['id']}"
    assert note["is_read"] is False

    # The buyer does not see the seller's notifications.
    assert other_client.get(NOTIFICATIONS_URL).data == []


def test_mark_read_and_unread_count(auth_client, user):
    Notification.objects.create(user=user, kind="payment_review", title="Needs review")
    Notification.objects.create(
        user=user, kind="order_update", title="Already seen", is_read=True
    )

    assert auth_client.get(f"{NOTIFICATIONS_URL}unread-count/").data == {"count": 1}

    notes = auth_client.get(NOTIFICATIONS_URL).data
    unread = next(note for note in notes if not note["is_read"])

    assert auth_client.post(f"{NOTIFICATIONS_URL}{unread['id']}/read/").status_code == 200
    assert auth_client.get(f"{NOTIFICATIONS_URL}unread-count/").data == {"count": 0}

    auth_client.post(f"{NOTIFICATIONS_URL}mark-all-read/")
    assert auth_client.get(f"{NOTIFICATIONS_URL}unread-count/").data == {"count": 0}


def test_notifications_require_authentication(api_client):
    response = api_client.get(NOTIFICATIONS_URL)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
