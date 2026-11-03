import pytest
from rest_framework import status

pytestmark = pytest.mark.django_db


def test_health_reports_database(api_client):
    response = api_client.get("/health/")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["status"] == "ok"
    assert response.data["database"] == "up"


def test_openapi_schema_builds(api_client):
    response = api_client.get("/api/schema/")

    assert response.status_code == status.HTTP_200_OK
