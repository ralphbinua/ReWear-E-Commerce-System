from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminDisputeViewSet,
    AdminListingViewSet,
    AdminOrderViewSet,
    AdminUserViewSet,
    ReportViewSet,
    SystemSummaryView,
)

router = DefaultRouter()
router.register("listings", AdminListingViewSet, basename="admin-listing")
router.register("reports", ReportViewSet, basename="report")
router.register("users", AdminUserViewSet, basename="admin-user")
router.register("disputes", AdminDisputeViewSet, basename="admin-dispute")
router.register("orders", AdminOrderViewSet, basename="admin-order")

urlpatterns = [
    path("summary/", SystemSummaryView.as_view(), name="admin-summary"),
    path("", include(router.urls)),
]
