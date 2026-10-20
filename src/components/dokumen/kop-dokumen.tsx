import { LogoDesa } from "@/components/brand/logo-desa";

type KopDokumenProps = {
  judul: string;
  /** Baris kecil di bawah judul, mis. periode atau nomor dokumen. */
  keterangan?: string;
  /** Pakai logo satu nada untuk dokumen yang dicetak hitam putih. */
  hitamPutih?: boolean;
};

/**
 * Header (kop) untuk setiap dokumen di aplikasi: laporan, rekap absensi,
 * daftar warga, dan dokumen lain yang dicetak/diekspor. Logo desa horizontal
 * di kiri atas (tinggi 40–48 px). Dirancang untuk latar kertas putih.
 */
export function KopDokumen({ judul, keterangan, hitamPutih }: KopDokumenProps) {
  return (
    <header className="flex flex-col gap-4 border-b-2 border-paper-fg pb-4 text-paper-fg sm:flex-row sm:items-center sm:justify-between print:flex-row print:items-center print:justify-between">
      <LogoDesa
        variant="horizontal"
        height={44}
        tone={hitamPutih ? "grayscale" : "light"}
      />
      <div className="sm:text-right print:text-right">
        <h1 className="text-lg font-bold leading-tight">{judul}</h1>
        {keterangan ? (
          <p className="text-sm text-paper-muted">{keterangan}</p>
        ) : null}
      </div>
    </header>
  );
}
