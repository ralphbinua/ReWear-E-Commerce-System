import { api } from "../lib/api";

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  phone: string;
  avatar: string | null;
  bio: string;
  is_email_verified: boolean;
  is_id_verified: boolean;
  is_staff: boolean;
  rating_avg: string;
  rating_count: number;
  date_joined: string;
}

export interface AuthResponse {
  user: User;
  access: string;
  refresh: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
}

export const authService = {
  register: (payload: RegisterPayload) =>
    api.post<AuthResponse>("/v1/auth/register/", payload).then((r) => r.data),

  login: (email: string, password: string) =>
    api
      .post<AuthResponse>("/v1/auth/login/", { email, password })
      .then((r) => r.data),

  logout: (refresh: string) =>
    api.post("/v1/auth/logout/", { refresh }).then(() => undefined),

  me: () => api.get<User>("/v1/auth/me/").then((r) => r.data),
};

export type PayoutMethod = "gcash" | "maya" | "bank";

export interface PayoutAccount {
  id: number;
  method: PayoutMethod;
  method_label: string;
  account_name: string;
  account_number: string;
  is_verified: boolean;
  created_at: string;
}

export interface PayoutAccountPayload {
  method: PayoutMethod;
  account_name: string;
  account_number: string;
}

export const payoutService = {
  list: () =>
    api.get<PayoutAccount[]>("/v1/auth/payout-accounts/").then((r) => r.data),

  create: (payload: PayoutAccountPayload) =>
    api.post<PayoutAccount>("/v1/auth/payout-accounts/", payload).then((r) => r.data),

  remove: (id: number) =>
    api.delete(`/v1/auth/payout-accounts/${id}/`).then(() => undefined),
};
