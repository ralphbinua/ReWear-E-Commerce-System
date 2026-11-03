import { useState, type FormEvent } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ListingCard } from "../components/ListingCard";
import { Input } from "../components/ui/input";
import { listingsService } from "../services/listings";

export default function Browse() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

  const { data, isPending, isError } = useQuery({
    queryKey: ["listings", q],
    queryFn: () => listingsService.list({ search: q || undefined }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setQ(search.trim());
  }

  return (
    <div className="shell py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-leaf-700">
            Pre-loved drops
          </h1>
          <p className="text-charcoal/70">
            {data ? `${data.count} listing${data.count === 1 ? "" : "s"} available` : "Loading…"}
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex w-full gap-2 md:w-96">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clothes, brands, sellers…"
            aria-label="Search listings"
          />
          <button
            type="submit"
            className="rounded-xl bg-leaf-600 px-4 font-semibold text-cream transition hover:bg-leaf-700"
          >
            Search
          </button>
        </form>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isPending &&
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-leaf-100" />
          ))}

        {isError && (
          <p className="col-span-full text-red-700">
            Couldn't load listings — is the API running on port 8000?
          </p>
        )}

        {data?.results.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}

        {data && data.results.length === 0 && (
          <p className="col-span-full rounded-2xl border border-leaf-300/40 bg-white p-8 text-center text-charcoal/70">
            Nothing matched “{q}”. Try a different search.
          </p>
        )}
      </div>
    </div>
  );
}
