from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ConversationViewSet,
    ListingConversationMessagesView,
    ListingConversationView,
)

router = DefaultRouter()
router.register("conversations", ConversationViewSet, basename="conversation")

urlpatterns = [
    path(
        "listings/<uuid:listing_id>/conversation/",
        ListingConversationView.as_view(),
        name="listing-conversation",
    ),
    path(
        "listings/<uuid:listing_id>/conversation/messages/",
        ListingConversationMessagesView.as_view(),
        name="listing-conversation-messages",
    ),
    path("", include(router.urls)),
]
