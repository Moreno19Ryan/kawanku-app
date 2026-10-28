"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Clock } from "lucide-react";
import { hariTanggal, jam, jamDetik, waktuRelatif } from "@/lib/waktu";

/*
 * Jam realtime mengikuti jam server (WIB), bukan jam perangkat: selisih
 * jam perangkat terhadap server diukur lewat /api/waktu, lalu jam berjalan
 * sendiri tiap detik di perangkat. Satu penghitung untuk semua jam di
 * halaman; disinkronkan ulang tiap 10 menit & saat tab dibuka lagi.
 * Sebelum tersinkron, jam tampil "--.--" (bukan jam perangkat).
 */

const SINKRON_ULANG_MS = 10 * 60_000;
const COBA_LAGI_MS = 15_000;

let selisih: number | null = null;
let detik: number | null = null;
let timerDetik: ReturnType<typeof setTimeout> | undefined;
let timerSinkron: ReturnType<typeof setTimeout> | undefined;
let sedangSinkron = false;
const pendengar = new Set<() => void>();

function beriTahu() {
  pendengar.forEach((f) => f());
}

function hitung() {
  if (selisih === null) return;
  const s = Math.floor((Date.now() + selisih) / 1000) * 1000;
  if (s !== detik) {
    detik = s;
    beriTahu();
  }
}

/** Detik berganti tepat di batas detik jam server. */
function jalankanDetik() {
  clearTimeout(timerDetik);
  if (selisih === null || pendengar.size === 0) return;
  const sisa = 1000 - ((Date.now() + selisih) % 1000);
  timerDetik = setTimeout(() => {
    hitung();
    jalankanDetik();
  }, sisa + 5);
}

async function ukur(): Promise<{ selisih: number; rtt: number }> {
  const t0 = Date.now();
  const r = await fetch("/api/waktu", { cache: "no-store" });
  const t1 = Date.now();
  if (!r.ok) throw new Error(`waktu ${r.status}`);
  const { sekarang } = (await r.json()) as { sekarang: number };
  return { selisih: sekarang - (t0 + t1) / 2, rtt: t1 - t0 };
}

async function sinkron() {
  if (sedangSinkron) return;
  sedangSinkron = true;
  clearTimeout(timerSinkron);
  try {
    // Dua kali ukur, pakai yang jaringannya paling cepat (paling tepat).
    const a = await ukur();
    const b = await ukur().catch(() => a);
    const baru = (a.rtt <= b.rtt ? a : b).selisih;
    const berubah = selisih === null || Math.abs(baru - selisih) > 250;
    selisih = baru;
    if (berubah) beriTahu();
    hitung();
    jalankanDetik();
    timerSinkron = setTimeout(sinkron, SINKRON_ULANG_MS);
  } catch {
    timerSinkron = setTimeout(sinkron, COBA_LAGI_MS);
  } finally {
    sedangSinkron = false;
  }
}

function saatTerlihat() {
  if (document.visibilityState === "visible") void sinkron();
}

function langganan(f: () => void) {
  pendengar.add(f);
  if (pendengar.size === 1) {
    document.addEventListener("visibilitychange", saatTerlihat);
    if (selisih === null) void sinkron();
    else {
      hitung();
      jalankanDetik();
    }
  }
  return () => {
    pendengar.delete(f);
    if (pendengar.size === 0) {
      clearTimeout(timerDetik);
      document.removeEventListener("visibilitychange", saatTerlihat);
    }
  };
}

/** Waktu server saat ini (ms, dibulatkan ke detik); null sebelum tersinkron. */
export function useJamServer(): number | null {
  return useSyncExternalStore(
    langganan,
    () => detik,
    () => null,
  );
}

/** Selisih jam perangkat terhadap server (ms; positif = perangkat terlambat). */
export function useSelisihJam(): number | null {
  return useSyncExternalStore(
    langganan,
    () => selisih,
    () => null,
  );
}

type Keadaan = "belum" | "terbuka" | "tutup";

function keadaanAbsensi(sekarang: number, buka: string, tutup: string): Keadaan {
  if (sekarang < Date.parse(buka)) return "belum";
  if (sekarang > Date.parse(tutup)) return "tutup";
  return "terbuka";
}

function Angka({ sekarang, detikKecil }: { sekarang: number | null; detikKecil: string }) {
  if (sekarang === null) return <span className="opacity-60">--.--</span>;
  const teks = jamDetik(sekarang);
  return (
    <>
      {teks.slice(0, 5)}
      <span className={detikKecil}>{teks.slice(5)}</span>
    </>
  );
}

/**
 * Jam di panel sambutan (Beranda): HP = pil di bawah salam; laptop = jam
 * besar di kanan panel (ditempatkan PanelSambutan).
 */
export function JamPanel({ tata }: { tata: "pil" | "besar" }) {
  const sekarang = useJamServer();
  if (tata === "pil") {
    return (
      <p className="inline-flex items-center gap-2 rounded-pill bg-white/15 px-3.5 py-2 text-sm">
        <Clock className="size-4 shrink-0" aria-hidden />
        <span className="font-semibold tabular-nums">
          {sekarang === null ? "--.--" : jamDetik(sekarang)} WIB
        </span>
        {sekarang !== null && <span className="text-white/85">· {hariTanggal(sekarang)}</span>}
      </p>
    );
  }
  return (
    <div className="text-right" aria-label="Jam server">
      <p className="text-[3.25rem] leading-none font-semibold tracking-tight tabular-nums">
        <Angka sekarang={sekarang} detikKecil="text-[1.625rem] text-white/75" />
      </p>
      <p className="mt-2 text-[0.95rem] text-white/85">
        {sekarang === null ? "Menyesuaikan jam…" : `${hariTanggal(sekarang)} · WIB`}
      </p>
    </div>
  );
}

/** Pil jam kecil (pemindai, kepala halaman). */
export function JamRingkas({ className = "" }: { className?: string }) {
  const sekarang = useJamServer();
  return (
    <span
      className={`inline-flex h-9 items-center gap-1.5 rounded-pill bg-surface px-3.5 text-[0.95rem] font-semibold text-primary tabular-nums ${className}`}
      aria-label="Jam server"
    >
      <Clock className="size-4" aria-hidden />
      {sekarang === null ? "--.--" : jamDetik(sekarang)}
    </span>
  );
}

const TEKS_KEADAAN: Record<Keadaan, (buka: string, tutup: string) => string> = {
  belum: (buka) => `Absensi terbuka ${jam(buka)}`,
  terbuka: (_, tutup) => `Absensi terbuka · tutup ${jam(tutup)}`,
  tutup: () => "Absensi sudah tertutup",
};

const WARNA_KEADAAN: Record<Keadaan, string> = {
  belum: "text-muted",
  terbuka: "text-success",
  tutup: "text-muted",
};

/** Kotak jam di kepala halaman sesi absensi (admin): jam + keadaan absensi. */
export function JamSesi({ buka, tutup, ditutup = false }: { buka: string; tutup: string; ditutup?: boolean }) {
  const sekarang = useJamServer();
  const keadaan: Keadaan | null = ditutup ? "tutup" : sekarang === null ? null : keadaanAbsensi(sekarang, buka, tutup);
  return (
    <div className="flex items-center gap-3 rounded-card bg-surface px-4 py-2.5">
      <Clock className="size-5 shrink-0 text-primary" aria-hidden />
      <div>
        <p className="text-xl leading-none font-semibold tabular-nums">
          {sekarang === null ? "--.--" : jamDetik(sekarang)}{" "}
          <span className="text-sm font-medium text-muted">WIB</span>
        </p>
        <p className={`mt-1 text-xs font-medium ${keadaan ? WARNA_KEADAAN[keadaan] : "text-muted"}`}>
          {keadaan ? TEKS_KEADAAN[keadaan](buka, tutup) : "Menyesuaikan jam…"}
        </p>
      </div>
    </div>
  );
}

/** Kartu jam besar di QR layar: jam server + garis jendela absensi. */
export function JamLayar({ buka, tutup }: { buka: string; tutup: string }) {
  const sekarang = useJamServer();
  const awal = Date.parse(buka);
  const akhir = Date.parse(tutup);
  const persen = sekarang === null ? 0 : Math.min(100, Math.max(0, ((sekarang - awal) / (akhir - awal)) * 100));
  return (
    <div className="rounded-card bg-primary p-6 text-white lg:p-7 dark:bg-primary-soft">
      <p className="text-sm text-white/85">Sekarang</p>
      <p className="mt-1 text-6xl leading-none font-semibold tracking-tight tabular-nums lg:text-8xl">
        <Angka sekarang={sekarang} detikKecil="text-3xl text-white/75 lg:text-5xl" />
      </p>
      <p className="mt-3 text-base lg:text-lg">
        {sekarang === null ? "Menyesuaikan jam…" : `${hariTanggal(sekarang)} · WIB`}
      </p>
      <div className="mt-5 h-2 overflow-hidden rounded-pill bg-white/25" aria-hidden>
        <div className="h-full rounded-pill bg-white transition-[width] duration-1000 ease-linear" style={{ width: `${persen}%` }} />
      </div>
      <p className="mt-2.5 text-sm text-white/90 lg:text-base">
        {sekarang !== null && sekarang > akhir ? "Absensi sudah tertutup · " : "Absensi terbuka "}
        {jam(buka)} – {jam(tutup)} WIB
      </p>
    </div>
  );
}

/** Kotak kuning bila jam perangkat ini berbeda lebih dari 1 menit dari jam server. */
export function PeringatanSelisihJam() {
  const beda = useSelisihJam();
  if (beda === null || Math.abs(beda) < 60_000) return null;
  const menit = Math.round(Math.abs(beda) / 60_000);
  return (
    <p className="rounded-card bg-warning/15 px-4 py-3.5 text-sm text-fg">
      Jam di perangkat ini berbeda <b>{menit} menit</b> dari jam server. Tidak apa-apa, yang dipakai untuk absensi
      tetap jam server.
    </p>
  );
}

/**
 * Label kartu "Berikutnya" (Beranda generus) mengikuti jam server: sebelum
 * absensi terbuka "Berikutnya · dalam …", saat terbuka "Absensi terbuka ·
 * sampai …". `label` = teks dari server, dipakai sebelum jam tersinkron.
 */
export function LabelJadwal({
  mulai,
  buka,
  tutup,
  label,
  ikon,
}: {
  mulai: string;
  buka: string;
  tutup: string;
  label: string;
  ikon: ReactNode;
}) {
  const sekarang = useJamServer();
  const keadaan = sekarang === null ? null : keadaanAbsensi(sekarang, buka, tutup);
  if (keadaan === "terbuka") {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-success">
        <span className="size-2 rounded-pill bg-success" aria-hidden />
        Absensi terbuka · sampai {jam(tutup)} WIB
      </p>
    );
  }
  return (
    <p className="flex items-center gap-2 text-sm font-medium text-primary">
      {ikon}
      {sekarang === null
        ? label
        : sekarang < Date.parse(mulai)
          ? `Berikutnya · ${waktuRelatif(mulai, sekarang)}`
          : "Sedang berlangsung"}
    </p>
  );
}

/** Aksi kartu "Berikutnya": `terbuka` (scan) selama absensi terbuka, selain itu `tertutup`. */
export function AksiJadwal({
  buka,
  tutup,
  awalTerbuka,
  terbuka,
  tertutup,
}: {
  buka: string;
  tutup: string;
  /** Keadaan menurut server saat halaman dibuat (sebelum jam tersinkron). */
  awalTerbuka: boolean;
  terbuka: ReactNode;
  tertutup: ReactNode;
}) {
  const sekarang = useJamServer();
  const sedangTerbuka = sekarang === null ? awalTerbuka : keadaanAbsensi(sekarang, buka, tutup) === "terbuka";
  return <>{sedangTerbuka ? terbuka : tertutup}</>;
}
