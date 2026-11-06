import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Upload } from "lucide-react";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAuth } from "../context/useAuth";
import {
  listingsService,
  type CreateListingPayload,
  type ListingDetail,
  type ListingImage,
} from "../services/listings";
import { referenceService, type Brand, type Category, type Size } from "../services/reference";

const selectClass =
  "w-full rounded-xl border border-leaf-300/50 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-charcoal/40 focus:border-leaf-500 focus:ring-2 focus:ring-leaf-500/30";

const fieldLabel = "grid gap-1.5 text-sm font-medium";

function toDatetimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export default function ListingEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["listing", id],
    queryFn: () => listingsService.get(id as string),
    enabled: Boolean(id),
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: referenceService.getCategories,
    staleTime: 10 * 60 * 1000,
  });
  const brands = useQuery({
    queryKey: ["brands"],
    queryFn: referenceService.getBrands,
    staleTime: 10 * 60 * 1000,
  });
  const sizes = useQuery({
    queryKey: ["sizes"],
    queryFn: referenceService.getSizes,
    staleTime: 10 * 60 * 1000,
  });

  const listing = query.data;
  const isOwner = Boolean(listing && user && user.id === listing.seller.id);

  return (
    <div className="shell py-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-leaf-600">
          Edit listing
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold text-leaf-700">
          {listing?.title ?? "Edit"}
        </h1>

        {query.isPending && <p className="mt-6 text-charcoal/60">Loading…</p>}
        {query.isError && <p className="mt-6 text-red-700">Couldn't load this listing.</p>}

        {listing && !isOwner && (
          <p className="mt-6 rounded-2xl border border-leaf-300/40 bg-white p-6 text-charcoal/70">
            This isn't your listing.
          </p>
        )}

        {listing && isOwner && categories.isSuccess && brands.isSuccess && sizes.isSuccess && (
          <EditForm
            listing={listing}
            categories={categories.data ?? []}
            brands={brands.data ?? []}
            sizes={sizes.data ?? []}
            onDone={() => navigate(`/listing/${listing.id}`)}
          />
        )}
      </div>
    </div>
  );
}

function EditForm({
  listing,
  categories,
  brands,
  sizes,
  onDone,
}: {
  listing: ListingDetail;
  categories: Category[];
  brands: Brand[];
  sizes: Size[];
  onDone: () => void;
}) {
  const [form, setForm] = useState(() => ({
    title: listing.title,
    description: listing.description,
    category: categories.find((c) => c.name === listing.category_name)?.id ?? 0,
    brand: brands.find((b) => b.name === listing.brand_name)?.id ?? 0,
    size: sizes.find((s) => s.name === listing.size_label)?.id ?? 0,
    condition: listing.condition,
    audience: listing.audience,
    price: listing.price,
    is_negotiable: listing.is_negotiable,
    location: listing.location,
  }));

  const queryClient = useQueryClient();
  const [endAt, setEndAt] = useState(() => toDatetimeLocal(listing.end_at));
  const [images, setImages] = useState<ListingImage[]>(listing.images);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const sizeOptions = [...sizes].sort(
    (a, b) => a.kind.localeCompare(b.kind) || a.order - b.order || a.name.localeCompare(b.name),
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);

    const payload: Partial<CreateListingPayload> = {
      title: String(form.title),
      description: String(form.description),
      category: Number(form.category),
      brand: Number(form.brand) || null,
      size: Number(form.size) || null,
      condition: form.condition as CreateListingPayload["condition"],
      audience: form.audience as CreateListingPayload["audience"],
      price: String(form.price),
      is_negotiable: Boolean(form.is_negotiable),
      location: String(form.location),
    };

    if (listing.type === "auction") {
      payload.end_at = endAt ? new Date(endAt).toISOString() : null;
    }

    try {
      await listingsService.update(listing.id, payload);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["listing", listing.id] }),
        queryClient.invalidateQueries({ queryKey: ["my-listings"] }),
      ]);
      setSaved(true);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      const msg = data ? Object.values(data as Record<string, unknown>).flat()[0] : undefined;
      setError(Array.isArray(msg) ? String(msg[0]) : "Couldn't save your changes.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadOne(file: File) {
    setUploading(true);
    setError(null);
    try {
      const image = await listingsService.uploadImage(listing.id, file, form.title);
      setImages((prev) => [...prev, image]);
    } catch {
      setError("Photo upload failed. Max 8 images, image files only.");
    } finally {
      setUploading(false);
    }
  }

  async function removeImage(id: number) {
    try {
      await listingsService.removeImage(id);
      setImages((prev) => prev.filter((img) => img.id !== id));
    } catch {
      setError("Couldn't remove that photo.");
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 grid gap-4 rounded-3xl border border-leaf-300/40 bg-white p-6">
      {error && <p className="text-sm text-red-700">{error}</p>}
      {saved && <p className="text-sm text-leaf-700">Saved — changes are live.</p>}

      <label className={fieldLabel}>
        Title
        <Input
          value={String(form.title)}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          maxLength={140}
          required
        />
      </label>

      <label className={fieldLabel}>
        Description
        <textarea
          required
          value={String(form.description)}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={4}
          className="min-h-28 rounded-xl border border-leaf-300/50 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-500/30"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={fieldLabel}>
          Category
          <select
            className={selectClass}
            value={String(form.category)}
            onChange={(e) => setForm((f) => ({ ...f, category: Number(e.target.value) }))}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className={fieldLabel}>
          Brand
          <select
            className={selectClass}
            value={String(form.brand)}
            onChange={(e) => setForm((f) => ({ ...f, brand: Number(e.target.value) }))}
          >
            <option value="0">No brand</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
        <label className={fieldLabel}>
          Size
          <select
            className={selectClass}
            value={String(form.size)}
            onChange={(e) => setForm((f) => ({ ...f, size: Number(e.target.value) }))}
          >
            <option value="0">Select</option>
            {sizeOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.kind_label})</option>
            ))}
          </select>
        </label>
        <label className={fieldLabel}>
          Price (₱)
          <Input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={String(form.price)}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={fieldLabel}>
          Condition
          <select
            className={selectClass}
            value={String(form.condition)}
            onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
          >
            {["new_with_tags", "like_new", "good", "fair"].map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
            ))}
          </select>
        </label>
        <label className={fieldLabel}>
          Audience
          <select
            className={selectClass}
            value={String(form.audience)}
            onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
          >
            {["women", "men", "unisex", "kids"].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
      </div>

      <label className={fieldLabel}>
        Location
        <Input
          value={String(form.location)}
          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          placeholder="Quezon City"
        />
      </label>

      {listing.type === "auction" && (
        <section className="grid gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div>
            <h3 className="text-sm font-semibold text-amber-900">Auction end date</h3>
            <p className="mt-1 text-xs text-amber-900/70">
              Current end:{" "}
              {listing.end_at
                ? new Date(listing.end_at).toLocaleString("en-PH")
                : "Not set"}
              .{" "}
              {!listing.is_live
                ? "This auction isn't live, so its end date is locked."
                : listing.bid_count > 0
                  ? "Bidders already joined, so you can only extend the auction."
                  : "You can move this end date earlier or later."}
            </p>
          </div>

          <label className={fieldLabel}>
            Ends at
            <Input
              type="datetime-local"
              required={listing.is_live}
              disabled={!listing.is_live}
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
          </label>
        </section>
      )}

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-charcoal/60">
          Photos ({images.length}/8)
        </h3>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((img) => (
            <div
              key={img.id}
              className="group relative h-36 overflow-hidden rounded-2xl bg-leaf-100"
            >
              <img
                src={img.image}
                alt={img.alt_text}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => void removeImage(img.id)}
                className="absolute right-2 top-2 rounded-full bg-black/55 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Remove photo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {images.length < 8 && (
            <label className="flex h-36 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-leaf-300/60 bg-white text-leaf-700 transition hover:border-leaf-500">
              {uploading ? (
                <span className="text-sm">Uploading…</span>
              ) : (
                <>
                  <Upload className="h-5 w-5" />
                  <span className="text-xs font-semibold">Add photo</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                disabled={uploading}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  for (const f of files) void uploadOne(f);
                }}
              />
            </label>
          )}
        </div>
      </section>

      <div className="flex flex-wrap gap-2 justify-between border-t border-leaf-300/30 pt-4">
        <Button variant="ghost" type="button" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

