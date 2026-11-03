import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Package, Truck, CheckCircle2, XCircle, Clock, ShoppingBag } from "lucide-react";

import { cn } from "../lib/utils";
import { ordersService, type OrderStatus } from "../services/orders";

const STATUS_META: Record<OrderStatus, { label: string; tone: string; Icon: typeof Clock }> = {
  pending_payment: { label: "Awaiting payment", tone: "bg-amber-100 text-amber-800", Icon: Clock },
  payment_review: { label: "Payment under review", tone: "bg-blue-100 text-blue-800", Icon: Clock },
  paid: { label: "Paid — waiting to ship", tone: "bg-blue-100 text-blue-800", Icon: Package },
  shipped: { label: "Shipped", tone: "bg-purple-100 text-purple-800", Icon: Truck },
  delivered: { label: "Delivered", tone: "bg-green-100 text-green-800", Icon: CheckCircle2 },
  completed: { label: "Completed", tone: "bg-green-100 text-green-800", Icon: CheckCircle2 },
  cancelled: { label: "Cancelled", tone: "bg-red-100 text-red-800", Icon: XCircle },
  refunded: { label: "Refunded", tone: "bg-red-100 text-red-800", Icon: XCircle },
  disputed: { label: "Disputed", tone: "bg-red-100 text-red-800", Icon: XCircle },
};

export default function Orders() {
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const { data, isPending, isError } = useQuery({
    queryKey: ["orders", role],
    queryFn: () => ordersService.listForCurrentUser(role),
  });

  return (
    <div className="shell py-10">
      <h1 className="font-display text-3xl font-semibold text-leaf-700">Your orders</h1>
      <p className="text-charcoal/70">Every purchase and sale in one place.</p>

      <div className="mt-5 inline-flex rounded-full border border-leaf-300/40 bg-white p-1">
        {(["buyer", "seller"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={cn(
              "rounded-full px-5 py-1.5 text-sm font-semibold capitalize transition",
              role === r ? "bg-leaf-600 text-cream" : "text-leaf-700 hover:bg-leaf-50",
            )}
          >
            {r === "buyer" ? "Purchases" : "Sales"}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-3">
        {isPending && Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-leaf-100" />
        ))}
        {isError && <p className="text-red-700">Couldn't load orders.</p>}

        {data?.results.map((order) => {
          const meta = STATUS_META[order.status];
          return (
            <Link
              key={order.id}
              to={`/orders/${order.id}`}
              className="flex items-center gap-4 rounded-2xl border border-leaf-300/40 bg-white p-4 transition hover:shadow-md"
            >
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-leaf-100">
                {order.listing.cover_image ? (
                  <img
                    src={order.listing.cover_image}
                    alt={order.listing.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ShoppingBag className="h-7 w-7 text-leaf-600" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 font-semibold">{order.listing.title}</p>
                <p className="text-xs text-charcoal/60">{order.order_number}</p>
                <span
                  className={cn(
                    "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    meta.tone,
                  )}
                >
                  <meta.Icon className="h-3 w-3" />
                  {meta.label}
                </span>
              </div>
              <p className="font-display shrink-0 text-lg font-semibold text-leaf-700">
                ₱ {Number(order.total).toLocaleString("en-PH")}
              </p>
            </Link>
          );
        })}

        {data && data.results.length === 0 && (
          <p className="rounded-2xl border border-leaf-300/40 bg-white p-10 text-center text-charcoal/70">
            {role === "buyer"
              ? "You haven't bought anything yet — browse some pre-loved drops."
              : "No sales yet. List something and watch it sell."}
          </p>
        )}
      </div>
    </div>
  );
}
