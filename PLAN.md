# ReWear — Technical & Delivery Plan

> Reuse, restyle, rewear.
> A secondhand fashion marketplace with **buy / sell / trade / donate / auction**, built by a small team in ~24 weeks.

---

## 1. What we are building

From the one-page business plan:

| Pillar | Detail |
|---|---|
| Problem | Fast fashion wastes textiles; fixed-price resale leaves value on the table for rare/designer pieces |
| Solution | One marketplace for resale, peer trades, donations, and **live competitive auctions** |
| Users | Eco-conscious shoppers, budget thrifters, vintage collectors, high-value sellers |
| Edge | Dedicated fashion ecosystem + curated bidding + **integrated local courier logistics** |
| Revenue | 5–8% commission on sales/auctions, featured-auction spots, delivery margin |
| Targets | Month 2: 50 beta transactions · Month 4: 500 users / 200 listings · Month 6: 2 NGO partners |

**Product shape:** installable **PWA** (responsive web) for the MVP, since the stack is React + Tailwind. Same REST API can back a React Native app later — no rewrites.

---

## 2. Stack decisions

| Layer | Choice | Why |
|---|---|---|
| API | **Django 5.2 LTS + Django REST Framework** | Batteries-included admin (free moderation console), strong ORM for transactional bid logic, mature auth |
| Scheduled jobs | **Vercel Cron** (HTTP endpoints, no worker) | Auction closing, auto-cancel of unpaid orders, payment auto-release. Django functions must be stateless |
| Realtime | **Supabase Realtime** (Postgres `INSERT` on `bids`) · SSE or polling fallback | Vercel Python functions are ephemeral; Channels workers can't run there. Bids still validated by Django |
| DB | **Supabase Postgres** | It *is* Postgres, plus managed backups, connection pooling, and a dashboard. One-line switch to any Postgres host |
| Files | **Supabase Storage** | Listing photos, avatars, donation receipts; signed URLs, CDN included |
| Frontend | **React 19 + TypeScript + Vite** | Fast dev loop, typed API contracts |
| Styling | **Tailwind CSS v4 + shadcn/ui + lucide-react** | Matches the logo's green/cream identity, accessible primitives, no design system to invent |
| Data layer | **TanStack Query + Axios** | Caching, optimistic bid updates, background refetch |
| Payments | **Manual — no gateway.** GCash / Maya / bank transfer + proof-of-payment upload, verified by seller or admin | No merchant account, no KYC, no integration risk. Swap in PayMongo later without touching orders |
| Email | **Resend** (or Supabase SMTP) | Transactional: outbid, won auction, order updates |
| Hosting | **Vercel only** — Django as a Python Functions service + React as the frontend, same monorepo | One deploy target, same-origin `/api/*` rewrites like the Real-Estate project; no Render account needed |
| Monitoring | **Sentry** (FE + BE) + **UptimeRobot** | Catch broken auction flows before users do |

### Why Supabase over "plain Postgres"
Supabase **is** Postgres — you keep full SQL, migrations, and `psql` access. You gain managed backups, dashboard, storage, and pooling for free. If you ever need to leave, `pg_dump` and point `DATABASE_URL` elsewhere. **Lock-in is low.**

### Deliberate non-choices (and why)
- **No payment gateway.** Money moves off-platform (GCash/Maya/bank transfer); the app only *records and verifies* it. This removes merchant onboarding, PCI scope, webhook failures, and refund disputes from the critical path — and it is what a campus beta actually needs on day one.
- **No Supabase Auth.** Django owns users, roles, and permissions. Syncing a second identity provider is the #1 source of bugs in Supabase + Django builds. Use **SimpleJWT** (access in memory, refresh in `localStorage` for MVP; httpOnly cookie when the login endpoint sets one).
- **No Celery / no long-lived workers.** Vercel runs Django as ephemeral serverless functions. Every scheduled task (auction close, unpaid-order auto-cancel, payment auto-release) is a plain `manage.py`/HTTP endpoint triggered by **Vercel Cron**, passing a `CRON_SECRET` bearer token.
- **No Django Channels.** Bids are validated transactionally by Django, then fans out through **Supabase Realtime** (`INSERT` on `bids`). If that becomes flaky, poll the bids list every second — far simpler than a WebSocket worker.
- **No Render / Railway / Fly / VPS.** One platform only: Vercel (Functions + static frontend). Supabase stays as the database/storage service.
- **No live video auctions** in v1 — timed auctions only. Streaming is a v2 project.
- **No AI pricing model** in v1 — ship a transparent **comparables-based** suggestion (median of same category/brand/condition), upgrade later.

---

## 3. Architecture

```
┌──────────────────── Vercel (one project) ───────────────────────┐
│                                                                 │
│  ┌──────────────────────────────┐  ┌─────────────────────────┐   │
│  │ React PWA  (static SPA)      │  │ Django + DRF (Python    │   │
│  │ Tailwind · TanStack Query    │  │ Functions, WSGI)        │   │
│  └───────┬──────────────────────┘  │  · JWT auth & roles     │   │
│          │ same origin             │  · Auction engine       │   │
│          └───────── /api/* ───────►│  · Orders & pay checks │   │
│                 /admin/*           │  · Cron endpoints       │   │
│                 /static/*          └───┬───────────────────────┘   │
│                                        │                           │
└────────────────────────────────────────┼───────────────────────────┘
                                         │
                    ┌────────────────────▼────────────────────┐
                    ▼                    ▼                     ▼
                 Supabase           Supabase Realtime        Resend
                 Postgres           (INSERT on bids)         (email)
                 + Storage          GCash/Maya: off-platform
```

**Rule:** every bid, purchase, and state transition goes through the Django API. The frontend never computes a winning bid — it renders what the server confirms.

---

## 4. Scope

### MVP-0 — Beta (target: Week 8) → hits the "50 transactions" objective
- [ ] Email/password auth, profile, shipping address
- [ ] Create listing (up to 8 photos, category, brand, size, condition, price)
- [ ] Browse + search + filters (category, size, brand, price, condition)
- [ ] Listing detail with seller info and safety tips
- [ ] Fixed-price order flow + **manual payment** (GCash/Maya, upload proof, seller confirms)
- [ ] Buyer ↔ seller chat per listing
- [ ] Order states + manual courier/tracking number entry
- [ ] Admin moderation: approve/reject/flag listings, ban users
- [ ] Reviews after completed order

### v1.0 — Public launch (target: Week 16) → hits "500 users / 200 listings"
- [ ] **Auctions**: countdown, min increment, reserve price, anti-snipe, outbid alerts
- [ ] Realtime bid feed + watchers
- [ ] Trade offers (item-for-item, optional cash top-up)
- [ ] Donation flow routed to partner NGOs + receipt
- [ ] Notifications (in-app + email), saved searches
- [ ] Disputes + payment-verification SLA + manual fee settlement
- [ ] Seller dashboard: sales, earnings, fees, payout requests

### v1.1 — Growth (target: Week 24) → hits "2 NGO partners"
- [ ] Partner portal (claim donations, impact dashboard)
- [ ] Featured/boosted listings (revenue)
- [ ] Referral codes (bonus bidding credits, shipping discounts)
- [ ] Price suggestion from comparables
- [ ] PWA install + push notifications
- [ ] Analytics dashboard + operational runbook

**Explicitly out of scope for now:** live video, international shipping, in-app wallet top-ups, native mobile apps, automated courier API integration (manual tracking is enough to prove the model).

---

## 5. Data model

Django apps (one concern per app):

```
accounts      User, Address, PayoutAccount, Verification
catalog       Category, Brand, Size, Listing, ListingImage, Watchlist
auctions      Bid, AuctionResult
commerce      Offer, Order, PaymentProof, Shipment, Dispute, Review
trading       TradeOffer, TradeItem
donations     PartnerOrg, Donation
messaging     Conversation, Message
moderation    Report, ModerationAction
core          Notification, AuditLog, PlatformFee
```

Key shapes (fields abbreviated):

```python
class Listing(models.Model):
    class Type(TextChoices):
        FIXED = "fixed"; AUCTION = "auction"; TRADE = "trade"; DONATION = "donation"
    class Status(TextChoices):
        DRAFT = "draft"; PENDING = "pending_review"; ACTIVE = "active"
        SOLD = "sold"; ENDED = "ended"; REMOVED = "removed"

    id = models.UUIDField(primary_key=True, default=uuid4)
    seller = models.ForeignKey(User, on_delete=models.CASCADE, related_name="listings")
    title, description, category, brand, size, condition, color
    type = models.CharField(choices=Type.choices)
    price = models.DecimalField(max_digits=10, decimal_places=2)   # fixed / trade value
    status = models.CharField(choices=Status.choices, db_index=True)

    # auction-only
    starting_bid = models.DecimalField(null=True, blank=True)
    reserve_price = models.DecimalField(null=True, blank=True)     # never exposed to buyers
    min_increment = models.DecimalField(default=20)
    start_at = models.DateTimeField(null=True)
    end_at = models.DateTimeField(null=True, db_index=True)
    extended_count = models.PositiveSmallIntegerField(default=0)   # anti-snipe cap

    boosted_until = models.DateTimeField(null=True)
    created_at, updated_at
```

```python
class Bid(models.Model):
    listing = FK(Listing)                 # must be type=auction, status=active
    bidder  = FK(User)
    amount  = Decimal
    created_at
    # unique_together = (listing, amount)  → prevents duplicate amounts
    # index = (listing, -amount)

class Order(models.Model):
    class Status(TextChoices):
        PENDING_PAYMENT  # 24h window to transfer + upload proof
        PAYMENT_REVIEW   # proof submitted, awaiting seller/admin check
        PAID             # proof verified — ship it
        SHIPPED
        DELIVERED        # buyer confirms, or auto after 3 days
        COMPLETED        # order closed, platform fee recorded
        CANCELLED; REFUNDED; DISPUTED
    listing, buyer, seller
    item_price, shipping_fee, platform_fee, total
    payment_method, payment_verified_at, payout_settled_at

class PaymentProof(models.Model):
    order      = FK(Order)
    method     = "gcash" | "maya" | "bank" | "cod"
    reference  = CharField(max_length=64)      # transfer ref no.
    screenshot = ImageField(null=True, blank=True)  # required except COD
    verified_by = FK(User, null=True)          # seller or admin
    status     = "pending" | "verified" | "rejected"
    created_at, verified_at
```

**Money rules:** `Decimal` everywhere (never float), store amounts in the smallest currency unit or `NUMERIC(10,2)`, and compute fees server-side only.

### Payment flow (no gateway)

1. Buyer places the order → `PENDING_PAYMENT`, sees the seller's GCash/Maya details and a **unique reference code** (the order number).
2. Buyer transfers, then uploads a screenshot + reference number → `PAYMENT_REVIEW`.
3. Seller confirms in their dashboard → `PAID`, or rejects with a reason and the buyer retries.
4. A **Vercel Cron** job (every 5–15 min) auto-cancels unpaid orders and escalates proof stuck in review for 24h to an admin.
5. On `COMPLETED`, a `PlatformFee` (5–8%) is written to the ledger; it is deducted from the seller's next payout or invoiced monthly.
6. **COD / meetup**: buyer confirms handover in-app, order jumps straight to `DELIVERED`, fee still recorded.

**Anti-fraud guards:** reference numbers are unique per order, screenshots live in a private bucket behind signed URLs, and a rejected proof requires a reason. No card data ever touches the system.

---

## 6. The auction engine (the hard part)

This is where the project either feels real or falls apart. Get it right and everything else is CRUD.

**Bid validation (`POST /listings/{id}/bids`, inside `transaction.atomic`):**
1. `select_for_update()` the listing row → serializes concurrent bids.
2. Reject if: not an auction, not `ACTIVE`, now < `start_at`, now > `end_at`, seller == bidder, bidder not verified.
3. `minimum = max(starting_bid, current_high + min_increment)` → reject `amount < minimum`.
4. Insert bid, then **anti-snipe**: if `end_at - now <= 120s` and `extended_count < 15` → `end_at = now + 120s`, `extended_count += 1`. Cap total extension at 30 minutes.
5. Insert bid → **Supabase Realtime** (Postgres `INSERT` on `bids`) pushes it to every subscriber of that auction; notify the previous high bidder by email + in-app.

**Closing (Vercel Cron, every 1–5 minutes):**
```
for each auction where end_at <= now and status = ACTIVE:
    lock listing
    winner = highest bid
    if no bids or (reserve_price and winner.amount < reserve_price):
        status = ENDED   # reserve_not_met, notify seller to relist or lower reserve
    else:
        status = SOLD
        create Order(PENDING_PAYMENT) with payment deadline = now + 24h
        notify winner (email + in-app) to upload proof
    payment deadline enforced by the same cron: if unpaid after 24h → cancel order, offer to next bidder
    notify all watchers by email + in-app
```

**Fairness details that impress reviewers**
- Bids are immutable; corrections happen via new bids, never edits.
- Public bid history anonymizes buyers (`r***a`) — privacy + anti-gaming.
- Server clock is the only clock; client countdown is cosmetic and resyncs on `auction.extended`.
- Rate-limit bids per user per auction (e.g. 30/min) to stop scripted sniping.
- Shill-bidding guard: flag accounts that repeatedly bid on their own circle's listings.

---

## 7. API surface (`/api/v1`)

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register` · `/auth/login` · `/auth/refresh` · `/auth/logout` · `GET /me` |
| Profile | `PATCH /me` · `/me/addresses` · `/me/payouts` · `GET /users/{id}` |
| Listings | `GET/POST /listings` · `GET/PATCH/DELETE /listings/{id}` · `POST /listings/{id}/images` · `POST /listings/{id}/boost` |
| Discovery | `GET /listings?q=&type=&category=&size=&brand=&min=&max=&sort=` · `GET /categories` · `GET /brands` |
| Auctions | `GET /listings/{id}/bids` · `POST /listings/{id}/bids` · `GET /auctions/live` · `POST /listings/{id}/watch` |
| Commerce | `POST /listings/{id}/checkout` · `GET /orders` · `GET /orders/{id}` · `POST /orders/{id}/ship` · `POST /orders/{id}/confirm` · `POST /orders/{id}/dispute` |
| Payments | `POST /orders/{id}/payment-proof` (multipart) · `POST /orders/{id}/verify-payment` (seller/admin) · `GET /orders/{id}/payment` |
| Trade | `POST /listings/{id}/trade-offers` · `POST /trade-offers/{id}/accept|decline` |
| Donate | `GET /partners` · `POST /donations` · `GET /donations/{id}/receipt` |
| Chat | `GET /conversations` · `GET /conversations/{id}/messages` · `WS /ws/chat/{id}` |
| Reviews | `POST /orders/{id}/review` · `GET /users/{id}/reviews` |
| Notifications | `GET /notifications` · `POST /notifications/read` |
| Admin | `/admin/*` (Django admin for MVP, custom dashboard later) |

Contract rules: cursor pagination, consistent `{results, next}` envelope, `400` with field errors, `409` for stale auction/order state, OpenAPI docs at `/api/docs` via **drf-spectacular**.

---

## 8. Frontend plan

**Routes**

```
/                    Home: hero, live auctions, fresh drops, categories
/browse              Grid + filter drawer (mobile) / sidebar (desktop)
/listing/:id         Gallery, seller, buy / bid / trade / donate CTA
/sell                Multi-step: photos → details → pricing → review
/auctions            Ending soon, live, upcoming
/auctions/:id        Bid panel + realtime feed + countdown
/messages            Thread list + chat pane
/orders              Purchases / Sales tabs
/orders/:id          Timeline, payment instructions + proof upload, tracking, dispute
/donate              Pick partner, schedule pickup
/profile/:id         Closet, reviews, ratings
/settings            Profile, addresses, payouts, notifications
/admin               Moderation queue (staff only)
```

**Component architecture**
- `routes/` page shells → `features/<domain>/` (api hooks, components, types)
- `components/ui/` shadcn primitives; `components/` shared app pieces
- Server state in TanStack Query only. No Redux. Local UI state via `useState`/`useReducer`.
- Auth: access token in memory, refresh token in `localStorage` → silent refresh on 401 via Axios interceptor. Session is rehydrated from the refresh token on page load.
- Realtime: one WebSocket provider that subscribes per route (`auction:{id}`), auto-reconnect with backoff, polling fallback after 3 failures.
- **Optimistic UI for bids, but roll back on server rejection** and surface the new minimum.

**Design system**
- Logo palette: deep green `#3F6B2B`, fresh green `#7CB342`, cream `#F7F5EE`, charcoal `#2B2B2B`.
- Tailwind theme tokens, not hardcoded hex.
- Mobile-first: 44px tap targets, sticky bottom CTA on listing pages, skeletons instead of spinners.
- Accessibility: keyboard-navigable filters, focus rings, WCAG AA contrast, `aria-live` on bid updates.

---

## 9. Repository layout

```
ReWear-E-Commerce-System/
├── backend/
│   ├── config/            settings/{base,dev,prod}.py, urls, wsgi, cron.py
│   ├── apps/              accounts, catalog, auctions, commerce, ...
│   ├── tests/             pytest, factory_boy
│   ├── manage.py
│   ├── requirements/      base.txt / dev.txt / prod.txt
│   └── pyproject.toml     ruff / pytest config
├── frontend/
│   ├── src/{routes,features,components,lib,hooks}
│   ├── public/
│   ├── vite.config.ts
│   └── vercel.json
├── docs/                  adr/, api.md, runbook.md
├── env.example
├── Makefile               make dev / test / migrate
└── README.md
```

Branching: `main` protected · `feat/<ticket>` → PR → 1 review → squash merge. Conventional commits. CI: lint + typecheck + tests on every PR.

---

## 10. Timeline (24 weeks, 4 people, part-time)

| Phase | Weeks | Deliverable | Business-plan gate |
|---|---|---|---|
| **0. Foundation** | 1–2 | Repo, CI, auth, design tokens, deployed skeleton (FE+BE+DB) | — |
| **1. Listings** | 3–4 | Create/edit listing with photos, categories, admin approval | — |
| **2. Discovery** | 5–6 | Browse, search, filters, listing detail, seller profiles | — |
| **3. Transactions** | 7–8 | Manual payment + proof verification, orders, chat, reviews | **Month 2: 50 beta transactions** |
| **4. Auctions** | 9–11 | Bid engine, realtime, anti-snipe, outbid alerts, closing jobs | — |
| **5. Fulfilment** | 12–13 | Shipping, tracking, auto-release, disputes, seller payouts | — |
| **6. Trade + Donate** | 14–16 | Trade offers, NGO donation routing, receipts | **Month 4: 500 users / 200 listings** |
| **7. Growth** | 17–20 | Boosted listings, referrals, price suggestion, PWA, analytics | — |
| **8. Partners + hardening** | 21–24 | Partner portal, load test, security review, runbook | **Month 6: 2 NGO partners** |

Each phase ends with a **demo + deploy**, never a local-only milestone.

**Team split (4 people)**
- **BE lead:** models, auction engine, order/payment-verification flow, cron jobs
- **FE lead:** design system, listing flow, auction UI
- **Fullstack/DevOps:** auth, chat, CI/CD, monitoring, integrations
- **PM/QA:** scope, tests, user interviews, moderation ops, content

Alone? Halve scope: drop trade + donations to v1.1 and ship fixed-price + auctions by Week 14.

---

## 11. Testing & quality bar

| Layer | Tool | Must cover |
|---|---|---|
| Unit | pytest-django | Fee math, bid validation, state transitions |
| API | DRF APIClient | Permissions per role, 403/409 paths |
| Concurrency | pytest + threads | 50 simultaneous bids → exactly one winner, no oversell |
| E2E | Playwright | Register → list → bid → win → pay → confirm |
| Load | k6 | 200 concurrent viewers, 20 bids/sec on one auction |
| Manual | Checklist | Mobile Safari, slow 3G, offline PWA |

**Definition of done:** tested · reviewed · deployed to staging · documented in `docs/` · observable in Sentry.

---

## 12. Security, trust & safety, compliance

- **Proof-of-payment verification** — every order needs a unique reference + screenshot reviewed by the seller, with admin escalation after 24h. Manual, but it stops the most common scam (fake "already sent" screenshots).
- **Auth:** Argon2 hashing, short-lived access tokens (15 min), refresh rotation + revocation, rate-limited login.
- **Input:** DRF serializers only, image type/size validation, signed upload URLs, strip EXIF (location privacy).
- **Abuse:** report listing/user, block user, moderation queue, banned-item policy (counterfeits, underwear, weapons).
- **Verification:** phone/email verify at signup; ID + payout account verify before first payout.
- **Privacy (PH RA 10173):** privacy policy, consent checkbox, data export/delete endpoint, encrypted backups, least-privilege DB roles.
- **Legal:** Terms of Service, prohibited-items policy, 18+ requirement, DTI business-name registration before collecting fees.
- **Audit:** `AuditLog` on admin actions and money movements; immutable payment records.

---

## 13. Deployment & cost

| Service | Tier | Monthly |
|---|---|---|
| Vercel (Functions + static frontend) | Hobby | $0 |
| Supabase | Free (500MB DB, 1GB storage) | $0 → $25 at scale |
| Sentry / Resend / UptimeRobot | Free | $0 |
| Domain | `.com` / `.ph` | ~₱700/yr |
| **Total to launch** | | **≈ $0–5/mo** |

Env vars in `env.example`: `DJANGO_SECRET_KEY`, `DATABASE_URL`, `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `JWT_SIGNING_KEY` (or `DJANGO_SECRET_KEY` for SimpleJWT), `SENTRY_DSN`. Never commit `.env`.

Deploy flow: PR → Vercel preview → merge to `main` → auto-deploy to Vercel → migrations as a release step → smoke test (`/health/` + API docs).

**`vercel.json` shape (like the Real-Estate project):** two services in one project — `frontend` (static, SPA rewrites to `/index.html`) and `backend` (Python Functions, `core.wsgi:application`) — with top-level rewrites: `/api/*`, `/admin/*`, `/static/*` → backend, everything else → frontend. Cron entries in the same file (e.g. `/api/v1/cron/auctions/` every 5 minutes, `CRON_SECRET` bearer).

---

## 14. Metrics to instrument from day one

| Metric | Why |
|---|---|
| Signup → first listing (activation rate) | Marketplace liquidity starts on the supply side |
| Listing → sale conversion, days-to-sell | Core marketplace health |
| Auction: bids per auction, sell-through, reserve-not-met % | Tells you if bidding actually adds value |
| GMV, take rate, net revenue | The business plan's profitability claim |
| Chat → transaction rate | Validates built-in chat as a conversion tool |
| Dispute rate, refund rate | Trust signal; keep under 2% |
| Payment proof → verified (median hours) | Manual verification is the new operational bottleneck |
| D30 retention, repeat-seller rate | Distinguishes a marketplace from a one-time closet dump |

Track with a simple `events` table + Metabase/Supabase charts. Don't buy an analytics suite yet.

---

## 15. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Cold start — no buyers, no sellers | High | Seed 50 listings from the team + campus thrift groups before launch; hand-pick auction inventory |
| Auction engine bugs (double winner, oversell) | High | Row-level locking, concurrency tests in CI, kill-switch to freeze an auction |
| Manual payment friction / fake proof | High | Unique reference per order, seller verification + 24h admin escalation, COD for local handover, cap beta order value |
| Courier integration delays | Medium | Manual tracking number for MVP; API later |
| Scope creep (video, native apps, AI) | High | Locked MVP scope; everything else goes to the "Later" list |
| Counterfeits / prohibited items | Medium | Moderation queue + report button + seller verification |
| Team is part-time / academic load | High | 2-week sprints, one demo per phase, cut scope not quality |

---

## 16. First 7 days

1. Create `main` branch protection, `.gitignore`, `README.md`, `docs/adr/0001-stack.md`.
2. Create a Vercel project linked to the repo (single project, `vercel.json` with `frontend` + `backend` services) → copy `DATABASE_URL` from Supabase.
3. Scaffold Django (`config/` + `accounts`) and React (`Vite + TS + Tailwind`) — deploy both "hello world" apps to Vercel today, same-origin.
4. Point `.env` at Supabase Postgres (every machine) — confirm every machine can run `python manage.py migrate`. Tests use in-memory SQLite so your Supabase DB stays clean.
5. Build `User` model + JWT auth + `/me` end-to-end (BE + FE login screen).
6. Set up CI (ruff, pytest, tsc, eslint) and Sentry.
7. Write the first ADRs: stack, auth model, auction rules — then start Phase 1.

---

## 17. Decision log (override these if you disagree)

| # | Decision | Alternative |
|---|---|---|
| 1 | Supabase (Postgres + Storage) | Any managed Postgres + S3/Cloudinary |
| 2 | Django-owned auth (SimpleJWT) | Supabase Auth + JWT verification middleware |
| 3 | **Vercel Functions + Vercel Cron** (no workers) | Keep Celery on a separate platform (violates "Vercel only") |
| 4 | **Supabase Realtime for bids** · SSE/polling fallback | Django Channels (can't run on ephemeral functions without heavy workarounds) |
| 5 | PWA first, native later | React Native (Expo) sharing the same API |
| 6 | No payment gateway — manual GCash/Maya + proof upload | Add PayMongo/Xendit later behind the same `PaymentProof` + order model |
| 7 | Timed auctions only | Live video auctions (v2) |
| 8 | **Vercel-only deployment** (FE + BE same origin) | Render/Fly/Railway (breaks the "one platform" constraint) |
