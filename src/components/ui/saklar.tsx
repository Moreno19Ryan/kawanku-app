import type { InputHTMLAttributes } from "react";

/** Saklar (toggle) One UI dari checkbox asli, jadi tetap jalan di dalam <form>. */
export function Saklar({
  label,
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string }) {
  return (
    <label className={`relative inline-flex shrink-0 cursor-pointer items-center ${className}`}>
      <input type="checkbox" className="peer sr-only" aria-label={label} {...props} />
      <span
        aria-hidden
        className="h-7 w-12 rounded-pill bg-border transition-colors duration-200 ease-oneui peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40"
      />
      <span
        aria-hidden
        className="absolute top-1 left-1 size-5 rounded-pill bg-surface shadow-sm transition-transform duration-200 ease-oneui peer-checked:translate-x-5"
      />
    </label>
  );
}
