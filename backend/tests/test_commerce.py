import io

import pytest
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

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


def test_staff_cannot_buy_or_offer(api_client, user, other_user, listing):
    user.is_staff = True
    user.save(update_fields=["is_staff"])
    staff_client = APIClient()
    staff_client.force_authenticate(user=user)

    buyer = buy(staff_client, listing)
    offer = staff_client.post(
        "/api/v1/offers/",
        {"listing": str(listing.id), "amount": "950.00"},
        format="json",
    )

    assert buyer.status_code == status.HTTP_400_BAD_REQUEST
    assert offer.status_code == status.HTTP_400_BAD_REQUEST


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


def complete_order(other_client, listing):
    order = buy(other_client, listing).data
    Order.objects.filter(pk=order["id"]).update(status=Order.Status.COMPLETED)
    return order


def test_buyer_can_rate_seller_after_completion(
    auth_client, other_client, user, other_user, listing
):
    order = complete_order(other_client, listing)

    response = other_client.post(
        f"{ORDERS_URL}{order['id']}/review/",
        {"rating": 5, "comment": "Fast shipping, exactly as described."},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED, response.data
    assert response.data["rating"] == 5
    assert response.data["reviewer"] == other_user.id
    assert response.data["reviewee"] == user.id

    user.refresh_from_db()
    assert user.rating_count == 1
    assert str(user.rating_avg) == "5.00"

    detail = other_client.get(f"{ORDERS_URL}{order['id']}/").data
    assert len(detail["reviews"]) == 1
    assert detail["reviews"][0]["comment"] == "Fast shipping, exactly as described."


def test_seller_can_rate_buyer_after_completion(auth_client, other_client, other_user, listing):
    order = complete_order(other_client, listing)

    response = auth_client.post(
        f"{ORDERS_URL}{order['id']}/review/",
        {"rating": 4, "comment": "Smooth transaction."},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED, response.data
    assert response.data["reviewee"] == other_user.id

    other_user.refresh_from_db()
    assert other_user.rating_count == 1
    assert str(other_user.rating_avg) == "4.00"


def test_cannot_rate_before_completion(other_client, listing):
    order = buy(other_client, listing).data

    response = other_client.post(
        f"{ORDERS_URL}{order['id']}/review/", {"rating": 5}, format="json"
    )

    assert response.status_code == status.HTTP_409_CONFLICT


def test_cannot_rate_same_order_twice(other_client, listing):
    order = complete_order(other_client, listing)
    payload = {"rating": 5}

    first = other_client.post(
        f"{ORDERS_URL}{order['id']}/review/", payload, format="json"
    )
    second = other_client.post(
        f"{ORDERS_URL}{order['id']}/review/", payload, format="json"
    )

    assert first.status_code == status.HTTP_201_CREATED
    assert second.status_code == status.HTTP_409_CONFLICT


def test_stranger_cannot_rate_an_order(other_client, listing):
    from rest_framework.test import APIClient

    from apps.accounts.models import User

    order = complete_order(other_client, listing)
    stranger = APIClient()
    stranger.force_authenticate(
        user=User.objects.create_user(email="nosy@example.com", password="Pass123!")
    )

    response = stranger.post(
        f"{ORDERS_URL}{order['id']}/review/", {"rating": 1}, format="json"
    )

    # Strangers cannot even see the order, so the endpoint 404s for them.
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_rating_must_be_between_one_and_five(other_client, listing):
    order = complete_order(other_client, listing)

    too_low = other_client.post(
        f"{ORDERS_URL}{order['id']}/review/", {"rating": 0}, format="json"
    )
    too_high = other_client.post(
        f"{ORDERS_URL}{order['id']}/review/", {"rating": 6}, format="json"
    )

    assert too_low.status_code == status.HTTP_400_BAD_REQUEST
    assert too_high.status_code == status.HTTP_400_BAD_REQUEST


def make_dashboard_order(listing, buyer, seller, item_price, platform_fee, status_value):
    return Order.objects.create(
        listing=listing,
        buyer=buyer,
        seller=seller,
        item_price=item_price,
        platform_fee=platform_fee,
        total=item_price,
        status=status_value,
    )


def test_seller_dashboard_summarizes_sales(auth_client, user, other_user, listing):
    completed = make_dashboard_order(
        listing,
        other_user,
        user,
        "1200.00",
        "84.00",
        Order.Status.COMPLETED,
    )
    make_dashboard_order(
        listing,
        other_user,
        user,
        "800.00",
        "56.00",
        Order.Status.PAID,
    )
    make_dashboard_order(
        listing,
        other_user,
        user,
        "500.00",
        "35.00",
        Order.Status.PENDING_PAYMENT,
    )
    make_dashboard_order(
        listing,
        other_user,
        user,
        "200.00",
        "14.00",
        Order.Status.PAYMENT_REVIEW,
    )
    listing.view_count = 42
    listing.save(update_fields=["view_count", "updated_at"])

    from apps.accounts.models import PayoutAccount

    PayoutAccount.objects.create(
        user=user,
        method="gcash",
        account_name="Sara Seller",
        account_number="09171234567",
        is_verified=True,
    )

    response = auth_client.get(f"{ORDERS_URL}seller-dashboard/")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["stats"]["total_sales"] == 4
    assert response.data["stats"]["paid_sales"] == 2
    assert response.data["stats"]["gross_revenue"] == "2000.00"
    assert response.data["stats"]["platform_fees"] == "140.00"
    assert response.data["stats"]["net_earnings"] == "1860.00"
    assert response.data["stats"]["pending_payment_orders"] == 1
    assert response.data["stats"]["pending_amount"] == "500.00"
    assert response.data["stats"]["payment_review_orders"] == 1
    assert response.data["stats"]["total_views"] == 42
    assert completed.id in [row["id"] for row in response.data["recent_sales"]]
    assert response.data["top_listings"][0]["id"] == str(listing.id)
    assert response.data["payout_accounts"][0]["account_name"] == "Sara Seller"


def test_seller_dashboard_requires_auth(api_client):
    response = api_client.get(f"{ORDERS_URL}seller-dashboard/")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
