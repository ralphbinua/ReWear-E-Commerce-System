import { api } from "../lib/api";

export interface Seller {
  id: number;
  display_name: string;
  avatar: string | null;
  rating_avg: string;
  rating_count: number;
}

export interface Listing {
  id: string;
  title: string;
  slug: string;
  type: "fixed" | "auction" | "trade" | "donation";
  status: string;
  price: string;
  condition: string;
  audience: string;
  category_name: string;
  brand_name: string | null;
  seller: Seller;
  cover_image: string | null;
  bid_count: number;
  end_at: string | null;
  created_at: string;
}

export interface ListingDetail extends Listing {
  description: string;
  size_label: string | null;
  color: string;
  location: string;
  is_negotiable: boolean;
  starting_bid: string | null;
  current_bid: string | null;
  minimum_bid: string | null;
  is_live: boolean;
  min_increment: string;
  start_at: string | null;
  extended_count: number;
  view_count: number;
  updated_at: string;
  images: Array<{
    id: number;
    image: string;
    alt_text: string;
    position: number;
    is_primary: boolean;
  }>;
}

export interface ListingBid {
  id: number;
  amount: string;
  bidder_name: string;
  is_mine: boolean;
  created_at: string;
}

export interface AuctionState {
  current_bid: string | null;
  minimum_bid: string;
  min_increment: string;
  bid_count: number;
  is_live: boolean;
  end_at: string;
  extended_count: number;
  bids: ListingBid[];
}

export interface PlaceBidResult extends AuctionState {
  bid: ListingBid;
  extended: boolean;
}

export interface ListingImage {
  id: number;
  image: string;
  alt_text: string;
  position: number;
  is_primary: boolean;
}

export interface Paged<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ListingsQuery {
  q?: string;
  search?: string;
  type?: string;
  category?: string;
  condition?: string;
  min_price?: number;
  max_price?: number;
  page?: number;
  page_size?: number;
  ending_soon?: boolean;
}

export interface CreateListingPayload {
  title: string;
  description: string;
  category: number;
  brand?: number | null;
  size?: number | null;
  condition: Listing["condition"];
  audience: Listing["audience"];
  color?: string;
  type: Listing["type"];
  price: string;
  is_negotiable: boolean;
  starting_bid?: string | null;
  reserve_price?: string | null;
  min_increment?: string | null;
  end_at?: string | null;
  location?: string;
}

export const listingsService = {
  list: (params: ListingsQuery = {}) =>
    api.get<Paged<Listing>>("/v1/listings/", { params }).then((r) => r.data),

  mine: (params: Pick<ListingsQuery, "page"> = {}) =>
    api.get<Paged<Listing>>("/v1/listings/mine/", { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<ListingDetail>(`/v1/listings/${id}/`).then((r) => r.data),

  getBids: (id: string) =>
    api.get<AuctionState>(`/v1/listings/${id}/bids/`).then((r) => r.data),

  placeBid: (id: string, amount: string) =>
    api
      .post<PlaceBidResult>(`/v1/listings/${id}/bids/`, { amount })
      .then((r) => r.data),

  create: (payload: CreateListingPayload) =>
    api.post<ListingDetail>("/v1/listings/", payload).then((r) => r.data),

  update: (id: string, payload: Partial<CreateListingPayload>) =>
    api.patch<ListingDetail>(`/v1/listings/${id}/`, payload).then((r) => r.data),

  uploadImage: (listingId: string, file: File, altText = "") => {
    const form = new FormData();
    form.append("image", file);
    form.append("alt_text", altText);
    return api
      .post<ListingImage>(`/v1/listings/${listingId}/images/`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  removeImage: (imageId: number) =>
    api.delete(`/v1/listing-images/${imageId}/`).then(() => undefined),
};
