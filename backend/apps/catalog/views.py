from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Count, Max, Q
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from apps.core.services import audit, notify

from .filters import ListingFilter
from .models import Brand, Category, Listing, ListingImage, Size, Watchlist
from .permissions import IsListingOwnerOrStaff, IsSellerOrReadOnly
from .serializers import (
    BrandSerializer,
    CategorySerializer,
    ListingDetailSerializer,
    ListingImageSerializer,
    ListingListSerializer,
    ListingWriteSerializer,
    SizeSerializer,
)


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    pagination_class = None


class BrandViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Brand.objects.all()
    serializer_class = BrandSerializer
    pagination_class = None
    search_fields = ("name",)


class SizeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Size.objects.all()
    serializer_class = SizeSerializer
    pagination_class = None


class ListingViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedOrReadOnly, IsSellerOrReadOnly]
    filterset_class = ListingFilter
    search_fields = ("title", "description", "brand__name", "category__name")
    ordering_fields = ("created_at", "price", "end_at")
    ordering = ("-created_at",)

    def get_queryset(self):
        queryset = (
            Listing.objects.select_related("seller", "category", "brand", "size")
            .prefetch_related("images")
            .annotate(
                bid_count=Count("bids", distinct=True),
                highest_bid=Max("bids__amount"),
            )
        )
        user = self.request.user

        if user.is_authenticated and user.is_staff:
            return queryset
        if self.action == "mine":
            return queryset.filter(seller=user)
        if self.action == "list":
            return queryset.filter(status=Listing.Status.ACTIVE)
        if self.action == "retrieve":
            # Sold/ended listings stay viewable so order pages and shared links
            # don't 404. Drafts and removed items stay private to the seller.
            public_statuses = [
                Listing.Status.ACTIVE,
                Listing.Status.SOLD,
                Listing.Status.ENDED,
            ]
            if user.is_authenticated:
                return queryset.filter(
                    Q(status__in=public_statuses) | Q(seller=user)
                )
            return queryset.filter(status__in=public_statuses)
        if user.is_authenticated:
            return queryset.filter(Q(status=Listing.Status.ACTIVE) | Q(seller=user))
        return queryset.filter(status=Listing.Status.ACTIVE)

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return ListingWriteSerializer
        if self.action in {"list", "mine"}:
            return ListingListSerializer
        return ListingDetailSerializer

    def perform_create(self, serializer):
        if self.request.user.is_staff:
            raise PermissionDenied("Staff accounts can't create marketplace listings.")
        serializer.save(seller=self.request.user)

    def perform_update(self, serializer):
        if self.request.user.is_staff:
            raise PermissionDenied("Staff accounts can't edit marketplace listings.")
        listing = serializer.instance
        previous_end_at = listing.end_at
        updated = serializer.save()

        if (
            updated.type == Listing.Type.AUCTION
            and previous_end_at
            and updated.end_at
            and updated.end_at > previous_end_at
        ):
            self._notify_auction_extended(updated, previous_end_at)

    def _notify_auction_extended(self, listing, previous_end_at):
        new_end = timezone.localtime(listing.end_at).strftime("%b %d, %Y %I:%M %p")
        bidders = get_user_model().objects.filter(bids__listing=listing).distinct()
        for bidder in bidders:
            notify(
                bidder,
                "auction_extended",
                "Auction extended",
                f"{listing.title} now ends {new_end}.",
                f"/listing/{listing.id}",
            )
        audit(
            self.request.user,
            "listing.auction_extended",
            "listing",
            listing.id,
            {"from": previous_end_at.isoformat(), "to": listing.end_at.isoformat()},
        )

    def perform_destroy(self, instance):
        if self.request.user.is_staff:
            raise PermissionDenied("Staff accounts can't delete marketplace listings.")
        super().perform_destroy(instance)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        output = ListingDetailSerializer(serializer.instance, context=self.get_serializer_context())
        return Response(output.data, status=status.HTTP_201_CREATED)

    @extend_schema(responses=ListingListSerializer(many=True))
    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def mine(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        serializer = ListingListSerializer(
            page if page is not None else queryset,
            many=True,
            context=self.get_serializer_context(),
        )
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    @extend_schema(request=None, responses={201: ListingImageSerializer})
    @action(
        detail=True,
        methods=["post"],
        parser_classes=[MultiPartParser, FormParser],
        permission_classes=[IsAuthenticated, IsSellerOrReadOnly],
    )
    def images(self, request, pk=None):
        listing = self.get_object()
        upload = request.FILES.get("image")

        if upload is None:
            return Response(
                {"detail": "Attach an image using the 'image' field."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if listing.images.count() >= settings.MAX_LISTING_IMAGES:
            return Response(
                {"detail": f"A listing can have at most {settings.MAX_LISTING_IMAGES} photos."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        position = listing.images.count()
        image = ListingImage.objects.create(
            listing=listing,
            image=upload,
            alt_text=request.data.get("alt_text", ""),
            position=position,
            is_primary=position == 0,
        )
        serializer = ListingImageSerializer(image, context=self.get_serializer_context())
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @extend_schema(request=None, responses={200: None})
    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def watch(self, request, pk=None):
        listing = self.get_object()
        entry, created = Watchlist.objects.get_or_create(user=request.user, listing=listing)
        if not created:
            entry.delete()
        return Response({"watching": created})

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        Listing.objects.filter(pk=instance.pk).update(view_count=instance.view_count + 1)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class ListingImageViewSet(mixins.DestroyModelMixin, viewsets.GenericViewSet):
    queryset = ListingImage.objects.select_related("listing")
    serializer_class = ListingImageSerializer
    permission_classes = [IsAuthenticated, IsListingOwnerOrStaff]
    http_method_names = ["delete"]
