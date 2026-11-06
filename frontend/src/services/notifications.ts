import { api } from "../lib/api";

export interface AppNotification {
  id: number;
  kind: string;
  kind_label: string;
  title: string;
  body: string;
  url: string;
  is_read: boolean;
  created_at: string;
}

export const notificationService = {
  list: () => api.get<AppNotification[]>("/v1/notifications/").then((r) => r.data),

  unreadCount: () =>
    api
      .get<{ count: number }>("/v1/notifications/unread-count/")
      .then((r) => r.data.count),

  markRead: (id: number) =>
    api.post<AppNotification>(`/v1/notifications/${id}/read/`).then((r) => r.data),

  markAllRead: () =>
    api.post<{ updated: number }>("/v1/notifications/mark-all-read/").then((r) => r.data),
};
