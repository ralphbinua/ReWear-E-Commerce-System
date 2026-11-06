import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Eye, Gavel, Heart, Pencil, Plus, ShoppingBag, Tag } from "lucide-react";

import { cn } from "../lib/utils";
import { listingsService, type Listing } from "../services/listings";

const STATUS_META: Record<string, { label: string; tone: string }> = {
  active: { label: "Live", tone: "bg-green-100 text-green-800" },
  sold: { label: "Sold", tone: "bg-leaf-100 text-leaf-800" },
  ended: { label: "Ended", tone: "bg-charcoal/10 text-charcoal/70" },
  pending_review: { label: "In review", tone: "bg-amber-100 text-amber-800" },
  draft: { label: "Draft", tone: "bg-charcoal/10 text-charcoal/70" },
  removed: { label: "Removed", tone: "bg-red-100 text-red-800" },
};

const TYPE_META: Record<Listing["type"], { label: string; Icon: typeof Tag }> = {
  fixed: { label: "Fixed price", Icon: Tag },
  auction: { label: "Auction", Icon: Gavel },
  trade: { label: "Trade", Icon: ShoppingBag },
  donation: { label: "Donation", Icon: Heart },
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Live" },
  { value: "sold", label: "Sold" },
  { value: "other", label: "Drafts / ended" },
] as const;

type Filter = (typeof FILTERS)[number]["value"];

function priceLabel(listing: Listing) {
  if (listing.type === "donation") return "Free";
  return `₱ ${Number(listing.price).toLocaleString("en-PH")}`;
}

export default function MyListings() {
  const [filter, setFilter] = useState<Filter>("all");

  const { data, isPending, isError } = useQuery({
    queryKey: ["my-listings"],
    queryFn: () => listingsService.mine(),
    refetchOnWindowFocus: true,
  });

  const listings = useMemo(() => data?.results ?? [], [data]);

  const counts = useMemo(
    () => ({
      all: listings.length,
      active: listings.filter((listing) => listing.status === "active").length,
      sold: listings.filter((listing) => listing.status === "sold").length,
      other: listings.filter(
        (listing) => listing.status !== "active" && listing.status !== "sold",
      ).length,
    }),
    [listings],
  );

  const visible = useMemo(() => {
    if (filter === "all") return listings;
    if (filter === "other")
      return listings.filter(
        (listing) => listing.status !== "active" && listing.status !== "sold",
      );
    return listings.filter((listing) => listing.status === filter);
  }, [filter, listings]);

  return (
    <div className="shell py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-leaf-700">My listings</h1>
          <p className="text-charcoal/70">
            Everything you've posted — live, sold, and in review.
          </p>
        </div>
        <Link
          to="/sell"
          className="inline-flex items-center gap-2 rounded-full bg-leaf-600 px-5 py-2.5 text-sm font-semibold text-cream transition hover:bg-leaf-700"
        >
          <Plus className="h-4 w-4" /> List something
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-semibold transition",
              filter === option.value
                ? "border-leaf-600 bg-leaf-600 text-cream"
                : "border-leaf-300/50 bg-white text-leaf-700 hover:bg-leaf-50",
            )}
          >
            {option.label}
            <span
              className={cn(
                "ml-2 rounded-full px-1.5 text-[11px]",
                filter === option.value ? "bg-cream/20" : "bg-leaf-100 text-leaf-800",
              )}
            >
              {counts[option.value]}
            </span>
          </button>
        ))}
      </div>

      {isPending && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-80 animate-pulse rounded-2xl bg-leaf-100" />
          ))}
        </div>
      )}

      {isError && (
        <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
          Couldn't load your listings. Refresh to try again.
        </p>
      )}

      {!isPending && !isError && visible.length === 0 && (
        <div className="mt-6 rounded-2xl border border-leaf-300/40 bg-white p-10 text-center">
          <p className="text-charcoal/70">
            {listings.length === 0
              ? "You haven't listed anything yet."
              : `No listings in "${FILTERS.find((option) => option.value === filter)?.label}".`}
          </p>
          <Link
            to="/sell"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-leaf-600 px-5 py-2.5 text-sm font-semibold text-cream transition hover:bg-leaf-700"
          >
            <Plus className="h-4 w-4" /> Post your first item
          </Link>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((listing) => {
          const status = STATUS_META[listing.status] ?? {
            label: listing.status,
            tone: "bg-charcoal/10 text-charcoal/70",
          };
          const type = TYPE_META[listing.type];

          return (
            <article
              key={listing.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-leaf-300/40 bg-white transition hover:shadow-md"
            >
              <Link
                to={`/listing/${listing.id}`}
                className="block aspect-[4/5] overflow-hidden bg-leaf-100"
                aria-label={`View ${listing.title}`}
              >
                {listing.cover_image ? (
                  <img
                    src={listing.cover_image}
                    alt={listing.title}
                    className="h-full w-full object-cover transition hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ShoppingBag className="h-10 w-10 text-leaf-600" />
                  </div>
                )}
              </Link>

              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      status.tone,
                    )}
                  >
                    {status.label}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-charcoal/60">
                    <type.Icon className="h-3.5 w-3.5" /> {type.label}
                  </span>
                </div>

                <Link to={`/listing/${listing.id}`} className="mt-2 line-clamp-1 font-semibold">
                  {listing.title}
                </Link>

                <p className="font-display mt-1 text-lg font-semibold text-leaf-700">
                  {priceLabel(listing)}
                </p>

                <p className="mt-1 text-xs text-charcoal/60">
                  {listing.type === "auction" && listing.bid_count > 0
                    ? `${listing.bid_count} ${listing.bid_count === 1 ? "bid" : "bids"} · `
                    : ""}
                  Posted {new Date(listing.created_at).toLocaleDateString("en-PH")}
                  {listing.type === "auction" && listing.end_at
                    ? ` · Ends ${new Date(listing.end_at).toLocaleDateString("en-PH")}`
                    : ""}
                </p>

                <div className="mt-auto flex gap-2 pt-3">
                  <Link
                    to={`/listing/${listing.id}`}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-leaf-300/60 px-3 py-2 text-xs font-semibold text-leaf-700 transition hover:bg-leaf-50"
                  >
                    <Eye className="h-3.5 w-3.5" /> View
                  </Link>
                  <Link
                    to={`/listing/${listing.id}/edit`}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-leaf-600 px-3 py-2 text-xs font-semibold text-cream transition hover:bg-leaf-700"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
