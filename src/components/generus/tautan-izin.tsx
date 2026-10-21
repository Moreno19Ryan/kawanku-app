import Link from "next/link";
import type { Kejadian } from "@/lib/kegiatan/jadwal";

/** Tautan kecil "Izin" di jadwal generus, untuk pertemuan yang belum lewat. */
export function TautanIzin({ k }: { k: Kejadian }) {
  if (k.status !== "terjadwal" || k.selesai <= new Date().toISOString()) return null;
  return (
    <Link
      href={`/saya/izin?k=${k.kegiatan.id}&t=${k.tanggal}`}
      className="shrink-0 rounded-pill px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-soft"
    >
      Izin
    </Link>
  );
}
