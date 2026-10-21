# Absensi (Fase 2)

Fase 2 dikerjakan bertahap:

- **2a (dokumen ini)**: sesi absensi, kartu QR (jalur 1), catat manual
  (kode, izin, sakit), dan rekap.
- **2b**: akun generus (username + PIN) dan QR layar berganti tiap menit
  (jalur 2).

Migrasi: `supabase/migrations/20261021180000_absensi_kartu_qr.sql`.
Tes: `supabase/tests/absensi_rls.test.sql`.

## Keputusan (Reno, 21 Okt 2026)

| Hal | Keputusan |
| --- | --- |
| Sasaran | Semua jamaah (kartu QR untuk semua). Jalur 2 khusus generus (2b). |
| Status | Hadir, izin (kuliah / kerja / lainnya), sakit. Tanpa keterangan bebas, karena data kesehatan tidak disimpan. |
| Pembuat sesi | Sesuai wilayah: admin desa (desa / kelompok mana pun), admin kelompok (kelompoknya), admin generus (sesi generus di wilayahnya). |
| Tahapan | 2a lalu 2b, masing-masing satu migrasi + PR. |

## Tabel

- **`sesi_absensi`**: satu kegiatan yang diabsen.
  - `kelompok_id` kosong berarti tingkat desa (peserta dari semua kelompok).
  - `hanya_generus` = sesi khusus generus.
  - `ditutup`: setelah ditutup, scan kartu ditolak, tapi koreksi manual tetap
    boleh.
  - Wilayah/sasaran terkunci setelah ada catatan.
- **`kartu_qr`**: token acak 16 karakter (≈79 bit), terpisah dari `jamaah.kode`.
  - Satu kartu aktif per jamaah.
  - Kartu yang hilang **diganti**: kartu lama dicabut dan tetap tersimpan
    sebagai riwayat. Tidak ada hapus.
  - Token dibuat server dan tidak bisa diubah.
- **`absensi`**: satu catatan per (sesi, jamaah), lewat `unique`, jadi scan
  ulang atau dua admin yang scan bersamaan tidak menggandakan catatan.
  - `status` hadir/izin/sakit; `alasan_izin` wajib untuk izin dan hanya untuk
    izin.
  - `jalur`: `kartu`, `manual`, atau `layar` (2b).
  - Trigger memastikan jamaahnya aktif dan termasuk peserta: kelompok cocok,
    dan untuk sesi generus harus generus.

Jamaah yang tidak tercatat dihitung **belum tercatat** (tidak hadir) di rekap.
Peserta dihitung saat dibuka: jamaah aktif di wilayah sesi, plus jamaah yang
sudah punya catatan.

## Hak akses (RLS)

| | Lihat sesi | Kelola sesi | Catat | Token kartu |
| - | --- | --- | --- | --- |
| Izin | `absensi.lihat` | `absensi.kelola` | `absensi.kelola` | `absensi.kelola` |
| Admin desa | semua | semua | semua jamaah | semua |
| Admin kelompok | kelompoknya + sesi desa | kelompoknya | jamaah kelompoknya (juga di sesi desa) | kelompoknya |
| Admin generus | wilayahnya + sesi desa | sesi generus di wilayahnya | generus di wilayahnya | generus |
| Pengembang | semua (hanya lihat) | - | - | - |

- Catatan absensi yang terlihat dibatasi per jamaah (`boleh_jamaah`), jadi
  admin generus hanya melihat catatan generus.
- Penanda keringanan tetap di `jamaah_keringanan` (izin `keringanan.lihat`).
  Penanda ini ditampilkan di hasil scan dan rekap, tetapi **tidak dicetak di
  kartu**.

## Alur di aplikasi

1. **Absensi → Buat sesi** (nama, wilayah, peserta, mulai/selesai).
2. **Absensi → Kartu QR**:
   - "Buat kartu yang belum ada" per kelompok.
   - "Cetak semua" membuka lembar A4 berisi 2 × 5 kartu ukuran KTP dengan kop
     desa. Cetak dengan skala 100%.
   - "Ganti kartu" bila kartu hilang atau rusak.
3. **Halaman sesi**: fokus di kolom scan, lalu scan kartu dengan scanner
   barcode USB (scanner mengetik token lalu Enter).
   - Kode jamaah `KW-XXXXXX` yang tercetak di kartu bisa diketik bila scan
     gagal.
   - Hasilnya tampil besar, berwarna, dan berbunyi (nada tinggi; bisa
     dimatikan):

     | Hasil | Bunyi | Layar |
     | --- | --- | --- |
     | Tercatat | 1 beep pendek | Hijau: "Alhamdulillah, kamu sudah tercatat hadir" |
     | Sudah absen | 2 beep pendek | Biru: "Alhamdulillah, kamu sudah absen sebelumnya" + jam scan pertama |
     | Gagal | 1 beep panjang | Merah, beserta alasannya |

   - Scan ulang tidak mengubah catatan: yang tersimpan tetap waktu scan
     pertama. Keterangan telat ditunda.
4. **Daftar peserta**: ubah status (hadir / izin: kuliah, kerja, lainnya /
   sakit / belum tercatat).
5. **Tutup sesi** setelah selesai.

Hasil `catat_absensi_kode`:

| Hasil | Arti |
| --- | --- |
| `tercatat` | Hadir, tercatat |
| `sudah` | Sudah tercatat sebelumnya |
| `tidak_dikenal` | Kode tidak dikenal, termasuk jamaah di luar wewenang |
| `kartu_dicabut` | Kartu sudah dicabut |
| `sesi_ditutup` | Sesi sudah ditutup |
| `bukan_peserta` | Bukan peserta sesi |
| `jamaah_nonaktif` | Jamaah nonaktif |
| `tidak_berhak` | Di luar wewenang |

## Saklar fitur

Modul dibuka per kelompok lewat saklar `absensi` di panel pengembang, sama
seperti modul Jamaah. Setelah migrasi diterapkan, nyalakan saklar itu (mis.
Kelompok 1 dulu).

## Belum (berikutnya)

- 2b: akun generus + QR layar berputar (jalur 2).
- Cetak/ekspor rekap absensi (wajib `KopDokumen`).
