# Pengelolaan akun admin generus per wilayah

Status: **usulan**. Migrasi `supabase/migrations/20261021100000_kelola_admin_generus.sql`
diterapkan ke produksi hanya setelah Reno menjawab "OK, jalankan".
Kode aplikasinya aman di-merge lebih dulu: sebelum migrasi diterapkan,
aturan lama tetap berlaku (admin desa mengelola semua akun non-pengembang,
admin kelompok belum melihat menu Admin & akses).

## Keputusan (Reno)

| Akun | Dikelola oleh |
|---|---|
| Admin generus **Kelompok N** | Admin **Kelompok N** saja (+ pengembang untuk pemulihan). **Bukan** admin desa. |
| Admin generus **desa** | Admin desa (+ pengembang) |
| Admin kelompok, admin desa | Admin desa (+ pengembang), seperti sebelumnya |
| Pengembang | Pengembang saja |

"Mengelola" berarti membuat akun, mengatur ulang kata sandi, mengaktifkan
atau menonaktifkan, mengubah nama, dan memberi atau mencabut peran.
Admin desa tetap **bisa melihat** akun admin generus kelompok, tapi tidak
bisa mengubahnya.

## Cara kerja

- Izin baru **`akses.kelola_generus`** ("Mengelola akun admin generus di
  kelompoknya") untuk `admin_kelompok` dan `pengembang`. Berlaku sesuai
  wilayah penugasan: admin Kelompok 1 hanya untuk Kelompok 1. Pengembang
  (tanpa kelompok) berlaku untuk semua kelompok. `admin_desa` sengaja tidak
  diberi.
- Akun "generus kelompok" adalah akun yang **semua** perannya peran khusus
  generus dengan kelompok terisi.
- Helper di skema `private`:
  - `akun_generus_kelompok`, `kelola_generus_mana_pun`;
  - `boleh_kelola_akun` (versi baru): akun pengembang → `sistem.kelola`;
    generus kelompok → `akses.kelola_generus` di setiap kelompoknya; akun
    tanpa peran → `akses.kelola` atau `akses.kelola_generus` di mana pun;
    selain itu → `akses.kelola`;
  - `boleh_beri_peran` dan `boleh_kelola_penugasan`.
- Policy `admin` (select, insert, update, delete) dan `penugasan_peran`
  (select, insert, update, delete) memakai helper ini.
- Fungsi untuk aplikasi (security invoker, hanya `authenticated`):
  - `public.akun_dapat_dikelola()`: akun mana saja yang boleh dikelola
    pemanggil. Dipakai untuk menampilkan tombol, dan **wajib** dicek
    sebelum memakai secret key (atur ulang kata sandi).
  - `public.boleh_beri_peran(peran, kelompok)`: dicek sebelum membuat akun
    baru dengan secret key.

## Aplikasi

- Pengaturan → **Admin & akses** juga tampil untuk admin kelompok. Mereka
  hanya melihat akunnya sendiri dan akun admin generus kelompoknya, dan
  pilihan perannya hanya "Admin Generus · Kelompok N".
- Untuk admin desa, peran Admin Generus hanya bisa diberikan untuk
  "Seluruh desa". Kartu admin generus kelompok tampil tanpa tombol, dengan
  keterangan "Bukan wewenangmu".

## Tes

`supabase/tests/kelola_generus_rls.test.sql` berisi 39 skenario. Uji
mutasi sudah dicek: memberi `akses.kelola_generus` ke admin desa, atau
mengembalikan `boleh_kelola_akun` versi lama, langsung menggagalkan
13 tes.
