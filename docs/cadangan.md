# Cadangan data (F6a)

Dua lapis, keduanya khusus pengembang.

## Lapis 1: di dalam database (cepat dipulihkan)

- Potret semua tabel data aplikasi (schema `public`, kecuali tabel teknis:
  galat, langganan & catatan notifikasi, sesi layar, tabel cadangan sendiri)
  disimpan **terenkripsi** (`pgp_sym_encrypt` AES-256) di
  `private.cadangan_isi`. Kuncinya acak, dibuat migrasi di Vault
  (`kawanku_cadangan_kunci`) dan tidak pernah keluar dari database.
- Jadwal (Pengaturan → Cadangan data), pg_cron `kawanku-cadangan` tiap
  02.00 WIB → `private.cadangan_terjadwal()`:

  | Jenis | Kapan | Bawaan disimpan |
  | ----- | ----- | --------------- |
  | Harian | setiap hari | 7 |
  | Mingguan | Ahad | 5 |
  | Bulanan | tanggal 1 | 12 |
  | Tahunan | 1 Januari | 5 |
  | Manual | tombol "Cadangkan sekarang" | 10 |

  Lebih dari jumlah simpan → yang tertua dihapus (rotasi).
- **Pemeriksaan otomatis** tiap tanggal 1: cadangan terakhir didekripsi lagi
  dan dicocokkan (jumlah baris + sidik md5). Bisa juga ditekan manual
  ("Periksa").
- **Pemulihan per baris**: pilih cadangan → tabel → cari → lihat perbedaan
  "sekarang ↔ di cadangan" → Pulihkan / Kembalikan (baris yang sudah
  terhapus). Hanya tabel ber-primary key tunggal. Trigger & aturan tabel
  tetap berlaku; kode jamaah `KW-` lama dipertahankan saat dikembalikan.
  Setiap pemulihan tercatat di `pemulihan_cadangan`.
- **Peringatan ke HP pengembang** (`notifikasi_sistem`, lewat jalur
  notifikasi HP, `docs/notifikasi.md`): cadangan gagal, pemeriksaan gagal,
  ruang database > 400 MB (80% batas paket Free). Nyalakan "Peringatan di HP"
  di halaman Cadangan data.
- Kelemahan: ikut hilang bila project Supabase rusak/terhapus → lapis 2.

## Lapis 2: di luar Supabase (GitHub Actions)

Alur `.github/workflows/cadangan.yml` ("Cadangan mingguan"), Ahad 03.00 WIB
(bisa dijalankan manual: Actions → Cadangan mingguan → Run workflow):

1. `supabase db dump` (cara resmi Supabase): `roles.sql`, `schema.sql`,
   `data.sql` (termasuk akun `auth`; tanpa isi cadangan lapis 1).
2. Dipaket `tar.gz`, dienkripsi **AES-256 (gpg)** dengan sandi pengembang.
3. Disimpan sebagai artifact 90 hari (±13 salinan).

**Repo ini publik**: artifact bisa diunduh siapa pun yang login GitHub,
karena itu sandi wajib panjang (minimal 32 karakter, dicek alur) dan hanya
disimpan pengembang. Lebih aman lagi bila repo dijadikan private.

### Pemasangan (sekali, oleh Reno)

GitHub → repo → Settings → Secrets and variables → Actions → New repository secret:

- `SUPABASE_DB_URL`: Supabase → Connect → **Session pooler** (port 5432,
  `...pooler.supabase.com`), kata sandi database diisi. Jangan pakai
  "Direct connection" (IPv6, tidak terjangkau runner GitHub).
- `CADANGAN_SANDI`: sandi acak ≥ 32 karakter, mis.
  `node -p crypto.randomBytes(32).toString('hex')`. **Simpan juga di tempat
  aman di luar GitHub**: tanpa sandi ini cadangan tidak bisa dibuka.

### Memulihkan dari lapis 2 (darurat)

1. Unduh artifact dari Actions, ekstrak zip-nya.
2. `gpg --decrypt kawanku-YYYYMMDD-HHMM.tar.gz.gpg > cadangan.tar.gz` (masukkan sandi),
   lalu `tar -xzf cadangan.tar.gz`.
3. Buat project Supabase baru, lalu ikuti panduan resmi Supabase
   "Backup and restore using CLI":
   ```sh
   psql --single-transaction --variable ON_ERROR_STOP=1 \
     --file roles.sql --file schema.sql \
     --command 'SET session_replication_role = replica' \
     --file data.sql --dbname "$URL_PROJECT_BARU"
   ```
4. Isi ulang secret Vault (notifikasi) dan env Vercel ke project baru. Kunci
   cadangan lapis 1 dibuat ulang otomatis oleh migrasi; cadangan lapis 1 lama
   memang tidak ikut.
