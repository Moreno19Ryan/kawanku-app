# Verifikasi dua langkah (MFA)

Disetujui Reno, 27 Okt 2026. Migrasi `20261101110000_mfa_pengembang`.

## Cara kerja

- Metode: **aplikasi authenticator (TOTP)**, mis. Google Authenticator atau
  Microsoft Authenticator. Gratis di semua paket Supabase (bukan SMS).
- **Akun pengembang wajib**: setelah login, `wajibAdmin()` mengarahkan ke
  `/mfa/daftar` sampai MFA aktif. Admin lain boleh mengaktifkannya dari
  Pengaturan → Akun saya (tidak wajib).
- Setiap masuk, akun ber-MFA diminta kode 6 angka di `/mfa` (sesi naik dari
  `aal1` ke `aal2`).
- **Dijaga database**: kebijakan RESTRICTIVE `wajib_aal2` di semua tabel
  `public` (`private.aal_cukup()`) dan `private.wajib_pengembang()`. Akun yang
  sudah punya MFA tidak bisa membaca/mengubah data lewat API hanya dengan
  kata sandi. Akun tanpa MFA tidak terpengaruh.
- **Tabel `public` baru wajib diberi kebijakan yang sama**:
  ```sql
  create policy wajib_aal2 on public.<tabel> as restrictive for all to authenticated
    using ((select private.aal_cukup())) with check ((select private.aal_cukup()));
  ```
  (Tes `mfa_pengembang.test.sql` memeriksa semua tabel.)

## Saran untuk pengembang

- Daftarkan **dua perangkat** (mis. HP utama + HP cadangan/tablet) lewat
  Pengaturan → Akun saya → Tambah perangkat. Akun pengembang tidak bisa
  menghapus perangkat terakhirnya.
- Simpan **kode rahasia** (tampil saat mendaftar) di tempat aman, mis.
  pengelola kata sandi. Kode ini bisa dimasukkan ke aplikasi authenticator
  di HP baru.

## Pemulihan bila semua perangkat hilang

Hanya pemilik project Supabase. Supabase → SQL Editor:

```sql
-- Hapus MFA akun ini; setelah login berikutnya, aplikasi meminta
-- pendaftaran ulang.
delete from auth.mfa_factors
where user_id = (select id from auth.users where lower(email) = lower('email-pengembang@contoh.id'));
```
