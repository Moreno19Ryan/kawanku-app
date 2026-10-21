# Data jamaah tambahan & data sensitif

Status: disetujui Reno (21 Okt 2026). Migrasi
`supabase/migrations/20261021140000_data_pribadi_jamaah.sql`, diterapkan ke
produksi hanya setelah "OK, jalankan".

## Data pokok (wajib di form)

Nama lengkap, jenis kelamin, kelompok, tanggal lahir **atau** tahun lahir,
status pernikahan, status sekolah/kegiatan. Diwajibkan di form & Server
Action; di database sengaja belum `not null` supaya data impor lama yang
belum lengkap tetap bisa masuk lalu dilengkapi (Beranda → "Data perlu
dilengkapi").

## Data tambahan (opsional, kolom di `jamaah`)

| Kolom | Isi |
| --- | --- |
| `tempat_lahir` | Teks bebas |
| `pendidikan_terakhir` | belum sekolah, SD, SMP, SMA/SMK, Diploma, S1, S2, S3 |
| `kegiatan` | Pekerjaan/kegiatan, teks bebas (mis. Karyawan swasta, Mondok) |
| `muballigh` | Ya/tidak (Muballigh untuk L, Muballighot untuk P) |
| `jenis_muballigh` | Hanya bila `muballigh`: Tugasan (MT) / Setempat (MS); boleh kosong dulu |
| `paket_caberawit` | Paket A–F |

## Data sensitif (opsional, tabel terpisah dengan izin sendiri)

| Tabel | Isi | Izin | Pemegang |
| --- | --- | --- | --- |
| `jamaah_kontak` | No. HP/WA, no. HP orang tua/wali, email | `kontak.lihat` / `kontak.kelola` | admin desa & kelompok (lihat+ubah), admin generus (lihat, jamaah generus saja) |
| `jamaah_pribadi` | Nama ayah & ibu kandung, alamat KTP & alamat saat ini (domisili) | `pribadi.lihat` / `pribadi.kelola` | admin desa & kelompok |
| `jamaah_identitas` | NIK, No. KK (bukan ID jamaah; ID tetap kode `KW-`) | `identitas.lihat` / `identitas.kelola` | admin desa saja |

- Pengembang tidak memegang izin apa pun di atas: hanya melihat profil biasa,
  tidak bisa mengubah, dan nanti tidak mendapat fitur ekspor/unduh.
- Batas wilayah & sasaran generus lewat `private.boleh_jamaah` (sama seperti
  keringanan dan janda/duda). Ikut terhapus bila jamaah dihapus.
- No. HP disimpan ternormalisasi `08…` (input `+62`, `62`, spasi, dan tanda
  hubung diterima). NIK unik; No. KK boleh sama (satu keluarga).
- NIK/No. KK ditampilkan tersamar (`3216••••••••0001`) dengan tombol tampilkan.
- Tidak disimpan: tinggi/berat badan, golongan darah, riwayat kesehatan.

## Alamat

Dua alamat: sesuai KTP dan saat ini (domisili), dengan saklar "Sama dengan
alamat KTP". Wilayah dipilih bertingkat (provinsi → kab/kota → kecamatan →
desa/kelurahan), semua kosong di awal, cakupan seluruh Indonesia.

- Daftar wilayah: kode Kemendagri (Kepmendagri No. 300.2.2-2138 Tahun 2025,
  sumber [cahyadsn/wilayah](https://github.com/cahyadsn/wilayah), MIT),
  91.599 baris, disimpan sebagai data statis di `src/lib/wilayah/data.ts`
  (bukan tabel database, supaya migrasi tetap kecil) dan disajikan lewat
  `GET /api/wilayah?induk=…`.
- Database menyimpan kode terdalam yang dipilih (`ktp_kode_wilayah`) dan nama
  lengkapnya saat disimpan (`ktp_wilayah`, mis. "Wanasari, Cibitung,
  Kabupaten Bekasi, Jawa Barat"), plus jalan/perumahan, RT, RW, kode pos.
- Anak di bawah 17 tahun: label "Alamat sesuai KIA" (Kartu Identitas Anak);
  kolomnya tetap `ktp_*`.
- 21 Okt 2026: untuk 87 generus + caberawit yang alamat KTP-nya kosong, alamat
  domisili disalin ke alamat KTP/KIA (saklar "sama" dinyalakan).
- Generus yang punya akun bisa mengubah alamatnya sendiri di `/saya/alamat`
  lewat RPC `ubah_alamat_saya()` (security definer; hanya kolom alamat untuk
  `jamaah_saya()`, PIN awal harus sudah diganti). Generus juga bisa membaca
  baris `jamaah_pribadi` miliknya sendiri; nama orang tua tidak ditampilkan
  dan tetap diubah admin. `updated_by` mencatat akun generus yang mengubah.

## Diubah sendiri oleh generus (21 Okt 2026)

Halaman `/saya/profil` (migrasi `20261022020000_profil_generus`):

- **Diubah langsung**: nama panggilan, no. HP/WA, email (RPC
  `ubah_profil_saya`; no. HP wali tetap lewat admin) dan alamat
  (`/saya/alamat`). Generus bisa membaca baris `jamaah_kontak` miliknya.
- **Lewat laporan**: nama lengkap, tanggal lahir, jenis kelamin, status
  sekolah, pendidikan, status pernikahan, kelompok, keluarga, lainnya.
  Generus mengirim `usulan_koreksi` (satu yang menunggu per bagian); admin
  yang boleh mengubah jamaahnya membetulkan data lalu menandai "Sudah
  dibetulkan" atau "Tolak" dengan tanggapan. Laporan tampil di Dashboard,
  Perlu dicek, dan detail jamaah. Generus bisa membatalkan selama menunggu.
- Semua perubahan tercatat di `updated_by` (akun generus atau admin).

## Masih menunggu pengurus

- Kegunaan NIK & No. KK (kolomnya sudah ada, opsional).
- Paket "GU" di data generus lama (di luar A–F): 4 anak Caberawit hasil impor
  untuk **sementara diisi Paket F** (21 Okt 2026, keputusan Reno) sampai
  dikonfirmasi pengurus. Bila GU ternyata paket tersendiri, tambahkan nilai
  enum `paket_caberawit` lewat migrasi lalu ubah keempat jamaah tersebut.
