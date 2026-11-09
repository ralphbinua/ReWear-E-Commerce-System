import { api } from "../lib/api";
import type { Order } from "./orders";

export interface Offer {
  id: number;
  listing: {
    id: string;
    title: string;
    slug: string;
    cover_image: string | null;
  };
  buyer: number;
  buyer_name: string;
  seller_name: string;
  amount: string;
  message: string;
  status: "pending" | "accepted" | "declined" | "expired" | "cancelled";
  created_at: string;
  responded_at: string | null;
}

export interface AcceptOfferResult {
  offer: Offer;
  order: Order;
}

export const offersService = {
  list: (params: { listing?: string; status?: string } = {}) =>
    api.get<Offer[]>("/v1/offers/", { params }).then((r) => r.data),

  create: (payload: { listing: string; amount: string; message?: string }) =>
    api.post<Offer>("/v1/offers/", payload).then((r) => r.data),

  accept: (id: number) =>
    api.post<AcceptOfferResult>(`/v1/offers/${id}/accept/`, {}).then((r) => r.data),

  decline: (id: number) => api.post<Offer>(`/v1/offers/${id}/decline/`, {}).then((r) => r.data),

  cancel: (id: number) => api.post<Offer>(`/v1/offers/${id}/cancel/`, {}).then((r) => r.data),
};
