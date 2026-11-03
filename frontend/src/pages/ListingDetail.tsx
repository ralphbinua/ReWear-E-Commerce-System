import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { Button } from "../components/ui/button";
import { listingsService } from "../services/listings";

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();

  const { data, isPending, isError } = useQuery({
    queryKey: ["listing", id],
    queryFn: () => listingsService.get(id as string),
    enabled: Boolean(id),
  });

  if (isPending)
    return (
      <div className="shell py-16 text-center text-charcoal/60">
        Loading listing…
      </div>
    );

  if (isError || !data)
    return (
      <div className="shell py-16 text-center">
        <p className="text-red-700">Couldn't load this listing.</p>
        <Link to="/browse" className="mt-4 inline-block text-leaf-700 underline">
          Back to browse
        </Link>
      </div>
    );

  const primary = data.images.find((i) => i.is_primary) ?? data.images[0];

  return (
    <div className="shell py-10">
      <Link to="/browse" className="text-sm text-leaf-700 underline">
        ← Back to browse
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border border-leaf-300/30 bg-leaf-100">
          {primary ? (
            <img src={primary.image} alt={data.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-96 w-full items-center justify-center text-8xl">🧥</div>
          )}
        </div>

        <div>
          <span className="inline-flex rounded-full bg-leaf-100 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-leaf-700">
            {data.type === "auction"
              ? "Live auction"
              : data.type === "trade"
                ? "Open to trade"
                : data.type === "donation"
                  ? "Donation"
                  : "Fixed price"}
          </span>
          <h1 className="font-display mt-3 text-3xl font-semibold text-charcoal">
            {data.title}
          </h1>
          <p className="text-charcoal/60">
            {data.category_name} · {data.condition.replace(/_/g, " ")}
            {data.size_label ? ` · Size ${data.size_label}` : ""}
            {data.location ? ` · ${data.location}` : ""}
          </p>

          <p className="font-display mt-6 text-4xl font-semibold text-leaf-700">
            ₱ {Number(data.price).toLocaleString("en-PH")}
          </p>
          {data.type === "fixed" && data.is_negotiable && (
            <p className="text-sm text-charcoal/60">Open to offers</p>
          )}

          <div className="mt-6 rounded-2xl border border-leaf-300/30 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal/60">
              Description
            </h2>
            <p className="mt-2 whitespace-pre-line text-charcoal/90">{data.description}</p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button disabled title="Order flow ships in the next sprint">
              Buy now (soon)
            </Button>
            <Button variant="ghost" disabled title="Chat ships in the next sprint">
              Message seller
            </Button>
          </div>

          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-leaf-300/30 bg-cream p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-leaf-500 text-lg font-bold text-cream">
              {data.seller.display_name[0]?.toUpperCase() ?? "S"}
            </div>
            <div>
              <p className="font-semibold text-leaf-700">{data.seller.display_name}</p>
              <p className="text-xs text-charcoal/60">
                ⭐ {Number(data.seller.rating_avg).toFixed(1)} · {data.seller.rating_count}{" "}
                reviews
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
