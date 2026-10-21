"use client";

import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import { PesanAksi } from "@/components/pengaturan/pesan-aksi";
import { buatPengumuman } from "@/lib/sistem/actions";
import { useFormAksi } from "@/components/pengaturan/use-form-aksi";

export function FormPengumuman() {
  const [state, onSubmit, pending] = useFormAksi(buatPengumuman);

  return (
    // key: kosongkan form setelah berhasil.
    <form key={state.pesan} onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Pesan</span>
        <textarea
          name="pesan"
          required
          rows={2}
          maxLength={300}
          placeholder="Mis. Nanti malam pukul 21.00 ada perawatan singkat ±15 menit."
          className={`${INPUT_CLASS} h-auto py-3`}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Jenis</span>
          <select name="nada" defaultValue="info" className={INPUT_CLASS}>
            <option value="info">Info (biru)</option>
            <option value="peringatan">Peringatan (kuning)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Mulai (WIB, opsional)</span>
          <input type="datetime-local" name="mulai" className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Berakhir (WIB, opsional)</span>
          <input type="datetime-local" name="berakhir" className={INPUT_CLASS} />
        </label>
      </div>
      <p className="text-xs text-muted">Mulai kosong = tayang sekarang. Berakhir kosong = tayang sampai disembunyikan.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("utama")}>
          {pending ? "Menyimpan…" : "Buat pengumuman"}
        </button>
        <PesanAksi state={state} />
      </div>
    </form>
  );
}
