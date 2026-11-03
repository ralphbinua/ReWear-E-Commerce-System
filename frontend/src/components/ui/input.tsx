import type { InputHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-leaf-300/50 bg-white px-3.5 py-2.5",
        "text-sm outline-none transition placeholder:text-charcoal/40",
        "focus:border-leaf-500 focus:ring-2 focus:ring-leaf-500/30",
        className,
      )}
      {...props}
    />
  );
}
