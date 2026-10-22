"use client";

import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import { Saklar } from "@/components/ui/saklar";
import { LABEL_STATUS_PERNIKAHAN, LABEL_STATUS_SEKOLAH } from "@/lib/label";
import type { StateAksi } from "@/lib/pengaturan/actions";
import { PesanAksi } from "./pesan-aksi";
import { useFormAksi } from "./use-form-aksi";

export type NilaiKategori = {
  nama: string;
  usia_min: number | null;
  usia_max: number | null;
  status_sekolah_berlaku: string[] | null;
  status_pernikahan_berlaku: string[] | null;
  termasuk_generus: boolean;
};

const KOSONG: NilaiKategori = {
  nama: "",
  usia_min: null,
  usia_max: null,
  status_sekolah_berlaku: null,
  status_pernikahan_berlaku: null,
  termasuk_generus: false,
};

/** Pilihan berbentuk chip (checkbox asli, jadi tetap terkirim lewat form). */
function PilihanChip({
  name,
  label,
  opsi,
  terpilih,
}: {
  name: string;
  label: string;
  opsi: Record<string, string>;
  terpilih: string[] | null;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {Object.entries(opsi).map(([nilai, teks]) => (
          <label key={nilai} className="cursor-pointer">
            <input
              type="checkbox"
              name={name}
              value={nilai}
              defaultChecked={terpilih?.includes(nilai)}
              className="peer sr-only"
            />
            <span className="inline-flex rounded-pill bg-surface-muted px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ease-oneui peer-checked:bg-primary-soft peer-checked:text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40">
              {teks}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Form aturan satu kategori jamaah (ubah atau tambah). */
export function FormKategori({
  aksi,
  nilai = KOSONG,
  labelKirim = "Simpan",
}: {
  aksi: (prev: StateAksi, formData: FormData) => Promise<StateAksi>;
  nilai?: NilaiKategori;
  labelKirim?: string;
}) {
  const [state, onSubmit, pending] = useFormAksi(aksi);
  const tambah = nilai === KOSONG;

  return (
    // key (form tambah): kosongkan isian setelah berhasil.
    <form key={tambah ? state.pesan : undefined} onSubmit={onSubmit} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Nama kategori</span>
        <input
          name="nama"
          required
          maxLength={80}
          defaultValue={nilai.nama}
          placeholder="Mis. Remaja Muda"
          className={INPUT_CLASS}
        />
      </label>

      <PilihanChip
        name="sekolah"
        label="Status sekolah (boleh lebih dari satu)"
        opsi={LABEL_STATUS_SEKOLAH}
        terpilih={nilai.status_sekolah_berlaku}
      />
      <PilihanChip
        name="pernikahan"
        label="Status pernikahan (boleh lebih dari satu)"
        opsi={LABEL_STATUS_PERNIKAHAN}
        terpilih={nilai.status_pernikahan_berlaku}
      />
      <p className="-mt-3 text-xs text-muted">
        Bila &ldquo;Termasuk generus&rdquo; dinyalakan, status pernikahan otomatis hanya Lajang.
      </p>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Usia (tahun)</legend>
        <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">Minimal</span>
            <input
              name="usia_min"
              type="number"
              inputMode="numeric"
              min={0}
              max={150}
              defaultValue={nilai.usia_min ?? ""}
              placeholder="–"
              className={INPUT_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">Maksimal</span>
            <input
              name="usia_max"
              type="number"
              inputMode="numeric"
              min={0}
              max={150}
              defaultValue={nilai.usia_max ?? ""}
              placeholder="–"
              className={INPUT_CLASS}
            />
          </label>
        </div>
      </fieldset>

      <p className="text-xs text-muted">
        Syarat yang dikosongkan tidak dipakai. Jamaah masuk kategori ini bila SEMUA syarat yang
        diisi cocok.
      </p>

      <div className="flex items-start justify-between gap-4 rounded-control bg-surface-muted p-4">
        <div>
          <p className="text-sm font-medium">Termasuk generus</p>
          <p className="text-xs text-muted">
            Jamaah kategori ini bisa dilihat dan diurus admin generus.
          </p>
        </div>
        <Saklar name="generus" label="Termasuk generus" defaultChecked={nilai.termasuk_generus} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className={buttonClass(tambah ? "utama" : "kedua", tambah ? "" : "h-9 px-4")}
        >
          {pending ? "Menyimpan…" : labelKirim}
        </button>
        <PesanAksi state={state} />
      </div>
    </form>
  );
}
