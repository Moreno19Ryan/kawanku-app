import Image from "next/image";

type LogoDesaProps = {
  /** `mark` = lambang saja; `horizontal` = lambang + tulisan nama desa. */
  variant?: "mark" | "horizontal";
  /** Tinggi dalam px; lebar mengikuti rasio asli (jangan diregangkan). */
  height: number;
  /**
   * `auto` = ikut tema (terang/gelap), `light` = selalu varian terang
   * (mis. kertas/kartu putih), `dark` = selalu varian gelap (di atas panel
   * biru), `grayscale` = cetak hitam putih.
   */
  tone?: "auto" | "light" | "dark" | "grayscale";
  className?: string;
};

const RATIO = { mark: 1761 / 1360, horizontal: 593.2 / 120 } as const;
const FILE = { mark: "logo-desa", horizontal: "logo-desa-horizontal" } as const;
const ALT = "Logo Desa Kartika Wanasari";

/**
 * Logo Desa Kartika Wanasari (identitas desa, bukan logo aplikasi).
 * Aturan: jangan ubah warna di luar varian yang ada, jangan regangkan,
 * jangan putar. Lihat public/brand/desa.
 */
export function LogoDesa({
  variant = "mark",
  height,
  tone = "auto",
  className = "",
}: LogoDesaProps) {
  const width = Math.round(height * RATIO[variant]);
  const base = `/brand/desa/${FILE[variant]}`;

  if (tone !== "auto") {
    return (
      <Image
        src={`${base}${{ grayscale: "-grayscale", dark: "-dark", light: "" }[tone]}.svg`}
        alt={ALT}
        width={width}
        height={height}
        className={className}
      />
    );
  }

  return (
    <>
      <Image
        src={`${base}.svg`}
        alt={ALT}
        width={width}
        height={height}
        className={`dark:hidden ${className}`}
      />
      <Image
        src={`${base}-dark.svg`}
        alt={ALT}
        width={width}
        height={height}
        className={`hidden dark:block ${className}`}
      />
    </>
  );
}
