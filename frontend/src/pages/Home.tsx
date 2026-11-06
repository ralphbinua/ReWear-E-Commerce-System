import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Gavel, HeartHandshake, Repeat, Search, Shirt, ShoppingBag } from "lucide-react";

const ways = [
  { icon: ShoppingBag, title: "Buy", body: "Quality secondhand at thrift prices." },
  { icon: Shirt, title: "Sell", body: "List in minutes and reach real buyers." },
  { icon: Repeat, title: "Trade", body: "Swap pieces, add cash if needed." },
  { icon: HeartHandshake, title: "Donate", body: "Send clothes to verified charity partners." },
  { icon: Gavel, title: "Auction", body: "Bid on rare, vintage and designer finds." },
];

export default function Home() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const term = q.trim();
    navigate(term ? `/browse?q=${encodeURIComponent(term)}` : "/browse");
  }

  return (
    <>
      <section className="shell grid gap-12 py-14 md:py-24 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <h1 className="font-display max-w-2xl text-5xl font-semibold leading-[1.05] tracking-tight text-charcoal md:text-7xl">
            Clothes with a past, priced for right now.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-charcoal/70">
            Buy, sell, trade, donate or bid on pre-loved fashion. Every piece you rewear is one
            less in landfill.
          </p>

          <form
            onSubmit={onSubmit}
            className="mt-8 flex max-w-xl items-center gap-2 rounded-full border border-leaf-300/50 bg-white p-1.5 shadow-sm focus-within:border-leaf-500 focus-within:ring-4 focus-within:ring-leaf-500/15"
          >
            <Search className="ml-3 h-5 w-5 shrink-0 text-charcoal/40" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search listings"
              placeholder="Try “vintage denim jacket”"
              className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-base outline-none placeholder:text-charcoal/40"
            />
            <button
              type="submit"
              className="rounded-full bg-leaf-600 px-6 py-2.5 font-semibold text-cream transition hover:bg-leaf-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf-700"
            >
              Search
            </button>
          </form>

          <p className="mt-4 text-sm text-charcoal/60">
            Prefer to look around?{" "}
            <Link to="/browse" className="font-semibold text-leaf-700 underline underline-offset-4">
              Browse all listings
            </Link>
          </p>
        </div>

        {/* Hang tag: sample auction */}
        <div className="relative mx-auto w-full max-w-sm">
          <div className="absolute -top-6 left-1/2 h-12 w-px -translate-x-1/2 bg-leaf-700/40" aria-hidden />
          <div className="relative rotate-2 rounded-[2rem] border border-leaf-300/50 bg-white p-7 pt-10 shadow-xl">
            <span
              className="absolute left-1/2 top-4 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-leaf-700/40 bg-cream"
              aria-hidden
            />
            <p className="inline-flex items-center gap-2 rounded-full bg-leaf-100 px-3 py-1 text-sm font-semibold text-leaf-700">
              <span className="h-2 w-2 rounded-full bg-leaf-500 motion-safe:animate-pulse" aria-hidden />
              Live auction
            </p>
            <p className="font-display mt-4 text-2xl font-semibold text-charcoal">
              Vintage denim jacket
            </p>
            <p className="text-sm text-charcoal/60">Size M, good condition</p>
            <p className="font-display mt-6 text-5xl font-semibold tabular-nums text-leaf-700">
              ₱ 1,450
            </p>
            <p className="mt-1 text-sm text-charcoal/60">14 bids, ends Sunday</p>
            <p className="mt-6 border-t border-dashed border-leaf-300/60 pt-4 text-xs text-charcoal/50">
              Sample listing
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-leaf-300/30 bg-white">
        <div className="shell py-12">
          <h2 className="font-display text-2xl font-semibold text-charcoal">
            One place for everything pre-loved
          </h2>
          <ul className="mt-6 grid divide-leaf-300/30 sm:grid-cols-2 sm:divide-x lg:grid-cols-5">
            {ways.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3 py-4 sm:block sm:px-5 sm:first:pl-0">
                <Icon className="h-6 w-6 shrink-0 text-leaf-600" aria-hidden />
                <div>
                  <h3 className="font-semibold sm:mt-3">{title}</h3>
                  <p className="mt-1 text-sm text-charcoal/65">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}