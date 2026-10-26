# Tempat sampah 30 hari (F6b)

Jamaah, keluarga, dan kegiatan yang dihapus tidak langsung hilang. Data itu
beserta semua yang ikut terhapus disimpan 30 hari di **Pengaturan → Tempat
sampah**, lalu terhapus permanen otomatis (pg_cron `kawanku-tempat-sampah`,
03.00 WIB). Yang ikut tersimpan, misalnya: kontak, alamat, NIK/KK, absensi,
kartu QR, akun generus, izin, pertemuan, jadwal, dan materi.

| Yang dihapus | Yang bisa melihat & mengembalikan |
| ------------ | --------------------------------- |
| Jamaah | pemegang `jamaah.hapus` di kelompoknya (admin kelompok) |
| Keluarga | pemegang `keluarga.kelola` di kelompoknya |
| Kegiatan | pengelola kegiatan di wilayahnya (`kegiatan.kelola`, tepat wilayah) |

- **Kembalikan**: semua baris disisipkan ulang apa adanya (kode `KW-`,
  status izin, waktu absensi tetap seperti semula). Bila data induknya sudah
  tidak ada (mis. keluarganya juga dihapus), kembalikan induknya dulu.
  Keluarga yang dikembalikan memasang lagi anggotanya (bila belum pindah
  keluarga/kelompok).
- **Hapus permanen**: langsung, tanpa menunggu 30 hari.

## Teknis

Migrasi `20261029100000_tempat_sampah`:

- `public.tempat_sampah` (entri; RLS `private.boleh_sampah`) dan
  `private.tempat_sampah_isi` (baris JSON, urutan terhapus).
- Trigger BEFORE DELETE `ke_tempat_sampah` di `jamaah`, `keluarga`,
  `kegiatan` membuat entri dan penanda transaksi `kawanku.sampah`; trigger
  AFTER DELETE `catat_ikut_terhapus` di tabel anak mencatat baris cascade.
  Tabel anak baru yang ber-FK cascade ke ketiga tabel itu → tambahkan
  triggernya.
- `kembalikan_dari_sampah()` menyisipkan dengan
  `session_replication_role = replica` (trigger tidak mengubah data lama) dan
  memeriksa induk sendiri (`private.induk_ada`). Baris utama gagal → semua
  dibatalkan; baris anak yang induknya hilang dilewati dan dilaporkan.
- Batasan: menghapus banyak akar dalam satu pernyataan SQL menaruh semua
  anak di entri terakhir (aplikasi selalu menghapus satu per satu).
