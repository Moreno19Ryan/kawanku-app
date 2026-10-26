"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { PesanAksi } from "@/components/pengaturan/pesan-aksi";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { StateAksi } from "@/lib/pengaturan/actions";
import { kirimTesNotifikasi, matikanLangganan, simpanLangganan } from "@/lib/notifikasi/actions";

const KUNCI_PUBLIK = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type Keadaan = "memeriksa" | "tidak-didukung" | "perlu-pasang" | "ditolak" | "mati" | "nyala";

function kunciKeBytes(base64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const biner = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const hasil = new Uint8Array(new ArrayBuffer(biner.length));
  for (let i = 0; i < biner.length; i++) hasil[i] = biner.charCodeAt(i);
  return hasil;
}

function namaPerangkat(): string {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "Mac" : "Perangkat";
  const browser = /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Edg\//.test(ua) ? "Edge" : /Firefox/.test(ua) ? "Firefox" : /Chrome/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "Browser";
  return `${os} · ${browser}`;
}

/** Layanan push browser kadang tidak menjawab (jaringan diblokir); jangan menggantung. */
function batasWaktu<T>(janji: Promise<T>, ms = 20_000): Promise<T> {
  return Promise.race([janji, new Promise<never>((_, tolak) => setTimeout(() => tolak(new Error("waktu habis")), ms))]);
}

async function langgananSaatIni(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/**
 * Nyalakan/matikan pengingat pengajian di perangkat ini (Web Push).
 * `ringkas`: hanya tampil sebagai ajakan bila belum menyala (Beranda).
 */
export function SaklarNotifikasi({
  ringkas = false,
  untuk = "generus",
}: {
  ringkas?: boolean;
  /** Pengembang: peringatan sistem (cadangan gagal, ruang database). */
  untuk?: "generus" | "pengembang";
}) {
  const [keadaan, setKeadaan] = useState<Keadaan>("memeriksa");
  const [state, setState] = useState<StateAksi>({});
  const [pending, mulai] = useTransition();

  useEffect(() => {
    (async () => {
      if (!KUNCI_PUBLIK || !("serviceWorker" in navigator) || !("Notification" in window)) {
        const ios = /iPhone|iPad/.test(navigator.userAgent);
        const terpasang = window.matchMedia("(display-mode: standalone)").matches;
        setKeadaan(KUNCI_PUBLIK && ios && !terpasang ? "perlu-pasang" : "tidak-didukung");
        return;
      }
      if (!("PushManager" in window)) {
        setKeadaan(/iPhone|iPad/.test(navigator.userAgent) ? "perlu-pasang" : "tidak-didukung");
        return;
      }
      if (Notification.permission === "denied") return setKeadaan("ditolak");
      const sub = await langgananSaatIni().catch(() => null);
      // Selaraskan: perangkat yang sudah berlangganan dicatat untuk akun yang sedang login.
      if (sub && Notification.permission === "granted") simpanLangganan(sub.toJSON() as { endpoint: string }, namaPerangkat()).catch(() => {});
      setKeadaan(sub ? "nyala" : "mati");
    })();
  }, []);

  function nyalakan() {
    mulai(async () => {
      setState({});
      try {
        const izin = await Notification.requestPermission();
        if (izin !== "granted") {
          setKeadaan(izin === "denied" ? "ditolak" : "mati");
          return;
        }
        const reg = (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
        await batasWaktu(navigator.serviceWorker.ready);
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await batasWaktu(
            reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: kunciKeBytes(KUNCI_PUBLIK) }),
          ));
        const hasil = await simpanLangganan(sub.toJSON() as { endpoint: string }, namaPerangkat());
        setState(hasil);
        if (!hasil.galat) setKeadaan("nyala");
      } catch {
        setState({ galat: "Gagal menyalakan notifikasi di browser ini. Periksa koneksi internet, lalu coba lagi." });
      }
    });
  }

  function matikan() {
    mulai(async () => {
      setState({});
      const sub = await langgananSaatIni().catch(() => null);
      if (sub) {
        setState(await matikanLangganan(sub.endpoint));
        await sub.unsubscribe().catch(() => {});
      }
      setKeadaan("mati");
    });
  }

  function uji() {
    mulai(async () => {
      const sub = await langgananSaatIni().catch(() => null);
      setState(sub ? await kirimTesNotifikasi(sub.endpoint) : { galat: "Perangkat ini belum berlangganan." });
    });
  }

  if (ringkas && keadaan !== "mati") return null;

  const isi = {
    memeriksa: "Memeriksa…",
    "tidak-didukung": KUNCI_PUBLIK
      ? "Browser ini belum mendukung notifikasi. Coba buka KawanKu di Chrome."
      : "Notifikasi belum disiapkan pengembang.",
    "perlu-pasang": "Di iPhone, pasang dulu KawanKu ke layar utama (Bagikan → Tambah ke Layar Utama), lalu buka dari ikonnya.",
    ditolak: "Notifikasi diblokir di browser ini. Izinkan lewat pengaturan situs (ikon gembok di sebelah alamat), lalu muat ulang.",
    mati:
      untuk === "pengembang"
        ? "Dapat peringatan di HP saat cadangan gagal, cadangan rusak, atau ruang database hampir penuh."
        : "Dapat pengingat di HP: malam sebelum pengajian dan sekitar 1 jam sebelum mulai.",
    nyala:
      untuk === "pengembang"
        ? "Peringatan sistem akan muncul di perangkat ini."
        : "Pengingat pengajian akan muncul di perangkat ini: malam sebelumnya dan sekitar 1 jam sebelum mulai.",
  }[keadaan];

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-pill bg-primary-soft text-primary">
          {keadaan === "nyala" ? <BellRing className="size-5" aria-hidden /> : keadaan === "mati" ? <Bell className="size-5" aria-hidden /> : <BellOff className="size-5" aria-hidden />}
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold">{untuk === "pengembang" ? "Peringatan di HP" : "Pengingat di HP"} {keadaan === "nyala" && <span className="text-sm font-normal text-success">· menyala</span>}</h2>
          <p className="text-sm text-muted">{isi}</p>
        </div>
      </div>
      {(keadaan === "mati" || keadaan === "nyala") && (
        <div className="flex flex-wrap gap-2">
          {keadaan === "mati" ? (
            <button type="button" onClick={nyalakan} disabled={pending} className={buttonClass("utama")}>
              <Bell className="size-4" aria-hidden />
              {pending ? "Menyalakan…" : "Nyalakan pengingat"}
            </button>
          ) : (
            <>
              <button type="button" onClick={uji} disabled={pending} className={buttonClass("kedua")}>
                Kirim uji
              </button>
              <button type="button" onClick={matikan} disabled={pending} className={buttonClass("netral")}>
                Matikan
              </button>
            </>
          )}
        </div>
      )}
      <PesanAksi state={state} />
    </Card>
  );
}
