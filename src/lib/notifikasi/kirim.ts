import "server-only";
import webpush from "web-push";

/**
 * Pengirim Web Push (notifikasi HP). Kunci VAPID dari env:
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY (publik, juga dipakai browser saat
 * berlangganan), VAPID_PRIVATE_KEY (rahasia, hanya server), dan
 * VAPID_SUBJECT (mailto: kontak pengembang). Tanpa kunci → fitur nonaktif.
 */

export type PesanPush = {
  endpoint: string;
  p256dh: string;
  auth: string;
  judul: string;
  isi: string;
  url?: string;
  tag?: string;
};

export function pushSiap(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let disiapkan = false;
function siapkan() {
  if (disiapkan) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:pengembang@inikawanku.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  disiapkan = true;
}

/** Kirim semua pesan; kembalikan endpoint yang berhasil & yang sudah tidak berlaku (404/410). */
export async function kirimPush(pesan: PesanPush[]): Promise<{ terkirim: string[]; kedaluwarsa: string[]; gagal: number }> {
  if (!pushSiap() || pesan.length === 0) return { terkirim: [], kedaluwarsa: [], gagal: 0 };
  siapkan();
  const hasil = await Promise.allSettled(
    pesan.map((p) =>
      webpush.sendNotification(
        { endpoint: p.endpoint, keys: { p256dh: p.p256dh, auth: p.auth } },
        JSON.stringify({ judul: p.judul, isi: p.isi, url: p.url ?? "/saya", tag: p.tag }),
        { TTL: 60 * 60, urgency: "high", timeout: 10_000 },
      ),
    ),
  );
  const terkirim: string[] = [];
  const kedaluwarsa: string[] = [];
  let gagal = 0;
  hasil.forEach((h, i) => {
    if (h.status === "fulfilled") terkirim.push(pesan[i].endpoint);
    else {
      const kode = (h.reason as { statusCode?: number } | undefined)?.statusCode;
      if (kode === 404 || kode === 410) kedaluwarsa.push(pesan[i].endpoint);
      else gagal++;
    }
  });
  return { terkirim, kedaluwarsa, gagal };
}
