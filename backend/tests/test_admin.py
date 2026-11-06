import pytest
from rest_framework import status

from apps.catalog.models import Listing
from apps.moderation.models import ModerationAction, Report

pytestmark = pytest.mark.django_db

ADMIN_URL = "/api/v1/admin/"


@pytest.fixture
def staff_client(user):
    user.is_staff = True
    user.save(update_fields=["is_staff"])
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_admin_endpoints_require_staff(api_client, other_client):
    assert api_client.get(f"{ADMIN_URL}summary/").status_code == status.HTTP_401_UNAUTHORIZED
    assert other_client.get(f"{ADMIN_URL}summary/").status_code == status.HTTP_403_FORBIDDEN


def test_staff_can_approve_and_remove_listings(staff_client, listing):
    listing.status = Listing.Status.PENDING_REVIEW
    listing.save(update_fields=["status", "updated_at"])

    approve = staff_client.post(
        f"{ADMIN_URL}listings/{listing.id}/approve/", {}, format="json"
    )
    assert approve.status_code == status.HTTP_200_OK
    listing.refresh_from_db()
    assert listing.status == Listing.Status.ACTIVE

    remove = staff_client.post(
        f"{ADMIN_URL}listings/{listing.id}/remove/", {}, format="json"
    )
    assert remove.status_code == status.HTTP_200_OK
    listing.refresh_from_db()
    assert listing.status == Listing.Status.REMOVED


def test_staff_can_resolve_report_with_removal(staff_client, user, other_user, listing):
    report = Report.objects.create(
        reporter=other_user,
        target_type="listing",
        target_id=str(listing.id),
        reason=Report.Reason.SCAM,
        details="Seller wants off-platform payment.",
    )

    response = staff_client.post(
        f"{ADMIN_URL}reports/{report.id}/resolve/",
        {"status": "actioned", "action": "remove_listing", "notes": "Removed scam listing."},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK, response.data
    report.refresh_from_db()
    listing.refresh_from_db()
    assert report.status == Report.Status.ACTIONED
    assert listing.status == Listing.Status.REMOVED
    assert ModerationAction.objects.filter(report=report).count() == 1


def test_staff_can_suspend_and_activate_user(staff_client, other_user):
    suspend = staff_client.post(f"{ADMIN_URL}users/{other_user.id}/suspend/", {}, format="json")
    assert suspend.status_code == status.HTTP_200_OK
    other_user.refresh_from_db()
    assert other_user.is_active is False

    activate = staff_client.post(f"{ADMIN_URL}users/{other_user.id}/activate/", {}, format="json")
    assert activate.status_code == status.HTTP_200_OK
    other_user.refresh_from_db()
    assert other_user.is_active is True


def test_staff_can_edit_user_account(staff_client, other_user):
    response = staff_client.patch(
        f"{ADMIN_URL}users/{other_user.id}/",
        {
            "username": "ben_buyer",
            "first_name": "Benjamin",
            "last_name": "Buyer",
            "phone": "09170000000",
            "is_staff": True,
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK, response.data
    other_user.refresh_from_db()
    assert other_user.username == "ben_buyer"
    assert other_user.first_name == "Benjamin"
    assert other_user.phone == "09170000000"
    assert other_user.is_staff is True


def test_summary_returns_system_counts(staff_client, user, listing):
    response = staff_client.get(f"{ADMIN_URL}summary/")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["active_users"] >= 1
    assert response.data["active_listings"] == 1
