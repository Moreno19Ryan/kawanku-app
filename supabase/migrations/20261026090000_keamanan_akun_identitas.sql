-- =====================================================================
-- KawanKu: keamanan akun & data identitas (Reno, 26 Okt 2026)
-- =====================================================================
--   1. Setiap admin aktif wajib punya minimal satu peran (dijaga database):
--      peran terakhir tidak bisa dicabut; akun tanpa peran tidak bisa
--      diaktifkan. Mencegah akun "yatim" seperti kasus akun pengembang.
--   2. PIN generus tidak bisa diganti sembarangan oleh admin: hanya
--      "Kembalikan ke PIN awal" (tanggal lahir DDMMYY) dengan alasan, dan
--      setiap pengembalian tercatat di riwayat_pin (terlihat juga oleh
--      generusnya). PIN bebas hanya saat akun baru dibuat.
--   3. NIK & No. KK: diisi admin kelompok, selalu tampil tersamar untuk semua
--      peran. Nomor lengkap hanya bisa dilihat lewat permintaan yang
--      disetujui pengembang (berlaku 1 jam), dan setiap kali dilihat dicatat.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Admin aktif minimal satu peran
-- ---------------------------------------------------------------------
create or replace function private.jaga_peran_minimal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.user_id = old.user_id then
    return new;
  end if;
  -- Akun Auth-nya sedang dihapus (cascade): biarkan.
  if not exists (select 1 from auth.users u where u.id = old.user_id) then
    return old;
  end if;
  if exists (select 1 from public.admin a where a.user_id = old.user_id and a.aktif)
     and not exists (select 1 from public.penugasan_peran pp where pp.user_id = old.user_id and pp.id <> old.id) then
    raise exception 'Admin aktif harus punya minimal satu peran. Tambahkan peran lain dulu, atau nonaktifkan akunnya.'
      using errcode = '23514', hint = 'peran_terakhir';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function private.jaga_peran_minimal() from public, anon, authenticated;

create trigger jaga_peran_minimal before delete or update of user_id on public.penugasan_peran
  for each row execute function private.jaga_peran_minimal();

create or replace function private.jaga_admin_berperan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.aktif and not old.aktif
     and not exists (select 1 from public.penugasan_peran pp where pp.user_id = new.user_id) then
    raise exception 'Beri minimal satu peran sebelum mengaktifkan akun ini.'
      using errcode = '23514', hint = 'tanpa_peran';
  end if;
  return new;
end;
$$;
revoke all on function private.jaga_admin_berperan() from public, anon, authenticated;

create trigger jaga_admin_berperan before update of aktif on public.admin
  for each row execute function private.jaga_admin_berperan();

-- ---------------------------------------------------------------------
-- 2. PIN generus: hanya kembali ke PIN awal, tercatat
-- ---------------------------------------------------------------------
create table public.riwayat_pin (
  id          uuid primary key default gen_random_uuid(),
  jamaah_id   uuid not null references public.jamaah (id) on delete cascade,
  alasan      text not null check (alasan in ('lupa', 'terkunci', 'lainnya')),
  catatan     text check (length(catatan) <= 200),
  oleh        uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index riwayat_pin_jamaah_idx on public.riwayat_pin (jamaah_id, created_at desc);
create index riwayat_pin_oleh_idx on public.riwayat_pin (oleh);
create trigger set_updated_at before update on public.riwayat_pin
  for each row execute function private.set_updated_at();

revoke all on public.riwayat_pin from anon, authenticated;
grant select on public.riwayat_pin to authenticated;
alter table public.riwayat_pin enable row level security;
-- Pengelola akun generus di wilayahnya, dan generusnya sendiri. Ditulis
-- hanya lewat kembalikan_pin_awal().
create policy riwayat_pin_select on public.riwayat_pin
  for select to authenticated
  using (private.boleh_jamaah('akun_generus.kelola', jamaah_id) or jamaah_id = private.jamaah_saya());

-- PIN bebas hanya saat akun dibuat (belum ada PIN).
create or replace function public.atur_pin_generus(p_user_id uuid, p_pin text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_jamaah uuid;
begin
  select g.jamaah_id into v_jamaah from public.akun_generus g where g.user_id = p_user_id;
  if v_jamaah is null or not private.boleh_jamaah('akun_generus.kelola', v_jamaah) then
    raise exception 'Tidak berhak' using errcode = '42501';
  end if;
  if exists (select 1 from private.pin_generus p where p.user_id = p_user_id) then
    raise exception 'Akun ini sudah punya PIN; pakai Kembalikan ke PIN awal'
      using errcode = '42501', hint = 'sudah_ada';
  end if;
  if coalesce(p_pin, '') !~ '^\d{6}$' then
    raise exception 'PIN harus 6 angka' using hint = 'pin';
  end if;
  insert into private.pin_generus (user_id, pin_hash)
  values (p_user_id, extensions.crypt(p_pin, extensions.gen_salt('bf', 10)));
  update public.akun_generus
     set pin_awal = true, gagal_login = 0, terkunci_sampai = null
   where user_id = p_user_id;
end;
$$;

-- Kembalikan PIN ke PIN awal (tanggal lahir DDMMYY), buka kunci, wajib ganti
-- saat masuk berikutnya, dan catat siapa/kapan/alasannya.
create or replace function public.kembalikan_pin_awal(p_jamaah_id uuid, p_alasan text, p_catatan text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_akun    public.akun_generus;
  v_tanggal date;
begin
  if not private.boleh_jamaah('akun_generus.kelola', p_jamaah_id) then
    raise exception 'Tidak berhak' using errcode = '42501';
  end if;
  if coalesce(p_alasan, '') not in ('lupa', 'terkunci', 'lainnya') then
    raise exception 'Pilih alasan' using errcode = '22023', hint = 'alasan';
  end if;
  if p_alasan = 'lainnya' and nullif(trim(coalesce(p_catatan, '')), '') is null then
    raise exception 'Tulis alasannya' using errcode = '22023', hint = 'catatan';
  end if;
  select * into v_akun from public.akun_generus where jamaah_id = p_jamaah_id;
  if not found then
    raise exception 'Akun tidak ditemukan' using errcode = '22023', hint = 'tanpa_akun';
  end if;
  select tanggal_lahir into v_tanggal from public.jamaah where id = p_jamaah_id;
  if v_tanggal is null then
    raise exception 'Isi tanggal lahir jamaah dulu' using errcode = '22023', hint = 'tanpa_tanggal_lahir';
  end if;
  insert into private.pin_generus (user_id, pin_hash)
  values (v_akun.user_id, extensions.crypt(to_char(v_tanggal, 'DDMMYY'), extensions.gen_salt('bf', 10)))
  on conflict (user_id) do update set pin_hash = excluded.pin_hash, updated_at = now();
  update public.akun_generus
     set pin_awal = true, gagal_login = 0, terkunci_sampai = null
   where user_id = v_akun.user_id;
  insert into public.riwayat_pin (jamaah_id, alasan, catatan)
  values (p_jamaah_id, p_alasan, left(nullif(trim(coalesce(p_catatan, '')), ''), 200));
end;
$$;
revoke all on function public.kembalikan_pin_awal(uuid, text, text) from public, anon;
grant execute on function public.kembalikan_pin_awal(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. NIK & No. KK: tersamar, lihat lengkap dengan persetujuan pengembang
-- ---------------------------------------------------------------------

-- Tidak ada lagi baca langsung (termasuk admin desa). Baca lewat
-- identitas_tersamar() atau lihat_identitas(); tulis lewat simpan_identitas().
alter policy jamaah_identitas_select on public.jamaah_identitas using (false);
alter policy jamaah_identitas_insert on public.jamaah_identitas with check (false);
alter policy jamaah_identitas_update on public.jamaah_identitas using (false) with check (false);
alter policy jamaah_identitas_delete on public.jamaah_identitas using (false);

-- "••••••••••••1234"
create or replace function private.samarkan(p_nomor text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_nomor is null then null
              else repeat('•', greatest(length(p_nomor) - 4, 0)) || right(p_nomor, 4) end;
$$;
revoke all on function private.samarkan(text) from public, anon, authenticated;

-- Versi tersamar untuk pemegang identitas.lihat / identitas.kelola.
create or replace function public.identitas_tersamar(p_jamaah_id uuid)
returns table (nik text, no_kk text)
language sql
stable
security definer
set search_path = ''
as $$
  select private.samarkan(i.nik), private.samarkan(i.no_kk)
  from public.jamaah_identitas i
  where i.jamaah_id = p_jamaah_id
    and (private.boleh_jamaah('identitas.lihat', p_jamaah_id) or private.boleh_jamaah('identitas.kelola', p_jamaah_id));
$$;
revoke all on function public.identitas_tersamar(uuid) from public, anon;
grant execute on function public.identitas_tersamar(uuid) to authenticated;

-- Simpan NIK/KK (identitas.kelola). null = tidak diubah, '' = dikosongkan.
create or replace function public.simpan_identitas(p_jamaah_id uuid, p_nik text, p_no_kk text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_lama public.jamaah_identitas;
  v_nik  text;
  v_kk   text;
begin
  if not private.boleh_jamaah('identitas.kelola', p_jamaah_id) then
    raise exception 'Tidak berhak' using errcode = '42501';
  end if;
  if (nullif(p_nik, '') is not null and p_nik !~ '^[0-9]{16}$')
     or (nullif(p_no_kk, '') is not null and p_no_kk !~ '^[0-9]{16}$') then
    raise exception 'NIK dan No. KK masing-masing 16 angka' using errcode = '22023', hint = 'format';
  end if;
  select * into v_lama from public.jamaah_identitas where jamaah_id = p_jamaah_id;
  v_nik := case when p_nik is null then v_lama.nik else nullif(p_nik, '') end;
  v_kk := case when p_no_kk is null then v_lama.no_kk else nullif(p_no_kk, '') end;
  if v_nik is null and v_kk is null then
    delete from public.jamaah_identitas where jamaah_id = p_jamaah_id;
  else
    insert into public.jamaah_identitas (jamaah_id, nik, no_kk)
    values (p_jamaah_id, v_nik, v_kk)
    on conflict (jamaah_id) do update set nik = excluded.nik, no_kk = excluded.no_kk;
  end if;
end;
$$;
revoke all on function public.simpan_identitas(uuid, text, text) from public, anon;
grant execute on function public.simpan_identitas(uuid, text, text) to authenticated;

-- Permintaan melihat NIK/KK lengkap.
create table public.permintaan_identitas (
  id              uuid primary key default gen_random_uuid(),
  jamaah_id       uuid not null references public.jamaah (id) on delete cascade,
  pemohon         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  alasan          text not null check (length(trim(alasan)) between 5 and 300),
  status          text not null default 'menunggu' check (status in ('menunggu', 'disetujui', 'ditolak')),
  tanggapan       text check (length(tanggapan) <= 200),
  ditangani_by    uuid references auth.users (id) on delete set null,
  ditangani_at    timestamptz,
  berlaku_sampai  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index permintaan_identitas_status_idx on public.permintaan_identitas (status, created_at desc);
create index permintaan_identitas_pemohon_idx on public.permintaan_identitas (pemohon, jamaah_id);
create index permintaan_identitas_jamaah_idx on public.permintaan_identitas (jamaah_id);
create index permintaan_identitas_ditangani_idx on public.permintaan_identitas (ditangani_by);
create trigger set_updated_at before update on public.permintaan_identitas
  for each row execute function private.set_updated_at();

revoke all on public.permintaan_identitas from anon, authenticated;
grant select, insert on public.permintaan_identitas to authenticated;
alter table public.permintaan_identitas enable row level security;
-- Pemohon melihat permintaannya; pengembang (sistem.kelola) melihat semua.
create policy permintaan_identitas_select on public.permintaan_identitas
  for select to authenticated
  using (pemohon = (select auth.uid()) or private.boleh('sistem.kelola', null));
create policy permintaan_identitas_insert on public.permintaan_identitas
  for insert to authenticated
  with check (
    pemohon = (select auth.uid()) and status = 'menunggu'
    and ditangani_by is null and berlaku_sampai is null
    and private.boleh_jamaah('identitas.lihat', jamaah_id)
  );

-- Pengembang menyetujui / menolak (tidak bisa menyetujui permintaannya sendiri).
create or replace function public.tangani_permintaan_identitas(p_id uuid, p_setuju boolean, p_tanggapan text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_aju public.permintaan_identitas;
begin
  if not private.boleh('sistem.kelola', null) then
    raise exception 'Hanya pengembang' using errcode = '42501';
  end if;
  select * into v_aju from public.permintaan_identitas where id = p_id for update;
  if not found or v_aju.status <> 'menunggu' then
    raise exception 'Permintaan sudah ditangani' using errcode = '22023', hint = 'sudah';
  end if;
  if v_aju.pemohon = (select auth.uid()) then
    raise exception 'Tidak bisa menyetujui permintaan sendiri' using errcode = '42501', hint = 'sendiri';
  end if;
  update public.permintaan_identitas
     set status = case when p_setuju then 'disetujui' else 'ditolak' end,
         tanggapan = left(nullif(trim(coalesce(p_tanggapan, '')), ''), 200),
         ditangani_by = (select auth.uid()),
         ditangani_at = now(),
         berlaku_sampai = case when p_setuju then now() + interval '1 hour' end
   where id = p_id;
end;
$$;
revoke all on function public.tangani_permintaan_identitas(uuid, boolean, text) from public, anon;
grant execute on function public.tangani_permintaan_identitas(uuid, boolean, text) to authenticated;

-- Catatan setiap kali NIK/KK lengkap dibuka.
create table public.akses_identitas (
  id              uuid primary key default gen_random_uuid(),
  jamaah_id       uuid not null references public.jamaah (id) on delete cascade,
  permintaan_id   uuid references public.permintaan_identitas (id) on delete set null,
  oleh            uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index akses_identitas_jamaah_idx on public.akses_identitas (jamaah_id, created_at desc);
create index akses_identitas_permintaan_idx on public.akses_identitas (permintaan_id);
create index akses_identitas_oleh_idx on public.akses_identitas (oleh);
create trigger set_updated_at before update on public.akses_identitas
  for each row execute function private.set_updated_at();
revoke all on public.akses_identitas from anon, authenticated;
grant select on public.akses_identitas to authenticated;
alter table public.akses_identitas enable row level security;
create policy akses_identitas_select on public.akses_identitas
  for select to authenticated
  using (oleh = (select auth.uid()) or private.boleh('sistem.kelola', null));

-- NIK/KK lengkap: hanya dengan permintaan disetujui yang masih berlaku.
create or replace function public.lihat_identitas(p_jamaah_id uuid)
returns table (nik text, no_kk text, berlaku_sampai timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_aju public.permintaan_identitas;
begin
  select * into v_aju from public.permintaan_identitas a
  where a.jamaah_id = p_jamaah_id and a.pemohon = (select auth.uid())
    and a.status = 'disetujui' and a.berlaku_sampai > now()
  order by a.berlaku_sampai desc limit 1;
  if not found or not private.boleh_jamaah('identitas.lihat', p_jamaah_id) then
    raise exception 'Perlu persetujuan pengembang' using errcode = '42501', hint = 'perlu_izin';
  end if;
  insert into public.akses_identitas (jamaah_id, permintaan_id) values (p_jamaah_id, v_aju.id);
  return query
    select i.nik, i.no_kk, v_aju.berlaku_sampai
    from public.jamaah_identitas i where i.jamaah_id = p_jamaah_id;
end;
$$;
revoke all on function public.lihat_identitas(uuid) from public, anon;
grant execute on function public.lihat_identitas(uuid) to authenticated;

-- Izin: NIK/KK diisi admin kelompok; admin desa & kelompok melihat tersamar.
delete from public.peran_izin pi
using public.peran p
where pi.peran_id = p.id and p.kode = 'admin_desa' and pi.izin_kode = 'identitas.kelola';
insert into public.peran_izin (peran_id, izin_kode)
select p.id, v.izin
from public.peran p, (values ('identitas.lihat'), ('identitas.kelola')) v(izin)
where p.kode = 'admin_kelompok'
on conflict do nothing;

alter publication supabase_realtime add table public.permintaan_identitas, public.riwayat_pin;
