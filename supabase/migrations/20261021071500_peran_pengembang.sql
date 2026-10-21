-- Peran Pengembang (developer/super admin aplikasi).
-- Usulan: docs/peran-pengembang.md. Diterapkan ke produksi hanya setelah
-- Reno menjawab "OK, jalankan".
--
-- Prinsip:
--   * Pengembang mengelola SISTEM (izin baru sistem.kelola: nanti mode
--     perawatan, saklar fitur, info sistem) dan bisa memulihkan akses admin
--     (akses.kelola). TIDAK otomatis memegang izin data jamaah.
--   * Peran/izin/akun "tingkat sistem" hanya bisa diubah pemegang
--     sistem.kelola. Admin desa (akses.kelola) tidak bisa memberi, mencabut,
--     menonaktifkan, atau mengubah akun pengembang, dan tidak bisa menambahkan
--     sistem.kelola ke peran lain.

-- ---------------------------------------------------------------------
-- 1. Helper (security definer, skema private)
-- ---------------------------------------------------------------------

-- Peran tingkat sistem = peran yang memegang izin sistem.kelola.
create or replace function private.peran_sistem(p_peran_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.peran_izin
    where peran_id = p_peran_id and izin_kode = 'sistem.kelola'
  );
$$;

-- Akun tingkat sistem = punya minimal satu penugasan peran tingkat sistem.
create or replace function private.akun_sistem(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.penugasan_peran pp
    join public.peran_izin pi on pi.peran_id = pp.peran_id and pi.izin_kode = 'sistem.kelola'
    where pp.user_id = p_user_id
  );
$$;

-- Boleh mengelola peran ini (izinnya, datanya, penugasannya)?
create or replace function private.boleh_kelola_peran(p_peran_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.boleh('akses.kelola', null)
    and (not private.peran_sistem(p_peran_id) or private.boleh('sistem.kelola', null));
$$;

-- Boleh mengelola akun admin ini (profil, aktif, penugasan)?
create or replace function private.boleh_kelola_akun(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.boleh('akses.kelola', null)
    and (not private.akun_sistem(p_user_id) or private.boleh('sistem.kelola', null));
$$;

-- Boleh menambah/mengubah/menghapus baris izin dengan kode ini?
create or replace function private.boleh_kelola_izin(p_izin_kode text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.boleh('akses.kelola', null)
    and (p_izin_kode <> 'sistem.kelola' or private.boleh('sistem.kelola', null));
$$;

revoke all on function
  private.peran_sistem(uuid),
  private.akun_sistem(uuid),
  private.boleh_kelola_peran(uuid),
  private.boleh_kelola_akun(uuid),
  private.boleh_kelola_izin(text)
from public;
grant execute on function
  private.peran_sistem(uuid),
  private.akun_sistem(uuid),
  private.boleh_kelola_peran(uuid),
  private.boleh_kelola_akun(uuid),
  private.boleh_kelola_izin(text)
to authenticated;

-- ---------------------------------------------------------------------
-- 2. Policy: perketat perubahan pada peran/izin/akun tingkat sistem
--    (select tidak berubah; insert peran & admin baru tidak berubah karena
--    baris baru belum punya izin/penugasan).
-- ---------------------------------------------------------------------

drop policy peran_update on public.peran;
drop policy peran_delete on public.peran;
create policy peran_update on public.peran
  for update to authenticated
  using (private.boleh_kelola_peran(id))
  with check (private.boleh_kelola_peran(id));
create policy peran_delete on public.peran
  for delete to authenticated using (private.boleh_kelola_peran(id));

drop policy izin_update on public.izin;
drop policy izin_delete on public.izin;
create policy izin_update on public.izin
  for update to authenticated
  using (private.boleh_kelola_izin(kode))
  with check (private.boleh_kelola_izin(kode));
create policy izin_delete on public.izin
  for delete to authenticated using (private.boleh_kelola_izin(kode));

drop policy peran_izin_insert on public.peran_izin;
drop policy peran_izin_update on public.peran_izin;
drop policy peran_izin_delete on public.peran_izin;
create policy peran_izin_insert on public.peran_izin
  for insert to authenticated
  with check (private.boleh_kelola_peran(peran_id) and private.boleh_kelola_izin(izin_kode));
create policy peran_izin_update on public.peran_izin
  for update to authenticated
  using (private.boleh_kelola_peran(peran_id) and private.boleh_kelola_izin(izin_kode))
  with check (private.boleh_kelola_peran(peran_id) and private.boleh_kelola_izin(izin_kode));
create policy peran_izin_delete on public.peran_izin
  for delete to authenticated
  using (private.boleh_kelola_peran(peran_id) and private.boleh_kelola_izin(izin_kode));

drop policy admin_update on public.admin;
drop policy admin_delete on public.admin;
create policy admin_update on public.admin
  for update to authenticated
  using (private.boleh_kelola_akun(user_id))
  with check (private.boleh_kelola_akun(user_id));
create policy admin_delete on public.admin
  for delete to authenticated using (private.boleh_kelola_akun(user_id));

drop policy penugasan_peran_insert on public.penugasan_peran;
drop policy penugasan_peran_update on public.penugasan_peran;
drop policy penugasan_peran_delete on public.penugasan_peran;
create policy penugasan_peran_insert on public.penugasan_peran
  for insert to authenticated
  with check (private.boleh_kelola_peran(peran_id) and private.boleh_kelola_akun(user_id));
create policy penugasan_peran_update on public.penugasan_peran
  for update to authenticated
  using (private.boleh_kelola_peran(peran_id) and private.boleh_kelola_akun(user_id))
  with check (private.boleh_kelola_peran(peran_id) and private.boleh_kelola_akun(user_id));
create policy penugasan_peran_delete on public.penugasan_peran
  for delete to authenticated
  using (private.boleh_kelola_peran(peran_id) and private.boleh_kelola_akun(user_id));

-- ---------------------------------------------------------------------
-- 3. Data: izin sistem.kelola + peran pengembang
-- ---------------------------------------------------------------------
insert into public.izin (kode, deskripsi) values
  ('sistem.kelola', 'Mengelola sistem aplikasi (mode perawatan, saklar fitur, info sistem)');

insert into public.peran (kode, nama, wilayah, hanya_generus, deskripsi) values
  ('pengembang', 'Pengembang', 'desa', false,
   'Pengembang aplikasi: sistem & pemulihan akses, tanpa akses data jamaah');

insert into public.peran_izin (peran_id, izin_kode)
select p.id, i.kode
from public.peran p
join public.izin i on i.kode in ('sistem.kelola', 'akses.kelola')
where p.kode = 'pengembang';
