"use client";

import { useId, useState } from "react";
import { PesanAksi } from "@/components/pengaturan/pesan-aksi";
import { useFormAksi } from "@/components/pengaturan/use-form-aksi";
import { buttonClass } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/input";
import type { StateAksi } from "@/lib/pengaturan/actions";

type Aksi = (prev: StateAksi, formData: FormData) => Promise<StateAksi>;

const KECIL = `${INPUT_CLASS} h-10 py-0 text-sm`;

function IsianPin({ adaTanggal, wajib }: { adaTanggal: boolean; wajib?: boolean }) {
  return (
    <input
      name="pin"
      inputMode="numeric"
      pattern="\d{6}"
      maxLength={6}
      required={wajib && !adaTanggal}
      autoComplete="off"
      placeholder={adaTanggal ? "PIN (kosong = tgl lahir DDMMYY)" : "PIN 6 angka (wajib)"}
      aria-label="PIN awal"
      className={`${KECIL} w-full sm:w-64`}
    />
  );
}

/** Buat akun: username (usulan dari nama panggilan / nama lengkap) + PIN awal. */
export function FormBuatAkun({ aksi, usulan, adaTanggal }: { aksi: Aksi; usulan: string[]; adaTanggal: boolean }) {
  const [state, onSubmit, pending] = useFormAksi(aksi);
  const daftar = useId();
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <input
        name="username"
        required
        list={daftar}
        defaultValue={usulan[0]}
        autoCapitalize="none"
        spellCheck={false}
        aria-label="Username"
        className={`${KECIL} w-full sm:w-48`}
      />
      <datalist id={daftar}>
        {usulan.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <IsianPin adaTanggal={adaTanggal} wajib />
      <button type="submit" disabled={pending} className={buttonClass("utama", "h-10 px-4")}>
        {pending ? "Membuat…" : "Buat akun"}
      </button>
      <PesanAksi state={state} />
    </form>
  );
}

export function FormUsername({ aksi, username }: { aksi: Aksi; username: string }) {
  const [state, onSubmit, pending] = useFormAksi(aksi);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        name="username"
        required
        defaultValue={username}
        autoCapitalize="none"
        spellCheck={false}
        aria-label="Username"
        className={`${KECIL} w-full sm:w-48`}
      />
      <button type="submit" disabled={pending} className={buttonClass("netral", "h-10 px-4")}>
        Ubah username
      </button>
      <PesanAksi state={state} />
    </form>
  );
}

/**
 * PIN generus tidak bisa diganti sembarangan: hanya dikembalikan ke PIN awal
 * (tanggal lahir DDMMYY) dengan alasan, dan tercatat (riwayat_pin).
 */
export function FormKembalikanPin({
  aksi,
  adaTanggal,
  pinAwal,
  terakhir,
}: {
  aksi: Aksi;
  adaTanggal: boolean;
  /** Generus masih memakai PIN awal (belum menggantinya). */
  pinAwal: boolean;
  /** Keterangan pengembalian terakhir, mis. "12 Okt 2026 (lupa)". */
  terakhir?: string;
}) {
  const [state, onSubmit, pending] = useFormAksi(aksi);
  const [alasan, setAlasan] = useState("lupa");
  if (!adaTanggal) {
    return (
      <p className="text-sm text-muted">
        PIN hanya bisa dikembalikan ke PIN awal (tanggal lahir). Isi tanggal lahir jamaah ini dulu di halaman jamaah.
      </p>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <p className="text-sm text-muted">
        {pinAwal
          ? "Masih memakai PIN awal: tanggal lahirnya (DDMMYY). Bila lupa, cukup beri tahu PIN itu."
          : "Sudah memakai PIN pilihannya sendiri. Bila lupa atau terkunci, kembalikan ke PIN awal (tanggal lahir DDMMYY); ia wajib menggantinya saat masuk."}
        {terakhir && ` Terakhir dikembalikan: ${terakhir}.`}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          name="alasan"
          value={alasan}
          onChange={(e) => setAlasan(e.target.value)}
          aria-label="Alasan"
          className={`${KECIL} w-full sm:w-44`}
        >
          <option value="lupa">Lupa PIN</option>
          <option value="terkunci">Akun terkunci</option>
          <option value="lainnya">Lainnya</option>
        </select>
        {alasan === "lainnya" && (
          <input
            name="catatan"
            required
            maxLength={200}
            placeholder="Tulis alasannya"
            aria-label="Catatan alasan"
            className={`${KECIL} w-full sm:flex-1`}
          />
        )}
        <button type="submit" disabled={pending} className={buttonClass("netral", "h-10 shrink-0 px-4")}>
          {pending ? "Memproses…" : "Kembalikan ke PIN awal"}
        </button>
      </div>
      <PesanAksi state={state} />
    </form>
  );
}
