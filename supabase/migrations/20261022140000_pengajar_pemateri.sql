-- =====================================================================
-- KawanKu: daftar pengajar rutin & beberapa pemateri per pertemuan
-- (22 Okt 2026)
-- =====================================================================
-- Keputusan Reno: pemateri tetap diisi manual oleh admin per pertemuan,
-- tapi dipilih dari daftar pengajar rutin (dikelola seperti kegiatan), dan
-- satu pertemuan bisa punya beberapa sesi dengan pemateri berbeda.
--   - pengajar: daftar pengajar rutin per wilayah (kelompok / desa).
--   - pertemuan_materi: sesi-sesi dalam satu pertemuan (pemateri + materi),
--     ditulis sekaligus lewat RPC simpan_materi_pertemuan.
--   - pertemuan.pemateri_nama & materi tetap diisi sebagai ringkasan
--     (dipakai kalender, jadwal generus, dan asisten).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Pengajar rutin
-- ---------------------------------------------------------------------
create table public.pengajar (
  id           uuid primary key default gen_random_uuid(),
  nama         text not null check (length(trim(nama)) between 1 and 120),
  keterangan   text check (length(keterangan) <= 120),
  -- Wilayah: null = tingkat desa (bisa dipilih semua kelompok).
  kelompok_id  uuid references public.kelompok (id) on delete cascade,
  aktif        boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by   uuid references auth.users (id) on delete set null
);
create unique index pengajar_nama_unik on public.pengajar (kelompok_id, lower(trim(nama))) nulls not distinct;
create index pengajar_created_by_idx on public.pengajar (created_by);
create index pengajar_updated_by_idx on public.pengajar (updated_by);

create trigger set_updated_at before update on public.pengajar
  for each row execute function private.set_updated_at();
create trigger set_updated_by before insert or update on public.pengajar
  for each row execute function private.set_updated_by();

revoke all on public.pengajar from anon, authenticated;
grant select, insert, update, delete on public.pengajar to authenticated;
alter table public.pengajar enable row level security;

-- Lihat: admin yang boleh melihat kegiatan di wilayah itu (pengajar desa
-- terlihat oleh semua kelompok). Kelola: pengurus kegiatan wilayahnya,
-- termasuk admin generus.
create policy pengajar_select on public.pengajar
  for select to authenticated using (private.boleh_lihat_sesi('kegiatan.lihat', kelompok_id));
create policy pengajar_insert on public.pengajar
  for insert to authenticated with check (private.boleh_kelola_wilayah('kegiatan.kelola', kelompok_id, true));
create policy pengajar_update on public.pengajar
  for update to authenticated
  using (private.boleh_kelola_wilayah('kegiatan.kelola', kelompok_id, true))
  with check (private.boleh_kelola_wilayah('kegiatan.kelola', kelompok_id, true));
create policy pengajar_delete on public.pengajar
  for delete to authenticated using (private.boleh_kelola_wilayah('kegiatan.kelola', kelompok_id, true));

-- ---------------------------------------------------------------------
-- 2. Sesi-sesi dalam pertemuan
-- ---------------------------------------------------------------------
create table public.pertemuan_materi (
  id                  uuid primary key default gen_random_uuid(),
  pertemuan_id        uuid not null references public.pertemuan (id) on delete cascade,
  urutan              smallint not null check (urutan between 1 and 10),
  pengajar_id         uuid references public.pengajar (id) on delete set null,
  pemateri_jamaah_id  uuid references public.jamaah (id) on delete set null,
  -- Salinan nama (tetap terbaca walau pengajar dihapus / lintas kelompok).
  pemateri_nama       text check (length(pemateri_nama) <= 120),
  materi              text check (length(materi) <= 300),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (pertemuan_id, urutan),
  check (pemateri_nama is not null or materi is not null)
);
create index pertemuan_materi_pengajar_idx on public.pertemuan_materi (pengajar_id);
create index pertemuan_materi_jamaah_idx on public.pertemuan_materi (pemateri_jamaah_id);

create trigger set_updated_at before update on public.pertemuan_materi
  for each row execute function private.set_updated_at();

revoke all on public.pertemuan_materi from anon, authenticated;
grant select, insert, delete on public.pertemuan_materi to authenticated;
alter table public.pertemuan_materi enable row level security;

-- Mengikuti pertemuannya (RLS pertemuan berlaku di subquery).
create policy pertemuan_materi_select on public.pertemuan_materi
  for select to authenticated
  using (exists (select 1 from public.pertemuan p where p.id = pertemuan_id));
create policy pertemuan_materi_insert on public.pertemuan_materi
  for insert to authenticated
  with check (exists (select 1 from public.pertemuan p where p.id = pertemuan_id
                      and private.boleh_kelola_pertemuan(p.kegiatan_id, p.kelompok_id)));
create policy pertemuan_materi_delete on public.pertemuan_materi
  for delete to authenticated
  using (exists (select 1 from public.pertemuan p where p.id = pertemuan_id
                 and private.boleh_kelola_pertemuan(p.kegiatan_id, p.kelompok_id)));

-- ---------------------------------------------------------------------
-- 3. Simpan sesi-sesi sekaligus + ringkasan di pertemuan
-- ---------------------------------------------------------------------
-- p_sesi: array [{pengajar_id?, jamaah_id?, nama?, materi?}], urut sesuai
-- jalannya acara (maks. 10). Nama diambil dari pengajar/jamaah bila dipilih.
-- Security invoker: tetap dibatasi RLS.
create or replace function public.simpan_materi_pertemuan(p_pertemuan uuid, p_sesi jsonb)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_butir   jsonb;
  v_no      smallint := 0;
  v_pengajar uuid;
  v_jamaah  uuid;
  v_nama    text;
  v_materi  text;
begin
  if not exists (select 1 from public.pertemuan p where p.id = p_pertemuan
                 and private.boleh_kelola_pertemuan(p.kegiatan_id, p.kelompok_id)) then
    raise exception 'Tidak berhak mengubah pertemuan ini' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_sesi, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_sesi, '[]'::jsonb)) > 10 then
    raise exception 'Daftar sesi tidak sah (maks. 10)' using errcode = '22023';
  end if;

  delete from public.pertemuan_materi where pertemuan_id = p_pertemuan;

  for v_butir in select * from jsonb_array_elements(coalesce(p_sesi, '[]'::jsonb)) loop
    v_pengajar := nullif(v_butir->>'pengajar_id', '')::uuid;
    v_jamaah := nullif(v_butir->>'jamaah_id', '')::uuid;
    v_nama := nullif(regexp_replace(trim(coalesce(v_butir->>'nama', '')), '\s+', ' ', 'g'), '');
    v_materi := nullif(regexp_replace(trim(coalesce(v_butir->>'materi', '')), '\s+', ' ', 'g'), '');
    if v_pengajar is not null then
      select g.nama into v_nama from public.pengajar g where g.id = v_pengajar;
      if not found then
        raise exception 'Pengajar tidak ditemukan' using errcode = '22023';
      end if;
      v_jamaah := null;
    elsif v_jamaah is not null then
      select j.nama_lengkap into v_nama from public.jamaah j where j.id = v_jamaah;
      if not found then
        raise exception 'Jamaah pemateri tidak ditemukan' using errcode = '22023';
      end if;
    end if;
    continue when v_nama is null and v_materi is null;
    v_no := v_no + 1;
    insert into public.pertemuan_materi (pertemuan_id, urutan, pengajar_id, pemateri_jamaah_id, pemateri_nama, materi)
    values (p_pertemuan, v_no, v_pengajar, v_jamaah, v_nama, v_materi);
  end loop;

  -- Ringkasan untuk kalender & jadwal generus.
  update public.pertemuan p set
    pemateri_nama = (
      select left(string_agg(x.pemateri_nama, ', ' order by x.awal), 120)
      from (select m.pemateri_nama, min(m.urutan) as awal from public.pertemuan_materi m
            where m.pertemuan_id = p_pertemuan and m.pemateri_nama is not null
            group by m.pemateri_nama) x),
    materi = (
      select left(string_agg(m.materi, ' · ' order by m.urutan), 300)
      from public.pertemuan_materi m where m.pertemuan_id = p_pertemuan and m.materi is not null),
    pemateri_jamaah_id = (
      select m.pemateri_jamaah_id from public.pertemuan_materi m
      where m.pertemuan_id = p_pertemuan and m.pemateri_jamaah_id is not null
      order by m.urutan limit 1)
  where p.id = p_pertemuan;
end;
$$;
revoke all on function public.simpan_materi_pertemuan(uuid, jsonb) from public, anon;
grant execute on function public.simpan_materi_pertemuan(uuid, jsonb) to authenticated;

alter publication supabase_realtime add table public.pengajar, public.pertemuan_materi;
