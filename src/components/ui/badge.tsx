import type { ReactNode } from "react";

const NADA = {
  utama: "bg-primary-soft text-primary",
  netral: "bg-surface-muted text-muted",
  sukses: "bg-success/10 text-success",
  bahaya: "bg-danger/10 text-danger",
} as const;

/** Label kecil berbentuk pill, mis. peran atau status. */
export function Badge({
  nada = "netral",
  children,
}: {
  nada?: keyof typeof NADA;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-medium ${NADA[nada]}`}
    >
      {children}
    </span>
  );
}
