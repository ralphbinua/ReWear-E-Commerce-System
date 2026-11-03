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

export const listingsService = {
  list: (params: ListingsQuery = {}) =>
    api.get<Paged<Listing>>("/v1/listings/", { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<ListingDetail>(`/v1/listings/${id}/`).then((r) => r.data),
};
