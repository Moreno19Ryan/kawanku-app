# Cadangan data (F3)

Keputusan Reno (26 Okt 2026): admin desa dan admin kelompok bisa mengunduh
cadangan data wilayahnya untuk arsip pengurus.

## Isi & bentuk

- Satu file **Excel (.xlsx)**, lembar: Info (kop, wilayah, waktu, pengunduh,
  jumlah baris), Jamaah, Kontak, Alamat & orang tua, Keluarga, Kegiatan
  (dengan jadwal & jendela absensi), Absensi.
- **Tanpa NIK/No. KK** (tetap hanya lewat permintaan yang disetujui
  pengembang). Kontak dan alamat ikut.
- Isi dibaca dengan sesi pengguna (**RLS**), jadi tidak pernah melebihi
  wewenangnya. Seluruh desa = semua kelompok; kelompok = jamaah, keluarga,
  dan absensi kelompok itu, plus kegiatan kelompok & desa.

## Hak akses

- Izin `cadangan.unduh` (data, bukan kode): admin desa & admin kelompok.
  Admin generus dan pengembang **tidak** bisa mengunduh.
- Penugasan desa → pilihan "Seluruh desa" dan tiap kelompok; penugasan
  kelompok → kelompoknya.

## Catatan unduhan

- Setiap unduhan dicatat di `unduhan_cadangan` (oleh, wilayah, jumlah baris
  per lembar) **sebelum** file diberikan; gagal mencatat = file tidak
  diberikan. Catatan tidak bisa diubah/dihapus dari aplikasi.
- Pengunduh melihat riwayatnya di Pengaturan → Cadangan data. Pengembang
  melihat semua di Panel pengembang dan mendapat kartu pengingat di Beranda
  untuk unduhan 24 jam terakhir.

## Kode

- Migrasi `supabase/migrations/20261027100000_cadangan_data.sql`, tes
  `supabase/tests/cadangan_data.test.sql`.
- `src/lib/cadangan/buat.ts` (`getWilayahCadangan`, `buatCadangan`, exceljs),
  `src/app/api/cadangan/route.ts` (GET `?wilayah=desa|<id kelompok>`),
  `src/app/(app)/pengaturan/cadangan/page.tsx`.
