# Hak akses per peran (DRAF untuk dicocokkan dengan pengurus)

Disusun Reno & Claude, 21 Okt 2026, dari pemetaan yang **benar-benar berlaku
di produksi** (`peran_izin`). Tujuannya: dibaca pengurus, lalu ditandai mana
yang sudah pas, mana yang kurang, dan mana yang salah. Semua bisa diubah
lewat data (Pengaturan → Peran & izin) tanpa mengubah kode.

Dua sumbu yang selalu berlaku:

- **Wilayah**: penugasan tingkat desa (semua kelompok) atau satu kelompok.
- **Sasaran**: peran khusus generus (admin generus) hanya melihat/mengubah
  jamaah berkategori generus.

**Keputusan Reno, 26 Okt 2026** (bukan trial lagi, migrasi
`20261026100000_wewenang_wilayah`):

- Mengelola data jamaah (tambah, ubah, nonaktifkan, hapus, keluarga, kontak,
  alamat, NIK/KK, janda/duda, keringanan, kenaikan kelas, "sudah dicek")
  **hanya di tingkat kelompok**, karena pengurus kelompoklah yang bertemu
  dan berkomunikasi langsung. Izin seperti ini ditandai "hanya berlaku di
  tingkat kelompok" (`izin.hanya_kelompok`): penugasan desa tidak pernah
  mendapatkannya, walau perannya diberi izin itu. Tingkat desa (termasuk
  admin generus desa) tetap **melihat** semuanya.
- Kegiatan dikelola **tepat di wilayahnya**: kegiatan desa oleh pengurus
  desa, kegiatan kelompok oleh pengurus kelompok itu. Tidak ada lagi
  kegiatan "serentak"; sambung kelompok menjadi satu kegiatan per kelompok.
- Absensi sesi kelompok dicatat pengurus kelompok itu; sesi desa dicatat
  pengurus desa dan pengurus kelompok (untuk jamaahnya sendiri).
- Setiap admin wajib punya minimal satu peran (dijaga database).

Keterangan: ✅ boleh · 👁 hanya lihat · — tidak.

## 1. Data jamaah

| Hal | Admin desa | Admin kelompok | Admin generus | Pengembang | Akun generus |
| --- | :---: | :---: | :---: | :---: | :---: |
| Lihat profil jamaah | ✅ semua | ✅ kelompoknya | ✅ generus di wilayahnya | 👁 semua | 👁 dirinya |
| Tambah jamaah | — | ✅ | — | — | — |
| Ubah profil jamaah | — | ✅ | ✅ kelompok (tetap generus) | — | data diri sendiri |
| Hapus permanen | — | ✅ | — | — | — |
| Nonaktifkan (pindah/wafat) | — | ✅ | ✅ kelompok | — | — |
| Kenaikan kelas tahunan | — | ✅ | ✅ kelompok | — | — |
| Laporan data salah dari generus | 👁 | ✅ menangani | ✅ kelompok | 👁 | ✅ mengirim |

## 2. Data sensitif (tabel terpisah)

| Hal | Admin desa | Admin kelompok | Admin generus | Pengembang | Akun generus |
| --- | :---: | :---: | :---: | :---: | :---: |
| No. HP, HP wali, email | 👁 | ✅ | 👁 | — | ✅ HP & email sendiri |
| Nama orang tua & alamat | 👁 | ✅ | — | — | ✅ alamat sendiri |
| NIK & No. KK | 👁 tersamar | ✅ isi, 👁 tersamar | — | ✅ menyetujui permintaan lihat lengkap | — |
| Keterangan janda/duda | 👁 | ✅ | — | — | — |
| Penanda keringanan (tanpa HP) | 👁 | ✅ | ✅ kelompok | — | — (tidak terlihat) |

## 3. Keluarga

| Hal | Admin desa | Admin kelompok | Admin generus | Pengembang |
| --- | :---: | :---: | :---: | :---: |
| Lihat keluarga | ✅ | ✅ | — | 👁 |
| Kelola keluarga & hubungan | — | ✅ | — | — |

## 4. Absensi

| Hal | Admin desa | Admin kelompok | Admin generus | Pengembang | Akun generus |
| --- | :---: | :---: | :---: | :---: | :---: |
| Lihat sesi & rekap | ✅ semua | ✅ kelompoknya + sesi desa | ✅ generus | 👁 (tanpa ekspor) | 👁 riwayatnya |
| Scan & catat (sesi dibuka otomatis dari pertemuan) | ✅ sesi desa | ✅ sesi kelompoknya + jamaahnya di sesi desa | ✅ generus, sesuai wilayah | — | — |
| Kartu QR fisik | ✅ | ✅ | ✅ | — | — |
| Akun generus (buat, kembalikan ke PIN awal, kunci) | ✅ | ✅ | ✅ | — | ganti PIN sendiri |
| Setujui pengajuan izin | ✅ kegiatan desa | ✅ kegiatan kelompoknya + jamaahnya di kegiatan desa | ✅ generus, sesuai wilayah | 👁 | ✅ mengajukan |

## 5. Kegiatan

| Hal | Admin desa | Admin kelompok | Admin generus | Pengembang | Akun generus |
| --- | :---: | :---: | :---: | :---: | :---: |
| Lihat jadwal & pertemuan | ✅ | ✅ | ✅ | 👁 | 👁 jadwalnya |
| Buat kegiatan & jadwal | ✅ kegiatan desa saja | ✅ kelompoknya | ✅ kegiatan generus di wilayahnya | — | — |
| Isi pemateri/materi, batal, pindah | ✅ kegiatan desa | ✅ kelompoknya | ✅ kegiatan generus di wilayahnya | — | — |
| Daftar pengajar rutin | ✅ desa | ✅ kelompoknya | ✅ wilayahnya | — | — |
| Pengumuman untuk generus | ✅ seluruh desa | ✅ kelompoknya | ✅ wilayahnya | (lewat pengumuman sistem) | 👁 |

## 6. Pengaturan & sistem

| Hal | Admin desa | Admin kelompok | Admin generus | Pengembang |
| --- | :---: | :---: | :---: | :---: |
| Kelola admin, peran & izin | ✅ | admin generus kelompoknya | — | ✅ (pemulihan akses) |
| Kelompok | ✅ | — | — | — |
| Kategori jamaah | ✅ | — | — | — |
| Pengumuman sistem (banner admin) | — | — | — | ✅ |
| Mode perawatan, saklar fitur | — | — | — | ✅ |

## 7. Pertanyaan untuk pengurus

Tandai jawabannya, nanti Claude sesuaikan datanya:

1. ~~Admin kelompok belum bisa menghapus jamaah permanen.~~ Sejak 26 Okt
   2026 admin kelompok yang menghapus (desa tidak lagi).
2. Admin generus **tidak** melihat nama orang tua & alamat, tapi melihat no.
   HP. Perlu melihat alamat (mis. untuk kunjungan/silaturahim)?
3. Admin generus **tidak** melihat data keluarga. Perlu?
4. ~~Admin kelompok tidak melihat NIK/No. KK dan keterangan janda/duda.~~
   Sejak 26 Okt 2026 admin kelompok yang mengisi keduanya (NIK/KK tampil
   tersamar; nomor lengkap perlu persetujuan pengembang).
5. Pengembang hanya melihat data jamaah (tanpa ekspor) untuk keperluan
   perbaikan sistem. Sudah pas?
6. Perlu peran baru? Mis. **pemateri/muballigh** (mengisi materi & capaian
   tanpa akses data pribadi) atau **ketua/pengurus kelompok** (hanya lihat
   & rekap).
