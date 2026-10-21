# Pembaruan status sekolah tahunan

Keputusan Reno (21 Okt 2026): yang bertanggung jawab memperbarui status
sekolah tiap tahun ajaran baru (sekitar Juli) adalah **admin kelompok**
untuk jamaah kelompoknya. Usulan di bawah **disetujui Reno (21 Okt 2026)**
dan dikerjakan lewat migrasi `20261022060000_kenaikan_kelas` (lihat
"Implementasi" di akhir).

## Masalahnya sekarang

Kategori jamaah (caberawit, pra-remaja, remaja muda, dst.) dihitung dari
`status_sekolah`. Tanpa data kelas, setiap Juli admin harus memeriksa satu
per satu siapa yang lulus SD → SMP, SMP → SMA, SMA → kuliah/bekerja. Mudah
terlewat, dan kategori (termasuk siapa yang dianggap generus) jadi salah.

## Usulan: kolom `kelas` + "Kenaikan kelas" sekali klik

1. **Kolom `kelas` opsional** di `jamaah` (angka 1–12, hanya untuk SD/SMP/
   SMA). SD 1–6, SMP 7–9, SMA/SMK 10–12. Diisi saat tambah/ubah jamaah;
   generus bisa melaporkannya lewat "Lapor data salah".
2. **Halaman Kenaikan kelas** (mulai 1 Juli, untuk admin kelompok):
   - Daftar jamaah bersekolah di kelompoknya, dengan usulan otomatis:
     kelas +1; kelas 6 → SMP kelas 7; kelas 9 → SMA kelas 10;
     kelas 12 → **lulus** (admin memilih: kuliah / bekerja / lainnya).
   - Centang "tinggal kelas" bila perlu, lalu **Terapkan** sekali klik.
     Kategori otomatis ikut menyesuaikan.
   - Jamaah tanpa data kelas ditandai "kelas belum diisi" supaya bisa
     dilengkapi saat itu juga.
3. **Pengingat** di Dashboard admin kelompok setiap Juli sampai kenaikan
   kelas tahun itu selesai; tercatat siapa dan kapan menerapkannya.
4. PAUD/TK → SD tetap pilihan manual (umur masuk SD berbeda-beda).

Perubahan: satu migrasi kecil (kolom `kelas` + catatan kenaikan per tahun
per kelompok), halaman baru, dan isian kelas di form jamaah.

## Implementasi

- **Database**: `jamaah.kelas` (1–12, dijaga sesuai jenjang) dan
  `jamaah.kelas_tahun` (tahun ajaran yang dirujuk kelas itu; tahun Juli-nya).
  Trigger `atur_kelas` mengosongkan kelas bila bukan lagi SD/SMP/SMA dan
  mengisi `kelas_tahun` otomatis saat kelas diubah. `private.tahun_ajaran`
  sama dengan `tahunAjaran()` di aplikasi.
- **RPC `terapkan_kenaikan_kelas(kelompok, perubahan)`**: security invoker
  (tetap RLS `jamaah_update`), satu transaksi, hanya jamaah yang kelasnya
  belum untuk tahun ajaran berjalan, jadi **tidak pernah naik dua kali**
  kapan pun datanya diisi. Dicatat di `kenaikan_kelas` (kelompok, tahun,
  jumlah, siapa, kapan).
- **Aplikasi**: isian Kelas di form jamaah (muncul untuk SD/SMP/SMA);
  halaman **Jamaah → Kenaikan kelas** (`/jamaah/kenaikan-kelas`, izin
  `jamaah.ubah` per kelompok); pengingat di Beranda Juli–September bila
  masih ada yang belum dinaikkan. Logika pilihan di `src/lib/jamaah/kenaikan.ts`
  (murni), data di `kenaikan-data.ts`, aksi di `kenaikan-actions.ts`.
- Belum: generus melaporkan kelas lewat "Lapor data salah" tetap berupa
  laporan teks biasa (admin yang mengisi kelasnya).
