/** Kelas tombol One UI: pill, tinggi nyaman untuk jempol. */
const DASAR =
  "inline-flex h-11 items-center justify-center gap-2 rounded-pill px-5 text-sm font-semibold transition-colors duration-200 ease-oneui disabled:opacity-50";

const VARIAN = {
  utama: "bg-primary text-primary-fg",
  kedua: "bg-primary-soft text-primary hover:bg-primary-soft/70",
  netral: "bg-surface-muted text-fg hover:bg-border",
  bahaya: "bg-danger/10 text-danger hover:bg-danger/15",
} as const;

export type VarianTombol = keyof typeof VARIAN;

export function buttonClass(varian: VarianTombol = "utama", className = "") {
  return `${DASAR} ${VARIAN[varian]} ${className}`;
}
