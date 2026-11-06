from django.conf import settings
from django.db import connection
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import (
    action,
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.auctions.services import close_expired_auctions

from .serializers import NotificationSerializer


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    """Liveness + database readiness probe used by Render/UptimeRobot."""
    try:
        connection.ensure_connection()
        db_ok = True
    except Exception:  # noqa: BLE001 - never let a probe 500
        db_ok = False

    payload = {
        "status": "ok" if db_ok else "degraded",
        "database": "up" if db_ok else "down",
        "version": "0.1.0",
    }
    return Response(
        payload,
        status=status.HTTP_200_OK if db_ok else status.HTTP_503_SERVICE_UNAVAILABLE,
    )


@api_view(["GET", "POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def cron_close_auctions(request):
    """Vercel Cron target: close auctions whose end time has passed.

    Vercel sends `Authorization: Bearer <CRON_SECRET>`. Refuses to run if the
    secret is not configured, so the endpoint is never hit anonymously.
    """
    secret = settings.CRON_SECRET
    if not secret:
        return Response(
            {"detail": "CRON_SECRET is not configured."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    if request.headers.get("Authorization") != f"Bearer {secret}":
        return Response({"detail": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

    closed = close_expired_auctions()
    return Response({"closed_auctions": closed})


class NotificationViewSet(
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """In-app notifications for the signed-in user (payment, bids, orders)."""

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return self.request.user.notifications.order_by("-created_at")

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        count = self.request.user.notifications.filter(is_read=False).count()
        return Response({"count": count})

    @action(detail=True, methods=["post"], url_path="read")
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=["is_read", "updated_at"])
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        updated = self.request.user.notifications.filter(is_read=False).update(is_read=True)
        return Response({"updated": updated})
