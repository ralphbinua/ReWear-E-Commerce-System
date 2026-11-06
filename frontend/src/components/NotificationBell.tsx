import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";

import { cn } from "../lib/utils";
import { notificationService, type AppNotification } from "../services/notifications";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: notificationService.list,
    refetchInterval: 30_000,
  });

  const unread = notifications?.filter((item) => !item.is_read).length ?? 0;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["notifications"] });

  const markRead = useMutation({
    mutationFn: (id: number) => notificationService.markRead(id),
    onSuccess: invalidate,
  });

  const markAllRead = useMutation({
    mutationFn: notificationService.markAllRead,
    onSuccess: invalidate,
  });

  function openNotification(item: AppNotification) {
    if (!item.is_read) markRead.mutate(item.id);
    setOpen(false);
    navigate(item.url || "/orders");
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-full p-2 text-leaf-700 transition hover:bg-leaf-100"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-leaf-300/40 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-leaf-300/30 px-4 py-2.5">
              <span className="text-sm font-semibold text-leaf-700">Notifications</span>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-leaf-700 hover:underline"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>

            <ul className="max-h-80 overflow-y-auto">
              {notifications?.slice(0, 10).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openNotification(item)}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left transition hover:bg-leaf-50",
                      !item.is_read && "bg-amber-50/70",
                    )}
                  >
                    <span className="flex w-full items-center gap-2">
                      <span className="flex-1 text-sm font-semibold text-charcoal">
                        {item.title}
                      </span>
                      {!item.is_read && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                      )}
                    </span>
                    {item.body && (
                      <span className="line-clamp-2 text-xs text-charcoal/70">
                        {item.body}
                      </span>
                    )}
                    <span className="text-[10px] uppercase tracking-wide text-charcoal/40">
                      {new Date(item.created_at).toLocaleString("en-PH")}
                    </span>
                  </button>
                </li>
              ))}

              {notifications && notifications.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-charcoal/60">
                  You're all caught up.
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
