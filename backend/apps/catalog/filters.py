import django_filters as filters
from django.utils import timezone

from .models import Listing


class ListingFilter(filters.FilterSet):
    type = filters.ChoiceFilter(choices=Listing.Type.choices)
    condition = filters.ChoiceFilter(choices=Listing.Condition.choices)
    audience = filters.ChoiceFilter(choices=Listing.Audience.choices)
    category = filters.CharFilter(field_name="category__slug")
    brand = filters.CharFilter(field_name="brand__slug")
    size = filters.CharFilter(field_name="size__name")
    seller = filters.NumberFilter(field_name="seller__id")
    min_price = filters.NumberFilter(field_name="price", lookup_expr="gte")
    max_price = filters.NumberFilter(field_name="price", lookup_expr="lte")
    ending_soon = filters.BooleanFilter(method="filter_ending_soon")

    class Meta:
        model = Listing
        fields = ("type", "condition", "audience", "category", "brand", "size")

    def filter_ending_soon(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            type=Listing.Type.AUCTION,
            status=Listing.Status.ACTIVE,
            end_at__gt=timezone.now(),
        ).order_by("end_at")
