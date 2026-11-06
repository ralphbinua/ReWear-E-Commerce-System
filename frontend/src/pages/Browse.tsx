import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";

import { ListingCard } from "../components/ListingCard";
import { listingsService } from "../services/listings";

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [search, setSearch] = useState(q);

  const { data, isPending, isError, isPlaceholderData } = useQuery({
    queryKey: ["listings", q],
    queryFn: () => listingsService.list({ search: q || undefined }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  function applySearch(term: string) {
    setSearch(term);
    setParams(term ? { q: term } : {}, { replace: true });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    applySearch(search.trim());
  }

  return (
    <div className="shell py-8 md:py-12">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-charcoal md:text-4xl">
            {q ? `Results for “${q}”` : "Pre-loved drops"}
          </h1>
          <p className="mt-1 text-charcoal/65" aria-live="polite">
            {data ? `${data.count} listing${data.count === 1 ? "" : "s"}` : "Loading…"}
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          role="search"
          className="flex w-full items-center gap-2 rounded-full border border-leaf-300/50 bg-white p-1.5 shadow-sm focus-within:border-leaf-500 focus-within:ring-4 focus-within:ring-leaf-500/15 md:w-[26rem]"
        >
          <Search className="ml-3 h-5 w-5 shrink-0 text-charcoal/40" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clothes, brands, sellers"
            aria-label="Search listings"
            className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none placeholder:text-charcoal/40 [&::-webkit-search-cancel-button]:hidden"
          />
          {q && (
            <button
              type="button"
              onClick={() => applySearch("")}
              aria-label="Clear search"
              className="rounded-full p-2 text-charcoal/50 hover:bg-leaf-50 hover:text-charcoal"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="submit"
            className="rounded-full bg-leaf-600 px-5 py-2 text-sm font-semibold text-cream transition hover:bg-leaf-700"
          >
            Search
          </button>
        </form>
      </div>

      <div
        className={`mt-8 grid grid-cols-2 gap-x-4 gap-y-6 transition-opacity md:grid-cols-3 lg:grid-cols-4 ${
          isPlaceholderData ? "opacity-60" : ""
        }`}
      >
        {isPending &&
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-leaf-100" />
          ))}

        {isError && (
          <p className="col-span-full rounded-2xl bg-red-50 p-5 text-red-800">
            Couldn't load listings. Check that the API is running on port 8000, then refresh.
          </p>
        )}

        {data?.results.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}

        {data && data.results.length === 0 && (
          <div className="col-span-full rounded-3xl border border-dashed border-leaf-300/60 bg-white p-12 text-center">
            <p className="font-display text-xl font-semibold text-charcoal">
              {q ? `Nothing matched “${q}”` : "No listings yet"}
            </p>
            <p className="mt-1 text-charcoal/65">
              {q ? "Try a shorter or different search term." : "Be the first to list something."}
            </p>
            {q && (
              <button
                type="button"
                onClick={() => applySearch("")}
                className="mt-5 rounded-full bg-leaf-600 px-5 py-2 text-sm font-semibold text-cream hover:bg-leaf-700"
              >
                Show all listings
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}