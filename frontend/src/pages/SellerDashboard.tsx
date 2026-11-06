import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  Eye,
  Gavel,
  Heart,
  MessageCircle,
  Package,
  Plus,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { cn } from "../lib/utils";
import { ordersService, type OrderStatus } from "../services/orders";

const STATUS_META: Record<
  OrderStatus,
  { label: string; tone: string }
> = {
  pending_payment: { label: "Waiting for payment", tone: "bg-amber-100 text-amber-800" },
  payment_review: { label: "Payment review", tone: "bg-blue-100 text-blue-800" },
  paid: { label: "Paid — ships next", tone: "bg-purple-100 text-purple-800" },
  shipped: { label: "Shipped", tone: "bg-purple-100 text-purple-800" },
  delivered: { label: "Delivered", tone: "bg-green-100 text-green-800" },
  completed: { label: "Completed", tone: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", tone: "bg-red-100 text-red-800" },
  refunded: { label: "Refunded", tone: "bg-red-100 text-red-800" },
  disputed: { label: "Disputed", tone: "bg-red-100 text-red-800" },
};

function pesos(value: string) {
  return `₱ ${Number(value).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function SellerDashboard() {
  const dashboard = useQuery({
    queryKey: ["seller-dashboard"],
    queryFn: ordersService.sellerDashboard,
    refetchOnWindowFocus: true,
  });

  if (dashboard.isPending) {
    return (
      <div className="shell py-10">
        <div className="h-10 w-64 animate-pulse rounded bg-leaf-100" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-3xl bg-leaf-100" />
          ))}
        </div>
      </div>
    );
  }

  if (dashboard.isError || !dashboard.data) {
    return (
      <div className="shell py-16 text-center text-red-700">
        Couldn't load your seller dashboard.
      </div>
    );
  }

  const { seller, stats, orders_by_status, recent_sales, top_listings, payout_accounts } =
    dashboard.data;
  const maxStatus = Math.max(
    1,
    ...Object.values(orders_by_status).map((count) => Number(count)),
  );

  const cards = [
    {
      label: "Net earnings",
      value: pesos(stats.net_earnings),
      helper: `After ${pesos(stats.platform_fees)} platform fee`,
      Icon: Wallet,
    },
    {
      label: "Gross sales",
      value: pesos(stats.gross_revenue),
      helper: `${stats.paid_sales} paid sale${stats.paid_sales === 1 ? "" : "s"}`,
      Icon: TrendingUp,
    },
    {
      label: "Pending review",
      value: pesos(stats.review_amount),
      helper: `${stats.payment_review_orders} order${stats.payment_review_orders === 1 ? "" : "s"} to verify`,
      Icon: Package,
    },
    {
      label: "Active listings",
      value: String(stats.active_listings),
      helper: `${stats.total_views.toLocaleString("en-PH")} total views`,
      Icon: Eye,
    },
  ];

  return (
    <div className="shell py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-leaf-600">
            Seller dashboard
          </p>
          <h1 className="font-display mt-2 text-3xl font-semibold text-leaf-700">
            Hey, {seller.display_name}
          </h1>
          <p className="text-charcoal/70">
            ⭐ {Number(seller.rating_avg).toFixed(1)} from {seller.rating_count}{" "}
            {seller.rating_count === 1 ? "review" : "reviews"} · sales, listings, and payouts at a glance
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/sell"
            className="inline-flex items-center gap-2 rounded-full bg-leaf-600 px-5 py-2.5 text-sm font-semibold text-cream transition hover:bg-leaf-700"
          >
            <Plus className="h-4 w-4" /> List something
          </Link>
          <Link
            to="/my-listings"
            className="inline-flex items-center gap-2 rounded-full border border-leaf-300/60 px-5 py-2.5 text-sm font-semibold text-leaf-700 hover:bg-leaf-50"
          >
            <ShoppingBag className="h-4 w-4" /> My listings
          </Link>
          <Link
            to="/messages"
            className="inline-flex items-center gap-2 rounded-full border border-leaf-300/60 px-5 py-2.5 text-sm font-semibold text-leaf-700 hover:bg-leaf-50"
          >
            <MessageCircle className="h-4 w-4" /> Messages
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, helper, Icon }) => (
          <section key={label} className="rounded-3xl border border-leaf-300/40 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-charcoal/60">{label}</p>
              <Icon className="h-5 w-5 text-leaf-600" />
            </div>
            <p className="font-display mt-2 text-3xl font-semibold text-leaf-700">{value}</p>
            <p className="mt-1 text-xs text-charcoal/55">{helper}</p>
          </section>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <section className="rounded-3xl border border-leaf-300/40 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-charcoal">Sales pipeline</h2>
            <Link to="/orders" className="text-sm font-semibold text-leaf-700 hover:underline">
              View orders
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            {Object.entries(orders_by_status).map(([status, count]) => {
              const meta = STATUS_META[status as OrderStatus];
              if (!meta) return null;
              return (
                <div key={status} className="grid gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-charcoal/70">{meta.label}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-leaf-100">
                    <div
                      className={cn("h-full rounded-full", meta.tone.split(" ")[0])}
                      style={{ width: `${(Number(count) / maxStatus) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 grid gap-2 border-t border-leaf-300/30 pt-4 text-sm">
            <p className="flex items-center justify-between">
              <span className="text-charcoal/60">Completed sales</span>
              <strong>{stats.completed_sales}</strong>
            </p>
            <p className="flex items-center justify-between">
              <span className="text-charcoal/60">Average sale</span>
              <strong>{pesos(stats.average_sale_price)}</strong>
            </p>
            <p className="flex items-center justify-between">
              <span className="text-charcoal/60">Waiting for payment</span>
              <strong>{pesos(stats.pending_amount)}</strong>
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-leaf-300/40 bg-white p-5">
          <h2 className="font-semibold text-charcoal">Payout accounts</h2>
          {payout_accounts.length === 0 ? (
            <p className="mt-4 text-sm text-charcoal/60">
              Add a payout account on the Orders page so buyers know where to send payment.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              {payout_accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-cream/60 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{account.method_label}</p>
                    <p className="truncate text-xs text-charcoal/60">
                      {account.account_name} · {account.account_number}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      account.is_verified
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800",
                    )}
                  >
                    {account.is_verified ? "Verified" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-leaf-300/30 pt-4 text-center">
            <div>
              <p className="font-display text-2xl font-semibold text-leaf-700">{stats.sold_listings}</p>
              <p className="text-xs text-charcoal/55">Sold listings</p>
            </div>
            <div>
              <p className="font-display text-2xl font-semibold text-leaf-700">{stats.ended_listings}</p>
              <p className="text-xs text-charcoal/55">Ended auctions</p>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-leaf-300/40 bg-white p-5">
          <h2 className="font-semibold text-charcoal">Recent sales</h2>
          {recent_sales.length === 0 ? (
            <p className="mt-4 text-sm text-charcoal/60">
              No sales yet. Your first sale will show up here.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              {recent_sales.map((order) => {
                const meta = STATUS_META[order.status];
                return (
                  <Link
                    key={order.id}
                    to={`/orders/${order.id}`}
                    className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-leaf-50"
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-leaf-100">
                      {order.listing.cover_image ? (
                        <img
                          src={order.listing.cover_image}
                          alt={order.listing.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ShoppingBag className="h-5 w-5 text-leaf-600" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{order.listing.title}</p>
                      <p className="text-xs text-charcoal/55">
                        {order.order_number} · {order.buyer_name}
                      </p>
                      {meta && (
                        <span className={cn("mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", meta.tone)}>
                          {meta.label}
                        </span>
                      )}
                    </div>
                    <p className="font-display shrink-0 font-semibold text-leaf-700">
                      {pesos(order.total)}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-leaf-300/40 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-charcoal">Top listings</h2>
            <Link to="/my-listings" className="text-sm font-semibold text-leaf-700 hover:underline">
              All listings
            </Link>
          </div>
          {top_listings.length === 0 ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-charcoal/60">
              <Gavel className="h-4 w-4 text-leaf-500" /> No listings yet — post your first item.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              {top_listings.map((listing) => (
                <Link
                  key={listing.id}
                  to={`/listing/${listing.id}/edit`}
                  className="flex items-center justify-between gap-3 rounded-2xl p-2 transition hover:bg-leaf-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{listing.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-charcoal/55">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" /> {listing.view_count}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Gavel className="h-3.5 w-3.5" /> {listing.bid_count} bids
                      </span>
                      <span>{listing.order_count} orders</span>
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-leaf-700">
                    {listing.type === "donation" ? "Free" : pesos(listing.price)}
                  </span>
                </Link>
              ))}
            </div>
          )}

          <p className="mt-5 flex items-center gap-2 rounded-2xl bg-leaf-50 p-3 text-xs text-charcoal/65">
            <Banknote className="h-4 w-4 shrink-0 text-leaf-600" />
            ReWear deducts the platform fee from completed sales and records it for your next payout.
          </p>
        </section>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link
          to="/orders"
          className="inline-flex items-center gap-2 rounded-full bg-leaf-600 px-5 py-2.5 text-sm font-semibold text-cream transition hover:bg-leaf-700"
        >
          <Heart className="h-4 w-4" /> Manage sales
        </Link>
        <Link
          to="/messages"
          className="inline-flex items-center gap-2 rounded-full border border-leaf-300/60 px-5 py-2.5 text-sm font-semibold text-leaf-700 hover:bg-leaf-50"
        >
          <MessageCircle className="h-4 w-4" /> Buyer messages
        </Link>
      </div>
    </div>
  );
}
