# Panel pengembang

Status: **usulan**. Migrasi `supabase/migrations/20261021090000_panel_pengembang.sql`
diterapkan ke produksi hanya setelah Reno menjawab "OK, jalankan".
Kode aplikasinya aman di-merge lebih dulu: selama tabelnya belum ada,
aplikasi berjalan normal (tidak dalam mode perawatan, tanpa pengumuman), dan
Panel pengembang menampilkan pesan bahwa migrasi belum diterapkan.

## Isi

| Bagian | Lokasi | Izin |
|---|---|---|
| Mode perawatan | Pengaturan → Panel pengembang | `sistem.kelola` |
| Saklar fitur per kelompok | Pengaturan → Panel pengembang | `sistem.kelola` |
| Info sistem | Pengaturan → Panel pengembang | `sistem.kelola` |
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
