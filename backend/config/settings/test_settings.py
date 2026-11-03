"""Test settings — SQLite in-memory.

`pytest` uses this module (see pyproject.toml) so tests never touch your
Supabase database. Everything else mirrors the dev defaults.
"""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("AUTO_APPROVE_LISTINGS", "true")

from .base import *  # noqa: E402,F403,F401
from .base import MIDDLEWARE as BASE_MIDDLEWARE  # noqa: E402

# Real-time static serving is irrelevant in tests; silence WhiteNoise.
MIDDLEWARE = [  # noqa: F405
    item
    for item in BASE_MIDDLEWARE
    if item != "whitenoise.middleware.WhiteNoiseMiddleware"
]

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
