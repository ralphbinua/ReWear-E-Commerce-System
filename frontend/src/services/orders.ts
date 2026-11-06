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

export interface PayoutDestination {
  method: string;
  method_label: string;
  account_name: string;
  account_number: string;
}

export interface OrderReview {
  id: number;
  reviewer: number;
  reviewer_name: string;
  reviewee: number;
  reviewee_name: string;
  rating: number;
  comment: string;
  created_at: string;
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
  payout_accounts: PayoutDestination[];
  reviews: OrderReview[];
}

export interface PagedOrders {
  count: number;
  next: string | null;
  previous: string | null;
  results: Order[];
}

export interface SellerDashboard {
  seller: {
    id: number;
    display_name: string;
    rating_avg: string;
    rating_count: number;
  };
  stats: {
    active_listings: number;
    sold_listings: number;
    ended_listings: number;
    total_listings: number;
    total_views: number;
    total_sales: number;
    paid_sales: number;
    completed_sales: number;
    pending_payment_orders: number;
    payment_review_orders: number;
    paid_orders: number;
    gross_revenue: string;
    platform_fees: string;
    net_earnings: string;
    pending_amount: string;
    review_amount: string;
    average_sale_price: string;
  };
  orders_by_status: Record<string, number>;
  recent_sales: Order[];
  top_listings: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    price: string;
    view_count: number;
    bid_count: number;
    order_count: number;
  }>;
  payout_accounts: Array<{
    id: number;
    method: string;
    method_label: string;
    account_name: string;
    account_number: string;
    is_verified: boolean;
  }>;
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

  review: (id: string, payload: { rating: number; comment?: string }) =>
    api.post<OrderReview>(`/v1/orders/${id}/review/`, payload).then((r) => r.data),

  sellerDashboard: () =>
    api.get<SellerDashboard>("/v1/orders/seller-dashboard/").then((r) => r.data),
};
