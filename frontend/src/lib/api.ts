import axios, { type InternalAxiosRequestConfig } from "axios";

import { apiErrorMessage } from "./api-errors";
import { showToast } from "./toast";
import { tokenStore } from "./tokens";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const access = tokenStore.getAccess();
  if (access) {
    config.headers.set("Authorization", `Bearer ${access}`);
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing;

  refreshing = (async () => {
    const refresh = tokenStore.getRefresh();
    if (!refresh) return null;

    try {
      const { data } = await axios.post(
        `${api.defaults.baseURL}/v1/auth/refresh/`,
        { refresh },
        { headers: { "Content-Type": "application/json" } },
      );
      tokenStore.setSession(data.access, data.refresh ?? refresh);
      return data.access as string;
    } catch {
      tokenStore.clear();
      return null;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

type RetryingConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error);
    }

    const original = error.config as RetryingConfig | undefined;
    const status = error.response?.status;

    if (status === 401 && original && !original._retry) {
      original._retry = true;
      const access = await refreshAccessToken();
      if (access) {
        original.headers.set("Authorization", `Bearer ${access}`);
        return api(original);
      }
    }

    if (status !== undefined && [400, 401, 403, 409, 422].includes(status)) {
      showToast(
        apiErrorMessage(error, "That action couldn't be completed."),
        "error",
        "Invalid action",
      );
    }

    return Promise.reject(error);
  },
);
