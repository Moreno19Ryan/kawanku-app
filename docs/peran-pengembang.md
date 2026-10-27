# Peran Pengembang (developer / super admin aplikasi)

Status: **usulan**. Migrasi `supabase/migrations/20261021071500_peran_pengembang.sql`
diterapkan ke produksi hanya setelah Reno menjawab "OK, jalankan".

## Tujuan

Akun untuk pengembang aplikasi, terpisah dari pengurus desa:

- **Mengurus sistem**: izin baru `sistem.kelola`. Nanti dipakai untuk panel
  pengembang (mode perawatan, saklar fitur, pengumuman, info sistem).
- **Memulihkan akses**: izin `akses.kelola`. Pengembang bisa mengaktifkan
  kembali atau membuatkan admin desa bila semuanya terkunci.
- **Data jamaah: hanya lihat** (migrasi
  `20261021120000_pengembang_lihat_jamaah`, keputusan Reno): izin
  `jamaah.lihat` untuk seluruh desa, supaya modul Jamaah bisa dipantau.
  Ditambah `keluarga.lihat` (migrasi `20261021160000_pengembang_lihat_keluarga`).
  Tidak ada `jamaah.tambah/ubah/hapus`, `keluarga.kelola`, `keringanan.*`, atau
  `janda_duda.*`; data terbatas tetap tersembunyi.

## Aturan baru (RLS)

"Tingkat sistem" = peran yang memegang `sistem.kelola`, atau akun yang punya
peran seperti itu.

| Tindakan | Admin desa (`akses.kelola`) | Pengembang (`sistem.kelola`) |
|---|---|---|
| Melihat akun pengembang di daftar admin | Ya | Ya |
| Menonaktifkan / mengubah nama / menghapus akun pengembang | **Tidak** | Ya |
| Memberi atau mencabut peran pada akun pengembang | **Tidak** | Ya |
| Memberi peran Pengembang ke siapa pun (termasuk diri sendiri) | **Tidak** | Ya |
| Menambah `sistem.kelola` ke peran lain | **Tidak** | Ya |
| Mengubah/menghapus peran Pengembang atau izin `sistem.kelola` | **Tidak** | Ya |
| Mengelola admin desa/kelompok/generus | Ya (seperti sebelumnya) | Ya |
| Melihat data jamaah | Ya | Ya (hanya lihat) |
| Menambah / mengubah / menghapus jamaah | Ya | **Tidak** |
| Keringanan & keterangan janda/duda | Ya | **Tidak** |

Helper baru di skema `private` (security definer): `peran_sistem`,
`akun_sistem`, `boleh_kelola_peran`, `boleh_kelola_akun`,
`boleh_kelola_izin`. Policy update/delete `peran`, `izin`, `peran_izin`,
`admin`, dan insert/update/delete `penugasan_peran` memakai helper ini.
Policy select tidak berubah.

Aplikasi juga menjaga hal yang sama sebelum memakai secret key (yang
melewati RLS): admin desa tidak bisa membuat akun berperan Pengembang dan
tidak bisa mengatur ulang kata sandi akun pengembang.

## Tes

- `supabase/tests/pengembang_rls.test.sql`: 32 skenario. Sudah dicek
  dengan mutasi: mengembalikan policy lama membuat tesnya gagal.
- `supabase/tests/fase1_rls.test.sql`: satu cek jumlah peran dilonggarkan
  (`= 3` → `>= 3`), karena seed sekarang punya 4 peran.

## Membuat akun pengembang (setelah migrasi diterapkan)

Admin desa sengaja **tidak bisa** memberi peran Pengembang, jadi akun
pertama dibuat oleh pemilik project:

1. Supabase → **Authentication → Users → Add user**. Isi email dan kata
   sandi yang kuat, lalu centang **Auto Confirm User**.
2. Supabase → **SQL Editor**: jalankan SQL di bawah setelah email dan nama
   diganti.

```sql
do $$
declare
  v_email text := 'dev@kawanku.com';   -- ganti
  v_nama  text := 'Nama Pengembang';   -- ganti
  v_user  uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(v_email);
  if v_user is null then
    raise exception 'User % belum ada di Authentication → Users', v_email;
  end if;

  insert into public.admin (user_id, nama) values (v_user, v_nama)
  on conflict (user_id) do nothing;

  insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
  select v_user, id, null from public.peran where kode = 'pengembang'
  on conflict do nothing;
end $$;
```

## Berikutnya (PR terpisah)

- Panel pengembang: mode perawatan, saklar fitur (per kelompok), pengumuman,
  dan info sistem. Butuh tabel `pengaturan_sistem`.
- ~~MFA (aplikasi authenticator) wajib untuk akun pengembang.~~ Selesai: `docs/mfa.md`.
