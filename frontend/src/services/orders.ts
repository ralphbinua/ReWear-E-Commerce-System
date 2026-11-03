import { api } from "../lib/api";

export type OrderStatus =
  | "pending_payment"
  | "payment_review"
  | "paid"
  | "shipped"
  | "delivered"
  | "completed"
  | "cancelled"
  | "refunded"
  | "disputed";

export interface OrderListing {
  id: string;
  title: string;
  slug: string;
  cover_image: string | null;
}

export interface OrderProof {
  id: number;
  method: string;
  reference: string | null;
  status: "pending" | "verified" | "rejected";
  screenshot: string | null;
}

export interface Order {
  id: string;
  order_number: string;
  listing: OrderListing;
  buyer: number;
  buyer_name: string;
  seller: number;
  seller_name: string;
  status: OrderStatus;
  item_price: string;
  shipping_fee: string;
  platform_fee: string;
  total: string;
  payment_method: string;
  payment_verified_at: string | null;
  courier: string;
  tracking_number: string;
  created_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  cancel_reason: string;
  latest_proof: OrderProof | null;
}

export interface PagedOrders {
  count: number;
  next: string | null;
  previous: string | null;
  results: Order[];
}

export const ordersService = {
  checkout: (listingId: string) =>
    api.post<Order>("/v1/orders/checkout/", { listing: listingId }).then((r) => r.data),

  listForCurrentUser: (role?: "buyer" | "seller") =>
    api
      .get<PagedOrders>("/v1/orders/", { params: role ? { role } : {} })
      .then((r) => r.data),

  get: (id: string) => api.get<Order>(`/v1/orders/${id}/`).then((r) => r.data),

  uploadProof: (
    id: string,
    fields: {
      method: string;
      reference?: string;
      screenshot: File;
    },
  ) => {
    const form = new FormData();
    form.append("method", fields.method);
    if (fields.reference) form.append("reference", fields.reference);
    form.append("screenshot", fields.screenshot);
    return api
      .post<Order>(`/v1/orders/${id}/payment-proof/`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  verifyPayment: (id: string, decision: "verified" | "rejected", reason?: string) =>
    api
      .post<Order>(`/v1/orders/${id}/verify-payment/`, { decision, reason })
      .then((r) => r.data),

  ship: (id: string, courier: string, tracking_number: string) =>
    api
      .post<Order>(`/v1/orders/${id}/ship/`, { courier, tracking_number })
      .then((r) => r.data),

  confirm: (id: string) => api.post<Order>(`/v1/orders/${id}/confirm/`, {}).then((r) => r.data),

  cancel: (id: string, reason?: string) =>
    api.post<Order>(`/v1/orders/${id}/cancel/`, { reason }).then((r) => r.data),
};
