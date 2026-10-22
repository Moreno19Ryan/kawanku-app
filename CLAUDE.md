# CLAUDE.md: KawanKu

Panduan untuk siapa pun (manusia atau AI) yang bekerja di repo ini. Baca juga
`AGENTS.md` (aturan bawaan Next.js 16).

## Ringkasan produk

KawanKu adalah aplikasi web manajemen **Desa Kartika Wanasari (LDII)**: database
jamaah, absensi mandiri, dan monitoring kegiatan. Konsepnya mirip GENSITI, tapi
cakupannya satu desa.

- Desa terdiri dari 4 kelompok, ±500 jiwa semua usia. Trial pertama di
  Kelompok 1 (±100 orang).
- **Istilah baku: Jamaah** (bukan "warga") di UI, kode, dan database.
- **Peran**: admin desa (seluruh desa), admin kelompok (kelompoknya saja), admin
  generus (jamaah generus, di tingkat desa atau tingkat kelompok), dan
  pengembang (sistem & pemulihan akses; data jamaah hanya lihat; lihat
  `docs/peran-pengembang.md`). Peran dan
  hak akses disimpan sebagai **data** di database, bukan di-hardcode: wilayah
  (`penugasan_peran.kelompok_id`, kosong = seluruh desa) dan sasaran
  (`peran.hanya_generus`) adalah dua sumbu terpisah.
- **Dua jenis entitas**:
  - Profil jamaah: semua orang, tanpa akun.
  - Akun login: hanya generus (username + PIN yang dibuat admin). Admin login
    terpisah.
- **Absensi (Fase 2)**: hanya online, tidak ada absen offline.
  - Jalur 1: kartu QR tetap per orang, discan admin dengan scanner barcode USB
    di laptop.
  - Jalur 2: generus login, lalu scan QR di layar laptop admin yang berganti
    tiap 1 menit (berlaku ±90 detik).
  - Jalur keringanan: generus tanpa HP memakai kartu fisik (jalur 1), ditandai
    khusus yang hanya terlihat admin. Generus tanpa penanda keringanan tidak
    bisa punya kartu fisik (dijaga database, `private.boleh_kartu_fisik`).
- **UI**: gaya One UI (halus, interaktif, intuitif). Laptop sebagai tampilan
  utama, tapi tetap nyaman di HP. PWA.
- **Data sensitif bersifat opsional dan disimpan di tabel terpisah dengan izin
  sendiri**, bukan kolom di `jamaah` (`docs/data-pribadi-jamaah.md`):
  `jamaah_kontak` (no. HP, HP wali, email), `jamaah_pribadi` (nama orang tua,
  alamat KTP & domisili), `jamaah_identitas` (NIK & No. KK, hanya admin desa;
  bukan ID, ID tetap kode `KW-`). Status pernikahan hanya
  `lajang`/`menikah`/`janda_duda`; untuk janda/duda hanya keterangan
  `cerai_hidup`/`cerai_mati` di `jamaah_janda_duda` (default hanya admin desa).
  Tidak disimpan: tinggi/berat badan dan data kesehatan.

### Fase

| Fase | Isi | Status |
| ---- | --- | ------ |
| 0 | Fondasi: scaffold, Supabase client, kerangka UI, PWA, logo, dokumen | Selesai |
| 1 | Database jamaah: kelompok, keluarga, jamaah, status pernikahan & sekolah, kategori jamaah, kode jamaah, peran sebagai data, RLS | Skema v2 disetujui; migrasi `supabase/migrations/20261020170513_*` diterapkan ke produksi + tes pgTAP. Login admin (email + kata sandi) aktif |
| 2 | Absensi (QR kartu, QR berputar, jalur keringanan) | 2a (sesi, kartu QR, scan, rekap) di produksi; 2b (akun generus + QR layar) dikerjakan, `docs/absensi.md` |
| 3 | Monitoring kegiatan | 3a (jadwal rutin, agenda, pertemuan) dikerjakan, `docs/kegiatan.md`; 3b laporan kehadiran (`/absensi/laporan`) dikerjakan; 3c target hafalan ditunda |

## Stack

- Next.js 16 (App Router, Turbopack, `cacheComponents` aktif) + TypeScript
- Tailwind CSS v4 (token di `src/app/globals.css`)
- Supabase (PostgreSQL, RLS, Auth) lewat `@supabase/ssr`
- Deploy di Vercel, fungsi di region `sin1` (dekat database `ap-southeast-1`)
- Ikon: `lucide-react`

Catatan Next.js 16: file `middleware.ts` sudah diganti namanya menjadi
`proxy.ts`. Dokumentasi versi yang terpasang ada di `node_modules/next/dist/docs/`.

### Alur login admin

- Akun dibuat admin (tidak ada daftar mandiri): user Supabase Auth + baris
  `public.admin` + minimal satu `penugasan_peran`. Admin pertama lewat SQL
  bootstrap di `docs/schema-proposal.md` §6.2.
- `src/proxy.ts` hanya mengecek ada/tidaknya sesi: tanpa sesi → `/login?next=...`;
  sudah login membuka `/login` → `/dashboard`.
- "Admin aktif" dicek di `wajibAdmin()` (dipanggil `AkunAdmin` di layout area
  admin, di dalam `<Suspense>`). Bukan admin aktif → `/keluar` → `/login`.
- Halaman/komponen yang mengambil data memanggil `getAdminSaatIni()` /
  `wajibAdmin()` sendiri (jangan mengandalkan layout). Batas akses data yang
  sebenarnya tetap RLS.
- Menu/bagian yang butuh izin memakai `punyaIzin(admin, "akses.kelola")` dan
  halamannya `wajibIzin(...)`. Izin dibaca dari data (`peran_izin`); yang
  dihitung hanya izin global (penugasan tanpa kelompok, peran bukan
  `hanya_generus`), sama dengan `private.boleh(izin, null)`.
- Akun admin baru & atur ulang kata sandi dibuat dari Pengaturan → Admin
  lewat `createAdminClient()` (env server `SUPABASE_SECRET_KEY`). Secret key
  hanya untuk Supabase Auth Admin API dan hanya setelah izin `akses.kelola`
  dicek; profil `admin` & `penugasan_peran` tetap ditulis dengan sesi
  pengguna (RLS). Kata sandi sementara ditampilkan sekali, tidak disimpan.
- Akun admin generus **kelompok** dikelola admin kelompoknya (izin
  `akses.kelola_generus` per wilayah), bukan admin desa; generus desa oleh
  admin desa (`docs/kelola-admin-generus.md`). Sumber kebenaran:
  `private.boleh_kelola_akun` / `boleh_beri_peran`; aplikasi memakai RPC
  `akun_dapat_dikelola()` & `boleh_beri_peran()` (wajib sebelum secret key).
  Izin per kelompok tersedia di DAL: `punyaIzinDi`, `punyaIzinDiManaPun`.
- Pemeriksaan admin di server memakai `supabase.auth.getUser()` (bukan
  `getClaims`), supaya sesi yang dicabut ("Keluar dari semua perangkat")
  langsung ditolak.
- Peran/akun "tingkat sistem" (memegang `sistem.kelola`, yaitu pengembang)
  hanya bisa diubah pemegang `sistem.kelola` (dijaga RLS). Sebelum memakai
  secret key untuk akun lain, cek dulu dengan `terlindungSistem()`.
- Panel pengembang (`docs/panel-pengembang.md`): `GerbangPerawatan` di layout
  area admin menahan admin selain pengembang saat mode perawatan
  (`pengaturan_sistem` atau env `MODE_PERAWATAN=1`); `BannerPengumuman`
  menampilkan pengumuman. Pembacaan tabel sistem bersifat fail-open
  (tabel/galat → aplikasi tetap jalan normal).
- Form pengaturan dikirim lewat `useFormAksi()` (onSubmit), bukan prop
  `action`, supaya React tidak mereset isian setelah validasi server gagal.
- Pengaman "jangan sampai tidak ada admin pengelola akses" (tidak bisa
  menonaktifkan diri sendiri / mencabut peran pengelola terakhir) saat ini
  dicek di Server Action, belum di database.
- Modul Jamaah (`/jamaah`) dibuka per kelompok lewat saklar fitur `jamaah`
  (panel pengembang) dan izin `jamaah.lihat` (termasuk peran generus, lewat
  `admin.izinWilayah`). Menu bersyarat dihitung di server (`nav-terbuka.tsx`);
  daftar hanya memuat kelompok yang menyala. Batas data tetap RLS: admin
  generus hanya melihat/menyimpan jamaah berkategori generus.
- Keluarga (`/jamaah/keluarga`) memakai izin `keluarga.lihat`/`keluarga.kelola`
  per kelompok (`kelompokKeluargaLihat`/`Kelola` di `getAksesJamaah`). Anggota
  keluarga harus sekelompok (FK komposit), jadi `ubahJamaah` melepas jamaah
  dari keluarganya saat pindah kelompok.
- Absensi (`/absensi`, `docs/absensi.md`) dibuka lewat saklar fitur `absensi`
  dan izin `absensi.lihat`/`absensi.kelola` (`getAksesAbsensi`). Pencatatan
  lewat RPC `catat_absensi_kode` (security invoker, batas tetap RLS). Lembar
  cetak kartu di `/cetak/kartu` (di luar layout admin).
- Akun generus (Fase 2b): login di `/masuk` (username + PIN). PIN diperiksa
  server (`siapkanMasukGenerus` → RPC `cek_pin_generus`, hanya service_role,
  kunci 5x salah); hash PIN di `private.pin_generus`, kata sandi Auth selalu
  acak (lihat `docs/absensi.md`). Area generus `/saya` & `/absen` (`getGenerusSaatIni` /
  `wajibGenerus`, `src/lib/generus/`). Akun generus tidak punya baris
  `admin`; `wajibAdmin()` mengarahkan akun generus ke `/saya`, dan
  `wajibGenerus()` mengarahkan admin ke `/dashboard`. Profil generus di
  `/saya/profil`: nama panggilan, no. HP & email diubah sendiri (RPC
  `ubah_profil_saya`), alamat di `/saya/alamat` (RPC `ubah_alamat_saya`); data
  lain lewat laporan `usulan_koreksi` yang ditangani admin di Perlu dicek &
  detail jamaah. Semua RPC ini hanya menulis baris `jamaah_saya()`. Izin/sakit
  diajukan generus di `/saya/izin` (`pengajuan_izin`, per kejadian kalender),
  disetujui admin di `/absensi/izin` atau halaman pertemuan, lalu otomatis
  tercatat di absensi (trigger, hadir tidak ditimpa). Beranda generus:
  statistik & lencana dari RPC `kehadiran_saya()` (termasuk pertemuan
  terlewat; dihitung di `src/lib/generus/kehadiran.ts`, murni), pengumuman
  bersasaran (`pengumuman.sasaran` admin/generus/semua + `kelompok_id`;
  pengurus kegiatan menulis di `/kegiatan/pengumuman`), jadwal 30 hari di
  `/saya/jadwal`, menu bawah `NavGenerus`. QR layar jalur 2 di
  `/layar/[id]` (RPC `token_layar` / `absen_layar`).
- Kegiatan (`/kegiatan`, `docs/kegiatan.md`): saklar fitur `kegiatan`, izin
  `kegiatan.lihat`/`kegiatan.kelola` (`getAksesKegiatan`). Kalender rutin
  dihitung dari `kegiatan_jadwal` (`src/lib/kegiatan/jadwal.ts`, murni);
  baris `pertemuan` hanya untuk isian (pemateri, materi, batal, pindah,
  absensi). Absensi pertemuan lewat RPC `buka_absensi_pertemuan`.
- `usePathname()` di komponen klien yang dirender di luar halaman (sidebar,
  bottom nav) harus di dalam `<Suspense>`, karena di rute dinamis path baru
  diketahui saat runtime.
- Dengan `cacheComponents`, apa pun yang membaca sesi (`createClient()` dari
  `@/lib/supabase/server`) harus di dalam `<Suspense>`; jangan `await` sesi di
  level atas layout.

## Struktur folder

```
src/
  app/
    (app)/              # area admin, memakai layout sidebar + bottom nav
      layout.tsx
      error.tsx         # galat tak terduga: coba lagi + kontak pengembang
    api/wilayah/        # GET daftar wilayah di bawah kode induk (untuk PilihWilayah)
      dashboard/page.tsx
      jamaah/           # daftar + cari/filter, baru/ (tambah), [id]/ (detail & ubah),
                        # periksa/ (Perlu dicek: kelengkapan data untuk dirapikan admin),
                        # kenaikan-kelas/ (naik kelas tahunan per kelompok),
                        # keluarga/ (daftar KK) & keluarga/[id]/ (anggota & hubungan)
      absensi/          # daftar & buat sesi, [id]/ (scan + rekap), kartu/ (kartu QR),
                        # akun/ (akun generus), rekap/ (pratinjau rekap bulanan/per kegiatan),
                        # laporan/ (tren, per kelompok/kegiatan/kategori, perlu disapa),
                        # izin/ (pengajuan izin generus)
      kegiatan/         # agenda/kalender, pertemuan/ (pemateri, materi, batal, absensi),
                        # kelola/ & kelola/[id]/ (kegiatan & jadwal), pengumuman/ (untuk generus)
    (generus)/          # area akun generus: saya/ (beranda, jadwal/, kehadiran/, scan/, profil/,
                        # alamat/, pin/, izin/), absen/ (hasil QR)
    layar/[id]/         # QR layar jalur 2 (tanpa navigasi, untuk proyektor)
      pengaturan/       # akun, tampilan, admin & akses, kelompok, peran & izin,
                        # pengumuman, panel pengembang, wewenang saya, kategori,
                        # bantuan (difilter izin)
    cetak/kartu/        # lembar cetak kartu QR (A4, tanpa navigasi)
    cetak/rekap/        # lembar cetak rekap absensi (KopDokumen, A4)
    api/rekap/          # GET ekspor rekap absensi (CSV)
    (auth)/             # halaman tanpa navigasi (login)
      login/page.tsx    # login admin (email + kata sandi)
      masuk/page.tsx    # login generus (username + PIN)
      keluar/route.ts   # hapus sesi non-admin lalu ke /login (bukan untuk <Link>)
    layout.tsx          # root layout, metadata, viewport
    globals.css         # design token
    favicon.ico, icon.svg, apple-icon.png   # ikon tab & iPhone (otomatis)
  components/
    absensi/            # FormSesi, PanelScan (scanner USB), PilihStatus, TombolCetak,
                        # LayarQr, form akun generus
    kegiatan/           # DaftarKejadian, EditorJadwal, form kegiatan & pertemuan
    generus/            # FormMasukGenerus, FormGantiPin, PemindaiQr (jsQR), HasilAbsen
    auth/               # FormMasuk (login), AkunAdmin (info admin + keluar + penjaga)
    bantuan/            # KontakPengembang (WhatsApp/email; Bantuan, login, perawatan, galat)
    jamaah/             # FormJamaah (pratinjau kategori), FormJandaDuda, form data sensitif,
                        # PilihWilayah (provinsi → desa), form keluarga
    pengaturan/         # form & tombol aksi halaman Pengaturan, daftar bagian
    tema/               # TombolTema (cepat), PilihTema (terang/gelap/ikut perangkat)
    sistem/             # GerbangPerawatan, BannerPengumuman, form panel pengembang
    brand/              # LogoDesa (logo Desa Kartika Wanasari)
    dokumen/            # KopDokumen: header wajib setiap dokumen cetak/ekspor
    kartu/              # KartuQr: kartu absensi jalur 1 (ukuran KTP)
    layout/             # sidebar, bottom nav, header, footer, BrandMark
    ui/                 # komponen dasar (Card, Badge, Skeleton, Saklar, buttonClass, INPUT_CLASS)
  lib/
    auth/
      admin.ts          # DAL: getAdminSaatIni / wajibAdmin (server-only)
      actions.ts        # Server Action masuk & keluar
      tujuan.ts         # validasi ?next= (cegah open redirect)
    pengaturan/
      actions.ts        # Server Action Pengaturan (kata sandi, admin, peran, kelompok)
      kategori-actions.ts # Server Action kategori jamaah (ubah, tambah, urutan, hapus)
    jamaah/
      akses.ts          # getAksesJamaah: izin per wilayah ∩ saklar fitur `jamaah` (server-only)
      actions.ts        # Server Action tambah/ubah/status/hapus, keringanan, janda/duda
      keluarga-actions.ts # Server Action keluarga (buat, ubah nama, hapus, anggota, hubungan)
      kategori.ts       # hitungUsia/cariKategori: pratinjau di form (sama dengan DB)
      format.ts         # formatNoHp, samarkan (server & klien)
      periksa.ts        # getPerluDicek: pemeriksaan kelengkapan data (server-only)
      kenaikan.ts       # tahun ajaran & pilihan kenaikan kelas (murni); -data.ts, -actions.ts
    absensi/
      akses.ts          # getAksesAbsensi: izin per wilayah ∩ saklar fitur `absensi` (server-only)
      actions.ts        # Server Action sesi, catat kode/status, kartu QR, token layar
      akun-actions.ts   # Server Action akun generus (buat, massal, PIN, username, aktif, hapus)
      bunyi.ts          # pola beep hasil scan (berhasil / sudah / gagal)
      rekap.ts          # getRekap: matriks kehadiran + catatan otomatis (server-only)
      rekap-csv.ts      # rekap → CSV (titik koma + BOM, kop di baris atas)
      laporan-hitung.ts # hitungLaporan: tren, status jamaah, sorotan (murni)
      laporan.ts        # getLaporan: ambil data laporan kehadiran (server-only)
    kegiatan/
      akses.ts          # getAksesKegiatan (server-only)
      jadwal.ts         # hitungKalender: jadwal rutin → pertemuan (murni)
      data.ts           # getKalender (server-only)
      actions.ts        # Server Action kegiatan, jadwal, pertemuan, buka absensi
    generus/
      akun.ts           # getGenerusSaatIni / wajibGenerus, PIN awal DDMMYY (server-only)
      actions.ts        # Server Action ganti PIN, keluar, absen (QR layar)
      tujuan.ts, username.ts  # ?next= aman untuk generus, usulan username
    wilayah/            # kode wilayah Kemendagri (data statis) + anakWilayah/namaLengkapWilayah
    sistem/
      data.ts           # status perawatan, pengumuman tayang, fitur (server-only, fail-open)
      actions.ts        # Server Action panel pengembang & pengumuman
    kontak.ts           # kontak pengembang (satu sumber untuk semua halaman)
    tema.ts             # pilihan tema + skrip inline <head> (anti kedip)
    waktu.ts            # waktuRelatif / tanggalJam (Bahasa Indonesia, WIB)
    label.ts            # label tampilan enum (status sekolah, pernikahan, wilayah)
    supabase/
      client.ts         # client untuk browser (Client Components)
      server.ts         # client untuk server (Server Components/Actions)
      proxy.ts          # refresh sesi + proteksi rute, dipanggil dari src/proxy.ts
      admin.ts          # client secret key (melewati RLS) KHUSUS Auth Admin API, server-only
      env.ts            # baca NEXT_PUBLIC_SUPABASE_*
  proxy.ts              # Next.js proxy (dulu middleware)
public/
  brand/                # logo aplikasi KawanKu (horizontal & mark), og-image
    desa/               # logo Desa Kartika Wanasari (+ png/ untuk PDF/email/cetak)
  icons/                # ikon PWA (dirujuk manifest)
  manifest.webmanifest  # manifest PWA
docs/                   # dokumen desain (usulan skema, dsb.)
supabase/
  config.toml           # konfigurasi stack lokal/CI (Postgres 17)
  migrations/           # migrasi; diterapkan ke produksi hanya setelah "OK, jalankan"
  tests/                # tes pgTAP (RLS & aturan), dijalankan CI di setiap PR supabase/**
```

## Peran & cara kerja sama (disepakati Reno, 21 Okt 2026)

**Peran**
- **Reno** (pengembang): memberi instruksi, arahan, dan brainstorming;
  pemegang keputusan akhir.
- **Claude** (asisten pengembang): eksekutor penulisan kode, jembatan
  komunikasi antara sistem dengan Reno, dan partner berpikir. Claude tetap
  AI, tapi bekerja dan berkomunikasi dengan adab serta istilah yang umum di
  kalangan warga LDII.

**Batas eksekusi**
- Tanpa perlu bertanya: menulis kode, membuat branch, commit, push ke branch
  fitur, dan membuka PR.
- Wajib menunggu "OK, jalankan": migrasi/execute_sql/apply_migration ke
  Supabase produksi dan merge/push ke main (lihat Aturan kerja di bawah).
- Usulan (fitur tambahan, perbaikan yang ditemukan di jalan) boleh
  disampaikan kapan saja, tapi baru dikerjakan setelah Reno setuju. Kecuali
  bug kecil yang jelas di bagian yang sedang dikerjakan: langsung diperbaiki
  lalu dilaporkan.
- Bila instruksi dinilai berisiko (membuka data pribadi jamaah, melemahkan
  keamanan, berpotensi merusak data), sampaikan dulu nasehat beserta
  alasannya sebelum mengerjakan; keputusan tetap di Reno.

**Jembatan ke pengurus**
- Claude juga menyiapkan bahan untuk pengurus: dokumen pertanyaan (mis.
  `docs/hak-akses.md`), panduan pemakaian untuk admin, dan ringkasan
  perubahan dalam bahasa non-teknis. Reno yang menyampaikannya.

**Batas soal agama**
- Untuk isi keagamaan (materi pengajian, target hafalan, dalil), Claude
  hanya membuat wadah/sistemnya. Isinya ditentukan pengurus/muballigh;
  Claude tidak memutuskan atau menulis isi keagamaan sendiri.

**Cara melapor**
- Ringkas, bahasa sehari-hari, hasil di depan, lalu apa yang menunggu
  keputusan Reno. Istilah teknis hanya bila perlu.

**Gaya bahasa (percakapan & teks aplikasi)**
- Membuka dengan salam: *Assalamu'alaikum warahmatullahi wabarakatuh*.
- Ucapan syukur/terima kasih selalu lengkap dengan ejaan ini:
  - kepada laki-laki: **Alhamdulillah Jazakallahu Khoiro** (termasuk kepada
    Reno);
  - kepada perempuan: **Alhamdulillah Jazakillahu Khoiro**;
  - kepada umum/banyak orang (mis. laporan & rekap per kegiatan/per bulan,
    teks untuk semua jamaah): **Alhamdulillah Jazakumullahu Khoiro**.
  - Di aplikasi, bila pesan ditujukan ke satu jamaah yang jenis kelaminnya
    diketahui (generus yang login, hasil scan kartu), pilih bentuk
    laki-laki/perempuan lewat `ucapanSyukur()` di `src/lib/label.ts`;
    selain itu bentuk umum.
- Istilah yang umum di kalangan warga LDII (mis. *amal sholih*,
  *Alhamdulillah*, *MasyaAllah*, *InsyaAllah*) dipakai secara wajar, tidak
  berlebihan. Di aplikasi tetap memakai istilah baku **Jamaah**.
- Perubahan teks aplikasi ke gaya ini diusulkan dulu ke Reno sebelum
  diterapkan.

## Aturan kerja (WAJIB, sama dengan GENSITI)

- Semua perubahan lewat branch + pull request. Jangan push langsung ke main.
- Dilarang menjalankan migrasi, execute_sql, atau apply_migration ke Supabase, dan dilarang push/merge ke main, sebelum aku menjawab "OK, jalankan" secara eksplisit di chat.
- Jangan ubah setting GitHub, Vercel, atau Supabase sendiri. Kalau ada yang perlu diubah, beri tahu aku langkahnya.
- Jangan pernah mencetak atau mengomit secret (service role key, token). Hanya NEXT_PUBLIC_* dan .env.example yang boleh masuk repo.
- Supabase Free tidak mendukung branching, jadi usulkan strategi aman untuk menguji migrasi sebelum produksi, dan tunggu persetujuanku.

## Konvensi penamaan

**Bahasa**
- UI, teks, dan dokumen dalam Bahasa Indonesia.
- Istilah domain memakai Bahasa Indonesia di kode dan database (`jamaah`,
  `kelompok`, `keluarga`, `kegiatan`, `absensi`), supaya sama dengan bahasa
  pengurus. Istilah teknis tetap Inggris (`created_at`, `id`, `role`).

**Kode**
- File & folder: `kebab-case` (`bottom-nav.tsx`, `page-header.tsx`).
- Komponen React: `PascalCase` (`BottomNav`), named export kecuali file
  konvensi Next.js (`page.tsx`, `layout.tsx`) yang wajib default export.
- Fungsi & variabel: `camelCase`. Konstanta modul: `UPPER_SNAKE_CASE`.
- Rute URL: Bahasa Indonesia, huruf kecil (`/jamaah`, `/kegiatan`, `/absensi`).
- Import memakai alias `@/` (mis. `@/lib/supabase/server`).
- Tema: `<html data-theme="light|dark">` dari pilihan per perangkat
  (localStorage `kk-tema`); tanpa atribut = ikut perangkat. Pakai varian
  `dark:` (sudah mengikuti tema aplikasi), jangan `@media (prefers-color-scheme)`
  langsung. Token gelap di `globals.css` ditulis dua kali; ubah keduanya.
- Warna, radius, dan spacing memakai token (`bg-surface`, `rounded-card`,
  `px-gutter`), bukan nilai hex/px langsung. `brand` = biru logo; `primary` =
  turunannya untuk teks/tombol (kontras AA).
- Logo aplikasi: pakai `BrandMark` (`public/brand/`). Jangan ubah warna atau
  memutar logo, dan beri jarak bebas ≥ ½ tinggi huruf K.
- Logo desa: pakai `LogoDesa` (`public/brand/desa/`, lihat README aset desa).
  Footer (termasuk halaman login) = horizontal 28–36 px; jangan pasang
  lambang desa besar di atas formulir login; setiap dokumen cetak/ekspor wajib memakai `KopDokumen` (hitam putih →
  `hitamPutih`); kartu QR memakai `KartuQr`. Jangan regangkan, putar, atau
  ubah warnanya di luar varian yang ada.

**Database**
- Tabel & kolom: `snake_case`, nama tabel tunggal (`jamaah`, `kelompok`).
- Primary key `id uuid default gen_random_uuid()`.
- Foreign key `<tabel>_id` (mis. `kelompok_id`).
- Setiap tabel punya `created_at` dan `updated_at` (`timestamptz`).
- RLS **wajib aktif** di setiap tabel `public`.
- File migrasi: `supabase/migrations/YYYYMMDDHHMMSS_deskripsi_singkat.sql`.

**Git**
- Branch: `feat/...`, `fix/...`, `chore/...`, `docs/...`.
- Commit: Conventional Commits (`feat: ...`, `fix: ...`, `docs: ...`).

## Keputusan pengurus

Sudah diputuskan Reno (21 Okt 2026):

- **Data sensitif**: lihat `docs/data-pribadi-jamaah.md`. Kegunaan NIK & No.
  KK dan lama penyimpanan dibiarkan seperti sekarang (kolom opsional,
  disimpan selama jamaah tercatat).
- **Kategori jamaah**: bukan draf lagi, melainkan **data sistem**. Dihitung
  otomatis dari aturan data (status sekolah, status pernikahan, usia untuk
  lansia) dan diubah admin desa lewat Pengaturan → Kategori jamaah (izin
  `pengaturan.kelola`) tanpa migrasi. Remaja dewasa tanpa batas atas umur.
- **Pembaruan status sekolah tahunan** (sekitar Juli): tanggung jawab
  **admin kelompok** untuk jamaah kelompoknya, lewat kolom `kelas` + halaman
  Jamaah → Kenaikan kelas (`docs/status-sekolah-tahunan.md`; jamaah naik
  paling banyak sekali per tahun ajaran, dijaga `kelas_tahun`).
- **Admin generus**: ada di tingkat desa **dan** per kelompok (skema dan
  akun produksi sudah mendukung keduanya).
- **Alasan izin**: sekolah, kuliah, kerja, lainnya.
- **Tunda**: target hafalan/capaian materi (Fase 3c) dan keterangan telat.

Masih dirangkai bersama (lalu dicocokkan dengan pengurus):

1. **Detail hak akses** tiap peran: draf di `docs/hak-akses.md`.
