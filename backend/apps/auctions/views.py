"""Bid endpoints: public history + authenticated bid placement."""

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from apps.catalog.models import Listing

from .serializers import AuctionStateSerializer, BidCreateSerializer, BidSerializer
from .services import BidError, place_bid


class BidThrottle(UserRateThrottle):
    scope = "bids"


class ListingBidListCreateView(APIView):
    """GET is public bid history; POST places a bid as the signed-in user."""

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_throttles(self):
        if self.request.method == "POST":
            return [BidThrottle()]
        return []

    def get_listing(self, listing_id):
        return get_object_or_404(Listing.objects.select_related("seller"), pk=listing_id)

    def get(self, request, listing_id):
        listing = self.get_listing(listing_id)
        serializer = AuctionStateSerializer(listing, context={"request": request})
        return Response(serializer.data)

    def post(self, request, listing_id):
        listing = self.get_listing(listing_id)
        payload = BidCreateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        try:
            bid, listing, extended = place_bid(
                listing, request.user, payload.validated_data["amount"]
            )
        except BidError as exc:
            return Response(
                {"detail": exc.message},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = AuctionStateSerializer(listing, context={"request": request}).data
        data["bid"] = BidSerializer(bid, context={"request": request}).data
        data["extended"] = extended
        return Response(data, status=status.HTTP_201_CREATED)
