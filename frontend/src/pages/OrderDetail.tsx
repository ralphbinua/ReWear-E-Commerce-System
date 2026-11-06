import { useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  ShieldCheck,
  Star,
  XCircle,
} from "lucide-react";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { cn } from "../lib/utils";
import { showToast } from "../lib/toast";
import { ordersService, type OrderStatus } from "../services/orders";
import { useAuth } from "../context/useAuth";

const STEPS: OrderStatus[] = ["pending_payment", "payment_review", "paid", "shipped", "completed"];

const STEP_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Placed — waiting for payment",
  payment_review: "Proof of payment submitted",
  paid: "Payment verified",
  shipped: "Shipped",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  disputed: "Disputed",
};

const COURIERS = ["LBC", "J&T Express", "Ninja Van", "GrabExpress", "Lalamove", "Meetup (no courier)"];

function Stars({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            "h-4 w-4",
            star <= value ? "fill-amber-400 text-amber-500" : "text-charcoal/25",
          )}
          aria-hidden
        />
      ))}
    </div>
  );
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: order, isPending, isError } = useQuery({
    queryKey: ["order", id],
    queryFn: () => ordersService.get(id as string),
    enabled: Boolean(id),
    refetchOnWindowFocus: true,
    // Keep the page live so a seller sees new payment proof without reloading.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      const inFlight =
        status === "pending_payment" ||
        status === "payment_review" ||
        status === "paid" ||
        status === "shipped";
      return inFlight ? 10_000 : false;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["order", id] });

  const uploadProof = useMutation({
    mutationFn: (file: File) =>
      ordersService.uploadProof(id as string, {
        method: proofMethod,
        reference: proofReference.trim() || undefined,
        screenshot: file,
      }),
    onSuccess: () => {
      setProofFile(null);
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const verify = useMutation({
    mutationFn: (decision: "verified" | "rejected") =>
      ordersService.verifyPayment(id as string, decision, rejectReason.trim() || undefined),
    onSuccess: () => {
      setRejectReason("");
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const ship = useMutation({
    mutationFn: () => ordersService.ship(id as string, courier, trackingNumber.trim()),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const confirm = useMutation({
    mutationFn: () => ordersService.confirm(id as string),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const cancel = useMutation({
    mutationFn: () => ordersService.cancel(id as string, "Buyer changed their mind"),
    onSuccess: invalidate,
  });

  const submitReview = useMutation({
    mutationFn: () =>
      ordersService.review(id as string, {
        rating,
        comment: reviewComment.trim() || undefined,
      }),
    onSuccess: () => {
      setRating(0);
      setReviewComment("");
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const [proofMethod, setProofMethod] = useState("gcash");
  const [proofReference, setProofReference] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);

  const [courier, setCourier] = useState(COURIERS[0]!);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [rating, setRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");

  function submitProof(event: FormEvent) {
    event.preventDefault();
    if (!proofFile) {
      showToast(
        "Choose a payment proof screenshot before submitting.",
        "error",
        "Invalid action",
      );
      return;
    }
    uploadProof.mutate(proofFile);
  }

  function submitReviewAction(event: FormEvent) {
    event.preventDefault();
    if (rating <= 0) {
      showToast("Choose a star rating before submitting.", "error", "Invalid action");
      return;
    }
    submitReview.mutate();
  }

  if (isPending)
    return <div className="shell py-16 text-center text-charcoal/60">Loading order…</div>;
  if (isError || !order)
    return <div className="shell py-16 text-center text-red-700">Order not found.</div>;

  const myRole: "buyer" | "seller" | "stranger" =
    user?.id === order.buyer ? "buyer" : user?.id === order.seller ? "seller" : "stranger";
  const currentStep = STEPS.indexOf(order.status as OrderStatus);
  const myReview = order.reviews.find((review) => review.reviewer === user?.id);
  const theirReview = order.reviews.find((review) => review.reviewer !== user?.id);
  const canRate =
    (myRole === "buyer" || myRole === "seller") &&
    (order.status === "completed" || order.status === "delivered");

  return (
    <div className="shell py-10">
      <Link to="/orders" className="inline-flex items-center gap-2 text-sm text-leaf-700 underline">
        <ArrowLeft className="h-4 w-4" /> My orders
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold text-leaf-700">
            {order.order_number}
          </h1>
          <p className="text-xs text-charcoal/60">{new Date(order.created_at).toLocaleString()}</p>
        </div>
        <p className="font-display text-3xl font-semibold text-leaf-700">
          ₱ {Number(order.total).toLocaleString("en-PH")}
        </p>
      </div>

      {/* Status timeline */}
      <ol className="mt-6 grid grid-cols-5 gap-1 sm:gap-2">
        {STEPS.map((step, i) => {
          const reached = order.status === "cancelled" ? false : order.status === step || (currentStep >= 0 && i < currentStep);
          const active = order.status === step;
          const Icon = reached ? CheckCircle2 : Circle;
          return (
            <li
              key={step}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl border px-1 py-3 text-center text-[10px] sm:text-[11px]",
                active
                  ? "border-leaf-600 bg-leaf-50 text-leaf-800"
                  : reached
                    ? "border-leaf-300/40 bg-white text-charcoal/60"
                    : "border-transparent text-charcoal/40",
              )}
            >
              <Icon className={cn("h-4 w-4", reached || active ? "text-leaf-600" : "text-charcoal/30")} />
              <span className="hidden sm:inline">{STEP_LABEL[step]}</span>
              <span className="sm:hidden">{STEP_LABEL[step].split("—")[0]}</span>
            </li>
          );
        })}
      </ol>

      {order.status === "cancelled" && (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-800">
          <XCircle className="h-4 w-4" /> Order cancelled{order.cancel_reason ? ` — ${order.cancel_reason}` : ""}.
        </p>
      )}

      {/* Item summary */}
      <Link
        to={`/listing/${order.listing.id}`}
        className="mt-4 flex items-center gap-4 rounded-2xl border border-leaf-300/40 bg-white p-4 hover:shadow-md"
      >
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-leaf-100">
          {order.listing.cover_image && (
            <img src={order.listing.cover_image} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div>
          <p className="font-semibold">{order.listing.title}</p>
          <p className="text-xs text-charcoal/60">{order.listing.id.slice(0, 8)}</p>
        </div>
      </Link>

      {/* Buyer actions */}
      {myRole === "buyer" && order.status === "pending_payment" && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-900">How to pay the seller</h2>
          <ol className="mt-2 list-decimal pl-5 text-sm text-amber-900/90">
            <li>
              Send <strong>₱{Number(order.total).toLocaleString("en-PH")}</strong> via
              GCash/Maya/bank transfer to the seller's account below.
            </li>
            <li>Use <strong>{order.order_number}</strong> as your payment note.</li>
            <li>Upload the screenshot below so the seller can verify it.</li>
          </ol>

          {order.payout_accounts.length > 0 ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-white/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/70">
                Send to
              </p>
              <ul className="mt-2 grid gap-2">
                {order.payout_accounts.map((account) => (
                  <li
                    key={`${account.method}-${account.account_number}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg bg-amber-50/80 px-3 py-2"
                  >
                    <span className="text-sm font-semibold text-amber-900">
                      {account.method_label}
                    </span>
                    <span className="text-sm text-amber-900/90">
                      {account.account_name} ·{" "}
                      <strong className="font-mono">{account.account_number}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-amber-300 bg-white/60 p-3 text-sm text-amber-900/90">
              The seller hasn't added payout details yet. Wait for them to add their
              GCash/Maya/bank account before sending money.
            </p>
          )}

          <form onSubmit={submitProof} className="mt-4 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium">
                Method
                <select
                  className="rounded-xl border border-leaf-300/50 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-leaf-500"
                  value={proofMethod}
                  onChange={(e) => setProofMethod(e.target.value)}
                >
                  <option value="gcash">GCash</option>
                  <option value="maya">Maya</option>
                  <option value="bank">Bank transfer</option>
                  <option value="cod">COD</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Reference no. (optional)
                <Input
                  value={proofReference}
                  onChange={(e) => setProofReference(e.target.value)}
                  placeholder="e.g. GC-12345"
                />
              </label>
            </div>
            <input
              ref={proofInputRef}
              type="file"
              accept="image/*"
              required
              className="block text-sm text-charcoal/80 file:mr-3 file:rounded-full file:border-0 file:bg-leaf-600 file:px-4 file:py-2 file:font-semibold file:text-cream file:transition hover:file:bg-leaf-700"
              onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!proofFile || uploadProof.isPending}>
                {uploadProof.isPending ? "Uploading…" : "I sent it — submit proof"}
              </Button>
              <Button variant="ghost" type="button" onClick={() => cancel.mutate()}>
                Cancel order
              </Button>
            </div>
            {uploadProof.isError && (
              <p role="alert" className="text-sm text-red-700">
                Couldn't upload your proof. Use a clear JPG/PNG screenshot under 5 MB and
                try again.
              </p>
            )}
            {cancel.isError && (
              <p role="alert" className="text-sm text-red-700">
                Couldn't cancel the order. Try again in a moment.
              </p>
            )}
          </form>
        </div>
      )}

      {myRole === "buyer" && order.status === "payment_review" && (
        <p className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          Seller is verifying your payment — you'll be notified when they confirm.
        </p>
      )}
      {myRole === "buyer" && order.status === "paid" && (
        <p className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <ShieldCheck className="mr-1 inline h-4 w-4" /> Payment verified. The seller will ship soon — check your notifications.
        </p>
      )}
      {myRole === "buyer" && order.status === "shipped" && (
        <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-purple-200 bg-purple-50 p-4">
          <p className="text-sm text-purple-900">
            Shipped via <strong>{order.courier}</strong>
            {order.tracking_number && <> · tracking {order.tracking_number}</>}.
          </p>
          <Button type="button" onClick={() => confirm.mutate()} disabled={confirm.isPending}>
            {confirm.isPending ? "Confirming…" : "I received it ✓"}
          </Button>
        </div>
      )}

      {/* Seller actions */}
      {myRole === "seller" && order.status === "payment_review" && (
        <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-semibold text-blue-900">Review payment proof</h2>
          {order.latest_proof?.screenshot && (
            <a href={order.latest_proof.screenshot} target="_blank" rel="noreferrer">
              <img
                src={order.latest_proof.screenshot}
                alt="Payment screenshot"
                className="mt-3 h-56 rounded-xl border border-blue-200 object-contain bg-white"
              />
            </a>
          )}
          <p className="mt-2 text-sm text-blue-900">
            Method: {order.latest_proof?.method}{" "}
            {order.latest_proof?.reference && <>· Ref: {order.latest_proof.reference}</>}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => verify.mutate("verified")} disabled={verify.isPending}>
              <ShieldCheck className="h-4 w-4" /> Payment verified
            </Button>
            <Input
              className="max-w-[16rem]"
              placeholder="Reason for rejecting (wrong amount…)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <Button variant="ghost" type="button" onClick={() => verify.mutate("rejected")} disabled={verify.isPending}>
              Reject
            </Button>
          </div>
        </div>
      )}

      {myRole === "seller" && order.status === "paid" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ship.mutate();
          }}
          className="mt-6 rounded-2xl border border-purple-200 bg-purple-50 p-5"
        >
          <h2 className="font-semibold text-purple-900">Ship it</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">
              Courier
              <select
                className="rounded-xl border border-leaf-300/50 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-leaf-500"
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
              >
                {COURIERS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Tracking no. (optional)
              <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="…" />
            </label>
          </div>
          <Button type="submit" className="mt-4" disabled={ship.isPending}>
            {ship.isPending ? "Marking…" : "Mark as shipped ✓"}
          </Button>
        </form>
      )}

      {(order.status === "completed" || order.status === "delivered") && (
        <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5 text-green-900">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5" />
            <p className="font-semibold">
              {order.status === "completed" ? "Sale complete!" : "Delivered!"}
            </p>
          </div>

          {canRate && (
            <div className="mt-4 grid gap-3">
              {myReview ? (
                <div className="rounded-xl bg-white/70 p-3">
                  <p className="text-sm font-semibold">Your rating</p>
                  <Stars value={myReview.rating} />
                  {myReview.comment && (
                    <p className="mt-1 text-sm text-charcoal/80">{myReview.comment}</p>
                  )}
                </div>
              ) : (
                <form
                  onSubmit={submitReviewAction}
                  className="rounded-xl bg-white/70 p-3"
                >
                  <p className="text-sm font-semibold">
                    {myRole === "buyer" ? "Rate the seller" : "Rate the buyer"}
                  </p>
                  <div className="mt-1.5 flex gap-1" role="radiogroup" aria-label="Rating">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        role="radio"
                        aria-checked={rating === star}
                        aria-label={`${star} star${star === 1 ? "" : "s"}`}
                        onClick={() => setRating(star)}
                        className="rounded p-0.5 transition hover:scale-110"
                      >
                        <Star
                          className={cn(
                            "h-7 w-7",
                            star <= rating
                              ? "fill-amber-400 text-amber-500"
                              : "text-charcoal/25",
                          )}
                        />
                      </button>
                    ))}
                  </div>
                  <Input
                    className="mt-2"
                    value={reviewComment}
                    onChange={(event) => setReviewComment(event.target.value)}
                    placeholder="Optional comment — how did it go?"
                    maxLength={1000}
                  />
                  <Button
                    type="submit"
                    className="mt-2"
                    disabled={rating === 0 || submitReview.isPending}
                  >
                    {submitReview.isPending ? "Submitting…" : "Submit rating"}
                  </Button>
                  {submitReview.isError && (
                    <p role="alert" className="mt-1 text-sm text-red-700">
                      Couldn't submit your rating. Try again.
                    </p>
                  )}
                </form>
              )}

              {theirReview && (
                <div className="rounded-xl bg-white/70 p-3">
                  <p className="text-sm font-semibold">
                    {myRole === "buyer" ? "Seller rated you" : "Buyer rated you"}
                  </p>
                  <Stars value={theirReview.rating} />
                  {theirReview.comment && (
                    <p className="mt-1 text-sm text-charcoal/80">{theirReview.comment}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {myRole === "stranger" && (
            <p className="mt-2 text-sm">You don't have a rating role on this order.</p>
          )}
        </div>
      )}
    </div>
  );
}
