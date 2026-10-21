-- Pengelolaan akun admin generus per wilayah.
-- Usulan: docs/kelola-admin-generus.md. Diterapkan ke produksi hanya setelah
-- Reno menjawab "OK, jalankan".
--
-- Keputusan Reno:
--   * Akun admin generus KELOMPOK N dikelola admin kelompok N (bukan admin
--     desa). Pengembang tetap bisa (pemulihan akses).
--   * Akun admin generus DESA dikelola admin desa (seperti sebelumnya).
--   * Akun lain (admin desa, admin kelompok) tetap dikelola akses.kelola.
--
-- "Mengelola" = membuat profil, mengubah nama/aktif, memberi/mencabut peran.
-- Izin baru akses.kelola_generus berlaku per wilayah penugasan (bukan
-- global), jadi admin kelompok 1 hanya bisa untuk Kelompok 1.

-- ---------------------------------------------------------------------
-- 1. Helper
-- ---------------------------------------------------------------------

-- Akun generus kelompok = punya penugasan, dan SEMUA penugasannya peran
-- hanya_generus dengan kelompok_id terisi.
create or replace function private.akun_generus_kelompok(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.penugasan_peran where user_id = p_user_id)
     and not exists (
       select 1
       from public.penugasan_peran pp
       join public.peran p on p.id = pp.peran_id
       where pp.user_id = p_user_id
         and (not p.hanya_generus or pp.kelompok_id is null)
     );
$$;

-- Pemanggil memegang akses.kelola_generus di wilayah mana pun?
create or replace function private.kelola_generus_mana_pun()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.penugasan_peran pp
    join public.admin a       on a.user_id = pp.user_id and a.aktif
    join public.peran p       on p.id = pp.peran_id and not p.hanya_generus
    join public.peran_izin pi on pi.peran_id = p.id and pi.izin_kode = 'akses.kelola_generus'
    where pp.user_id = (select auth.uid())
  );
$$;

-- Boleh mengelola akun admin ini? (menggantikan versi migrasi pengembang)
create or replace function private.boleh_kelola_akun(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.akun_sistem(p_user_id)
      then private.boleh('sistem.kelola', null)
    when private.akun_generus_kelompok(p_user_id)
      then not exists (
        select 1 from public.penugasan_peran pp
        where pp.user_id = p_user_id
          and not private.boleh('akses.kelola_generus', pp.kelompok_id)
      )
    -- Akun tanpa peran (baru dibuat, belum diberi peran).
    when not exists (select 1 from public.penugasan_peran where user_id = p_user_id)
      then private.boleh('akses.kelola', null) or private.kelola_generus_mana_pun()
    else private.boleh('akses.kelola', null)
  end;
$$;

-- Boleh memberi/mengubah/mencabut penugasan (peran + wilayah) ini?
-- Bagian peran saja, tanpa cek akun (dipakai juga untuk akun baru).
create or replace function private.boleh_beri_peran(p_peran_id uuid, p_kelompok_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.peran_sistem(p_peran_id)
      then private.boleh('sistem.kelola', null)
    when p_kelompok_id is not null
         and (select hanya_generus from public.peran where id = p_peran_id)
      then private.boleh('akses.kelola_generus', p_kelompok_id)
    else private.boleh('akses.kelola', null)
  end;
$$;

create or replace function private.boleh_kelola_penugasan(
  p_user_id uuid, p_peran_id uuid, p_kelompok_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.boleh_kelola_akun(p_user_id)
     and private.boleh_beri_peran(p_peran_id, p_kelompok_id);
$$;

revoke all on function
  private.akun_generus_kelompok(uuid),
  private.kelola_generus_mana_pun(),
  private.boleh_beri_peran(uuid, uuid),
  private.boleh_kelola_penugasan(uuid, uuid, uuid)
from public;
grant execute on function
  private.akun_generus_kelompok(uuid),
  private.kelola_generus_mana_pun(),
  private.boleh_beri_peran(uuid, uuid),
  private.boleh_kelola_penugasan(uuid, uuid, uuid)
to authenticated;

-- ---------------------------------------------------------------------
-- 2. Fungsi untuk aplikasi (Data API). security invoker: tetap tunduk RLS.
-- ---------------------------------------------------------------------

-- Akun admin yang boleh dikelola pemanggil (untuk menampilkan tombol dan
-- sebagai cek sebelum memakai secret key).
create or replace function public.akun_dapat_dikelola()
returns setof uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select a.user_id from public.admin a where private.boleh_kelola_akun(a.user_id);
$$;

-- Apakah pemanggil boleh memberi peran+wilayah ini ke akun baru.
create or replace function public.boleh_beri_peran(p_peran_id uuid, p_kelompok_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.boleh_beri_peran(p_peran_id, p_kelompok_id);
$$;

revoke all on function public.akun_dapat_dikelola(), public.boleh_beri_peran(uuid, uuid)
  from public, anon;
grant execute on function public.akun_dapat_dikelola(), public.boleh_beri_peran(uuid, uuid)
  to authenticated;

-- ---------------------------------------------------------------------
-- 3. Policy admin & penugasan_peran
-- ---------------------------------------------------------------------
drop policy admin_select on public.admin;
drop policy admin_insert on public.admin;
drop policy admin_update on public.admin;
drop policy admin_delete on public.admin;
create policy admin_select on public.admin
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.boleh('akses.kelola', null)
    or private.boleh_kelola_akun(user_id)
  );
create policy admin_insert on public.admin
  for insert to authenticated
  with check (private.boleh('akses.kelola', null) or private.kelola_generus_mana_pun());
create policy admin_update on public.admin
  for update to authenticated
  using (private.boleh_kelola_akun(user_id))
  with check (private.boleh_kelola_akun(user_id));
create policy admin_delete on public.admin
  for delete to authenticated using (private.boleh_kelola_akun(user_id));

drop policy penugasan_peran_select on public.penugasan_peran;
drop policy penugasan_peran_insert on public.penugasan_peran;
drop policy penugasan_peran_update on public.penugasan_peran;
drop policy penugasan_peran_delete on public.penugasan_peran;
create policy penugasan_peran_select on public.penugasan_peran
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.boleh('akses.kelola', null)
    or private.boleh_kelola_akun(user_id)
  );
create policy penugasan_peran_insert on public.penugasan_peran
  for insert to authenticated
  with check (private.boleh_kelola_penugasan(user_id, peran_id, kelompok_id));
create policy penugasan_peran_update on public.penugasan_peran
  for update to authenticated
  using (private.boleh_kelola_penugasan(user_id, peran_id, kelompok_id))
  with check (private.boleh_kelola_penugasan(user_id, peran_id, kelompok_id));
create policy penugasan_peran_delete on public.penugasan_peran
  for delete to authenticated
  using (private.boleh_kelola_penugasan(user_id, peran_id, kelompok_id));

-- ---------------------------------------------------------------------
-- 4. Data: izin baru
-- ---------------------------------------------------------------------
insert into public.izin (kode, deskripsi) values
  ('akses.kelola_generus', 'Mengelola akun admin generus di kelompoknya');

-- admin_kelompok: berlaku untuk kelompok penugasannya saja.
-- pengembang: tanpa kelompok = semua kelompok (pemulihan akses).
-- admin_desa sengaja TIDAK diberi (keputusan Reno).
insert into public.peran_izin (peran_id, izin_kode)
select id, 'akses.kelola_generus' from public.peran where kode in ('admin_kelompok', 'pengembang');
