# Peta jalan KawanKu

Disusun bersama Reno, 28 Okt 2026. Urutan pekerjaan berikutnya, dipecah per
langkah. Setiap langkah yang mengubah tampilan **diawali mockup** dan
dikerjakan setelah Reno setuju; setiap langkah yang mengubah database
menunggu **"OK, jalankan"**. Status diperbarui di sini setiap kali selesai.

## Keputusan yang sudah diambil (Reno, 28 Okt 2026)

1. **Caberawit tidak punya akun sendiri.** Dipantau dan diabsenkan lewat akun
   orang tuanya, supaya orang tua tidak perlu menghafal banyak akun (apalagi
   bila anaknya banyak) dan pemantauan anak ada di satu tempat.
2. **Satu orang, satu akun.** Pengurus juga jamaah: setelah masuk, pengurus
   **memilih mau masuk sebagai apa** saat itu (sebagai jamaah, atau sebagai
   salah satu dapukannya). Satu orang bisa punya **lebih dari satu dapukan**,
   di kelompok maupun di desa.
3. **Pengurus tetap bisa absen** sebagai jamaah pada kegiatan yang wajib
   diikutinya (kenaan).
4. **Kata sapaan tetap** sesuai Pedoman Bahasa: santun; generus "kamu";
   jamaah dewasa, lansia, dan pengurus tanpa kata ganti.
5. Setiap tahap redesign mencakup **area admin dan area jamaah sekaligus**.
6. **Akun caberawit dibuat otomatis** saat pembagian rapor / pergantian
   semester, bila anak sudah selesai dari caberawit (lihat Tahap D).
7. **Semua tampilan wajib dua versi: HP dan laptop/PC.** Tidak ada lagi
   halaman yang di laptop hanya tampil seukuran HP (area generus saat ini).
   Setiap mockup & PR menyertakan keduanya.
8. **Orang tua tetap memantau anaknya yang generus** (setelah caberawit:
   pra remaja dan seterusnya), walaupun anak sudah punya akun sendiri.
9. **Kategori Balita** (28 Okt 2026): anak **belum sekolah** = Balita;
   Caberawit mulai **PAUD/TK dan SD**. Diatur sebagai data di Pengaturan →
   Kategori jamaah (tanpa migrasi). Balita dipantau lewat akun orang tua
   (B7), tidak termasuk TPA.

## Prinsip kerja (Reno, 28 Okt 2026)

Proyek ini mengelola data banyak jamaah, jadi setiap detail diperiksa
dengan teliti sebelum dipakai banyak orang:

- **Berurutan**: langkah dikerjakan sesuai urutan di dokumen ini, tidak
  melompat; bila urutan perlu berubah, dokumen ini diperbarui dulu.
- **Rancang → mockup/dokumen → setuju → kode → uji → PR → "OK, jalankan"**.
- Setiap perubahan database diuji dulu di database lokal + tes pgTAP,
  dengan cadangan sebelum diterapkan ke produksi.
- Dibuka **bertahap**: Kelompok 1 dulu, dievaluasi, baru seluruh desa.
- Kesalahan yang ditemukan dicatat dan diperbaiki di akarnya, bukan
  ditambal.

## Tahap A · Redesign lanjutan (tanpa perubahan database)

| Langkah | Isi | Hasil |
| --- | --- | --- |
| A1 ✓ | **Beranda pengembang** (selesai, PR #86) | Panel sambutan berisi keadaan sistem ("Alhamdulillah, semua sistem normal" / "Ada 2 galat baru"); pintasan khusus pengembang (Panel pengembang, Bantuan akun, Jejak aktivitas, Salin laporan masalah); Perlu perhatian: galat baru, tugas otomatis bermasalah, cadangan terlambat. |
| A1b ✓ | **Area jamaah versi laptop** | Kerangka area jamaah (generus) untuk laptop/PC: menu samping seperti admin, Beranda dua kolom; halaman jamaah lain ikut melebar dengan rapi. Mockup dulu. |
| A1c ✓ | **Jam & tanggal realtime (WIB, mengikuti jam server)** (usul Reno) | Di Beranda admin & jamaah, QR layar (besar), halaman sesi absensi, pemindai QR; hasil absen menyebut "Tercatat pukul … WIB" dari waktu database. Jam HP tidak dipakai supaya tidak bisa disalahgunakan. |
| A2 | **Pengaturan & Panel pengembang** | Halaman kerja pertama dengan pola baru: judul besar, kartu per bagian, aksi utama satu per layar, nyaman di HP. |
| A3 | **Jamaah** (daftar, detail, tambah/ubah, keluarga, Perlu dicek, kenaikan kelas) | Pola halaman kerja yang sama. |
| A4 | **Absensi** (sesi, scan, rekap, laporan, izin, kartu, akun) | Pola halaman kerja yang sama. |
| A5 | **Kegiatan** (kalender, pertemuan, kelola, pengajar, pengumuman) | Pola halaman kerja yang sama. |
| A6 | **Area jamaah lain** (Jadwal, Kehadiran, Rapor, Profil, Alamat, Izin, Scan, PIN) | Dibangun untuk semua kategori jamaah (bukan khusus generus), siap dipakai Tahap B. |

Langkah tiap tahap A: mockup HP & laptop (terang/gelap) → persetujuan Reno →
kode → uji di HP & laptop → PR → "OK, jalankan" → gabung.

## Tahap B · Akun untuk seluruh jamaah

| Langkah | Isi | Catatan |
| --- | --- | --- |
| B1 | **Dokumen rancangan & pertanyaan pengurus** (`docs/akun-jamaah.md`) | Model akun, alur masuk, pemilih peran, akun orang tua, dan pertanyaan yang perlu dijawab pengurus. Dikirim Reno ke pengurus. |
| B2 | **Database: "akun generus" menjadi "akun jamaah"** | Semua kategori boleh punya akun (kecuali caberawit). Akun pengurus ditautkan ke data jamaahnya, sehingga satu orang = satu akun. Data & akun lama dipindah otomatis, tidak ada yang hilang. Migrasi + tes pgTAP. |
| B3 | **Masuk terpadu** | Satu halaman masuk untuk semua. Jamaah biasa: username + PIN. Pengurus: lihat pertanyaan 1. Kunci 5× salah & bantuan akun tetap. |
| B4 | **Pemilih peran ("Masuk sebagai")** | Muncul setelah masuk bila punya lebih dari satu: Jamaah · Admin Kelompok 1 · Admin Desa · dst. Bisa berganti kapan saja dari menu akun; pilihan terakhir diingat di perangkat ini. Tampilan & data mengikuti peran yang dipilih. |
| B5 | **Sasaran kegiatan per kategori (kenaan)** | Sekarang hanya "khusus generus / semua". Diperluas: kegiatan menyebut kategori yang wajib ikut (mis. remaja, dewasa, lansia). Dipakai untuk jadwal, absen, pertemuan terlewat, dan laporan. |
| B6 | **Absen untuk semua jamaah, termasuk pengurus** | QR layar & kartu QR untuk semua kategori yang kenaan. Pengurus yang sedang memegang absensi tetap bisa mencatat dirinya sendiri hadir. |
| B7 | **Akun orang tua untuk caberawit (dan pemantauan anak generus)** | Dari data keluarga (hubungan orang tua – anak): orang tua melihat jadwal, kehadiran, dan rapor tiap anak caberawit; mengabsenkan anak lewat QR layar ("Absen untuk: Ahmad, Fatimah"); mengajukan izin/sakit anak. Kartu QR anak tetap bisa dipakai. Anak yang sudah generus (punya akun sendiri) tetap terpantau orang tuanya: jadwal, kehadiran, rapor. |
| B8 | **Tampilan per kategori** | Beranda jamaah menyesuaikan kategori. Lansia: pilihan tampilan sederhana (huruf lebih besar, tombol lebih sedikit). Sapaan sesuai keputusan 4. |
| B9 | **Pembuatan akun massal & bahan pengurus** | Buat akun per kelompok sekaligus, cetak slip info masuk, bantuan lupa PIN, panduan singkat untuk jamaah dan pengurus. |
| B10 | **Uji coba bertahap** | Kelompok 1 dulu per kategori (mis. remaja → dewasa → lansia & orang tua caberawit), dievaluasi, baru seluruh desa. |

Urutan yang diusulkan:

1. A1 → A1b → A1c → A2.
2. B1 (dokumen) sambil menunggu jawaban pengurus.
3. B2 → B3 → B4 (fondasi akun & pemilih peran).
4. A3 → A4 → A5 (halaman kerja pengurus, sudah memakai pemilih peran).
5. B5 → B6 → B7 → B8 bersama A6 (area jamaah untuk semua kategori).
6. B9 → B10 (pembuatan akun & uji coba).

## Tahap D · TPA (Taman Pendidikan Al-Qur'an) untuk caberawit (rencana)

Dirancang setelah Tahap B berjalan; rinciannya dibahas bersama pengurus.

| Langkah | Isi |
| --- | --- |
| D1 | **Dokumen rancangan TPA**: kelas/jenjang, semester, rapor, siapa saja yang terlibat. |
| D2 | **Peran baru sebagai data**: guru TPA, tim kurikulum, pembina, dsb. (memakai sistem peran yang ada; wewenangnya diatur per peran). |
| D3 | **Kegiatan TPA** khusus caberawit: jadwal, absensi, izin lewat akun orang tua. |
| D4 | **Wadah kurikulum & rapor semester**: Claude hanya membuat wadahnya; isi materi, target, dan penilaian ditentukan tim kurikulum/pengurus. |
| D5 | **Pembagian rapor / pergantian semester**: anak yang selesai dari caberawit otomatis naik kategori dan **dibuatkan akun sendiri**; orang tua mendapat kabar beserta slip info masuk. |

## Tahap C · Hal lain yang masih tertunda

- **Cadangan lapis 2**: Reno mengisi rahasia GitHub `SUPABASE_DB_URL` dan
  `CADANGAN_SANDI`.
- **Repo publik/privat**: keputusan Reno.
- **Verifikasi dua langkah**: daftarkan perangkat cadangan dan simpan kode
  rahasianya.
- **Sapa lewat WhatsApp** (templat pesan untuk jamaah & wali).
- **Target hafalan / capaian materi** (Fase 3c, ditunda; isi ditentukan
  pengurus).

## Pertanyaan untuk Reno & pengurus (sebelum B2)

1. **Cara masuk pengurus.** Usul: semua memakai username yang sama
   bentuknya; jamaah biasa dengan PIN 6 angka, pengurus dengan **kata sandi**
   yang lebih kuat karena bisa membuka data jamaah (pengembang tetap
   ditambah verifikasi dua langkah).
2. **Data saat "masuk sebagai" satu dapukan.** Usul: yang tampil hanya data
   dapukan itu (mis. Admin Kelompok 1 hanya melihat Kelompok 1), supaya tidak
   tercampur. Untuk melihat data desa, berganti ke dapukan desa.
3. **Akun admin bersama yang sekarang dipegang satu pengurus.** Usul: setiap
   pengurus memakai akunnya sendiri dan dapukan diberikan ke akun
   masing-masing; akun bersama dinonaktifkan setelah semua pindah. Akun
   bersama sulit ditelusuri (siapa mengubah apa) dan berisiko bila kata
   sandinya tersebar.
4. ~~Batas caberawit~~ (dijawab Reno: akun dibuat otomatis saat pembagian
   rapor / pergantian semester, Tahap D5; orang tua tetap bisa memantau
   anaknya yang generus, keputusan 8).
5. **Anak tanpa orang tua di data keluarga** (mis. tinggal dengan wali).
   Usul: wali yang tercatat di keluarga memegang perannya.
