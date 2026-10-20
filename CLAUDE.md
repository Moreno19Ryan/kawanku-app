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
  generus (jamaah generus, di tingkat desa atau tingkat kelompok). Peran dan
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
    khusus yang hanya terlihat admin.
- **UI**: gaya One UI (halus, interaktif, intuitif). Laptop sebagai tampilan
  utama, tapi tetap nyaman di HP. PWA.
- **Tidak ada NIK atau data sensitif lain** sampai pengurus memutuskan aturannya.
  Status pernikahan hanya `lajang`/`menikah`/`janda_duda`; untuk janda/duda
  hanya keterangan `cerai_hidup`/`cerai_mati` di tabel terbatas
  (`jamaah_janda_duda`, default hanya admin desa), tanpa alasan atau detail
  lain. Data yang lebih sensitif dari profil biasa disimpan di tabel terpisah
  dengan izin sendiri, bukan sebagai kolom di `jamaah`.

### Fase

| Fase | Isi | Status |
| ---- | --- | ------ |
| 0 | Fondasi: scaffold, Supabase client, kerangka UI, PWA, logo, dokumen | Selesai |
| 1 | Database jamaah: kelompok, keluarga, jamaah, status pernikahan & sekolah, kategori jamaah, kode jamaah, peran sebagai data, RLS | Usulan skema v2 di `docs/schema-proposal.md` (menunggu review, belum ada migrasi) |
| 2 | Absensi (QR kartu, QR berputar, jalur keringanan) | Belum |
| 3 | Monitoring kegiatan | Belum |

## Stack

- Next.js 16 (App Router, Turbopack, `cacheComponents` aktif) + TypeScript
- Tailwind CSS v4 (token di `src/app/globals.css`)
- Supabase (PostgreSQL, RLS, Auth) lewat `@supabase/ssr`
- Deploy di Vercel, fungsi di region `sin1` (dekat database `ap-southeast-1`)
- Ikon: `lucide-react`

Catatan Next.js 16: file `middleware.ts` sudah diganti namanya menjadi
`proxy.ts`. Dokumentasi versi yang terpasang ada di `node_modules/next/dist/docs/`.

## Struktur folder

```
src/
  app/
    (app)/              # area admin, memakai layout sidebar + bottom nav
      layout.tsx
      dashboard/page.tsx
    (auth)/             # halaman tanpa navigasi (login)
      login/page.tsx    # login admin (kerangka)
    layout.tsx          # root layout, metadata, viewport
    globals.css         # design token
    favicon.ico, icon.svg, apple-icon.png   # ikon tab & iPhone (otomatis)
  components/
    brand/              # LogoDesa (logo Desa Kartika Wanasari)
    dokumen/            # KopDokumen: header wajib setiap dokumen cetak/ekspor
    kartu/              # KartuQr: kartu absensi jalur 1 (ukuran KTP)
    layout/             # sidebar, bottom nav, header, footer, BrandMark
    ui/                 # komponen dasar (Card, ...)
  lib/
    supabase/
      client.ts         # client untuk browser (Client Components)
      server.ts         # client untuk server (Server Components/Actions)
      proxy.ts          # refresh sesi, dipanggil dari src/proxy.ts
      env.ts            # baca NEXT_PUBLIC_SUPABASE_*
  proxy.ts              # Next.js proxy (dulu middleware)
public/
  brand/                # logo aplikasi KawanKu (horizontal & mark), og-image
    desa/               # logo Desa Kartika Wanasari (+ png/ untuk PDF/email/cetak)
  icons/                # ikon PWA (dirujuk manifest)
  manifest.webmanifest  # manifest PWA
docs/                   # dokumen desain (usulan skema, dsb.)
supabase/migrations/    # (nanti) file migrasi, hanya setelah disetujui
```

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

## Keputusan yang masih menunggu pengurus

1. **Data awal jamaah**: sumber, format, dan siapa yang mengimpor.
2. **Data sensitif**: apakah NIK/alamat/no. HP disimpan, siapa yang boleh
   melihat, dan berapa lama disimpan. Sampai diputuskan, **jangan buat kolom
   data sensitif apa pun**.
3. **Detail hak akses**: apa saja yang boleh dilihat/diubah tiap peran (admin
   desa, admin kelompok, admin generus).
4. **Kategori jamaah**: aturan dan angka seed (DRAF di
   `docs/schema-proposal.md` §4.4). Kategori dihitung otomatis dari aturan
   data (status sekolah, status pernikahan, dan usia untuk lansia); bisa diubah
   lewat data tanpa migrasi. Sudah diputuskan: remaja dewasa tanpa batas atas
   umur.
5. **Pembaruan status sekolah tahunan**: status sekolah diperbarui manual
   tiap tahun ajaran baru (sekitar Juli); siapa penanggung jawabnya, dan
   apakah nanti perlu kolom `kelas` untuk kenaikan jenjang otomatis.
6. **Pengurus generus per kelompok**: apakah setiap kelompok punya admin
   generus sendiri, atau hanya tingkat desa (skema mendukung keduanya).
