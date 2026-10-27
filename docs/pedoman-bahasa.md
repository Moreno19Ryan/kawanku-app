# Pedoman Bahasa KawanKu

Disepakati Reno, 27 Okt 2026. Berlaku untuk **semua teks aplikasi**: judul,
tombol, label, pesan galat, pengingat, sapaan Asisten, notifikasi HP,
dokumen cetak, dan pesan dari server/database.

## Karakter

KawanKu berbicara seperti **seorang generus yang baik hati, berakhlak, dan
santun**:

- **Sopan dan santun**: meminta dengan "silakan", "mohon", "boleh dibantu…";
  bukan perintah.
- **Rendah hati**: mengakui bila sistem yang keliru ("Mohon maaf, …").
- **Ramah, tidak berlebihan**: hangat, tapi tidak lebay; tanda seru
  secukupnya; tanpa emoji.
- **Jujur dan jelas**: menyebut apa yang terjadi dan apa langkah
  berikutnya; tidak mengarang angka atau janji.
- **Tidak menyalahkan**: "belum cocok", "belum lengkap", bukan "salah",
  "gagal karena kamu".
- **Tidak menggurui**: mengajak, bukan menegur atau menghakimi.

## Kata ganti

| Untuk | Kata ganti | Contoh |
| ----- | ---------- | ------ |
| Generus (area `/saya`, `/masuk`) | **kamu** / **-mu** (hangat, sebaya) | "Semoga sudah sehat, ya." · "Ketik PIN-mu." |
| Admin & pengurus (area admin, `/login`) | **tanpa kata ganti** (kalimat netral) | "Lupa kata sandi? Silakan minta atur ulang ke admin pengelola akun." |
| Umum / banyak orang (laporan, cetak, pengumuman) | tanpa kata ganti, atau "jamaah" | "Alhamdulillah Jazakumullahu Khoiro atas kehadiran para jamaah." |

Di area admin **jangan** memakai "kamu", "-mu", "Anda", atau "Bapak/Ibu".
Ubah kalimatnya menjadi netral: "akunmu" → "akun ini" / "akun yang
dipakai"; "kelompokmu" → "kelompok yang dikelola".

## Pola kalimat

**Galat / tidak berhasil**: (maaf bila dari sistem) + apa yang terjadi +
langkah berikutnya.

| Hindari | Gunakan |
| ------- | ------- |
| Username atau PIN salah. | Mohon maaf, username atau PIN belum cocok. Silakan dicoba lagi. |
| Gagal terhubung. | Mohon maaf, koneksi sedang terputus. Silakan periksa internet, lalu coba lagi. |
| Isi email dan kata sandi. | Mohon isi email dan kata sandi terlebih dahulu. |
| Akun ini bukan admin aktif. | Akun ini belum terdaftar sebagai admin aktif. Silakan hubungi admin desa. |

**Meminta / mengarahkan**: "Silakan …", "Mohon …", "Boleh dibantu …".

**Pengingat**: mengajak dan mendoakan, bukan menegur.

| Hindari | Gunakan |
| ------- | ------- |
| Kamu tidak hadir 3 kali. | Kami rindu kehadiranmu. InsyaAllah sampai jumpa di pengajian berikutnya. |
| Data belum lengkap! | Masih ada data yang belum lengkap. Boleh dilengkapi bila sempat. |

**Berhasil**: singkat dan bersyukur seperlunya ("Alhamdulillah, tersimpan.").

## Ucapan syukur & istilah

- Terima kasih selalu dengan bentuk baku (lihat CLAUDE.md, *Gaya bahasa*):
  laki-laki **Alhamdulillah Jazakallahu Khoiro**, perempuan **Alhamdulillah
  Jazakillahu Khoiro**, umum **Alhamdulillah Jazakumullahu Khoiro**
  (`ucapanSyukur()` di `src/lib/label.ts`).
- *Assalamu'alaikum*, *Alhamdulillah*, *InsyaAllah*, *MasyaAllah* dipakai
  pada tempatnya, tidak di setiap kalimat.
- Isi keagamaan (doa panjang, dalil, nasihat) tidak ditulis aplikasi; bila
  perlu, disediakan pengurus.
- Istilah baku: **Jamaah**, **generus**, **pengajian**, **pertemuan**.

## Ejaan & tanda baca

- Ejaan baku (EYD): *silakan* (bukan *silahkan*), *praktik*, *antre*,
  *mengubah*.
- Huruf kapital hanya di awal kalimat/judul dan nama diri ("Masuk sebagai
  admin", bukan "Masuk Sebagai Admin").
- Tombol memakai kata kerja singkat: *Masuk*, *Simpan*, *Kirim izin*.
- Angka & waktu: "pukul 19.30 WIB", "5 menit", "3 pertemuan".
- Tidak memakai singkatan gaul ("gk", "udh", "yg").

## Cara menerapkan

- Teks baru mengikuti pedoman ini sejak awal.
- Perubahan teks yang sudah ada diusulkan dulu ke Reno (daftar teks lama →
  usulan), baru diterapkan.
