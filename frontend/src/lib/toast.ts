export const TOAST_EVENT = "rewear:toast";

export type ToastTone = "error" | "success" | "info";

export interface ToastRequest {
  id: string;
  title: string;
  message: string;
  tone: ToastTone;
}

export function showToast(
  message: string,
  tone: ToastTone = "error",
  title = tone === "error" ? "Invalid action" : "ReWear",
) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<ToastRequest>(TOAST_EVENT, {
      detail: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title,
        message,
        tone,
      },
    }),
  );
}
