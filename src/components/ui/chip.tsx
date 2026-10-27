import type { InputHTMLAttributes, ReactNode } from "react";

/** Pilihan berbentuk chip dari checkbox asli (tetap terkirim lewat <form>). */
export function Chip({
  children,
  kecil = false,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { children: ReactNode; kecil?: boolean }) {
  return (
    <label className="cursor-pointer">
      <input type="checkbox" className="peer sr-only" {...props} />
      <span
        className={`inline-flex items-center justify-center rounded-pill bg-surface-muted font-medium transition-colors duration-200 ease-oneui peer-checked:bg-primary-soft peer-checked:text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 ${
          kecil ? "min-w-9 px-3 py-1 text-sm" : "px-3.5 py-1.5 text-sm"
        }`}
      >
        {children}
      </span>
    </label>
  );
}
