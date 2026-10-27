import type { ReactNode } from "react";
import { LogoPutih, PolaK } from "@/components/brand/hiasan-sambutan";

/**
 * Panel biru halaman sambutan (Beranda admin & generus, docs/pedoman-desain.md):
 * HP: menempel di atas selebar layar, sudut bawah membulat, membawa kepala
 * sendiri (logo + `kanan`); laptop (`lg`, admin): kartu membulat, kepala
 * disembunyikan karena logo & akun sudah ada di menu samping. Halaman yang
 * memakainya ditandai `data-sambutan` supaya kepala biasa di layout hilang.
 */
export function PanelSambutan({
  kanan,
  kepalaLaptop = true,
  children,
}: {
  /** Tombol di kanan atas (tema, akun/keluar), berwarna putih. */
  kanan?: ReactNode;
  /** false: kepala (logo + kanan) disembunyikan di laptop. */
  kepalaLaptop?: boolean;
  children?: ReactNode;
}) {
  return (
    <section
      className={`relative -mx-gutter overflow-hidden rounded-b-[2.25rem] bg-primary px-gutter pt-2 pb-24 text-white sm:mx-0 sm:mt-4 sm:rounded-card dark:bg-primary-soft ${
        kepalaLaptop ? "" : "lg:mt-6 lg:px-8 lg:pt-7 lg:pb-28"
      }`}
    >
      <PolaK className="-top-6 -right-24 size-72 lg:-top-16 lg:size-[26rem]" />
      <div className={`relative -mx-2 flex items-center justify-between ${kepalaLaptop ? "" : "lg:hidden"}`}>
        <div className="-my-[6px]">
          <LogoPutih height={24} priority />
        </div>
        {kanan && <div className="flex items-center gap-1">{kanan}</div>}
      </div>
      {children && <div className={`kk-muncul relative mt-6 ${kepalaLaptop ? "" : "lg:mt-0"}`}>{children}</div>}
    </section>
  );
}
