from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import OfferViewSet, OrderViewSet

router = DefaultRouter()
router.register("orders", OrderViewSet, basename="order")
router.register("offers", OfferViewSet, basename="offer")

urlpatterns = [path("", include(router.urls))]
