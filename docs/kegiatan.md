# Kegiatan (Fase 3)

Fase 3 dikerjakan bertahap:

- **3a (dokumen ini)**: kegiatan rutin berjadwal & agenda, pertemuan
  (pemateri, materi, libur/batal, pindah waktu), dan buka absensi dari
  pertemuan.
- **3b**: laporan & monitoring kehadiran (tren, per kegiatan/kelompok/jamaah).
- **3c**: target hafalan / capaian materi caberawit & generus (opsional).

Migrasi: `supabase/migrations/20261021220000_kegiatan_rutin.sql`.
Tes: `supabase/tests/kegiatan_rls.test.sql`.

## Keputusan (Reno, 21 Okt 2026)

- **Pengajian rutin sambung kelompok**: di setiap kelompok, Minggu
  dan Selasa malam pukul 20.00 WIB. Sejak 26 Okt 2026 menjadi **satu
  kegiatan per kelompok** (dikelola kelompoknya masing-masing). Pemateri dan materinya berbeda di tiap
  kelompok. Minggu ke-3 setiap bulan libur (Hari Keluarga se-Daerah).
- **Pengajian rutin sambung desa**: Kamis malam pukul 20.00 WIB.
- **Jadwal bisa berubah sewaktu-waktu** sesuai musyawarah pengurus.
- **Pembuat kegiatan** sesuai wilayah, sama dengan sesi absensi. Generus
  bisa melihat jadwalnya di akun mereka.

## Model

- **`kegiatan`**: `jenis` = `rutin` atau `agenda`; `kelompok_id` kosong berarti
  tingkat desa. Kolom lama `per_kelompok` (serentak) tidak dipakai lagi:
  dicegah constraint `kegiatan_tanpa_serentak` (migrasi
  `20261026100000_wewenang_wilayah` memecah kegiatan serentak menjadi satu
  kegiatan per kelompok, jadwal disalin, pertemuan & izin dipindah). Juga ada `hanya_generus`, `lokasi`, `durasi_menit`,
  `aktif`, dan masa berlaku.
- **`kegiatan_jadwal`**: hari (0 = Minggu), jam, dan `kecuali_pekan_ke` (pekan
  libur dalam bulan; pekan ke-3 = tanggal 15–21).
- **`pertemuan`**: satu kejadian, dengan kunci (kegiatan, kelompok, tanggal
  jadwal).
  - `mulai` bisa dipindah. Status `terjadwal` atau `dibatalkan` + alasan.
  - Pemateri: satu pertemuan bisa berisi beberapa sesi (`pertemuan_materi`:
    urutan, pemateri, materi), ditulis sekaligus lewat RPC
    `simpan_materi_pertemuan` (security invoker). Pemateri dipilih dari daftar
    **pengajar rutin** (`pengajar`, per kelompok atau seluruh desa), jamaah
    berstatus muballigh/ot, atau diketik. `pemateri_nama`/`materi`/
    `pemateri_jamaah_id` di `pertemuan` adalah ringkasan otomatis (dipakai
    kalender, jadwal generus, asisten). Migrasi `20261022140000_pengajar_pemateri`.
  - Juga menyimpan materi, catatan, dan `sesi_id` (absensi).
- **Kalender rutin dihitung dari aturan jadwal** (`src/lib/kegiatan/jadwal.ts`,
  fungsi murni). Baris `pertemuan` baru dibuat bila ada isian. Mengubah jadwal
  langsung mengubah kalender, dan pertemuan yang sudah tersimpan tetap ada.
- **`buka_absensi_pertemuan()`**: membuat sesi absensi untuk pertemuan
  (nama = nama kegiatan) lalu menautkannya. Kalau dipanggil lagi,
  hasilnya sesi yang sama. Sejak 24 Okt 2026 absensi **terikat** pada
  pertemuan: libur menghapus absensinya, pindah waktu menggeser waktunya,
  ganti nama kegiatan mengganti nama sesinya, dan kegiatan yang pernah
  diabsen tidak bisa dihapus (nonaktifkan saja). Detail di `docs/absensi.md`
  bagian "Terikat pertemuan".
- **Data awal**: dua kegiatan rutin di atas, bisa diubah lewat aplikasi.

## Hak akses (RLS)

| | Lihat | Kelola kegiatan | Isi pertemuan |
| - | --- | --- | --- |
| Admin desa | semua | kegiatan desa saja | kegiatan desa |
| Admin kelompok | desa + kelompoknya | kelompoknya | kelompoknya |
| Admin generus | desa + wilayahnya | kegiatan generus di wilayahnya | kegiatan generus |
| Pengembang | semua (hanya lihat) | - | - |
| Akun generus | desa + kelompoknya | - | - |

Kelola **tepat di wilayahnya** (`private.boleh_kelola_wilayah`, sejak
26 Okt 2026): penugasan desa hanya kegiatan desa, penugasan kelompok hanya
kegiatan kelompok itu. Sama untuk pengajar & pengumuman generus.

Izin: `kegiatan.lihat`, `kegiatan.kelola`. Membuka absensi juga butuh
`absensi.kelola` di wilayahnya.

## Aplikasi

- **`/kegiatan`** (menu Kegiatan, saklar fitur `kegiatan`):
  - agenda 7/14/30 hari, dikelompokkan per tanggal;
  - kartu "Berikutnya";
  - pengingat pertemuan pekan ini yang belum ada pematerinya.
- **`/kegiatan/pertemuan?k=&kel=&t=`**:
  - isi sesi-sesi pemateri & materi ("Tambah pemateri / sesi"), catatan, dan
    pindah waktu; pemateri tetap diisi admin per pertemuan;
  - tandai libur/batal (dengan alasan cepat; bila absensi sudah berisi
    catatan, minta konfirmasi karena absensinya ikut terhapus) atau aktifkan
    lagi;
  - buka atau lihat absensi.
- **`/kegiatan/pengajar`**: daftar pengajar rutin (tambah, nonaktifkan,
  hapus) per wilayah; pengajar nonaktif tidak muncul di pilihan pemateri.
- **`/kegiatan/kelola`**: daftar kegiatan dan form buat (rutin dengan editor
  jadwal, atau agenda). Di `[id]`: ubah data, ubah jadwal, pertemuan 5 pekan ke
  depan, hapus (atau nonaktifkan bila sudah punya riwayat absensi).
- **`/saya`** (generus): jadwal 7 hari ke depan.

## Beranda generus (21 Okt 2026)

Migrasi `20261022040000_beranda_generus`. Akun generus tidak polos: beranda
menampilkan pengumuman, pertemuan berikutnya (pemateri & materi), statistik
kehadiran, lencana, jadwal 7 hari, dan riwayat. Menu bawah: Beranda · Jadwal ·
Scan · Kehadiran · Profil.

- **Statistik & lencana** hanya data dirinya sendiri, dari RPC
  `kehadiran_saya(p_batas)` (security definer, hanya `jamaah_saya()`): sesi
  tempat ia menjadi peserta sejak profilnya ada, berstatus hadir / izin /
  sakit / `alpa` (sesi selesai tanpa catatan) / `berjalan`. Perhitungan di
  `src/lib/generus/kehadiran.ts` (murni):
  - persentase hadir bulan ini (WIB);
  - rentetan hadir beruntun (izin/sakit tidak memutus, terlewat memutus);
  - lencana: rentetan 3/5/10, hadir penuh bulan lalu (≥2 pertemuan),
    10/25/50/100 kehadiran, "Amanah" (bulan ini ≥3 pertemuan, tidak ada yang
    terlewat, pernah izin/sakit);
  - sapaan yang menyesuaikan (sambutan, ajakan kembali hadir, apresiasi).
  Tidak ada peringkat antar teman.
- **Pengumuman bersasaran**: `pengumuman.sasaran` (`admin` / `generus` /
  `semua`) + `kelompok_id` (kosong = seluruh desa). Pengumuman sistem
  (`pengumuman.kelola`, pengembang) di Pengaturan → Pengumuman; pengurus
  kegiatan (`kegiatan.kelola`) menulis pengumuman **untuk generus** di
  wilayahnya di `/kegiatan/pengumuman`. Akun generus hanya membaca pengumuman
  generus/semua di desa atau kelompoknya; banner admin hanya admin/semua.
  Bila isi pengumuman generus tampak mengabarkan perubahan jadwal (pindah,
  libur, batal, diundur, …; `sepertiPerubahanJadwal()` di
  `src/lib/kegiatan/pengumuman.ts`), form mengingatkan pengurus mengubah
  pertemuannya juga, supaya jadwal di HP generus tidak bertentangan.
- **Jadwal** `/saya/jadwal`: 30 hari, pemateri & materi bila sudah diisi,
  tautan "Izin" per pertemuan yang belum lewat.

## Rekap pengajar (F4, 26 Okt 2026)

Di `/kegiatan/pengajar` ada "Rekap pengajar" per bulan (pilihan 12 bulan
terakhir): pemateri, jumlah sesi (dan pertemuan bila berbeda), kegiatan,
wilayah, dan materi terakhir. Dihitung dari `pertemuan_materi` (atau
ringkasan `pertemuan.pemateri_nama` untuk pertemuan lama) pada pertemuan
terjadwal yang sudah berlangsung; libur tidak dihitung. Batas data RLS
`kegiatan.lihat`. Rekap yang sama muncul di laporan bulanan.
