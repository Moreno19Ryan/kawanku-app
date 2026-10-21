"use client";

import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import { Saklar } from "@/components/ui/saklar";
import { PesanAksi } from "@/components/pengaturan/pesan-aksi";
import { simpanPerawatan } from "@/lib/sistem/actions";
import { useFormAksi } from "@/components/pengaturan/use-form-aksi";

export function FormPerawatan({
  aktif,
  pesan,
  perkiraanSelesai,
}: {
  aktif: boolean;
  pesan: string;
  /** Nilai datetime-local (WIB). */
  perkiraanSelesai: string;
}) {
  const [state, onSubmit, pending] = useFormAksi(simpanPerawatan, (form) => {
    const nyala = new FormData(form).get("aktif") === "on";
    return (
      !nyala ||
      aktif ||
      window.confirm(
        "Nyalakan mode perawatan? Semua admin selain pengembang tidak bisa memakai aplikasi.",
      )
    );
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 rounded-control bg-surface-muted px-4 py-3">
        <div>
          <p className="font-medium">Mode perawatan</p>
          <p className="text-sm text-muted">Admin lain melihat halaman &ldquo;Sedang perawatan&rdquo;.</p>
        </div>
        <Saklar name="aktif" label="Mode perawatan" defaultChecked={aktif} />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Pesan untuk admin (opsional)</span>
        <textarea
          name="pesan"
          rows={3}
          maxLength={500}
          defaultValue={pesan}
          placeholder="KawanKu sedang diperbarui. Silakan coba lagi beberapa saat lagi."
          className={`${INPUT_CLASS} h-auto py-3`}
        />
      </label>

      <label className="flex flex-col gap-1.5 sm:max-w-xs">
        <span className="text-sm font-medium">Perkiraan selesai (WIB, opsional)</span>
        <input
          type="datetime-local"
          name="perkiraan_selesai"
          defaultValue={perkiraanSelesai}
          className={INPUT_CLASS}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("utama")}>
          {pending ? "Menyimpan…" : "Simpan"}
        </button>
        <PesanAksi state={state} />
      </div>
    </form>
  );
}
