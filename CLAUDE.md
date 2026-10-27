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
- **Wewenang wilayah** (Reno, 26 Okt 2026, `docs/hak-akses.md`): mengelola
  data jamaah hanya di tingkat kelompok (`izin.hanya_kelompok`, dihormati
  `private.boleh` & `admin.ts`; desa hanya melihat). Kegiatan, jadwal,
  pertemuan, pengajar, pengumuman generus, dan sesi absensi dikelola **tepat**
  di wilayahnya (`private.boleh_kelola_wilayah`); tidak ada kegiatan
  serentak (`kegiatan_tanpa_serentak`). Catat absensi:
  `private.boleh_catat_sesi` (sesi kelompok hanya kelompoknya).
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
  alamat KTP & domisili), `jamaah_identitas` (NIK & No. KK, diisi admin
  kelompok, selalu tersamar untuk semua peran; nomor lengkap hanya lewat
  permintaan yang disetujui pengembang, berlaku 1 jam, tercatat; bukan ID,
  ID tetap kode `KW-`). Status pernikahan hanya
  `lajang`/`menikah`/`janda_duda`; untuk janda/duda hanya keterangan
  `cerai_hidup`/`cerai_mati` di `jamaah_janda_duda` (diisi admin kelompok,
  dilihat desa & kelompoknya).
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
- Deploy di Vercel, fungsi di region `sin1` (dekat database `ap-southeast-1`).
  Domain produksi: https://inikawanku.com. Alamat absolut hanya dari
  `alamatSitus()` (`src/lib/situs.ts`: env `NEXT_PUBLIC_SITE_URL`, fallback
  `VERCEL_PROJECT_PRODUCTION_URL`, lalu localhost); jangan tulis domain di kode.
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
- Setiap admin aktif wajib punya minimal satu peran (dijaga database,
  migrasi `20261026090000_keamanan_akun_identitas`, trigger
  `jaga_peran_minimal` / `jaga_admin_berperan`, hint `peran_terakhir` /
  `tanpa_peran`): peran terakhir tidak bisa dicabut, akun tanpa peran tidak
  bisa diaktifkan.
- Pengaman "jangan sampai tidak ada admin pengelola akses" (tidak bisa
  menonaktifkan diri sendiri / mencabut peran pengelola terakhir) saat ini
  dicek di Server Action, belum di database.
- Pengaman pengembang dijaga database (migrasi `20261022110000_jaga_pengembang`):
  peran tingkat sistem milik sendiri tidak bisa dicabut, dan pemegang
  `sistem.kelola` aktif terakhir tidak bisa dicabut/dipindah/dinonaktifkan
  (trigger `jaga_penugasan_sistem` / `jaga_admin_sistem`, hint
  `pengembang_sendiri`/`pengembang_terakhir`).
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
  lewat RPC `catat_absensi_kode` (security invoker, batas tetap RLS). Setiap
  sesi terikat satu pertemuan Kegiatan (`sesi_absensi.pertemuan_id`, migrasi
  `20261024090000_absensi_terikat_pertemuan`): dibuka lewat
  `buka_absensi_pertemuan`, libur menghapus absensinya, pindah waktu & ganti
  nama ikut otomatis, kegiatan berriwayat absensi hanya bisa dinonaktifkan.
  Tidak ada "buat sesi" di menu Absensi (acara di luar jadwal = agenda di
  Kegiatan). Serba otomatis: absensi terbuka N menit sebelum mulai s.d. N
  menit setelah selesai, N = `kegiatan.jendela_menit` (15/30/45/60, bawaan
  30; disalin ke `sesi_absensi.jendela_menit`; `private.waktu_scan_sesi` =
  `jendelaScan()` di `src/lib/absensi/jendela.ts`, trigger `cek_waktu_sesi`).
  Sesinya dibuka **database sendiri tiap menit** lewat pg_cron (tugas
  `kawanku-buka-absensi` → `private.buka_absensi_otomatis()`, migrasi
  `20261027090000_absensi_otomatis`), dengan `siapkanAbsensiOtomatis()` saat
  admin membuka Beranda/Absensi/pertemuan sebagai cadangan; tanpa tombol
  buka/tutup. Lembar
  cetak kartu di `/cetak/kartu` (di luar layout admin). Pertemuan hari
  ini (`PertemuanHariIni`) tampil di Beranda admin & Absensi. Kamera QR
  (`KameraQr`, jsQR + bantuan izin per browser) dipakai pemindai generus dan
  "Scan pakai kamera HP" di halaman sesi.
- Akun generus (Fase 2b): login di `/masuk` (username + PIN). PIN diperiksa
  server (`siapkanMasukGenerus` → RPC `cek_pin_generus`, hanya service_role,
  kunci 5x salah); hash PIN di `private.pin_generus`, kata sandi Auth selalu
  acak (lihat `docs/absensi.md`). Admin tidak bisa melihat atau mengetik PIN
  baru: hanya "Kembalikan ke PIN awal" (RPC `kembalikan_pin_awal`, dengan
  alasan, tercatat di `riwayat_pin`). Area generus `/saya` & `/absen` (`getGenerusSaatIni` /
  `wajibGenerus`, `src/lib/generus/`). Akun generus tidak punya baris
  `admin`; `wajibAdmin()` mengarahkan akun generus ke `/saya`, dan
  `wajibGenerus()` mengarahkan admin ke `/dashboard`. Profil generus di
  `/saya/profil`: data diri lengkap diubah sendiri (RPC
  `ubah_data_diri_saya`: sapaan, tempat/tanggal lahir, sekolah & kelas,
  pendidikan, kegiatan, kontak, HP wali, orang tua; ditolak bila membuatnya
  keluar dari generus), alamat di `/saya/alamat` (RPC `ubah_alamat_saya`);
  setiap perubahan tercatat di `perubahan_data_generus` (admin menandai
  "Sudah dicek" di Perlu dicek & detail jamaah). Nama lengkap, jenis
  kelamin, status pernikahan, kelompok, keluarga lewat laporan
  `usulan_koreksi` (status pernikahan berisi nilai terstruktur; tombol
  Terapkan → RPC `terapkan_usulan_koreksi`, security invoker). NIK/KK tidak
  tampil di akun generus. Semua RPC ini hanya menulis baris `jamaah_saya()`. Izin/sakit
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
  absensi). Absensi pertemuan lewat RPC `buka_absensi_pertemuan`. Beberapa
  sesi pemateri per pertemuan (`pertemuan_materi`, RPC
  `simpan_materi_pertemuan`) dipilih dari daftar pengajar rutin
  (`/kegiatan/pengajar`, tabel `pengajar`; rekap pemateri per bulan di
  halaman yang sama, `src/lib/kegiatan/rekap-pengajar.ts`). Tindak lanjut
  "perlu disapa" (`sapaan_jamaah`) dan laporan bulanan (`/cetak/laporan`):
  lihat `docs/absensi.md`.
- Asisten KawanKu (`docs/asisten.md`): kartu pengingat/peringatan/saran/
  apresiasi di Beranda admin & generus, dihitung dari data yang ada
  (`src/lib/asisten/`), termasuk deteksi pola kegiatan & data ganda.
  "Kawan" (F7): kartu Ringkasan hari ini di Beranda admin (RPC
  `ringkasan_hari_ini`, aturan izin = RLS) + notifikasi pagi ke HP admin;
  sambutan generus (`src/lib/generus/sambutan.ts`); rapor bulanan
  `/saya/rapor` (`raporBulan()`) + notifikasi tanggal 1.
  Pemantau galat: `src/instrumentation.ts` + halaman galat → RPC
  `catat_galat` → Panel pengembang (tabel `galat_aplikasi`, hanya pengembang).
- Notifikasi HP (`docs/notifikasi.md`): generus menyalakan Web Push
  (`SaklarNotifikasi`); pg_cron `kawanku-kirim-notifikasi` →
  `private.kirim_notifikasi()` → pg_net → `/api/notifikasi/kirim` (rahasia
  bersama `NOTIFIKASI_RAHASIA` = Vault `kawanku_notifikasi_rahasia`, kunci
  VAPID di env) → `web-push`. Tanpa secret key Supabase.
- Cadangan data (`docs/cadangan.md`, Pengaturan → Cadangan data, hanya
  pengembang): lapis 1 pg_cron `kawanku-cadangan` → potret terenkripsi di
  `private.cadangan_isi` (rotasi harian/mingguan/bulanan/tahunan, pemeriksaan
  tiap tanggal 1, pemulihan per baris `pulihkan_dari_cadangan`); lapis 2
  GitHub Actions `cadangan.yml` (dump terenkripsi gpg, artifact 90 hari).
  Peringatan sistem ke HP pengembang lewat `notifikasi_sistem`.
- Tempat sampah (`docs/tempat-sampah.md`, Pengaturan → Tempat sampah):
  hapus jamaah/keluarga/kegiatan → `tempat_sampah` 30 hari beserta data yang
  ikut terhapus (trigger `ke_tempat_sampah` / `catat_ikut_terhapus`);
  dikembalikan apa adanya lewat RPC `kembalikan_dari_sampah` oleh yang berwenang
  menghapusnya. Tabel anak ber-FK cascade baru → tambahkan triggernya.
- Realtime: `SegarkanLangsung` (di layout admin & generus) mendengarkan
  perubahan tabel lewat Supabase Realtime (publikasi `supabase_realtime`,
  migrasi `20261022100000_realtime`; tetap RLS) lalu `router.refresh()`,
  juga saat tab dibuka lagi/koneksi kembali. Tabel baru yang tampil di
  halaman → tambahkan ke migrasi publikasi & daftar `TABEL`. Pencarian/filter
  memakai `FormOtomatis` (tanpa tombol: ketik → cari setelah jeda, pilihan →
  langsung).
- Memuat & transisi: fallback data besar & `loading.tsx` memakai `Memuat`
  (logo "K" beranimasi, `src/components/ui/memuat.tsx`, CSS `.kk-k-*` di
  `globals.css`). Isi halaman dibungkus `<ViewTransition>` di layout
  (memudar halus saat pindah halaman); pembaruan yang bukan pindah halaman
  (Realtime, pencarian, simpan form) ditandai `addTransitionType("diam")`
  supaya tidak beranimasi.
- Sadar perangkat (Reno, 27 Okt 2026): perangkat yang sedang dipakai selalu
  disebut **"perangkat ini"** (bukan "HP ini"/"laptop ini"; PC & laptop tidak
  bisa dibedakan). Jenisnya (`usePerangkat()`, `src/components/perangkat/`;
  `kenaliPerangkat()`/`kataTekan()` di `src/lib/perangkat.ts`, murni) hanya
  untuk perilaku: "Klik" (laptop/PC) vs "Ketuk" (HP/tablet), sebelum hidrasi
  "Pilih"; laptop/PC: isian pertama langsung difokuskan, kamera depan
  seperti cermin; HP/tablet: tanpa fokus otomatis.
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
      absensi/          # daftar sesi, [id]/ (scan + rekap), kartu/ (kartu QR),
                        # akun/ (akun generus), rekap/ (pratinjau rekap bulanan/per kegiatan),
                        # laporan/ (tren, per kelompok/kegiatan/kategori, perlu disapa),
                        # izin/ (pengajuan izin generus)
      kegiatan/         # agenda/kalender, pertemuan/ (pemateri, materi, batal, absensi),
                        # kelola/ & kelola/[id]/ (kegiatan & jadwal), pengumuman/ (untuk generus)
    (generus)/          # area akun generus: saya/ (beranda, jadwal/, kehadiran/, rapor/, scan/, profil/,
                        # alamat/, pin/, izin/), absen/ (hasil QR)
    layar/[id]/         # QR layar jalur 2 (tanpa navigasi, untuk proyektor)
      pengaturan/       # akun, tampilan, admin & akses, kelompok, peran & izin,
                        # pengumuman, panel pengembang, cadangan data, wewenang saya,
                        # kategori, tempat sampah, bantuan (difilter izin)
    cetak/kartu/        # lembar cetak kartu QR (A4, tanpa navigasi)
    cetak/rekap/        # lembar cetak rekap absensi (KopDokumen, A4)
    cetak/laporan/      # laporan bulanan kehadiran & kegiatan (KopDokumen, A4)
    cetak/akun/         # slip info masuk akun generus (alamat + QR, username, aturan PIN)
    api/rekap/          # GET ekspor rekap absensi (CSV)
    api/notifikasi/kirim/ # POST dari database (pg_net): kirim Web Push pengingat
    (auth)/             # halaman tanpa navigasi (login)
      login/page.tsx    # login admin (email + kata sandi)
      masuk/page.tsx    # login generus (username + PIN)
      keluar/route.ts   # hapus sesi non-admin lalu ke /login (bukan untuk <Link>)
    layout.tsx          # root layout, metadata, viewport
    globals.css         # design token
    favicon.ico, icon.svg, apple-icon.png   # ikon tab & iPhone (otomatis)
  components/
    absensi/            # PertemuanHariIni, PanelScan (scanner USB), PilihStatus, TombolCetak,
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
  instrumentation.ts    # onRequestError → pemantau galat (RPC catat_galat)
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
- **Pedoman Bahasa** (`docs/pedoman-bahasa.md`, WAJIB untuk semua teks
  aplikasi): berbicara seperti generus yang santun dan berakhlak baik
  (sopan, rendah hati, ramah tidak berlebihan, jujur, tidak menyalahkan,
  tidak menggurui). Galat: "Mohon maaf, … Silakan …". Kata ganti: generus
  **kamu**; admin/pengurus **tanpa kata ganti** (bukan kamu/Anda/Bapak-Ibu);
  umum tanpa kata ganti. Ejaan baku, tanpa emoji.

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
- Desain mengikuti **Pedoman Desain** (`docs/pedoman-desain.md`, One UI):
  area lihat di atas & area sentuh di bawah, latar netral + kartu membulat,
  biru sebagai aksen; panel biru penuh hanya di halaman sambutan (masuk).
  Redesign bertahap per halaman.
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
  Sejak 22 Okt 2026: kategori generus selalu khusus lajang (constraint
  `kategori_jamaah_generus_lajang`); urutan pemeriksaan diatur sistem
  (`urutanSistem()` di `src/lib/jamaah/kategori.ts`, ditulis lewat RPC
  `atur_urutan_kategori`), tidak ada tombol Naik/Turun; aturan yang membuat
  kategori lain tak terpakai ditolak (`masalahAturan()`). Kombinasi data tak
  lazim diperingatkan di form jamaah & Perlu dicek (`cekKewajaran()`).
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
