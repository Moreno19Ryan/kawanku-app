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
- **Kartu fisik generus hanya untuk keringanan** (keputusan Reno, 21 Okt 2026;
  migrasi `20261022010000_kartu_fisik_keringanan`). Generus absen lewat akunnya
  (jalur 2). `private.boleh_kartu_fisik(jamaah)` = bukan generus, atau generus
  dengan keringanan aktif. Kartu baru di luar itu ditolak (trigger, hint
  `pakai_akun`), buat massal melewatinya, mencabut keringanan ikut mencabut
  kartu, dan scan kartu lama generus tanpa keringanan menghasilkan
  `pakai_akun`. Mengetik kode `KW-` oleh admin tetap bisa.

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

## Fase 2b: akun generus + QR layar (jalur 2)

Migrasi: `supabase/migrations/20261021200000_akun_generus_qr_layar.sql`.
Tes: `supabase/tests/akun_generus_rls.test.sql`.

### Keputusan (Reno, 21 Okt 2026)

| Hal | Keputusan |
| --- | --- |
| Username | Nama lengkap tanpa spasi/titik, huruf kecil (`abdulazizsyahputra`, maks. 30 karakter). Nama panggilan jadi usulan kedua; admin boleh mengubah. Bila sudah dipakai, ditambah angka (`…2`). |
| PIN awal | Tanggal lahir **DDMMYY**. Wajib diganti saat login pertama, dan tidak boleh tanggal lahir lagi. Tanpa tanggal lahir lengkap → admin mengetik PIN 6 angka. |
| Pengelola | Pengelola absensi wilayahnya (izin `akun_generus.kelola`): admin desa, admin kelompok, admin generus. |
| Isi akun | Absen (scan QR) + riwayat kehadiran sendiri + ganti PIN. |

### Akun

- **`akun_generus`**: satu akun per jamaah generus.
  - `user_id` (Supabase Auth), `username` unik, `aktif`, `pin_awal`.
  - Penghitung salah PIN dan `terkunci_sampai`.
- **Email Auth sintetis** `kw-xxxxxx@generus.kawanku.invalid`. Email ini tidak
  pernah dipakai mengirim email. Akun dibuat lewat Auth Admin API (secret key)
  setelah `boleh_kelola_akun_generus()` lolos.
- **Akun generus tidak punya baris `admin`.** Trigger mencegah satu akun
  menjadi admin sekaligus generus.
- **Login di `/masuk`**, dijalankan di browser supaya batas percobaan Supabase
  dihitung per perangkat:
  1. `mulai_login_generus(username)`.
  2. `signInWithPassword`.
  3. Bila PIN salah: `gagal_login_generus`. Setelah **5x salah**, akun dikunci
     **15 menit**.
  4. Bila berhasil: `login_generus_berhasil()`.
- **Admin bisa**:
  - membuat akun massal per kelompok (yang tanggal lahirnya lengkap);
  - mengubah username;
  - mengatur ulang PIN (kembali ke DDMMYY, sekaligus membuka kunci);
  - menonaktifkan akun;
  - menghapus akun (riwayat absen tetap ada).
- **Generus hanya bisa membaca** profilnya sendiri, catatan absensinya
  sendiri, dan sesi yang ia ikuti. Kebijakan select yang ada diperluas lewat
  `private.jamaah_saya()`.

### QR layar

- `/layar/[id]` (di luar layout admin) menampilkan QR berisi URL
  `/absen?t=<sesi>.<detik>.<tanda>`.
- Tanda = HMAC-SHA256 dengan rahasia per sesi (`sesi_layar`, tertutup untuk
  API).
- QR berganti tiap **60 detik** dan berlaku **90 detik**.
- Generus bisa membuka QR dengan:
  - menu **Scan QR absen** (kamera di aplikasi, jsQR); atau
  - aplikasi kamera HP.
- `absen_layar(token)` memeriksa tanda dan umur token, lalu mencatat dengan
  `jalur = layar`. Pesan dan bunyinya sama dengan scan kartu; scan ulang
  hanya menampilkan "sudah absen".
- Belum login → `/masuk?next=/absen?t=…`. Bila login memakan waktu lebih dari
  90 detik, generus cukup scan ulang.

## Rekap absensi (cetak & ekspor)

Absensi → **Rekap** (`/absensi/rekap`). Tombol **Rekap** juga ada di halaman
setiap sesi.

1. **Pilih jenis rekap:**
   - **Bulanan**: pilih bulan, wilayah (seluruh desa atau satu kelompok), dan
     peserta (semua jamaah atau generus saja).
   - **Per kegiatan**: pilih satu sesi.
2. **Pratinjau** langsung tampil di bawah filter. Tampilannya sama persis
   dengan hasil cetak.
3. **Cetak / PDF** membuka `/cetak/rekap`, halaman tanpa navigasi dengan
   `KopDokumen` hitam putih. Rekap bulanan dicetak A4 mendatar, rekap per
   kegiatan A4 tegak.
4. **Unduh Excel (CSV)** lewat `/api/rekap`: pemisah titik koma dan BOM UTF-8,
   jadi langsung rapi di Excel berbahasa Indonesia dan Google Sheets. Baris
   teratas berisi kop.

### Isi rekap

**Bulanan**: matriks peserta × pertemuan dengan kode berikut.

| Kode | Arti |
| --- | --- |
| H | Hadir |
| I | Izin |
| S | Sakit |
| A | Tidak hadir |
| · | Bukan peserta pertemuan itu |

- Tiap peserta dihitung jumlah H/I/S/A dan **%**, yaitu hadir dibagi
  pertemuan yang diikutinya.
- Ada baris "Hadir per pertemuan" dan daftar pertemuan.
- Peserta = jamaah aktif di wilayah yang dipilih, ditambah jamaah yang punya
  catatan meski kini nonaktif. Sesi tingkat desa ikut dihitung untuk setiap
  kelompok.

**Per kegiatan**: daftar peserta dengan status dan keterangan (jam & jalur,
atau alasan izin).

**Catatan otomatis** dihitung dari data, tanpa layanan luar:

| Rekap | Isi catatan |
| --- | --- |
| Bulanan | Rata-rata kehadiran; naik/turun dibanding bulan lalu; pertemuan paling ramai/sepi; yang hadir di semua pertemuan; yang **perlu disapa** (tidak hadir 3 pertemuan terakhir berturut-turut) |
| Per kegiatan | % kehadiran; kehadiran per kelompok (sesi desa); naik/turun dibanding pertemuan sebelumnya di wilayah & sasaran yang sama; alasan izin terbanyak |

### Hak akses

- Pratinjau: pemegang `absensi.lihat` (batas data tetap RLS).
- Cetak & ekspor: hanya pengelola absensi (`absensi.kelola`). Pengembang hanya
  bisa melihat, sesuai keputusan "pengembang tidak bisa menarik data".
- Penanda keringanan tidak dicetak.

## Pengajuan izin dari HP generus

Keputusan Reno (21 Okt 2026): generus bisa mengajukan izin/sakit dari HP
sebelum pengajian, dan admin yang menyetujui. Migrasi
`20261022030000_pengajuan_izin`.

- Tabel `pengajuan_izin`: satu kejadian kalender (kegiatan, kelompok
  pelaksana, tanggal; kunci yang sama dengan `pertemuan`), jadi bisa diajukan
  walau absensinya belum dibuka. `jenis` izin (alasan kuliah/kerja/lainnya +
  catatan opsional ≤150) atau sakit (tanpa keterangan: data kesehatan tidak
  disimpan). Satu pengajuan aktif per jamaah per pertemuan.
- Validasi (trigger `atur_pengajuan_izin`): hanya untuk dirinya sendiri,
  kegiatan di wilayahnya, hari ini s.d. 60 hari ke depan, ada jadwal pada
  tanggal itu, pertemuan tidak dibatalkan, absensinya belum ditutup.
- RLS: generus mengajukan/melihat/membatalkan (selama menunggu) miliknya;
  admin `absensi.lihat` melihat, admin `absensi.kelola` jamaahnya
  menyetujui/menolak (+ tanggapan, `ditangani_by/at` otomatis).
- Disetujui → tercatat di `absensi` (status izin/sakit, jalur manual):
  langsung bila sesi pertemuannya sudah ada, atau otomatis saat absensi
  pertemuan dibuka (trigger pada `pertemuan.sesi_id`). Catatan **hadir tidak
  ditimpa**.
- Aplikasi: generus di `/saya/izin` (pilih pertemuan 14 hari ke depan);
  admin di `/absensi/izin` (kartu di halaman Absensi menampilkan jumlah yang
  menunggu) dan di halaman pertemuan kegiatan.

## Belum (berikutnya)

- Keterangan telat (toleransi per sesi).
