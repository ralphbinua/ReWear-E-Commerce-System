import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

import { cn } from "../lib/utils";
import { TOAST_EVENT, type ToastRequest } from "../lib/toast";

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRequest[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    const handleToast = (event: Event) => {
      const request = (event as CustomEvent<ToastRequest>).detail;
      if (!request?.message) return;
      setToasts((current) => [...current.slice(-2), request]);
    };

    window.addEventListener(TOAST_EVENT, handleToast);
    return () => window.removeEventListener(TOAST_EVENT, handleToast);
  }, []);

  useEffect(() => {
    const oldest = toasts[0];
    if (!oldest) return;

    const timer = window.setTimeout(() => dismissToast(oldest.id), 5000);
    return () => window.clearTimeout(timer);
  }, [dismissToast, toasts]);

  return (
    <>
      {children}

      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-[min(calc(100vw-2rem),24rem)] -translate-x-1/2 flex-col gap-2 sm:left-auto sm:right-4 sm:translate-x-0"
      >
        {toasts.map((toast) => {
          const Icon =
            toast.tone === "success"
              ? CheckCircle2
              : toast.tone === "info"
                ? Info
                : AlertTriangle;

          return (
            <section
              key={toast.id}
              role={toast.tone === "error" ? "alert" : "status"}
              className={cn(
                "toast-in pointer-events-auto flex items-start gap-3 rounded-2xl border p-3 shadow-xl",
                toast.tone === "error" &&
                  "border-red-300 bg-red-50 text-red-950",
                toast.tone === "success" &&
                  "border-green-300 bg-green-50 text-green-950",
                toast.tone === "info" && "border-leaf-300 bg-white text-charcoal",
              )}
            >
              <Icon
                aria-hidden
                className={cn(
                  "mt-0.5 h-5 w-5 shrink-0",
                  toast.tone === "error" && "text-red-600",
                  toast.tone === "success" && "text-leaf-600",
                  toast.tone === "info" && "text-leaf-700",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{toast.title}</p>
                <p className="mt-0.5 text-sm leading-snug">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss notification"
                className="shrink-0 rounded-full p-1 transition hover:bg-black/5"
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            </section>
          );
        })}
      </div>
    </>
  );
}
