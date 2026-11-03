"""Local development settings."""

from .base import *  # noqa: F403
from .base import MIDDLEWARE as BASE_MIDDLEWARE
from .base import env_bool

DEBUG = True
ALLOWED_HOSTS = ["*"]

# Listings go live immediately locally; flip AUTO_APPROVE_LISTINGS=false to test the queue.
AUTO_APPROVE_LISTINGS = env_bool("AUTO_APPROVE_LISTINGS", True)

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
INTERNAL_IPS = ["127.0.0.1"]

# runserver serves static files itself; WhiteNoise is for production only.
MIDDLEWARE = [
    item for item in BASE_MIDDLEWARE if item != "whitenoise.middleware.WhiteNoiseMiddleware"
]

# Generated file uploads are fine on disk while developing.
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}
