/**
 * Info masuk akun generus untuk dibagikan admin (slip cetak & WhatsApp).
 * Fungsi murni. PIN tidak pernah ditulis angkanya: hanya aturannya
 * (tanggal lahir TTBBYY), jadi slip yang tercecer tidak langsung membuka akun.
 */
import { ucapanSyukur } from "@/lib/label";

export type InfoMasuk = {
  panggilan: string;
  username: string;
  pinAwal: boolean;
  adaTanggal: boolean;
  jenisKelamin: string | null;
  alamat: string;
};

/** Keterangan PIN sesuai keadaan akun. */
export function teksPin(pinAwal: boolean, adaTanggal: boolean): string {
  if (!pinAwal) return "PIN: yang sudah kamu buat sendiri. Lupa PIN? Minta admin mengatur ulang.";
  if (!adaTanggal) return "PIN awal: yang diberikan admin.";
  return "PIN awal: tanggal lahirmu 6 angka (TTBBYY), mis. lahir 14 Maret 2009 → 140309.";
}

export function pesanWhatsapp(i: InfoMasuk): string {
  return [
    `Assalamu'alaikum warahmatullahi wabarakatuh, ${i.panggilan}.`,
    "Akun KawanKu-mu sudah siap untuk absen pengajian.",
    "",
    `1. Buka ${i.alamat}`,
    `2. Username: ${i.username}`,
    `3. ${teksPin(i.pinAwal, i.adaTanggal)}`,
    "",
    i.pinAwal ? "Setelah masuk, ganti PIN-mu dan jangan beri tahu siapa pun." : "Jangan beri tahu PIN-mu ke siapa pun.",
    `${ucapanSyukur(i.jenisKelamin)}.`,
  ].join("\n");
}

/** Tautan wa.me; ke nomor generus bila ada (08… → 628…), selain itu pilih kontak sendiri. */
export function tautanWhatsapp(noHp: string | null, teks: string): string {
  const nomor = noHp?.replace(/\D/g, "").replace(/^0/, "62");
  return `https://wa.me/${nomor ?? ""}?text=${encodeURIComponent(teks)}`;
}
