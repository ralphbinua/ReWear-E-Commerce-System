import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Truck, Tag, Camera, Trash2, CheckCircle2, Leaf } from "lucide-react";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { cn } from "../lib/utils";
import { showToast } from "../lib/toast";
import {
  listingsService,
  type CreateListingPayload,
  type ListingImage,
} from "../services/listings";
import { referenceService } from "../services/reference";

type Step = "details" | "price" | "photos";

const selectClass =
  "w-full rounded-xl border border-leaf-300/50 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-charcoal/40 focus:border-leaf-500 focus:ring-2 focus:ring-leaf-500/30";

const fieldLabel = "grid gap-1.5 text-sm font-medium";

const conditions = [
  { value: "new_with_tags", label: "New with tags" },
  { value: "like_new", label: "Like new" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
] as const;

const audiences = [
  { value: "women", label: "Women" },
  { value: "men", label: "Men" },
  { value: "unisex", label: "Unisex" },
  { value: "kids", label: "Kids" },
] as const;

export default function Sell() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("details");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<number | "">("");
  const [brand, setBrand] = useState<number | "">("");
  const [size, setSize] = useState<number | "">("");
  const [condition, setCondition] = useState<CreateListingPayload["condition"]>("good");
  const [audience, setAudience] = useState<CreateListingPayload["audience"]>("women");
  const [color, setColor] = useState("");
  const [location, setLocation] = useState("");

  const [type, setType] = useState<CreateListingPayload["type"]>("fixed");
  const [price, setPrice] = useState("");
  const [startingBid, setStartingBid] = useState("");
  const [reservePrice, setReservePrice] = useState("");
  const [minIncrement, setMinIncrement] = useState("20.00");
  const [endAt, setEndAt] = useState("");
  const [isNegotiable, setIsNegotiable] = useState(true);
  const [listingId, setListingId] = useState<string | null>(null);
  const [images, setImages] = useState<ListingImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  const sizeOptions = useMemo(() => {
    const sorted = [...(sizes.data ?? [])].sort(
      (a, b) => a.kind.localeCompare(b.kind) || a.order - b.order || a.name.localeCompare(b.name),
    );
    return sorted.map((s) => ({ value: s.id, label: `${s.name} (${s.kind_label})` }));
  }, [sizes.data]);

  function showInvalidAction(message: string) {
    setError(message);
    showToast(message, "error", "Invalid action");
  }

  function validateDetails() {
    if (!title.trim() || title.trim().length < 5)
      return "Give the item a title of at least 5 characters.";
    if (!description.trim() || description.trim().length < 20)
      return "Help buyers out: describe defects, material, why you're selling.";
    if (!category) return "Pick a category.";
    return null;
  }

  function validatePricing() {
    if (type === "fixed") {
      if (!price || Number(price) <= 0) return "Enter a price above zero.";
    }
    if (type === "auction") {
      if (!startingBid || Number(startingBid) <= 0)
        return "An auction needs a starting bid above zero.";
      if (!endAt) return "An auction needs an end date and time.";
      if (new Date(endAt).getTime() <= Date.now())
        return "The auction must end in the future.";
    }
    return null;
  }

  async function submitDetails(event: FormEvent) {
    event.preventDefault();
    const invalid = validateDetails();
    if (invalid) return showInvalidAction(invalid);
    setError(null);
    setStep("price");
  }

  async function submitListing(event: FormEvent) {
    event.preventDefault();
    const invalid = validatePricing();
    if (invalid) return showInvalidAction(invalid);

    setSaving(true);
    setError(null);

    const payload: CreateListingPayload = {
      title: title.trim(),
      description: description.trim(),
      category: Number(category),
      brand: brand === "" ? null : Number(brand),
      size: size === "" ? null : Number(size),
      condition,
      audience,
      color: color.trim(),
      type,
      price: type === "fixed" ? price : "0",
      is_negotiable: isNegotiable,
      starting_bid: type === "auction" ? startingBid : null,
      reserve_price: type === "auction" && reservePrice ? reservePrice : null,
      min_increment: type === "auction" ? minIncrement : null,
      end_at: type === "auction" && endAt ? new Date(endAt).toISOString() : null,
      location: location.trim(),
    };

    try {
      const created = await listingsService.create(payload);
      setListingId(created.id);
      setStep("photos");
    } catch (creationError: unknown) {
      const data = (creationError as { response?: { data?: unknown } })?.response?.data;
      let message = "Couldn't create the listing.";
      if (typeof data === "string") {
        message = data;
      } else if (data && typeof data === "object") {
        const first = Object.values(data as Record<string, unknown>).flat()[0];
        if (typeof first === "string") message = first;
      }
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadOne(file: File) {
    if (!listingId) return;
    setUploading(true);
    setError(null);
    try {
      const image = await listingsService.uploadImage(listingId, file, title);
      setImages((prev) => [...prev, image]);
    } catch {
      setError(`"${file.name}" didn't upload. Max 8 photos, must be an image.`);
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

  function publish() {
    if (listingId) navigate(`/listing/${listingId}`, { replace: true });
  }

  const stepNumber = step === "details" ? 1 : step === "price" ? 2 : 3;

  return (
    <div className="shell py-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-leaf-600">
          Step {stepNumber} of 3 — {step === "photos" ? "Photos" : step === "price" ? "Pricing" : "The item"}
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold text-leaf-700">
          List something pre-loved
        </h1>
        <p className="text-charcoal/70">
          Your clothes get a second life — someone else gets a bargain.
        </p>

        {/* Stepper */}
        <div className="mt-4 flex gap-2">
          {[
            { n: 1, label: "Item", done: step !== "details" },
            { n: 2, label: "Price", done: step === "photos" },
            { n: 3, label: "Photos", done: false },
          ].map((s) => (
            <div
              key={s.n}
              className={cn(
                "flex-1 rounded-2xl border px-4 py-2 text-sm",
                stepNumber >= s.n
                  ? "border-leaf-600 bg-leaf-50 text-leaf-800"
                  : "border-leaf-300/40 bg-white text-charcoal/50",
              )}
            >
              <span className="font-semibold">{s.n}.</span> {s.label}
              {s.done && <CheckCircle2 className="ml-1 inline h-4 w-4 text-leaf-600" />}
            </div>
          ))}
        </div>

        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

        {/* Step 1 — Item details */}
        {step === "details" && (
          <form onSubmit={submitDetails} className="mt-6 grid gap-4">
            <label className={fieldLabel}>
              Title
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Vintage Levi's 501 denim jacket, mid-wash"
                maxLength={140}
                autoFocus
              />
            </label>

            <label className={fieldLabel}>
              Description
              <textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="min-h-28 rounded-xl border border-leaf-300/50 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-500/30"
                placeholder="Material, brand, sizing (does it run small?), defects, why you're letting it go."
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className={fieldLabel}>
                Category
                <select
                  required
                  className={selectClass}
                  value={category}
                  onChange={(e) => setCategory(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">Select a category</option>
                  {categories.data?.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>

              <label className={fieldLabel}>
                Brand (optional)
                <select
                  className={selectClass}
                  value={brand}
                  onChange={(e) => setBrand(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">No brand / don't know</option>
                  {brands.data?.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>

              <label className={fieldLabel}>
                Size (optional)
                <select
                  className={selectClass}
                  value={size}
                  onChange={(e) => setSize(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">Select a size</option>
                  {sizeOptions.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </label>

              <label className={fieldLabel}>
                Color (optional)
                <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Black" />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className={fieldLabel}>
                Condition
                <select className={selectClass} value={condition} onChange={(e) => setCondition(e.target.value as typeof condition)}>
                  {conditions.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>

              <label className={fieldLabel}>
                Audience
                <select className={selectClass} value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)}>
                  {audiences.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className={fieldLabel}>
              Location (optional)
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Quezon City" />
            </label>

            <div className="flex justify-end">
              <Button type="submit">Continue to pricing →</Button>
            </div>
          </form>
        )}

        {/* Step 2 — Pricing */}
        {step === "price" && (
          <form onSubmit={submitListing} className="mt-6 grid gap-4">
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">Listing type</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  { value: "fixed", label: "Fixed price", icon: Tag },
                  { value: "auction", label: "Auction", icon: Truck },
                  { value: "donation", label: "Donation", icon: Leaf },
                ].map(({ value, label, icon: Icon }) => (
                  <label
                    key={value}
                    className={cn(
                      "flex cursor-pointer flex-col items-center gap-1 rounded-2xl border p-4 text-center transition",
                      type === value
                        ? "border-leaf-600 bg-leaf-50 ring-2 ring-leaf-600"
                        : "border-leaf-300/40 bg-white hover:border-leaf-400",
                    )}
                  >
                    <input
                      type="radio"
                      name="listing-type"
                      className="sr-only"
                      checked={type === value}
                      onChange={() => {
                        setType(value as typeof type);
                        if (value === "auction" && !endAt) {
                          const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
                          setEndAt(d.toISOString().slice(0, 16));
                        }
                      }}
                    />
                    <Icon className="h-5 w-5 text-leaf-700" />
                    <span className="text-sm font-semibold">{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {type === "fixed" && (
              <>
                <label className={fieldLabel}>
                  Price (₱)
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="950.00"
                  />
                </label>
                <label className="flex cursor-pointer items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={isNegotiable}
                    onChange={(e) => setIsNegotiable(e.target.checked)}
                    className="h-4 w-4 accent-leaf-600"
                  />
                  Open to offers
                </label>
              </>
            )}

            {type === "donation" && (
              <p className="rounded-2xl border border-leaf-300/40 bg-white p-4 text-sm text-charcoal/80">
                This item will be listed as a donation — interested buyers pay nothing; our NGO partner picks it up. Price is forced to ₱0.
              </p>
            )}

            {type === "auction" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={fieldLabel}>
                  Starting bid (₱)
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    required
                    value={startingBid}
                    onChange={(e) => setStartingBid(e.target.value)}
                    placeholder="500.00"
                  />
                </label>
                <label className={fieldLabel}>
                  Min increment (₱)
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={minIncrement}
                    onChange={(e) => setMinIncrement(e.target.value)}
                  />
                </label>
                <label className={fieldLabel}>
                  Reserve price (₱, optional)
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={reservePrice}
                    onChange={(e) => setReservePrice(e.target.value)}
                    placeholder="Hidden from buyers"
                  />
                </label>
                <label className={fieldLabel}>
                  Ends at
                  <Input
                    type="datetime-local"
                    required
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                  />
                </label>
              </div>
            )}

            <div className="flex flex-wrap gap-2 justify-between">
              <Button variant="ghost" type="button" onClick={() => setStep("details")}>
                ← Back
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving listing…" : "Save & add photos →"}
              </Button>
            </div>
          </form>
        )}

        {/* Step 3 — Photos */}
        {step === "photos" && (
          <div className="mt-6">
            <p className="text-sm text-charcoal/70">
              Add up to 8 photos. Daylight + clean background sells things faster. The first photo is the preview.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {images.map((img) => (
                <div key={img.id} className="group relative h-40 overflow-hidden rounded-2xl bg-leaf-100">
                  <img src={img.image} alt={img.alt_text} className="h-full w-full object-cover" />
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
                <label className="flex h-40 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-leaf-300/60 bg-white text-leaf-700 transition hover:border-leaf-500 hover:bg-leaf-50">
                  {uploading ? (
                    <span className="text-sm">Uploading…</span>
                  ) : (
                    <>
                      <Camera className="h-6 w-6" />
                      <span className="text-xs font-semibold">Add photo</span>
                      <span className="text-[10px] text-charcoal/50">{images.length}/8</span>
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
                      for (const file of files) void uploadOne(file);
                    }}
                  />
                </label>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-2 justify-between">
              <Button variant="ghost" type="button" onClick={() => setStep("price")}>
                ← Back (adjust price)
              </Button>
              <Button type="button" onClick={publish}>
                Publish listing →
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
