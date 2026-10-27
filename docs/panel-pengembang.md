# Panel pengembang

Status: **di produksi** (migrasi awal `20261021090000_panel_pengembang`).
Ruang kendali tahap 1 (kesehatan sistem & tugas otomatis): migrasi
`20261101090000_ruang_kendali`, diterapkan setelah "OK, jalankan".

## Isi

| Bagian | Lokasi | Izin |
|---|---|---|
| Mode perawatan | Pengaturan → Panel pengembang | `sistem.kelola` |
| Saklar fitur per kelompok | Pengaturan → Panel pengembang | `sistem.kelola` |
| Info sistem | Pengaturan → Panel pengembang | `sistem.kelola` |
| Kesehatan sistem | Pengaturan → Panel pengembang | `sistem.kelola` |
| Tugas otomatis | Pengaturan → Panel pengembang | `sistem.kelola` |
| Pengumuman (banner) | Pengaturan → Pengumuman | `pengumuman.kelola` (baru) |

`pengumuman.kelola` awalnya hanya dipegang peran Pengembang. Izin ini bisa
diberikan ke peran lain (mis. admin desa) lewat data, tanpa migrasi.

### Mode perawatan
- Satu saklar, pesan opsional, dan perkiraan selesai (WIB).
- Halaman login tetap bisa dipakai. Setelah login, admin selain pengembang
  hanya melihat halaman "Sedang perawatan" (dengan tombol Keluar).
  Pengembang tetap bisa bekerja dan melihat pengingat di atas halaman.
- **Cadangan darurat**: env `MODE_PERAWATAN=1` di Vercel (lalu redeploy)
  memaksa mode perawatan walau database bermasalah.
- Ini gerbang tampilan. Batas akses data tetap RLS.

### Pengumuman
- Pesan (maks. 300 karakter), jenis info/peringatan, waktu mulai dan
  berakhir (opsional, WIB).
- Tampil sebagai banner di atas semua halaman area admin, maksimal 3 yang
  sedang tayang. Bisa ditutup per sesi.
- Status di daftar: Tayang, Terjadwal, Berakhir, Disembunyikan.

### Saklar fitur
- Tabel `fitur` (jamaah, kegiatan, absensi; semua mati) dan `fitur_kelompok`.
- Fitur menyala untuk sebuah kelompok bila `aktif` dan (`semua_kelompok`
  atau kelompok itu dipilih). Admin tingkat desa: menyala bila aktif di
  kelompok mana pun. Helper: `fiturMenyala()` di `src/lib/sistem/data.ts`.
- Modul yang belum dibangun tetap tampil "Segera" di menu walau
  dinyalakan. Saklar mulai berpengaruh saat modulnya selesai (mis. halaman
  Jamaah untuk trial Kelompok 1).

### Kesehatan sistem (migrasi `20261101090000_ruang_kendali`)
Satu kartu hijau/kuning/merah dari RPC `kesehatan_sistem()`: tugas otomatis
(gagal/macet/dimatikan), notifikasi HP (langganan, terkirim, gagal kirim ke
server aplikasi), cadangan (terakhir berhasil, gagal 7 hari), ruang database
(dari 500 MB), dan galat yang belum dicek. Aturan penilaiannya ada di
`src/lib/sistem/kesehatan.ts` (murni).

### Tugas otomatis
Daftar tugas pg_cron KawanKu (`kawanku-*`) dengan jalan terakhir, jumlah
jalan/gagal 24 jam, dan pesan galatnya. Tombol **Jalankan sekarang**
(`jalankan_tugas`; cadangan = cadangan manual) dan **Matikan/Nyalakan**
(`atur_tugas`). Tugas baru `kawanku-bersihkan` (02.30 WIB) menghapus riwayat
tugas > 7 hari dan catatan notifikasi > 90 hari, supaya ruang database tidak
habis oleh riwayat tugas tiap menit.

### Bantuan akun (Pengaturan → Bantuan akun, migrasi `20261101100000_bantuan_akun`)
Cari akun admin & generus (nama, email, username, kode jamaah) lewat RPC
`cari_akun`: aktif/nonaktif, peran & kelompok, terakhir masuk, PIN terkunci
(5x salah), masih PIN awal, dan jumlah perangkat yang sedang masuk
(`auth.sessions`). Tindakan: **Buka kunci** (`buka_kunci_akun`) dan
**Keluarkan dari semua perangkat** (`keluarkan_akun`: hapus sesi; akun tetap
aktif). Setiap tindakan tercatat di `bantuan_akun_log`. Lupa PIN / kata sandi
tetap lewat halaman yang sudah ada (Kembalikan ke PIN awal, atur ulang kata
sandi), ditautkan dari panduan singkat di halaman ini.

### Info sistem
Lingkungan, region fungsi, commit dan pesannya, waktu build, latensi
database, jumlah admin aktif, dan kapan pengaturan sistem terakhir diubah.

## Database

| Tabel | Baca | Ubah |
|---|---|---|
| `pengaturan_sistem` (satu baris, kolom `tunggal`) | pengguna login | `sistem.kelola` (update saja; tanpa insert/delete) |
| `pengumuman` | pengguna login | `pengumuman.kelola` |
| `fitur`, `fitur_kelompok` | pengguna login | `sistem.kelola` |

`anon` tidak punya akses. Semua tabel memakai RLS, `created_at`/`updated_at`,
dan `updated_by` otomatis lewat trigger.

## Tes

`supabase/tests/sistem_rls.test.sql` berisi 29 skenario: seed, struktur,
admin desa/kelompok ditolak mengubah, pengembang boleh, `updated_by`
terisi, dan anon ditolak. Uji mutasi: melonggarkan policy update
`pengaturan_sistem` dan insert `pengumuman` langsung menggagalkan tesnya.
