import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  Package,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { cn } from "../lib/utils";
import {
  payoutService,
  type PayoutMethod,
} from "../services/auth";
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

const PAYOUT_METHODS: { value: PayoutMethod; label: string }[] = [
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "bank", label: "Bank transfer" },
];

function PayoutDetails() {
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<PayoutMethod>("gcash");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  const { data: accounts, isPending } = useQuery({
    queryKey: ["payout-accounts"],
    queryFn: payoutService.list,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["payout-accounts"] });

  const addAccount = useMutation({
    mutationFn: () =>
      payoutService.create({
        method,
        account_name: accountName.trim(),
        account_number: accountNumber.trim(),
      }),
    onSuccess: () => {
      setAccountName("");
      setAccountNumber("");
      invalidate();
    },
  });

  const removeAccount = useMutation({
    mutationFn: (id: number) => payoutService.remove(id),
    onSuccess: invalidate,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!accountName.trim() || !accountNumber.trim()) return;
    addAccount.mutate();
  }

  return (
    <section className="mt-6 rounded-2xl border border-leaf-300/40 bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-leaf-100">
          <CreditCard className="h-4 w-4 text-leaf-700" />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-leaf-700">
            Where buyers send payment
          </h2>
          <p className="text-sm text-charcoal/70">
            Add the GCash, Maya, or bank account you want buyers to pay into. Buyers
            only see these details on their order page.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {isPending && <div className="h-14 animate-pulse rounded-xl bg-leaf-100" />}

        {accounts?.map((account) => (
          <div
            key={account.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-leaf-300/30 bg-cream/50 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold">
                {account.method_label}
                {account.is_verified && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800">
                    Verified
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-charcoal/70">
                {account.account_name} · {account.account_number}
              </p>
            </div>
            <button
              type="button"
              onClick={() => removeAccount.mutate(account.id)}
              disabled={removeAccount.isPending}
              className="rounded-full p-2 text-charcoal/50 transition hover:bg-red-50 hover:text-red-700"
              aria-label={`Remove ${account.method_label} account`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        {accounts && accounts.length === 0 && (
          <p className="rounded-xl border border-dashed border-leaf-300/60 px-4 py-4 text-sm text-charcoal/60">
            No payout account yet. Add one so buyers know where to send money.
          </p>
        )}
      </div>

      <form onSubmit={submit} className="mt-4 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">
            Method
            <select
              className="rounded-xl border border-leaf-300/50 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-leaf-500"
              value={method}
              onChange={(e) => setMethod(e.target.value as PayoutMethod)}
            >
              {PAYOUT_METHODS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Account name
            <Input
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g. Sara Dela Cruz"
              required
            />
          </label>
        </div>
        <label className="grid gap-1.5 text-sm font-medium">
          Account number
          <Input
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="e.g. 0917 123 4567"
            required
          />
        </label>
        <div>
          <Button
            type="submit"
            disabled={addAccount.isPending || !accountName.trim() || !accountNumber.trim()}
          >
            <Plus className="h-4 w-4" />
            {addAccount.isPending ? "Adding…" : "Add payout account"}
          </Button>
        </div>
        {addAccount.isError && (
          <p role="alert" className="text-sm text-red-700">
            Couldn't save that account. Check the details and try again.
          </p>
        )}
      </form>
    </section>
  );
}

export default function Orders() {
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const { data, isPending, isError } = useQuery({
    queryKey: ["orders", role],
    queryFn: () => ordersService.listForCurrentUser(role),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
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

      {role === "seller" && <PayoutDetails />}

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
