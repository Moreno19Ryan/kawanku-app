import Image from "next/image";

/** Pola huruf "K" samar di panel biru sambutan (hiasan, bukan logo). */
export function PolaK({ className }: { className: string }) {
  return (
    <svg aria-hidden viewBox="0 0 520 520" className={`pointer-events-none absolute fill-white opacity-[0.13] ${className}`}>
      <path d="M60 60H130V460H60Z" />
      <path d="M130 260 330 60H460L260 260Z" />
      <path d="M130 260 330 460H460L260 260Z" />
    </svg>
  );
}

/** Logo KawanKu varian untuk latar gelap/biru (tulisan terang). */
export function LogoPutih({ height, priority = false }: { height: number; priority?: boolean }) {
  return (
    <span className="inline-flex p-[0.5em]" style={{ fontSize: height }}>
      <Image
        src="/brand/logo-horizontal-dark.svg"
        alt="KawanKu"
        width={Math.round((height * 458.4) / 68)}
        height={height}
        priority={priority}
      />
    </span>
  );
}
