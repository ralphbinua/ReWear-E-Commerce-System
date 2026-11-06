import io

import pytest
from PIL import Image
from rest_framework import status

from apps.catalog.models import Listing
from apps.commerce.models import Order, PaymentProof, PlatformFee
from apps.core.models import AuditLog

pytestmark = pytest.mark.django_db

ORDERS_URL = "/api/v1/orders/"
CHECKOUT_URL = "/api/v1/orders/checkout/"


def png_bytes():
    buffer = io.BytesIO()
    Image.new("RGB", (8, 8), (76, 122, 52)).save(buffer, format="PNG")
    return buffer.getvalue()


def buy(client, listing):
    return client.post(CHECKOUT_URL, {"listing": str(listing.id)}, format="json")


def test_checkout_creates_order_and_sells_listing(auth_client, other_client, other_user, listing):
    response = buy(other_client, listing)

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["status"] == Order.Status.PENDING_PAYMENT
    assert response.data["item_price"] == str(listing.price)
    assert response.data["platform_fee"] == "84.00"  # 7% of 1200
    assert response.data["total"] == str(listing.price)

    listing.refresh_from_db()
    assert listing.status == Listing.Status.SOLD


def test_seller_cannot_buy_own_listing(auth_client, listing):
    response = buy(auth_client, listing)
    assert response.status_code == status.HTTP_400_BAD_REQUEST


def test_full_sale_flow(auth_client, other_client, other_user, listing):
    # 1. buyer checks out
    order = buy(other_client, listing).data
    assert order["status"] == "pending_payment"
    order_id = order["id"]

    # 2. buyer uploads proof
    from django.core.files.uploadedfile import SimpleUploadedFile

    client = other_client
    response = client.post(
        f"{ORDERS_URL}{order_id}/payment-proof/",
        {
            "method": "gcash",
            "reference": "GC-99887",
            "screenshot": SimpleUploadedFile("proof.png", png_bytes(), content_type="image/png"),
        },
        format="multipart",
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.data["status"] == "payment_review"

    # 3. seller verifies
    response = auth_client.post(
        f"{ORDERS_URL}{order_id}/verify-payment/", {"decision": "verified"}, format="json"
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.data["status"] == "paid"

    # 4. seller ships
    response = auth_client.post(
        f"{ORDERS_URL}{order_id}/ship/",
        {"courier": "LBC", "tracking_number": "LBC123456"},
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.data["status"] == "shipped"

    # 5. buyer confirms delivery
    response = other_client.post(f"{ORDERS_URL}{order_id}/confirm/", {}, format="json")
    assert response.status_code == status.HTTP_200_OK
    assert response.data["status"] == "completed"

    fee = PlatformFee.objects.get(order__id=order_id)
    assert fee.amount == 84


def test_seller_rejection_sends_back_to_pending(auth_client, other_client, listing):
    order = buy(other_client, listing).data
    order_id = order["id"]

    from django.core.files.uploadedfile import SimpleUploadedFile

    other_client.post(
        f"{ORDERS_URL}{order_id}/payment-proof/",
        {
            "method": "gcash",
            "reference": "GC-X",
            "screenshot": SimpleUploadedFile("p.png", png_bytes(), content_type="image/png"),
        },
        format="multipart",
    )
    response = auth_client.post(
        f"{ORDERS_URL}{order_id}/verify-payment/",
        {"decision": "rejected", "reason": "Wrong amount"},
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.data["status"] == "pending_payment"

    proof = PaymentProof.objects.get(order__id=order_id)
    assert proof.status == PaymentProof.Status.REJECTED


def test_stranger_cannot_see_order(other_client, db, listing):
    from rest_framework.test import APIClient

    from apps.accounts.models import User

    stranger = APIClient()
    stranger.force_authenticate(
        user=User.objects.create_user(email="stranger@example.com", password="Pass123!")
    )

    order = buy(other_client, listing).data
    response = stranger.get(f"{ORDERS_URL}{order['id']}/")
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_cancel_restores_listing(other_client, auth_client, listing):
    order = buy(other_client, listing).data
    response = other_client.post(
        f"{ORDERS_URL}{order['id']}/cancel/", {"reason": "Buyer changed mind"}, format="json"
    )
    assert response.status_code == status.HTTP_200_OK
    listing.refresh_from_db()
    assert listing.status == Listing.Status.ACTIVE


def test_audit_log_written_on_verification(auth_client, other_client, listing):
    order = buy(other_client, listing).data
    from django.core.files.uploadedfile import SimpleUploadedFile

    other_client.post(
        f"{ORDERS_URL}{order['id']}/payment-proof/",
        {
            "method": "gcash",
            "reference": "GC-Y",
            "screenshot": SimpleUploadedFile("p.png", png_bytes(), content_type="image/png"),
        },
        format="multipart",
    )
    auth_client.post(
        f"{ORDERS_URL}{order['id']}/verify-payment/", {"decision": "verified"}, format="json"
    )
    assert AuditLog.objects.filter(
        action="order.payment_verified", target_id=str(order["id"])
    ).exists()


def test_buyer_receives_seller_payout_accounts(other_client, user, listing):
    from apps.accounts.models import PayoutAccount

    PayoutAccount.objects.create(
        user=user,
        method="gcash",
        account_name="Sara Seller",
        account_number="09171234567",
    )

    order = buy(other_client, listing).data

    assert order["payout_accounts"] == [
        {
            "method": "gcash",
            "method_label": "GCash",
            "account_name": "Sara Seller",
            "account_number": "09171234567",
        }
    ]


def test_seller_does_not_see_payout_accounts_through_order(
    auth_client, other_client, user, listing
):
    from apps.accounts.models import PayoutAccount

    PayoutAccount.objects.create(
        user=user,
        method="gcash",
        account_name="Sara Seller",
        account_number="09171234567",
    )
    order = buy(other_client, listing).data

    response = auth_client.get(f"{ORDERS_URL}{order['id']}/")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["payout_accounts"] == []
