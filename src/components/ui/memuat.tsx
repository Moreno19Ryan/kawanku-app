/**
 * Logo "K" KawanKu yang tersusun bagian demi bagian (animasi memuat).
 * Bentuk & warna sama dengan public/brand/mark.svg (warna lewat token
 * --kk-logo-*, ikut tema). Dekoratif: pembaca layar memakai teks Memuat.
 */
export function LogoMemuat({ ukuran = 48, className = "" }: { ukuran?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 74 68"
      width={ukuran}
      height={(ukuran * 68) / 74}
      aria-hidden
      className={`shrink-0 overflow-visible ${className}`}
    >
      <g transform="translate(-20 -14)">
        <path className="kk-k-batang" fill="var(--kk-logo-batang)" d="M20 14 H38 V82 H20 Z" />
        <path className="kk-k-lengan" fill="var(--kk-logo-lengan)" d="M38 48 L72 14 H94 L60 48 Z" />
        <path className="kk-k-kaki" fill="var(--kk-logo-kaki)" d="M38 48 L72 82 H94 L60 48 Z" />
      </g>
    </svg>
  );
}

/**
 * Tampilan memuat data: logo "K" beranimasi + teks. Pakai sebagai fallback
 * <Suspense> / loading.tsx; className mengatur tinggi supaya tata letak
 * tidak melompat saat data tiba.
 */
export function Memuat({
  teks = "Memuat…",
  ukuran = 48,
  className = "",
}: {
  teks?: string;
  ukuran?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-4 py-10 ${className}`}
    >
      <LogoMemuat ukuran={ukuran} />
      {teks && <p className="kk-memuat-teks text-sm font-medium text-muted">{teks}</p>}
    </div>
  );
}
