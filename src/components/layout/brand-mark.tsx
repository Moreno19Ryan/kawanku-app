import Image from "next/image";

/** Logo + nama aplikasi. Logo masih placeholder sampai logo desa tersedia. */
export function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/icons/icon.svg"
        alt=""
        width={36}
        height={36}
        className="rounded-[0.6rem]"
        priority
      />
      <div className="leading-tight">
        <p className="text-base font-semibold">KawanKu</p>
        <p className="text-xs text-muted">Desa Kartika Wanasari</p>
      </div>
    </div>
  );
}
