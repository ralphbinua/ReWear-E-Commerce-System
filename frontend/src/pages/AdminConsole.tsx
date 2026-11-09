import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CheckCircle2,
  Eye,
  FileText,
  Gavel,
  KeyRound,
  Package,
  Pencil,
  RotateCcw,
  ShieldAlert,
  ShoppingBag,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { cn } from "../lib/utils";
import { showToast } from "../lib/toast";
import {
  adminService,
  type SystemDispute,
  type SystemReport,
  type SystemUser,
} from "../services/admin";
import { useAuth } from "../context/useAuth";

type Tab =
  | "overview"
  | "listings"
  | "reports"
  | "users"
  | "orders"
  | "disputes"
  | "catalog"
  | "audit-logs";

const TABS: Array<{ value: Tab; label: string; Icon: typeof Eye }> = [
  { value: "overview", label: "Overview", Icon: Eye },
  { value: "listings", label: "Listings", Icon: ShoppingBag },
  { value: "reports", label: "Reports", Icon: ShieldAlert },
  { value: "users", label: "Users", Icon: Users },
  { value: "orders", label: "Orders", Icon: Package },
  { value: "disputes", label: "Disputes", Icon: FileText },
  { value: "catalog", label: "Catalog", Icon: ShoppingBag },
  { value: "audit-logs", label: "Audit logs", Icon: ShieldAlert },
];

function money(value: string) {
  return `₱ ${Number(value).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const inputClass =
  "rounded-xl border border-leaf-300/50 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-500/30";

export default function AdminConsole() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  if (!user?.is_staff) {
    return (
      <div className="shell py-16">
        <div className="mx-auto max-w-md rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" />
          <h1 className="mt-4 font-display text-2xl font-semibold text-amber-900">
            System admin only
          </h1>
          <p className="mt-2 text-sm text-amber-900/80">
            Sign in with a staff account. This is ReWear’s built-in system admin console.
          </p>
          <Link
            to="/admin/login"
            className="mt-5 inline-block rounded-full bg-leaf-600 px-5 py-2.5 text-sm font-semibold text-cream hover:bg-leaf-700"
          >
            Admin login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="shell py-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-leaf-600">
          System admin
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold text-leaf-700">
          ReWear control room
        </h1>
        <p className="text-charcoal/70">
          Approve listings, resolve reports, manage users, and keep orders moving — all without
          leaving the ReWear app.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setActiveTab(value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
              activeTab === value
                ? "border-leaf-600 bg-leaf-600 text-cream"
                : "border-leaf-300/50 bg-white text-leaf-700 hover:bg-leaf-50",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {activeTab === "overview" && <Overview />}
        {activeTab === "listings" && <ListingsPanel />}
        {activeTab === "reports" && <ReportsPanel />}
        {activeTab === "users" && <UsersPanel />}
        {activeTab === "orders" && <OrdersPanel />}
        {activeTab === "disputes" && <DisputesPanel />}
        {activeTab === "catalog" && <CatalogPanel />}
        {activeTab === "audit-logs" && <AuditLogsPanel />}
      </div>
    </div>
  );
}

function useAdminRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["system-admin"] });
}

function Overview() {
  const summary = useQuery({
    queryKey: ["system-admin", "summary"],
    queryFn: adminService.summary,
  });

  if (summary.isPending) return <Loading />;
  if (summary.isError || !summary.data) return <LoadError />;

  const cards = [
    { label: "Pending listings", value: summary.data.pending_listings, Icon: ShoppingBag },
    { label: "Open reports", value: summary.data.open_reports, Icon: ShieldAlert },
    { label: "Active users", value: summary.data.active_users, Icon: Users },
    { label: "Disputed orders", value: summary.data.disputed_orders, Icon: FileText },
    { label: "Active listings", value: summary.data.active_listings, Icon: Eye },
    { label: "Total orders", value: summary.data.total_orders, Icon: Package },
    { label: "Platform revenue", value: money(summary.data.platform_revenue), Icon: CheckCircle2 },
    { label: "Sold listings", value: summary.data.sold_listings, Icon: Gavel },
    {
      label: "Platform fee rate",
      value: `${(Number(summary.data.platform_fee_rate) * 100).toFixed(2)}%`,
      Icon: CheckCircle2,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ label, value, Icon }) => (
        <section key={label} className="rounded-3xl border border-leaf-300/40 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-charcoal/60">{label}</p>
            <Icon className="h-5 w-5 text-leaf-600" />
          </div>
          <p className="font-display mt-3 text-3xl font-semibold text-leaf-700">{value}</p>
        </section>
      ))}
    </div>
  );
}

function ListingsPanel() {
  const refresh = useAdminRefresh();
  const [listingStatus, setListingStatus] = useState("pending_review");
  const [search, setSearch] = useState("");
  const listings = useQuery({
    queryKey: ["system-admin", "listings", listingStatus, search],
    queryFn: () =>
      adminService.listings({
        status: listingStatus === "all" ? undefined : listingStatus,
        q: search.trim() || undefined,
      }),
  });

  const approve = useMutation({
    mutationFn: adminService.approveListing,
    onSuccess: () => {
      showToast("Listing approved.", "success", "ReWear");
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: adminService.removeListing,
    onSuccess: () => {
      showToast("Listing removed.", "success", "ReWear");
      refresh();
    },
  });
  const restore = useMutation({
    mutationFn: adminService.restoreListing,
    onSuccess: () => {
      showToast("Listing sent back to review.", "success", "ReWear");
      refresh();
    },
  });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-3">
        <select
          aria-label="Listing status"
          className={inputClass}
          value={listingStatus}
          onChange={(event) => setListingStatus(event.target.value)}
        >
          <option value="pending_review">Pending review</option>
          <option value="active">Active</option>
          <option value="sold">Sold</option>
          <option value="ended">Ended</option>
          <option value="removed">Removed</option>
          <option value="all">All listings</option>
        </select>
        <Input
          className="max-w-sm"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search title or description…"
        />
      </div>

      {listings.isPending && <Loading />}
      {listings.isError && <LoadError />}
      {listings.data && listings.data.length === 0 && <Empty text="No listings match this filter." />}

      <div className="grid gap-3">
        {listings.data?.map((listing) => (
          <article
            key={listing.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-leaf-300/40 bg-white p-4"
          >
            <div className="min-w-0">
              <Link to={`/listing/${listing.id}`} className="font-semibold hover:underline">
                {listing.title}
              </Link>
              <p className="mt-1 text-xs text-charcoal/55">
                by {listing.seller.display_name} · {listing.type} · {listing.status} ·{" "}
                {listing.view_count} views · {listing.bid_count} bids · {listing.order_count} orders
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-display font-semibold text-leaf-700">
                {listing.type === "donation" ? "Free" : money(listing.price)}
              </span>
              {listing.status === "pending_review" && (
                <Button onClick={() => approve.mutate(listing.id)} disabled={approve.isPending}>
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </Button>
              )}
              {listing.status !== "removed" && (
                <Button variant="ghost" onClick={() => remove.mutate(listing.id)} disabled={remove.isPending}>
                  <XCircle className="h-4 w-4" /> Remove
                </Button>
              )}
              {listing.status === "removed" && (
                <Button variant="ghost" onClick={() => restore.mutate(listing.id)} disabled={restore.isPending}>
                  <RotateCcw className="h-4 w-4" /> Restore
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ReportsPanel() {
  const [reportStatus, setReportStatus] = useState("open");
  const reports = useQuery({
    queryKey: ["system-admin", "reports", reportStatus],
    queryFn: () =>
      adminService.reports({
        status: reportStatus === "all" ? undefined : reportStatus,
      }),
  });

  return (
    <div className="grid gap-4">
      <select
        aria-label="Report status"
        className={inputClass}
        value={reportStatus}
        onChange={(event) => setReportStatus(event.target.value)}
      >
        <option value="open">Open</option>
        <option value="reviewing">Reviewing</option>
        <option value="actioned">Actioned</option>
        <option value="dismissed">Dismissed</option>
        <option value="all">All reports</option>
      </select>

      {reports.isPending && <Loading />}
      {reports.isError && <LoadError />}
      {reports.data && reports.data.length === 0 && <Empty text="No reports in this queue." />}

      <div className="grid gap-3">
        {reports.data?.map((report) => (
          <ReportCard key={report.id} report={report} />
        ))}
      </div>
    </div>
  );
}

function ReportCard({ report }: { report: SystemReport }) {
  const refresh = useAdminRefresh();
  const [action, setAction] = useState("");
  const [notes, setNotes] = useState("");

  const resolve = useMutation({
    mutationFn: (payload: { status: "actioned" | "dismissed"; action?: string; notes?: string }) =>
      adminService.resolveReport(report.id, payload),
    onSuccess: () => {
      showToast("Report resolved.", "success", "ReWear");
      refresh();
    },
  });

  function submit(event: FormEvent, status: "actioned" | "dismissed") {
    event.preventDefault();
    resolve.mutate({ status, action: action || undefined, notes: notes.trim() || undefined });
  }

  return (
    <article className="rounded-3xl border border-leaf-300/40 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold capitalize">
            {report.reason.replace(/_/g, " ")} report
          </h3>
          <p className="mt-1 text-xs text-charcoal/55">
            {report.target_type} #{report.target_id} · by {report.reporter_name} ·{" "}
            {new Date(report.created_at).toLocaleString("en-PH")}
          </p>
        </div>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
          {report.status.replace(/_/g, " ")}
        </span>
      </div>

      {report.details && <p className="mt-3 text-sm text-charcoal/75">{report.details}</p>}

      {!["actioned", "dismissed"].includes(report.status) && (
        <div className="mt-4 grid gap-3 border-t border-leaf-300/30 pt-4 md:grid-cols-[12rem_1fr_auto]">
          <select
            aria-label="Moderation action"
            className={inputClass}
            value={action}
            onChange={(event) => setAction(event.target.value)}
          >
            <option value="">No extra action</option>
            <option value="warn">Warn user</option>
            <option value="remove_listing">Remove listing</option>
            <option value="suspend_user">Suspend user</option>
            <option value="ban_user">Ban user</option>
            <option value="dismiss">Dismiss</option>
          </select>
          <Input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Resolution note…"
            maxLength={1000}
          />
          <div className="flex gap-2">
            <Button onClick={(event) => submit(event, "actioned")} disabled={resolve.isPending}>
              Take action
            </Button>
            <Button variant="ghost" onClick={(event) => submit(event, "dismissed")} disabled={resolve.isPending}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

function UsersPanel() {
  const { user: currentUser } = useAuth();
  const refresh = useAdminRefresh();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    phone: "",
    is_staff: false,
  });
  const [resetResult, setResetResult] = useState<{
    userId: number;
    password: string;
  } | null>(null);
  const users = useQuery({
    queryKey: ["system-admin", "users", search],
    queryFn: () => adminService.users({ q: search.trim() || undefined }),
  });

  const suspend = useMutation({
    mutationFn: adminService.suspendUser,
    onSuccess: () => {
      showToast("User suspended.", "success", "ReWear");
      refresh();
    },
  });
  const activate = useMutation({
    mutationFn: adminService.activateUser,
    onSuccess: () => {
      showToast("User restored.", "success", "ReWear");
      refresh();
    },
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: typeof form }) =>
      adminService.updateUser(id, payload),
    onSuccess: () => {
      showToast("Account updated.", "success", "ReWear");
      setEditingId(null);
      refresh();
    },
  });
  const resetPassword = useMutation({
    mutationFn: adminService.resetPassword,
    onSuccess: (result) => {
      setResetResult({ userId: result.user.id, password: result.temporary_password });
      showToast("Temporary password created.", "success", "ReWear");
      refresh();
    },
  });

  function startEditing(member: SystemUser) {
    setEditingId(member.id);
    setForm({
      username: member.username ?? "",
      email: member.email,
      first_name: member.first_name,
      last_name: member.last_name,
      phone: member.phone,
      is_staff: member.is_staff,
    });
  }

  function saveEdit(event: FormEvent, member: SystemUser) {
    event.preventDefault();
    update.mutate({ id: member.id, payload: form });
  }

  return (
    <div className="grid gap-4">
      <Input
        className="max-w-sm"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search email or name…"
      />

      {users.isPending && <Loading />}
      {users.isError && <LoadError />}
      {users.data && users.data.length === 0 && <Empty text="No users found." />}

      <div className="grid gap-3">
        {users.data?.map((member) => (
          <article
            key={member.id}
            className="grid gap-4 rounded-3xl border border-leaf-300/40 bg-white p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold">{member.display_name}</p>
                <p className="text-xs text-charcoal/55">
                  {member.username ? `@${member.username} · ` : ""}
                  {member.email} · joined {new Date(member.date_joined).toLocaleDateString("en-PH")} ·{" "}
                  {member.listings_count} listings · {member.sales_count} sales
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    member.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800",
                  )}
                >
                  {member.is_active ? "Active" : "Suspended"}
                </span>
                {member.is_staff && (
                  <span className="rounded-full bg-leaf-100 px-2 py-0.5 text-[10px] font-semibold text-leaf-800">
                    Staff
                  </span>
                )}
                <Button variant="ghost" onClick={() => startEditing(member)}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => resetPassword.mutate(member.id)}
                  disabled={resetPassword.isPending}
                >
                  <KeyRound className="h-4 w-4" /> Reset password
                </Button>
                {member.is_active ? (
                  <Button
                    variant="ghost"
                    onClick={() => suspend.mutate(member.id)}
                    disabled={suspend.isPending || member.id === currentUser?.id || member.is_superuser}
                    title={
                      member.id === currentUser?.id
                        ? "You can't suspend your own account"
                        : member.is_superuser
                          ? "Superusers cannot be suspended"
                          : undefined
                    }
                  >
                    <Ban className="h-4 w-4" /> Suspend
                  </Button>
                ) : (
                  <Button variant="ghost" onClick={() => activate.mutate(member.id)} disabled={activate.isPending}>
                    <UserCheck className="h-4 w-4" /> Restore
                  </Button>
                )}
              </div>
            </div>

            {resetResult?.userId === member.id && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">Temporary password</p>
                <p className="mt-1 font-mono text-base">{resetResult.password}</p>
                <p className="mt-1 text-xs text-amber-900/70">
                  Give this to the user right away. It won't be shown again.
                </p>
              </div>
            )}

            {editingId === member.id && (
              <form
                onSubmit={(event) => saveEdit(event, member)}
                className="grid gap-3 border-t border-leaf-300/30 pt-4 md:grid-cols-2"
              >
                <label className="grid gap-1.5 text-sm font-medium">
                  Username
                  <Input
                    value={form.username}
                    onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                    maxLength={30}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Email
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  First name
                  <Input
                    value={form.first_name}
                    onChange={(event) => setForm((current) => ({ ...current, first_name: event.target.value }))}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Last name
                  <Input
                    value={form.last_name}
                    onChange={(event) => setForm((current) => ({ ...current, last_name: event.target.value }))}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Phone
                  <Input
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={form.is_staff}
                    onChange={(event) => setForm((current) => ({ ...current, is_staff: event.target.checked }))}
                    disabled={member.id === currentUser?.id}
                  />
                  Staff account
                </label>
                <div className="flex gap-2 md:col-span-2">
                  <Button type="submit" disabled={update.isPending}>
                    {update.isPending ? "Saving…" : "Save account"}
                  </Button>
                  <Button variant="ghost" type="button" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function OrdersPanel() {
  const orders = useQuery({
    queryKey: ["system-admin", "orders"],
    queryFn: adminService.orders,
  });

  if (orders.isPending) return <Loading />;
  if (orders.isError || !orders.data) return <LoadError />;

  return (
    <div className="grid gap-3">
      {orders.data.length === 0 && <Empty text="No orders yet." />}
      {orders.data.map((order) => (
        <Link
          key={order.id}
          to={`/orders/${order.id}`}
          className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-leaf-300/40 bg-white p-4 hover:shadow-md"
        >
          <div>
            <p className="font-semibold">{order.listing.title}</p>
            <p className="text-xs text-charcoal/55">
              {order.order_number} · {order.buyer_name} → {order.seller_name} · fee {money(order.platform_fee)}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display font-semibold text-leaf-700">{money(order.total)}</p>
            <p className="text-xs capitalize text-charcoal/55">{order.status.replace(/_/g, " ")}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function DisputesPanel() {
  const [disputeStatus, setDisputeStatus] = useState("open");
  const disputes = useQuery({
    queryKey: ["system-admin", "disputes", disputeStatus],
    queryFn: () =>
      adminService.disputes({ status: disputeStatus === "all" ? undefined : disputeStatus }),
  });

  return (
    <div className="grid gap-4">
      <select
        aria-label="Dispute status"
        className={inputClass}
        value={disputeStatus}
        onChange={(event) => setDisputeStatus(event.target.value)}
      >
        <option value="open">Open</option>
        <option value="resolved_buyer">Resolved for buyer</option>
        <option value="resolved_seller">Resolved for seller</option>
        <option value="closed">Closed</option>
        <option value="all">All disputes</option>
      </select>

      {disputes.isPending && <Loading />}
      {disputes.isError && <LoadError />}
      {disputes.data && disputes.data.length === 0 && <Empty text="No disputes in this queue." />}

      <div className="grid gap-3">
        {disputes.data?.map((dispute) => (
          <DisputeCard key={dispute.id} dispute={dispute} />
        ))}
      </div>
    </div>
  );
}

function DisputeCard({ dispute }: { dispute: SystemDispute }) {
  const refresh = useAdminRefresh();
  const [status, setStatus] = useState<"resolved_buyer" | "resolved_seller" | "closed">(
    dispute.status === "resolved_seller" ? "resolved_seller" : "resolved_buyer",
  );
  const [note, setNote] = useState(dispute.resolution_note);

  const resolve = useMutation({
    mutationFn: () =>
      adminService.resolveDispute(dispute.id, {
        status,
        resolution_note: note.trim() || undefined,
      }),
    onSuccess: () => {
      showToast("Dispute resolved.", "success", "ReWear");
      refresh();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    resolve.mutate();
  }

  return (
    <article className="rounded-3xl border border-leaf-300/40 bg-white p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h3 className="font-semibold">{dispute.order_number}</h3>
          <p className="mt-1 text-xs text-charcoal/55">
            opened by {dispute.opened_by_name} · {dispute.reason.replace(/_/g, " ")} ·{" "}
            {dispute.order_status.replace(/_/g, " ")}
          </p>
        </div>
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-800">
          {dispute.status.replace(/_/g, " ")}
        </span>
      </div>

      <p className="mt-3 text-sm text-charcoal/75">{dispute.description}</p>

      {!dispute.status.startsWith("resolved") && dispute.status !== "closed" && (
        <form
          onSubmit={submit}
          className="mt-4 grid gap-3 border-t border-leaf-300/30 pt-4 md:grid-cols-[12rem_1fr_auto]"
        >
          <select
            aria-label="Resolution"
            className={inputClass}
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as "resolved_buyer" | "resolved_seller" | "closed")
            }
          >
            <option value="resolved_buyer">Resolved for buyer</option>
            <option value="resolved_seller">Resolved for seller</option>
            <option value="closed">Close</option>
          </select>
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Resolution note…"
            maxLength={2000}
          />
          <Button type="submit" disabled={resolve.isPending}>
            Resolve
          </Button>
        </form>
      )}
    </article>
  );
}

function CatalogPanel() {
  const refresh = useAdminRefresh();
  const [categoryName, setCategoryName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [sizeName, setSizeName] = useState("");
  const [sizeKind, setSizeKind] = useState("top");

  const categories = useQuery({
    queryKey: ["system-admin", "categories"],
    queryFn: adminService.categories,
  });
  const brands = useQuery({
    queryKey: ["system-admin", "brands"],
    queryFn: adminService.brands,
  });
  const sizes = useQuery({
    queryKey: ["system-admin", "sizes"],
    queryFn: adminService.sizes,
  });

  const createCategory = useMutation({
    mutationFn: () => adminService.createCategory({ name: categoryName.trim() }),
    onSuccess: () => {
      setCategoryName("");
      showToast("Category added.", "success", "ReWear");
      refresh();
    },
  });
  const createBrand = useMutation({
    mutationFn: () => adminService.createBrand({ name: brandName.trim() }),
    onSuccess: () => {
      setBrandName("");
      showToast("Brand added.", "success", "ReWear");
      refresh();
    },
  });
  const createSize = useMutation({
    mutationFn: () => adminService.createSize({ kind: sizeKind, name: sizeName.trim() }),
    onSuccess: () => {
      setSizeName("");
      showToast("Size added.", "success", "ReWear");
      refresh();
    },
  });
  const deleteCategory = useMutation({
    mutationFn: adminService.deleteCategory,
    onSuccess: () => {
      showToast("Category deleted.", "success", "ReWear");
      refresh();
    },
  });
  const deleteBrand = useMutation({
    mutationFn: adminService.deleteBrand,
    onSuccess: () => {
      showToast("Brand deleted.", "success", "ReWear");
      refresh();
    },
  });
  const deleteSize = useMutation({
    mutationFn: adminService.deleteSize,
    onSuccess: () => {
      showToast("Size deleted.", "success", "ReWear");
      refresh();
    },
  });

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-3xl border border-leaf-300/40 bg-white p-5">
        <h2 className="font-semibold text-charcoal">Categories</h2>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (categoryName.trim()) createCategory.mutate();
          }}
        >
          <Input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="New category" />
          <Button type="submit" disabled={createCategory.isPending}>Add</Button>
        </form>
        <div className="mt-4 grid gap-2">
          {categories.data?.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-xl bg-cream/60 px-3 py-2 text-sm">
              <span>{item.name}</span>
              <Button variant="ghost" onClick={() => deleteCategory.mutate(item.id)} disabled={deleteCategory.isPending}>
                Delete
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-leaf-300/40 bg-white p-5">
        <h2 className="font-semibold text-charcoal">Brands</h2>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (brandName.trim()) createBrand.mutate();
          }}
        >
          <Input value={brandName} onChange={(event) => setBrandName(event.target.value)} placeholder="New brand" />
          <Button type="submit" disabled={createBrand.isPending}>Add</Button>
        </form>
        <div className="mt-4 grid gap-2">
          {brands.data?.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-xl bg-cream/60 px-3 py-2 text-sm">
              <span>{item.name}</span>
              <Button variant="ghost" onClick={() => deleteBrand.mutate(item.id)} disabled={deleteBrand.isPending}>
                Delete
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-leaf-300/40 bg-white p-5">
        <h2 className="font-semibold text-charcoal">Sizes</h2>
        <form
          className="mt-3 grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (sizeName.trim()) createSize.mutate();
          }}
        >
          <select className={inputClass} value={sizeKind} onChange={(event) => setSizeKind(event.target.value)}>
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
            <option value="shoes">Shoes</option>
            <option value="one_size">One size</option>
          </select>
          <div className="flex gap-2">
            <Input value={sizeName} onChange={(event) => setSizeName(event.target.value)} placeholder="New size" />
            <Button type="submit" disabled={createSize.isPending}>Add</Button>
          </div>
        </form>
        <div className="mt-4 grid gap-2">
          {sizes.data?.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-xl bg-cream/60 px-3 py-2 text-sm">
              <span>{item.name} <span className="text-charcoal/50">({item.kind})</span></span>
              <Button variant="ghost" onClick={() => deleteSize.mutate(item.id)} disabled={deleteSize.isPending}>
                Delete
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AuditLogsPanel() {
  const [search, setSearch] = useState("");
  const logs = useQuery({
    queryKey: ["system-admin", "audit-logs", search],
    queryFn: () => adminService.auditLogs({ q: search.trim() || undefined }),
  });

  if (logs.isPending) return <Loading />;
  if (logs.isError || !logs.data) return <LoadError />;

  return (
    <div className="grid gap-4">
      <Input
        className="max-w-sm"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search action or target…"
      />
      {logs.data.length === 0 && <Empty text="No audit logs found." />}
      <div className="grid gap-3">
        {logs.data.map((log) => (
          <article key={log.id} className="rounded-3xl border border-leaf-300/40 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{log.action}</p>
                <p className="text-xs text-charcoal/55">
                  {log.target_type} #{log.target_id} · by {log.actor_name ?? "system"} ·{" "}
                  {new Date(log.created_at).toLocaleString("en-PH")}
                </p>
              </div>
              {log.ip_address && <span className="text-xs text-charcoal/50">{log.ip_address}</span>}
            </div>
            {Object.keys(log.metadata).length > 0 && (
              <pre className="mt-3 overflow-x-auto rounded-xl bg-cream/70 p-3 text-xs text-charcoal/75">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function Loading() {
  return <div className="h-40 animate-pulse rounded-3xl bg-leaf-100" />;
}

function LoadError() {
  return (
    <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
      Couldn't load this admin section.
    </p>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-3xl border border-dashed border-leaf-300/60 bg-white p-10 text-center text-sm text-charcoal/60">
      {text}
    </p>
  );
}
