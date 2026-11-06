from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import NotificationViewSet, cron_close_auctions

router = DefaultRouter()
router.register("notifications", NotificationViewSet, basename="notification")

urlpatterns = [
    path("cron/close-auctions/", cron_close_auctions, name="cron-close-auctions"),
    path("", include(router.urls)),
]
