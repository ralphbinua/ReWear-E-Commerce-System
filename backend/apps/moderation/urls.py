from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminBrandViewSet,
    AdminCategoryViewSet,
    AdminDisputeViewSet,
    AdminListingViewSet,
    AdminOrderViewSet,
    AdminSizeViewSet,
    AdminUserViewSet,
    AuditLogViewSet,
    ReportViewSet,
    SystemSummaryView,
)

router = DefaultRouter()
router.register("listings", AdminListingViewSet, basename="admin-listing")
router.register("reports", ReportViewSet, basename="report")
router.register("users", AdminUserViewSet, basename="admin-user")
router.register("disputes", AdminDisputeViewSet, basename="admin-dispute")
router.register("orders", AdminOrderViewSet, basename="admin-order")
router.register("categories", AdminCategoryViewSet, basename="admin-category")
router.register("brands", AdminBrandViewSet, basename="admin-brand")
router.register("sizes", AdminSizeViewSet, basename="admin-size")
router.register("audit-logs", AuditLogViewSet, basename="admin-audit-log")

urlpatterns = [
    path("summary/", SystemSummaryView.as_view(), name="admin-summary"),
    path("", include(router.urls)),
]
