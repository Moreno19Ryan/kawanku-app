-- =====================================================================
-- KawanKu: kolom kelas + kenaikan kelas tahunan
-- =====================================================================
-- Keputusan Reno (21 Okt 2026): status sekolah diperbarui tiap tahun ajaran
-- baru (Juli) oleh admin kelompok; perlu kolom kelas supaya kenaikan
-- jenjang bisa diusulkan otomatis (docs/status-sekolah-tahunan.md).
--   - jamaah.kelas 1–12 (opsional): SD 1–6, SMP 7–9, SMA/SMK 10–12.
--   - jamaah.kelas_tahun: tahun ajaran (tahun Juli-nya) yang dirujuk kelas
--     itu. Diisi otomatis saat kelas diubah, jadi kenaikan kelas tidak
--     pernah menaikkan dua kali, kapan pun datanya diisi.
--   - RPC terapkan_kenaikan_kelas: menerapkan hasil kenaikan sekelompok
--     sekaligus (security invoker: tetap RLS jamaah_update), dicatat di
--     kenaikan_kelas (siapa & kapan).
-- =====================================================================

-- Tahun ajaran untuk sebuah tanggal: Juli–Desember = tahun itu, Januari–Juni
-- = tahun sebelumnya.
create or replace function private.tahun_ajaran(p_tanggal date)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select (extract(year from p_tanggal) - case when extract(month from p_tanggal) < 7 then 1 else 0 end)::smallint;
$$;
revoke all on function private.tahun_ajaran(date) from public, anon;
grant execute on function private.tahun_ajaran(date) to authenticated;

alter table public.jamaah
  add column kelas smallint,
  add column kelas_tahun smallint,
  add constraint jamaah_kelas_jenjang check (
    kelas is null
    or (status_sekolah = 'sd' and kelas between 1 and 6)
    or (status_sekolah = 'smp' and kelas between 7 and 9)
    or (status_sekolah = 'sma_smk' and kelas between 10 and 12)
  ),
  add constraint jamaah_kelas_tahun check ((kelas is null) = (kelas_tahun is null));

-- Kelas dikosongkan bila bukan lagi SD/SMP/SMA; kelas_tahun diisi tahun ajaran
-- berjalan saat kelas diisi/diubah (kecuali diisi eksplisit, mis. oleh RPC).
create or replace function private.atur_kelas()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status_sekolah is null or new.status_sekolah not in ('sd', 'smp', 'sma_smk') then
    new.kelas := null;
  end if;
  if new.kelas is null then
    new.kelas_tahun := null;
  elsif tg_op = 'INSERT' then
    new.kelas_tahun := coalesce(new.kelas_tahun, private.tahun_ajaran((now() at time zone 'Asia/Jakarta')::date));
  elsif (new.kelas is distinct from old.kelas or new.kelas_tahun is null)
        and new.kelas_tahun is not distinct from old.kelas_tahun then
    new.kelas_tahun := private.tahun_ajaran((now() at time zone 'Asia/Jakarta')::date);
  end if;
  return new;
end;
$$;
create trigger atur_kelas before insert or update on public.jamaah
  for each row execute function private.atur_kelas();

-- ---------------------------------------------------------------------
-- Catatan kenaikan kelas per kelompok per tahun ajaran
-- ---------------------------------------------------------------------
create table public.kenaikan_kelas (
  id           uuid primary key default gen_random_uuid(),
  kelompok_id  uuid not null references public.kelompok (id) on delete cascade,
  tahun        smallint not null check (tahun between 2000 and 2200),
  jumlah       integer not null default 0 check (jumlah >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by   uuid references auth.users (id) on delete set null,
  unique (kelompok_id, tahun)
);
create index kenaikan_kelas_created_by_idx on public.kenaikan_kelas (created_by);
create index kenaikan_kelas_updated_by_idx on public.kenaikan_kelas (updated_by);
create trigger set_updated_at before update on public.kenaikan_kelas
  for each row execute function private.set_updated_at();
create trigger set_updated_by before insert or update on public.kenaikan_kelas
  for each row execute function private.set_updated_by();

revoke all on public.kenaikan_kelas from anon, authenticated;
grant select, insert, update on public.kenaikan_kelas to authenticated;
alter table public.kenaikan_kelas enable row level security;
create policy kenaikan_kelas_select on public.kenaikan_kelas
  for select to authenticated using (private.boleh_kelola_wilayah('jamaah.lihat', kelompok_id, true));
create policy kenaikan_kelas_insert on public.kenaikan_kelas
  for insert to authenticated with check (private.boleh_kelola_wilayah('jamaah.ubah', kelompok_id, true));
create policy kenaikan_kelas_update on public.kenaikan_kelas
  for update to authenticated
  using (private.boleh_kelola_wilayah('jamaah.ubah', kelompok_id, true))
  with check (private.boleh_kelola_wilayah('jamaah.ubah', kelompok_id, true));

-- ---------------------------------------------------------------------
-- RPC: terapkan kenaikan kelas
-- ---------------------------------------------------------------------
-- p_perubahan: [{"id": uuid, "status_sekolah": text, "kelas": int|null}, ...]
-- Hanya jamaah di kelompok itu yang kelasnya belum untuk tahun ajaran ini
-- (kelas_tahun < tahun atau kelas kosong). Tahun = tahun ajaran berjalan.
-- Jamaah di luar wewenang dilewati (RLS using); hasil di luar wewenang
-- (mis. admin generus membuat jamaah bukan generus) membatalkan semuanya.
create or replace function public.terapkan_kenaikan_kelas(p_kelompok_id uuid, p_perubahan jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tahun  smallint := private.tahun_ajaran((now() at time zone 'Asia/Jakarta')::date);
  v_item   jsonb;
  v_jumlah integer := 0;
  v_n      integer;
begin
  if jsonb_typeof(p_perubahan) <> 'array' or jsonb_array_length(p_perubahan) > 1000 then
    raise exception 'Data kenaikan kelas tidak valid';
  end if;
  for v_item in select * from jsonb_array_elements(p_perubahan)
  loop
    update public.jamaah j
       set status_sekolah = (v_item->>'status_sekolah')::public.status_sekolah,
           kelas = (v_item->>'kelas')::smallint,
           kelas_tahun = case when v_item->>'kelas' is null then null else v_tahun end
     where j.id = (v_item->>'id')::uuid
       and j.kelompok_id = p_kelompok_id
       and j.status_sekolah in ('sd', 'smp', 'sma_smk')
       and (j.kelas_tahun is null or j.kelas_tahun < v_tahun);
    get diagnostics v_n = row_count;
    v_jumlah := v_jumlah + v_n;
  end loop;

  if v_jumlah > 0 then
    insert into public.kenaikan_kelas (kelompok_id, tahun, jumlah)
    values (p_kelompok_id, v_tahun, v_jumlah)
    on conflict (kelompok_id, tahun) do update set jumlah = public.kenaikan_kelas.jumlah + excluded.jumlah;
  end if;
  return v_jumlah;
end;
$$;
revoke all on function public.terapkan_kenaikan_kelas(uuid, jsonb) from public, anon;
grant execute on function public.terapkan_kenaikan_kelas(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- View jamaah: kolomnya dibekukan saat dibuat, jadi kelas & kelas_tahun
-- ditambahkan di akhir lewat create or replace (tanpa drop; kolom lama dan
-- urutannya tetap). jamaah_tanpa_kategori tidak perlu kolom ini.
-- ---------------------------------------------------------------------
create or replace view public.jamaah_dengan_kategori
with (security_invoker = true) as
select
  j.id, j.kode, j.kelompok_id, j.keluarga_id, j.hubungan_keluarga, j.nama_lengkap,
  j.nama_panggilan, j.tanggal_lahir, j.tahun_lahir, j.jenis_kelamin, j.status_pernikahan,
  j.status_sekolah, j.status_sekolah_diperbarui, j.aktif, j.created_at, j.updated_at,
  j.created_by, j.updated_by, j.tempat_lahir, j.pendidikan_terakhir, j.kegiatan,
  j.muballigh, j.jenis_muballigh, j.paket_caberawit,
  private.usia(j.tanggal_lahir, j.tahun_lahir) as usia,
  k.id               as kategori_jamaah_id,
  k.kode             as kategori_jamaah_kode,
  k.nama             as kategori_jamaah_nama,
  coalesce(k.termasuk_generus, false) as termasuk_generus,
  j.kelas,
  j.kelas_tahun
from public.jamaah j
left join public.kategori_jamaah k
  on k.id = private.kategori_jamaah_id(
       j.tanggal_lahir, j.tahun_lahir, j.status_pernikahan, j.status_sekolah);
