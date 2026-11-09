import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock, Gavel, History, MessageCircle } from "lucide-react";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { cn } from "../lib/utils";
import { apiErrorMessage } from "../lib/api-errors";
import { showToast } from "../lib/toast";
import { useAuth } from "../context/useAuth";
import { listingsService, type ListingDetail as ListingDetailData } from "../services/listings";
import { offersService } from "../services/offers";
import { ordersService } from "../services/orders";

function money(value: string | null | undefined) {
  return Number(value ?? 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function useCountdown(endAt: string | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [endAt]);

  if (!endAt) return "No end date";
  const remaining = new Date(endAt).getTime() - now;
  if (remaining <= 0) return "Auction ended";

  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m ${seconds}s left`;
  return `${seconds}s left`;
}

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState(0);

  const checkout = useMutation({
    mutationFn: () => ordersService.checkout(id as string),
    onSuccess: (order) => navigate(`/orders/${order.id}`),
  });

  const { data, isPending, isError } = useQuery({
    queryKey: ["listing", id],
    queryFn: () => listingsService.get(id as string),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const listing = query.state.data;
      return listing?.type === "auction" && listing.is_live ? 15_000 : false;
    },
  });

  if (isPending)
    return (
      <div className="shell grid gap-8 py-10 lg:grid-cols-2">
        <div className="aspect-[4/5] animate-pulse rounded-3xl bg-leaf-100" />
        <div className="h-96 animate-pulse rounded-3xl bg-leaf-100" />
      </div>
    );

  if (isError || !data)
    return (
      <div className="shell py-16 text-center">
        <p className="text-red-700">Couldn't load this listing. It may have been removed.</p>
        <Link to="/browse" className="mt-4 inline-block font-semibold text-leaf-700 underline">
          Back to browse
        </Link>
      </div>
    );

  const isAuction = data.type === "auction";
  const isSeller = Boolean(user && user.id === data.seller.id);
  const isStaff = Boolean(user?.is_staff);
  const isSold = data.status === "sold";
  const images = [...data.images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  const shown = images[active] ?? images[0];

  const facts = [
    ["Condition", data.condition.replace(/_/g, " ")],
    ["Size", data.size_label],
    ["Brand", data.brand_name],
    ["Category", data.category_name],
    ["Location", data.location],
  ].filter(([, value]) => Boolean(value));

  const badge = isSold
    ? "Sold"
    : isAuction
      ? data.is_live
        ? "Live auction"
        : "Auction ended"
      : data.type === "trade"
        ? "Open to trade"
        : data.type === "donation"
          ? "Free donation"
          : "Fixed price";

  return (
    <div className="shell py-8 md:py-10">
      <Link
        to="/browse"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-leaf-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to browse
      </Link>

      <div className="mt-5 grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
        {/* Gallery */}
        <div>
          <div className="aspect-[4/5] overflow-hidden rounded-3xl bg-leaf-100">
            {shown ? (
              <img src={shown.image} alt={shown.alt_text || data.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-8xl">🧥</div>
            )}
          </div>
          {images.length > 1 && (
            <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <li key={img.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    aria-label={`Show photo ${i + 1}`}
                    aria-current={i === active}
                    className={cn(
                      "h-20 w-16 overflow-hidden rounded-xl border-2 transition",
                      i === active ? "border-leaf-600" : "border-transparent opacity-70 hover:opacity-100",
                    )}
                  >
                    <img src={img.image} alt="" className="h-full w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Details */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <span className="inline-flex items-center gap-2 rounded-full bg-leaf-100 px-3 py-1 text-sm font-semibold text-leaf-700">
            {isAuction && data.is_live && (
              <span className="h-2 w-2 rounded-full bg-leaf-500 motion-safe:animate-pulse" aria-hidden />
            )}
            {badge}
          </span>
          <h1 className="font-display mt-3 text-3xl font-semibold leading-tight text-charcoal md:text-4xl">
            {data.title}
          </h1>

          {isAuction ? (
            <AuctionPrice listing={data} />
          ) : (
            <div className="mt-4">
              <p className="font-display text-4xl font-semibold tabular-nums text-leaf-700">
                {data.type === "donation" ? "Free" : `₱ ${Number(data.price).toLocaleString("en-PH")}`}
              </p>
              {data.type === "fixed" && data.is_negotiable && (
                <p className="text-sm text-charcoal/60">Seller is open to offers</p>
              )}
            </div>
          )}

          {isAuction ? (
            <AuctionPanel listing={data} />
          ) : isSold ? (
            <div className="mt-6 rounded-2xl border border-leaf-300/40 bg-white p-4">
              <p className="font-semibold text-leaf-700">This item has been sold.</p>
              <p className="mt-1 text-sm text-charcoal/75">
                {isSeller
                  ? "You sold this piece — check your sales for payment and shipping."
                  : "It's no longer available, but there are plenty more pre-loved finds."}
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                <Link
                  to={isSeller ? "/orders" : "/browse"}
                  className="inline-block text-sm font-semibold text-leaf-700 underline underline-offset-4"
                >
                  {isSeller ? "View your sales" : "Browse similar items"}
                </Link>
                {!isSeller && !isStaff && (
                  <button
                    type="button"
                    onClick={() => (user ? navigate(`/messages?listing=${data.id}`) : navigate("/rewear/login"))}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-leaf-700 underline underline-offset-4"
                  >
                    <MessageCircle className="h-4 w-4" /> Message seller
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-2">
              <div className="sticky bottom-3 z-10 flex flex-wrap gap-3 rounded-2xl bg-cream/90 py-2 backdrop-blur">
                {data.type === "fixed" && data.status === "active" && !isSeller && !isStaff && (
                  <Button
                    className="flex-1"
                    disabled={checkout.isPending}
                    onClick={() => (user ? checkout.mutate() : navigate("/rewear/login"))}
                  >
                    {checkout.isPending
                      ? "Creating order…"
                      : user
                        ? "Buy now"
                        : "Sign in to buy"}
                  </Button>
                )}
                {data.type === "fixed" && isSeller && (
                  <Button className="flex-1" disabled title="You can't buy your own listing">
                    Your listing
                  </Button>
                )}
                {data.type === "trade" && !isSeller && (
                  <Button className="flex-1" disabled title="Trade offers ship in the next sprint">
                    Propose a trade (soon)
                  </Button>
                )}
                {data.type === "donation" && !isSeller && (
                  <Button className="flex-1" disabled title="Donation requests ship in the next sprint">
                    Request donation (soon)
                  </Button>
                )}
                {data.type === "fixed" && isStaff && (
                  <p className="w-full rounded-xl bg-cream p-3 text-sm text-charcoal/70">
                    Staff accounts are read-only in the marketplace.
                  </p>
                )}
                {!isSeller && !isStaff && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      user ? navigate(`/messages?listing=${data.id}`) : navigate("/rewear/login")
                    }
                  >
                    <MessageCircle className="h-4 w-4" /> Message seller
                  </Button>
                )}
              </div>
              {checkout.isError && (
                <p className="text-sm text-red-700" role="alert">
                  {apiErrorMessage(checkout.error, "Couldn't start checkout.")}
                </p>
              )}
            </div>
          )}

          {data.type === "fixed" && data.status === "active" && !isStaff && (
            <OfferPanel listing={data} isSeller={isSeller} />
          )}

          {isSeller && (
            <Link
              to={`/listing/${data.id}/edit`}
              className="mt-4 inline-block text-sm font-semibold text-leaf-700 underline underline-offset-4"
            >
              Edit your listing
            </Link>
          )}

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-leaf-300/30 py-5 text-sm">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt className="text-charcoal/55">{label}</dt>
                <dd className="mt-0.5 font-semibold capitalize text-charcoal">{value}</dd>
              </div>
            ))}
          </dl>

          <section className="mt-6">
            <h2 className="font-semibold text-charcoal">About this piece</h2>
            <p className="mt-2 max-w-prose whitespace-pre-line text-charcoal/85">{data.description}</p>
          </section>

          <div className="mt-8 flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-leaf-300/30">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-leaf-600 text-lg font-bold text-cream">
              {data.seller.display_name[0]?.toUpperCase() ?? "S"}
            </div>
            <div>
              <p className="font-semibold text-charcoal">{data.seller.display_name}</p>
              <p className="text-sm text-charcoal/60">
                ⭐ {Number(data.seller.rating_avg).toFixed(1)} from {data.seller.rating_count}{" "}
                {data.seller.rating_count === 1 ? "review" : "reviews"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OfferPanel({ listing, isSeller }: { listing: ListingDetailData; isSeller: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const offers = useQuery({
    queryKey: ["listing-offers", listing.id],
    queryFn: () => offersService.list({ listing: listing.id }),
    enabled: Boolean(user),
    refetchInterval: 15_000,
  });

  const myPendingOffer = offers.data?.find(
    (offer) => offer.buyer === user?.id && offer.status === "pending",
  );
  const acceptedOffer = offers.data?.find((offer) => offer.status === "accepted");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["listing-offers", listing.id] });

  const createOffer = useMutation({
    mutationFn: () =>
      offersService.create({
        listing: listing.id,
        amount,
        message: message.trim() || undefined,
      }),
    onSuccess: () => {
      setAmount("");
      setMessage("");
      setError(null);
      showToast("Offer sent.", "success", "ReWear");
      invalidate();
    },
    onError: (mutationError) => {
      setError(apiErrorMessage(mutationError, "Couldn't send your offer."));
    },
  });

  const accept = useMutation({
    mutationFn: offersService.accept,
    onSuccess: (result) => {
      showToast("Offer accepted. Order created.", "success", "ReWear");
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["listing", listing.id] });
      navigate(`/orders/${result.order.id}`);
    },
    onError: (mutationError) => {
      setError(apiErrorMessage(mutationError, "Couldn't accept this offer."));
    },
  });

  const decline = useMutation({
    mutationFn: offersService.decline,
    onSuccess: () => {
      showToast("Offer declined.", "success", "ReWear");
      invalidate();
    },
    onError: (mutationError) => {
      setError(apiErrorMessage(mutationError, "Couldn't decline this offer."));
    },
  });

  const cancel = useMutation({
    mutationFn: offersService.cancel,
    onSuccess: () => {
      showToast("Offer withdrawn.", "success", "ReWear");
      invalidate();
    },
    onError: (mutationError) => {
      setError(apiErrorMessage(mutationError, "Couldn't withdraw this offer."));
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) {
      const text = "Enter an offer amount above zero.";
      setError(text);
      showToast(text, "error", "Invalid action");
      return;
    }
    if (value >= Number(listing.price)) {
      const text = "Offer below the asking price, or use Buy now for the full price.";
      setError(text);
      showToast(text, "error", "Invalid action");
      return;
    }
    createOffer.mutate();
  }

  if (!listing.is_negotiable) return null;

  const pendingOffers = offers.data?.filter((offer) => offer.status === "pending") ?? [];

  return (
    <section className="mt-6 rounded-3xl border border-leaf-300/40 bg-white p-5">
      <h2 className="font-semibold text-charcoal">Make an offer</h2>

      {isSeller ? (
        <>
          {pendingOffers.length === 0 && offers.data && (
            <p className="mt-2 text-sm text-charcoal/60">No pending offers yet.</p>
          )}
          <div className="mt-3 grid gap-3">
            {pendingOffers.map((offer) => (
              <div key={offer.id} className="rounded-2xl bg-cream/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">₱ {money(offer.amount)}</p>
                    <p className="text-xs text-charcoal/55">
                      by {offer.buyer_name} · {new Date(offer.created_at).toLocaleString("en-PH")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => accept.mutate(offer.id)} disabled={accept.isPending}>
                      Accept
                    </Button>
                    <Button variant="ghost" onClick={() => decline.mutate(offer.id)} disabled={decline.isPending}>
                      Decline
                    </Button>
                  </div>
                </div>
                {offer.message && <p className="mt-2 text-sm text-charcoal/75">{offer.message}</p>}
              </div>
            ))}
          </div>
        </>
      ) : !user ? (
        <p className="mt-2 text-sm text-charcoal/70">
          <Link to="/rewear/login" className="font-semibold text-leaf-700 underline">
            Sign in
          </Link>{" "}
          to make an offer.
        </p>
      ) : acceptedOffer ? (
        <p className="mt-2 text-sm text-leaf-700">
          Your offer of ₱ {money(acceptedOffer.amount)} was accepted — check Orders to pay.
        </p>
      ) : myPendingOffer ? (
        <div className="mt-3 rounded-2xl bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Your offer of ₱ {money(myPendingOffer.amount)} is pending.
          </p>
          {myPendingOffer.message && (
            <p className="mt-1 text-sm text-amber-900/80">{myPendingOffer.message}</p>
          )}
          <Button
            variant="ghost"
            className="mt-3"
            onClick={() => cancel.mutate(myPendingOffer.id)}
            disabled={cancel.isPending}
          >
            Withdraw offer
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <label className="grid gap-1.5 text-sm font-medium">
              Offer (₱)
              <Input
                type="number"
                min={1}
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                max={Number(listing.price) - 1}
                required
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Message (optional)
              <Input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={500}
                placeholder="I can pick it up today…"
              />
            </label>
          </div>
          <div>
            <Button type="submit" disabled={createOffer.isPending}>
              {createOffer.isPending ? "Sending…" : "Send offer"}
            </Button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}

function AuctionPrice({ listing }: { listing: ListingDetailData }) {
  const countdown = useCountdown(listing.end_at);
  const amount = listing.current_bid ?? listing.starting_bid;

  return (
    <div className="mt-5 rounded-3xl bg-leaf-700 p-6 text-cream">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-sm text-cream/75">{listing.current_bid ? "Current bid" : "Starting bid"}</p>
          <p className="font-display text-5xl font-semibold tabular-nums">₱ {money(amount)}</p>
        </div>
        <p className="flex items-center gap-2 text-lg font-semibold tabular-nums" aria-live="off">
          <Clock className="h-5 w-5" aria-hidden />
          {listing.is_live ? countdown : "Bidding closed"}
        </p>
      </div>
      <p className="mt-4 flex items-center gap-2 border-t border-cream/20 pt-3 text-sm text-cream/80">
        <Gavel className="h-4 w-4" aria-hidden />
        {listing.bid_count} {listing.bid_count === 1 ? "bid" : "bids"}
        {listing.extended_count > 0 && <span>, extended for late bids</span>}
      </p>
    </div>
  );
}

function AuctionPanel({ listing }: { listing: ListingDetailData }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const minimum = listing.minimum_bid ?? listing.starting_bid ?? "0";
  const [amount, setAmount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Until the bidder types, the field tracks the live minimum (which rises
  // when someone else bids or the auction is extended).
  const value = amount ?? minimum;

  const history = useQuery({
    queryKey: ["listing-bids", listing.id],
    queryFn: () => listingsService.getBids(listing.id),
    refetchInterval: listing.is_live ? 5_000 : false,
  });

  const mutation = useMutation({
    mutationFn: (value: string) => listingsService.placeBid(listing.id, value),
    onSuccess: (result) => {
      setError(null);
      setNotice(
        result.extended
          ? "You're the highest bidder. A late bid extended the auction by 2 minutes."
          : "You're the highest bidder.",
      );
      setAmount(null);
      void queryClient.invalidateQueries({ queryKey: ["listing", listing.id] });
      void queryClient.invalidateQueries({ queryKey: ["listing-bids", listing.id] });
    },
    onError: (mutationError) => {
      setNotice(null);
      setError(apiErrorMessage(mutationError, "Couldn't place your bid. Try again."));
    },
  });

  const isSeller = Boolean(user && user.id === listing.seller.id);
  const bids = history.data?.bids ?? [];

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!value || Number(value) <= 0) {
      const message = "Enter a bid above zero.";
      setError(message);
      showToast(message, "error", "Invalid action");
      return;
    }
    mutation.mutate(value);
  }

  return (
    <section className="mt-4 rounded-3xl bg-white p-5 ring-1 ring-leaf-300/30">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-charcoal">Place a bid</h2>
        <span className="text-sm text-charcoal/65">
          Minimum <strong className="tabular-nums text-charcoal">₱ {money(minimum)}</strong>
        </span>
      </div>

      {isSeller ? (
        <p className="mt-3 rounded-xl bg-cream p-3 text-sm text-charcoal/70">
          This is your auction, so you can't bid on it.
        </p>
      ) : user?.is_staff ? (
        <p className="mt-3 rounded-xl bg-cream p-3 text-sm text-charcoal/70">
          Staff accounts are read-only in the marketplace.
        </p>
      ) : !user ? (
        <p className="mt-3 text-sm text-charcoal/70">
          <Link to="/rewear/login" className="font-semibold text-leaf-700 underline">
            Sign in
          </Link>{" "}
          to place a bid.
        </p>
      ) : !listing.is_live ? (
        <p className="mt-3 rounded-xl bg-cream p-3 text-sm text-charcoal/70">
          Bidding is closed for this auction.
        </p>
      ) : (
        <>
          <form onSubmit={submit} className="mt-3 flex gap-2">
            <label className="flex-1">
              <span className="sr-only">Your bid in pesos</span>
              <Input
                type="number"
                min={minimum}
                step="0.01"
                inputMode="decimal"
                value={value}
                onChange={(event) => setAmount(event.target.value)}
                aria-describedby="bid-help"
                className="text-lg font-semibold tabular-nums"
                required
              />
            </label>
            <Button type="submit" disabled={mutation.isPending} className="px-6">
              {mutation.isPending ? "Placing bid…" : "Place bid"}
            </Button>
          </form>
          <p id="bid-help" className="mt-2 text-xs text-charcoal/60">
            {listing.bid_count === 0
              ? `The first bid can be ₱ ${money(minimum)}. After that, each bid must add at least ₱ ${money(listing.min_increment)}.`
              : `Bid at least ₱ ${money(minimum)}: the current bid plus ₱ ${money(listing.min_increment)}.`}{" "}
            A bid in the last 2 minutes extends the auction.
          </p>
        </>
      )}

      {!isSeller && !user?.is_staff && (
        <Button
          variant="ghost"
          className="mt-4"
          onClick={() => (user ? navigate(`/messages?listing=${listing.id}`) : navigate("/rewear/login"))}
        >
          <MessageCircle className="h-4 w-4" /> Message seller
        </Button>
      )}

      <p role="alert" className={cn("mt-2 text-sm text-red-700", !error && "hidden")}>
        {error}
      </p>
      <p role="status" className={cn("mt-2 text-sm font-medium text-leaf-700", !notice && "hidden")}>
        {notice}
      </p>

      <div className="mt-5 border-t border-leaf-300/30 pt-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-charcoal/70">
          <History className="h-4 w-4" aria-hidden /> Bid history
          {history.data && <span className="font-normal">({history.data.bid_count})</span>}
        </h3>

        {bids.length === 0 ? (
          <p className="mt-2 text-sm text-charcoal/60">No bids yet. Yours could be the first.</p>
        ) : (
          <ul className="mt-2 divide-y divide-leaf-300/20">
            {bids.slice(0, 10).map((bid, i) => (
              <li key={bid.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className={cn("font-medium", i === 0 ? "text-leaf-700" : "text-charcoal/75")}>
                  {bid.bidder_name}
                  {bid.is_mine && <span className="ml-1 text-leaf-600">(you)</span>}
                  {i === 0 && <span className="ml-2 rounded-full bg-leaf-100 px-2 py-0.5 text-xs">Highest</span>}
                </span>
                <span className="hidden text-charcoal/50 sm:inline">
                  {new Date(bid.created_at).toLocaleString("en-PH", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                <span className="font-semibold tabular-nums text-charcoal">₱ {money(bid.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}