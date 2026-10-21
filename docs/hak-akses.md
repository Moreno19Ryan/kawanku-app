# Hak akses per peran (DRAF untuk dicocokkan dengan pengurus)

Disusun Reno & Claude, 21 Okt 2026, dari pemetaan yang **benar-benar berlaku
di produksi** (`peran_izin`). Tujuannya: dibaca pengurus, lalu ditandai mana
yang sudah pas, mana yang kurang, dan mana yang salah. Semua bisa diubah
lewat data (Pengaturan → Peran & izin) tanpa mengubah kode.

Dua sumbu yang selalu berlaku:

- **Wilayah**: penugasan tingkat desa (semua kelompok) atau satu kelompok.
- **Sasaran**: peran khusus generus (admin generus) hanya melihat/mengubah
  jamaah berkategori generus.

Keterangan: ✅ boleh · 👁 hanya lihat · — tidak.

## 1. Data jamaah

| Hal | Admin desa | Admin kelompok | Admin generus | Pengembang | Akun generus |
| --- | :---: | :---: | :---: | :---: | :---: |
| Lihat profil jamaah | ✅ semua | ✅ kelompoknya | ✅ generus di wilayahnya | 👁 semua | 👁 dirinya |
| Tambah jamaah | ✅ | ✅ | — | — | — |
| Ubah profil jamaah | ✅ | ✅ | ✅ (tetap generus) | — | nama panggilan saja |
| Hapus permanen | ✅ | — | — | — | — |
| Nonaktifkan (pindah/wafat) | ✅ | ✅ | ✅ | — | — |
| Laporan data salah dari generus | ✅ menangani | ✅ menangani | ✅ menangani | 👁 | ✅ mengirim |

## 2. Data sensitif (tabel terpisah)

| Hal | Admin desa | Admin kelompok | Admin generus | Pengembang | Akun generus |
| --- | :---: | :---: | :---: | :---: | :---: |
| No. HP, HP wali, email | ✅ | ✅ | 👁 | — | ✅ HP & email sendiri |
| Nama orang tua & alamat | ✅ | ✅ | — | — | ✅ alamat sendiri |
| NIK & No. KK | ✅ | — | — | — | — |
| Keterangan janda/duda | ✅ | — | — | — | — |
| Penanda keringanan (tanpa HP) | ✅ | ✅ | ✅ | — | — (tidak terlihat) |

## 3. Keluarga

| Hal | Admin desa | Admin kelompok | Admin generus | Pengembang |
| --- | :---: | :---: | :---: | :---: |
| Lihat keluarga | ✅ | ✅ | — | 👁 |
| Kelola keluarga & hubungan | ✅ | ✅ | — | — |

## 4. Absensi

| Hal | Admin desa | Admin kelompok | Admin generus | Pengembang | Akun generus |
| --- | :---: | :---: | :---: | :---: | :---: |
| Lihat sesi & rekap | ✅ semua | ✅ kelompoknya + sesi desa | ✅ generus | 👁 (tanpa ekspor) | 👁 riwayatnya |
| Buat sesi, scan, catat izin/sakit | ✅ | ✅ | ✅ sesi generus | — | — |
| Kartu QR fisik | ✅ | ✅ | ✅ | — | — |
| Akun generus (buat, PIN, kunci) | ✅ | ✅ | ✅ | — | ganti PIN sendiri |
| Setujui pengajuan izin | ✅ | ✅ | ✅ | 👁 | ✅ mengajukan |

## 5. Kegiatan

| Hal | Admin desa | Admin kelompok | Admin generus | Pengembang | Akun generus |
| --- | :---: | :---: | :---: | :---: | :---: |
| Lihat jadwal & pertemuan | ✅ | ✅ | ✅ | 👁 | 👁 jadwalnya |
| Buat kegiatan & jadwal | ✅ desa/serentak/kelompok | ✅ kelompoknya | ✅ kegiatan generus | — | — |
| Isi pemateri/materi, batal, pindah | ✅ | ✅ kelompoknya | ✅ kegiatan generus | — | — |
| Pengumuman untuk generus | ✅ | ✅ kelompoknya | ✅ | (lewat pengumuman sistem) | 👁 |

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

1. Admin kelompok **belum** bisa menghapus jamaah permanen (hanya
   menonaktifkan). Sudah pas?
2. Admin generus **tidak** melihat nama orang tua & alamat, tapi melihat no.
   HP. Perlu melihat alamat (mis. untuk kunjungan/silaturahim)?
3. Admin generus **tidak** melihat data keluarga. Perlu?
4. Admin kelompok **tidak** melihat NIK/No. KK dan keterangan janda/duda.
   Sudah pas?
5. Pengembang hanya melihat data jamaah (tanpa ekspor) untuk keperluan
   perbaikan sistem. Sudah pas?
6. Perlu peran baru? Mis. **pemateri/muballigh** (mengisi materi & capaian
   tanpa akses data pribadi) atau **ketua/pengurus kelompok** (hanya lihat
   & rekap).
