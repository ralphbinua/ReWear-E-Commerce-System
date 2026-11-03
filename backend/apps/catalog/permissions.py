from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsSellerOrReadOnly(BasePermission):
    """Anyone can read; only the seller (or staff) can mutate the listing."""

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return request.user.is_authenticated and (
            obj.seller_id == request.user.id or request.user.is_staff
        )


class IsListingOwnerOrStaff(BasePermission):
    """For child objects (images) that hang off a listing."""

    def has_object_permission(self, request, view, obj):
        listing = getattr(obj, "listing", None)
        if listing is None:
            return False
        return request.user.is_authenticated and (
            listing.seller_id == request.user.id or request.user.is_staff
        )
