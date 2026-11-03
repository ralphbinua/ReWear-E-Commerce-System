from django.urls import path

from .views import cron_close_auctions

urlpatterns = [
    path("cron/close-auctions/", cron_close_auctions, name="cron-close-auctions"),
]
