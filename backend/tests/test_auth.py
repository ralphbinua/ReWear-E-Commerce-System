import pytest
from rest_framework import status

pytestmark = pytest.mark.django_db

REGISTER_URL = "/api/v1/auth/register/"
LOGIN_URL = "/api/v1/auth/login/"
REFRESH_URL = "/api/v1/auth/refresh/"
LOGOUT_URL = "/api/v1/auth/logout/"
ME_URL = "/api/v1/auth/me/"


def test_register_returns_tokens_and_user(api_client):
    response = api_client.post(
        REGISTER_URL,
        {
            "email": "new@example.com",
            "password": "Str0ngPass!23",
            "first_name": "New",
            "last_name": "User",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["user"]["email"] == "new@example.com"
    assert response.data["access"]
    assert response.data["refresh"]


def test_register_rejects_duplicate_email(api_client, user):
    response = api_client.post(
        REGISTER_URL,
        {"email": user.email, "password": "Str0ngPass!23"},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "email" in response.data


def test_register_rejects_weak_password(api_client):
    response = api_client.post(
        REGISTER_URL,
        {"email": "weak@example.com", "password": "123"},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "password" in response.data


def test_login_returns_user_payload(api_client, user):
    response = api_client.post(
        LOGIN_URL,
        {"email": user.email, "password": "Str0ngPass!23"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["user"]["id"] == user.id
    assert response.data["access"]


def test_me_requires_authentication(api_client):
    assert api_client.get(ME_URL).status_code == status.HTTP_401_UNAUTHORIZED


def test_me_accepts_bearer_token(api_client, user):
    login = api_client.post(
        LOGIN_URL,
        {"email": user.email, "password": "Str0ngPass!23"},
        format="json",
    )
    access = login.data["access"]

    response = api_client.get(ME_URL, HTTP_AUTHORIZATION=f"Bearer {access}")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["email"] == user.email


def test_logout_blacklists_refresh_token(api_client, user):
    login = api_client.post(
        LOGIN_URL,
        {"email": user.email, "password": "Str0ngPass!23"},
        format="json",
    )
    access, refresh = login.data["access"], login.data["refresh"]

    logout = api_client.post(
        LOGOUT_URL,
        {"refresh": refresh},
        format="json",
        HTTP_AUTHORIZATION=f"Bearer {access}",
    )
    assert logout.status_code == status.HTTP_204_NO_CONTENT

    reused = api_client.post(REFRESH_URL, {"refresh": refresh}, format="json")
    assert reused.status_code == status.HTTP_401_UNAUTHORIZED


def test_profile_update(auth_client, user):
    response = auth_client.patch(
        ME_URL,
        {"first_name": "Sara Jane", "bio": "Thrift curator"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    user.refresh_from_db()
    assert user.first_name == "Sara Jane"
    assert user.bio == "Thrift curator"


def test_address_is_scoped_to_user(auth_client, user):
    create = auth_client.post(
        "/api/v1/auth/addresses/",
        {
            "label": "Home",
            "recipient_name": "Sara Seller",
            "phone": "09171234567",
            "line1": "12 Katipunan Ave",
            "city": "Quezon City",
            "province": "Metro Manila",
            "postal_code": "1108",
            "is_default": True,
        },
        format="json",
    )
    assert create.status_code == status.HTTP_201_CREATED

    response = auth_client.get("/api/v1/auth/addresses/")
    assert len(response.data) == 1
    assert response.data[0]["city"] == "Quezon City"
