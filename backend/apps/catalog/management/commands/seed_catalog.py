from django.core.management.base import BaseCommand
from django.db import transaction

from apps.catalog.models import Brand, Category, Size

CATEGORIES = [
    "Tops",
    "Bottoms",
    "Dresses",
    "Outerwear",
    "Shoes",
    "Bags & Accessories",
    "Activewear",
]

BRANDS = [
    "Nike",
    "Levi's",
    "Zara",
    "H&M",
    "Uniqlo",
    "Carhartt",
    "The North Face",
    "Ralph Lauren",
    "Adidas",
    "Dickies",
]

SIZES = {
    Size.Kind.TOP: ["XS", "S", "M", "L", "XL", "XXL"],
    Size.Kind.BOTTOM: ["24", "26", "28", "30", "32", "34", "36"],
    Size.Kind.SHOES: ["5", "6", "7", "8", "9", "10", "11", "12"],
    Size.Kind.ONE_SIZE: ["One size"],
}


class Command(BaseCommand):
    help = "Seed reference data (categories, brands, sizes). Safe to run repeatedly."

    @transaction.atomic
    def handle(self, *args, **options):
        created = {"categories": 0, "brands": 0, "sizes": 0}

        for order, name in enumerate(CATEGORIES):
            _, was_created = Category.objects.get_or_create(name=name, defaults={"order": order})
            created["categories"] += int(was_created)

        for name in BRANDS:
            _, was_created = Brand.objects.get_or_create(name=name)
            created["brands"] += int(was_created)

        for kind, names in SIZES.items():
            for order, name in enumerate(names):
                _, was_created = Size.objects.get_or_create(
                    kind=kind, name=name, defaults={"order": order}
                )
                created["sizes"] += int(was_created)

        self.stdout.write(
            self.style.SUCCESS(
                "Seed complete: "
                f"{created['categories']} categories, "
                f"{created['brands']} brands, "
                f"{created['sizes']} sizes added."
            )
        )
