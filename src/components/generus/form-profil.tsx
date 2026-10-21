"use client";

import { PesanAksi } from "@/components/pengaturan/pesan-aksi";
import { useFormAksi } from "@/components/pengaturan/use-form-aksi";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import { kirimUsulanKoreksi, simpanProfilSaya } from "@/lib/generus/actions";
import { formatNoHp } from "@/lib/jamaah/format";
import { LABEL_BAGIAN_USULAN } from "@/lib/label";

function Kolom({ label, children, bantuan }: { label: string; children: React.ReactNode; bantuan?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {bantuan && <span className="text-xs text-muted">{bantuan}</span>}
    </label>
  );
}

/** Nama panggilan, no. HP/WA, email: diubah generus sendiri. */
export function FormProfil({
  nilai,
}: {
  nilai: { nama_panggilan: string | null; no_hp: string | null; email: string | null };
}) {
  const [state, onSubmit, pending] = useFormAksi(simpanProfilSaya);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Kolom label="Nama panggilan" bantuan="Dipakai untuk menyapamu di aplikasi.">
        <input name="nama_panggilan" maxLength={40} defaultValue={nilai.nama_panggilan ?? ""} className={INPUT_CLASS} />
      </Kolom>
      <Kolom label="No. HP/WhatsApp">
        <input
          name="no_hp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          defaultValue={formatNoHp(nilai.no_hp)}
          placeholder="08xx-xxxx-xxxx"
          className={INPUT_CLASS}
        />
      </Kolom>
      <Kolom label="Email">
        <input name="email" type="email" maxLength={120} autoComplete="email" defaultValue={nilai.email ?? ""} className={INPUT_CLASS} />
      </Kolom>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("kedua", "h-10 px-5")}>
          {pending ? "Menyimpan…" : "Simpan"}
        </button>
        <PesanAksi state={state} />
      </div>
    </form>
  );
}

/** Lapor data yang salah (nama, tanggal lahir, dll.) ke admin. */
export function FormUsulanKoreksi() {
  const [state, onSubmit, pending] = useFormAksi(kirimUsulanKoreksi);
  // Terkirim → form dipasang ulang (isian kosong); ditolak server → isian tetap.
  return (
    <form key={state.pesan ?? "baru"} onSubmit={onSubmit} className="flex flex-col gap-4">
      <Kolom label="Data yang salah">
        <select name="bagian" required defaultValue="" className={INPUT_CLASS}>
          <option value="" disabled>
            Pilih…
          </option>
          {Object.entries(LABEL_BAGIAN_USULAN).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Kolom>
      <Kolom label="Seharusnya" bantuan="Tulis data yang benar, mis. “Lahir 5 Maret 2008” atau “Sudah lulus SMA, sekarang kuliah”.">
        <textarea name="isi" required maxLength={300} rows={3} className={`${INPUT_CLASS} h-auto py-3`} />
      </Kolom>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("kedua", "h-10 px-5")}>
          {pending ? "Mengirim…" : "Kirim ke admin"}
        </button>
        <PesanAksi state={state} />
      </div>
    </form>
  );
}
