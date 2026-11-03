from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BrandViewSet,
    CategoryViewSet,
    ListingImageViewSet,
    ListingViewSet,
    SizeViewSet,
)

router = DefaultRouter()
router.register("listings", ListingViewSet, basename="listing")
router.register("listing-images", ListingImageViewSet, basename="listing-image")
router.register("categories", CategoryViewSet, basename="category")
router.register("brands", BrandViewSet, basename="brand")
router.register("sizes", SizeViewSet, basename="size")

urlpatterns = [path("", include(router.urls))]
