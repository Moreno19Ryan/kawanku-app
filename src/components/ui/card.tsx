import type { HTMLAttributes } from "react";

/** Kartu dasar One UI: permukaan terang, sudut besar, tanpa garis tegas. */
export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-card bg-surface p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:p-6 ${className}`}
      {...props}
    />
  );
}
