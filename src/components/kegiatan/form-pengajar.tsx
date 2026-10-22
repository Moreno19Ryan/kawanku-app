"use client";

import { PesanAksi } from "@/components/pengaturan/pesan-aksi";
import { useFormAksi } from "@/components/pengaturan/use-form-aksi";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import { tambahPengajar } from "@/lib/kegiatan/actions";

/** Tambah pengajar rutin (nama, keterangan, wilayah). */
export function FormPengajar({ wilayah }: { wilayah: { nilai: string; nama: string }[] }) {
  const [state, onSubmit, pending] = useFormAksi(tambahPengajar);
  return (
    // key: kosongkan form setelah berhasil.
    <form key={state.pesan} onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Nama pengajar</span>
        <input name="nama" required maxLength={120} placeholder="mis. Ust. Hasan" className={INPUT_CLASS} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">
          Keterangan <span className="font-normal text-muted">(opsional)</span>
        </span>
        <input name="keterangan" maxLength={120} placeholder="mis. MT, Muballigh daerah" className={INPUT_CLASS} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Wilayah</span>
        <select name="wilayah" defaultValue={wilayah[0]?.nilai} className={INPUT_CLASS}>
          {wilayah.map((w) => (
            <option key={w.nilai} value={w.nilai}>
              {w.nama}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <button type="submit" disabled={pending} className={buttonClass("utama")}>
          {pending ? "Menyimpan…" : "Tambah pengajar"}
        </button>
        <PesanAksi state={state} />
      </div>
    </form>
  );
}
