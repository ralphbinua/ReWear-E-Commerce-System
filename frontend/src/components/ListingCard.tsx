import { Link } from "react-router-dom";

import type { Listing } from "../services/listings";

const typeLabel: Record<Listing["type"], string> = {
  fixed: "Fixed price",
  auction: "Auction",
  trade: "Trade",
  donation: "Donation",
};

export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      to={`/listing/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-leaf-300/30 bg-white transition hover:shadow-md"
    >
      <div className="relative h-48 w-full overflow-hidden bg-leaf-100">
        {listing.cover_image ? (
          <img
            src={listing.cover_image}
            alt={listing.title}
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl">
            🧥
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-cream/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-leaf-700">
          {typeLabel[listing.type]}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-1 font-semibold">{listing.title}</h3>
        <p className="text-xs text-charcoal/60">
          by {listing.seller.display_name} · {listing.condition.replace(/_/g, " ")}
        </p>
        <p className="mt-auto font-display text-lg font-semibold text-leaf-700">
          ₱ {Number(listing.price).toLocaleString("en-PH")}
        </p>
      </div>
    </Link>
  );
}
