import { Link } from "react-router-dom";

import { Button } from "../components/ui/button";

const pillars = [
  { emoji: "🛍️", title: "Buy", body: "Affordable, quality secondhand drops." },
  { emoji: "🧥", title: "Sell", body: "List in minutes; reach real buyers." },
  { emoji: "🔄", title: "Trade", body: "Swap clothes, optional cash top-up." },
  {
    emoji: "📦",
    title: "Donate",
    body: "Route clothes to verified charity partners.",
  },
  {
    emoji: "🔨",
    title: "Auction",
    body: "Live bidding for rare, vintage and designer pieces.",
  },
];

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="shell grid gap-10 py-16 md:grid-cols-2 md:items-center md:py-24">
          <div>
            <span className="inline-flex rounded-full bg-leaf-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-leaf-700">
              Pre-loved · Better Planet
            </span>
            <h1 className="font-display mt-4 max-w-xl text-4xl font-semibold leading-tight text-charcoal md:text-6xl">
              Fashion that already lived a good life.
            </h1>
            <p className="mt-4 max-w-md text-lg text-charcoal/80">
              Buy, sell, trade, donate — or auction off rare vintage finds. Every sale means
              one less garment in a landfill.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/browse">
                <Button>Start browsing</Button>
              </Link>
              <Link to="/browse">
                <Button variant="ghost">Explore auctions</Button>
              </Link>
            </div>
          </div>

          <div className="relative mx-auto flex h-80 w-full items-center justify-center rounded-3xl bg-gradient-to-br from-leaf-600 to-leaf-400 shadow-lg md:h-96">
            <span className="text-8xl md:text-9xl">👕</span>
            <div className="absolute bottom-6 left-6 rounded-2xl bg-cream/90 px-4 py-3 text-sm shadow backdrop-blur">
              <p className="font-semibold text-leaf-700">Vintage denim jacket</p>
              <p className="text-charcoal/70">Auction · 14 bids · ends Sunday</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-leaf-300/30 bg-white py-12">
        <div className="shell">
          <h2 className="font-display text-2xl font-semibold text-leaf-700">
            Everything pre-loved, one place
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {pillars.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl border border-leaf-300/30 bg-cream p-4"
              >
                <p className="text-2xl">{p.emoji}</p>
                <h3 className="mt-2 font-semibold">{p.title}</h3>
                <p className="mt-1 text-sm text-charcoal/70">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
