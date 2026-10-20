import type { StateAksi } from "@/lib/pengaturan/actions";

/** Hasil Server Action: galat (merah) atau konfirmasi singkat (hijau). */
export function PesanAksi({ state, className = "" }: { state: StateAksi; className?: string }) {
  const teks = state.galat ?? state.pesan;
  return (
    <p
      role="status"
      aria-live="polite"
      className={
        teks
          ? `text-sm ${state.galat ? "text-danger" : "text-success"} ${className}`
          : "sr-only"
      }
    >
      {teks}
    </p>
  );
}
