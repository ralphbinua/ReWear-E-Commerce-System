# ReWear

Secondhand fashion marketplace — buy, sell, trade, donate, and auction pre-loved apparel.
The full product and delivery plan lives in [`PLAN.md`](PLAN.md).

**Current status:** full backend foundation + auction-close cron endpoint wired (Django + DRF + JWT, 32 tests). Seller flow done — create a listing end-to-end with photos (`/sell`). Frontend has Home, Browse, Listing detail, auth, images. Orders flow, bid placement, and chat are next.

---

## Stack

| Layer | Tech |
|---|---|
| API | Django 5.2 + Django REST Framework |
| Auth | SimpleJWT (email login, 15-min access / 7-day refresh, blacklist on logout) |
| DB | Supabase Postgres (transaction pooler, port 6543) via `DATABASE_URL` |
| Scheduled jobs | **Vercel Cron** (HTTP endpoints, no worker) — bid closing, unpaid-order cancel, payment auto-release |
| Realtime | **Supabase Realtime** on `bids` inserts · SSE/polling fallback |
| Hosting | **Vercel only** — one project, Django as a Python Functions service + React as the static frontend |
| Frontend | React 19 + TypeScript · Vite · Tailwind v4 · TanStack Query · Axios |
| Files | Local disk now · Supabase Storage for deploys |
| Docs | OpenAPI at `/api/docs/` |

---

## Quickstart (Windows PowerShell)

```bash
cd backend

python -m pip install -r requirements/dev.txt

Copy-Item ..\env.example ..\.env     # then set DATABASE_URL in it to your Supabase URL
python manage.py migrate
python manage.py seed_catalog
python manage.py createsuperuser
python manage.py runserver
```

In a second terminal, the frontend:

```powershell
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxies /api → :8000)
```

macOS / Linux:

```bash
cd backend
pip install -r requirements/dev.txt
cp ../env.example ../.env
python manage.py migrate
python manage.py seed_catalog
python manage.py runserver

cd ../frontend
npm install
npm run dev
```

Open:

- Web app — <http://localhost:5173>
- API docs — <http://localhost:8000/api/docs/>
- Admin — <http://localhost:8000/admin/>
- Health — <http://localhost:8000/health/>

Supabase is the only database — dev included. `python manage.py check` will refuse to boot until `.env` has a working `DATABASE_URL` (see below). Tests always use in-memory SQLite and never see your Supabase DB.

### Using Supabase

ReWear uses **Supabase Postgres** everywhere — no local database file at all. Copy the **transaction pooler** connection string from **Project Settings → Database → Connection pooling** into `DATABASE_URL` (port **6543**, keep `?sslmode=require`). Nothing else changes.

### Deploying — Vercel only

One Vercel project, two services in the repo root (`vercel.json` is already wired up):

```json
{
  "crons": [
    { "path": "/api/v1/cron/close-auctions/", "schedule": "*/5 * * * *" }
  ],
  "services": {
    "frontend": { "root": "frontend",
                  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] },
    "backend":  { "root": "backend", "entrypoint": "config.wsgi:application" }
  },
  "rewrites": [
    { "source": "/api/(.*)",    "destination": { "service": "backend" } },
    { "source": "/admin/(.*)",  "destination": { "service": "backend" } },
    { "source": "/static/(.*)", "destination": { "service": "backend" } },
    { "source": "/(.*)",        "destination": { "service": "frontend" } }
  ]
}
```

Env vars to set in the Vercel project settings: `DJANGO_SECRET_KEY`, `DATABASE_URL`,
`CRON_SECRET`, `DJANGO_DEBUG=false`, `DJANGO_ALLOWED_HOSTS`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.

The cron path `/api/v1/cron/close-auctions/` calls Django with `Authorization: Bearer $CRON_SECRET` and closes expired auctions (sale, reserve-not-met, or no bids), creating orders only when there is a winner.

---

## Tests & lint

```bash
cd backend
pytest                 # 32 tests
ruff check .
ruff format --check .
```

Tests use in-memory SQLite (`config/settings/test_settings.py`) and never touch your Supabase database.

---

## API (v1)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/auth/register/` | Returns `user`, `access`, `refresh` |
| POST | `/api/v1/auth/login/` | Email + password |
| POST | `/api/v1/auth/refresh/` | Rotates refresh token |
| POST | `/api/v1/auth/logout/` | Blacklists the refresh token |
| GET/PATCH | `/api/v1/auth/me/` | Current profile |
| CRUD | `/api/v1/auth/addresses/` | Scoped to the logged-in user |
| CRUD | `/api/v1/auth/payout-accounts/` | GCash / Maya / bank |
| GET | `/api/v1/listings/` | Public browse; filters + search + ordering |
| POST | `/api/v1/listings/` | Create (seller is set server-side) |
| GET | `/api/v1/listings/{id}/` | Public if active; owner can see drafts |
| PATCH/DELETE | `/api/v1/listings/{id}/` | Seller or staff only |
| POST | `/api/v1/listings/{id}/images/` | Multipart photo upload, max 8 |
| DELETE | `/api/v1/listing-images/{id}/` | Seller or staff only |
| GET | `/api/v1/listings/mine/` | Seller's own listings |
| POST | `/api/v1/listings/{id}/watch/` | Toggle watchlist |
| GET | `/api/v1/categories/` · `/brands/` · `/sizes/` | Reference data |

Browse filters: `type`, `condition`, `audience`, `category` (slug), `brand` (slug),
`size`, `seller`, `min_price`, `max_price`, `ending_soon`, `search`, `ordering`, `page`, `page_size`.

### Auth header

```
Authorization: Bearer <access>
```

The access token is kept in memory; the refresh token lives in `localStorage`
and is used to silently rehydrate the session on page load. If you build a
dedicated "remember me" flow, switch to an httpOnly cookie once the backend
sets one.

---

## Layout

```
├── vercel.json        one project, two services + cron
├── frontend/          Vite + React 19 + TypeScript + Tailwind v4
│   └── src/
│       ├── lib/          axios instance, token store, utils
│       ├── services/     auth, listings
│       ├── context/      auth (rehydrate-on-refresh), ProtectedRoute, Layout
│       ├── components/   ListingCard, ProtectedRoute, Layout, ui/*
│       └── pages/        Home, Browse, ListingDetail, Login, Register, 404
└── backend/
    ├── config/            settings (base/dev/prod), urls, wsgi
    ├── apps/
    │   ├── core/          timestamps, notifications, audit log, cron endpoint, pagination
    │   ├── accounts/      User (email login), Address, PayoutAccount + auth API
    │   ├── catalog/       Category, Brand, Size, Listing, ListingImage, Watchlist
    │   ├── auctions/      Bid, AuctionResult + close_expired_auctions (cron-ready)
    │   ├── commerce/      Offer, Order, PaymentProof, PlatformFee, Shipment, Dispute, Review
    │   ├── trading/       TradeOffer, TradeItem
    │   ├── donations/     PartnerOrg, Donation
    │   ├── messaging/     Conversation, Message
    │   └── moderation/    Report, ModerationAction
    ├── tests/
    └── requirements/
```

---

## Notes

- Listing photos are stored in `backend/media/` during development and served only when `DEBUG=true`.
- New listings are auto-approved in dev (`AUTO_APPROVE_LISTINGS=true`). Set it to `false` to exercise the moderation queue.
- Money is stored as `Decimal` and never calculated on the client.
- `reserve_price` is intentionally excluded from all public serializers.
