import Image from "next/image";

type BrandMarkProps = {
  /** Tinggi logo dalam px; lebar mengikuti rasio file (458.4 × 68). */
  height?: number;
};

const LOGO_RATIO = 458.4 / 68;

/**
 * Logo horizontal KawanKu. Varian terang/gelap dipilih otomatis mengikuti
 * tema sistem. Jangan ubah warna atau memutar logo (lihat public/brand).
 */
export function BrandMark({ height = 28 }: BrandMarkProps) {
  const width = Math.round(height * LOGO_RATIO);

  return (
    // Jarak bebas ≥ ½ tinggi huruf K di sekeliling logo.
    <span className="inline-flex p-[0.5em]" style={{ fontSize: height }}>
      <Image
        src="/brand/logo-horizontal.svg"
        alt="KawanKu"
        width={width}
        height={height}
        className="dark:hidden"
        priority
      />
      <Image
        src="/brand/logo-horizontal-dark.svg"
        alt="KawanKu"
        width={width}
        height={height}
        className="hidden dark:block"
        priority
      />
    </span>
  );
}
