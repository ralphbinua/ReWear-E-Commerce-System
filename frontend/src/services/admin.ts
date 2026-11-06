import { api } from "../lib/api";
import type { Order } from "./orders";

export interface SystemSummary {
  pending_listings: number;
  active_listings: number;
  sold_listings: number;
  open_reports: number;
  active_users: number;
  total_orders: number;
  disputed_orders: number;
  platform_revenue: string;
}

export interface AdminListing {
  id: string;
  title: string;
  type: string;
  status: string;
  price: string;
  view_count: number;
  bid_count: number;
  order_count: number;
  seller: {
    id: number;
    display_name: string;
  };
  created_at: string;
}

export interface SystemReport {
  id: number;
  reporter_name: string;
  reporter_email: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string;
  status: string;
  created_at: string;
}

export interface SystemUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  rating_avg: string;
  rating_count: number;
  date_joined: string;
  listings_count: number;
  sales_count: number;
  purchases_count: number;
  reports_count: number;
}

export interface SystemDispute {
  id: number;
  order: number;
  order_number: string;
  order_status: string;
  opened_by_name: string;
  reason: string;
  description: string;
  status: string;
  resolution_note: string;
  created_at: string;
}

export const adminService = {
  summary: () => api.get<SystemSummary>("/v1/admin/summary/").then((r) => r.data),

  listings: (params: { status?: string; q?: string } = {}) =>
    api.get<AdminListing[]>("/v1/admin/listings/", { params }).then((r) => r.data),

  approveListing: (id: string) =>
    api.post<AdminListing>(`/v1/admin/listings/${id}/approve/`, {}).then((r) => r.data),

  removeListing: (id: string) =>
    api.post<AdminListing>(`/v1/admin/listings/${id}/remove/`, {}).then((r) => r.data),

  restoreListing: (id: string) =>
    api.post<AdminListing>(`/v1/admin/listings/${id}/restore/`, {}).then((r) => r.data),

  reports: (params: { status?: string; target_type?: string } = {}) =>
    api.get<SystemReport[]>("/v1/admin/reports/", { params }).then((r) => r.data),

  resolveReport: (
    id: number,
    payload: { status: "actioned" | "dismissed"; action?: string; notes?: string },
  ) =>
    api
      .post<SystemReport>(`/v1/admin/reports/${id}/resolve/`, payload)
      .then((r) => r.data),

  users: (params: { q?: string } = {}) =>
    api.get<SystemUser[]>("/v1/admin/users/", { params }).then((r) => r.data),

  suspendUser: (id: number) =>
    api.post<SystemUser>(`/v1/admin/users/${id}/suspend/`, {}).then((r) => r.data),

  activateUser: (id: number) =>
    api.post<SystemUser>(`/v1/admin/users/${id}/activate/`, {}).then((r) => r.data),

  disputes: (params: { status?: string } = {}) =>
    api.get<SystemDispute[]>("/v1/admin/disputes/", { params }).then((r) => r.data),

  resolveDispute: (
    id: number,
    payload: { status: "resolved_buyer" | "resolved_seller" | "closed"; resolution_note?: string },
  ) =>
    api
      .post<SystemDispute>(`/v1/admin/disputes/${id}/resolve/`, payload)
      .then((r) => r.data),

  orders: () => api.get<Order[]>("/v1/admin/orders/").then((r) => r.data),
};
