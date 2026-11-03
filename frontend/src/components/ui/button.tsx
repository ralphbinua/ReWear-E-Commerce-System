import type { ButtonHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf-600 disabled:cursor-not-allowed disabled:opacity-60";
  const variants = {
    primary:
      "bg-leaf-600 text-cream hover:bg-leaf-700 active:scale-[0.98]",
    ghost: "text-leaf-700 hover:bg-leaf-100",
  };
  return <button className={cn(base, variants[variant], className)} {...props} />;
}
