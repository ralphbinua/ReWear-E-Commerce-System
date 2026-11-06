from django.urls import path

from .views import ListingBidListCreateView

urlpatterns = [
    path(
        "listings/<uuid:listing_id>/bids/",
        ListingBidListCreateView.as_view(),
        name="listing-bids",
    ),
]
