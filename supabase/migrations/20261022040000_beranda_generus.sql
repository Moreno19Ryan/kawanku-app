-- =====================================================================
-- KawanKu: beranda generus (pengumuman untuk generus + riwayat kehadiran)
-- =====================================================================
-- Keputusan Reno (21 Okt 2026): akun generus jangan polos; ada statistik &
-- lencana kehadiran (hanya data dirinya), pengumuman dari pengurus, dan
-- jadwal lengkap dengan pemateri & materi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Pengumuman: sasaran (admin / generus / semua) + wilayah
-- ---------------------------------------------------------------------
-- Pengumuman lama = untuk admin (seperti sebelumnya). kelompok_id kosong =
-- seluruh desa. Pengurus kegiatan (kegiatan.kelola) di wilayahnya boleh
-- membuat pengumuman untuk generus; pengumuman.kelola (tingkat desa) boleh
-- semuanya.
alter table public.pengumuman
  add column sasaran text not null default 'admin' check (sasaran in ('admin', 'generus', 'semua')),
  add column kelompok_id uuid references public.kelompok (id) on delete cascade;
create index pengumuman_kelompok_idx on public.pengumuman (kelompok_id);
create index pengumuman_created_by_idx on public.pengumuman (created_by);

-- Boleh mengelola pengumuman ini.
create or replace function private.boleh_kelola_pengumuman(p_sasaran text, p_kelompok_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.boleh('pengumuman.kelola', null)
      or (p_sasaran = 'generus' and private.boleh_kelola_wilayah('kegiatan.kelola', p_kelompok_id, true));
$$;
revoke all on function private.boleh_kelola_pengumuman(text, uuid) from public, anon;
grant execute on function private.boleh_kelola_pengumuman(text, uuid) to authenticated;

-- Admin melihat semua; akun generus hanya pengumuman untuk generus/semua di
-- wilayahnya (desa atau kelompoknya).
alter policy pengumuman_select on public.pengumuman
  using (
    private.jamaah_saya() is null
    or (sasaran <> 'admin' and private.kegiatan_untuk_saya(kelompok_id))
  );
alter policy pengumuman_insert on public.pengumuman
  with check (private.boleh_kelola_pengumuman(sasaran, kelompok_id));
alter policy pengumuman_update on public.pengumuman
  using (private.boleh_kelola_pengumuman(sasaran, kelompok_id))
  with check (private.boleh_kelola_pengumuman(sasaran, kelompok_id));
alter policy pengumuman_delete on public.pengumuman
  using (private.boleh_kelola_pengumuman(sasaran, kelompok_id));

-- ---------------------------------------------------------------------
-- 2. Riwayat kehadiran generus sendiri (termasuk pertemuan yang terlewat)
-- ---------------------------------------------------------------------
-- Sesi tempat generus ini menjadi peserta (wilayah & sasaran cocok), sejak
-- profilnya ada, yang sudah dimulai. status: hadir | izin | sakit | alpa
-- (sesi sudah ditutup/selesai tanpa catatan) | berjalan (belum ada catatan).
create or replace function public.kehadiran_saya(p_batas integer default 120)
returns table (
  sesi_id uuid,
  nama text,
  mulai timestamptz,
  status text,
  alasan_izin public.alasan_izin
)
language sql
stable
security definer
set search_path = ''
as $$
  with saya as (
    select j.* from public.jamaah j where j.id = private.jamaah_saya()
  )
  select s.id, s.nama, s.mulai,
         coalesce(a.status::text,
                  case when s.ditutup or coalesce(s.selesai, s.mulai + interval '3 hours') < now()
                       then 'alpa' else 'berjalan' end),
         a.alasan_izin
  from saya j
  join public.sesi_absensi s
    on (s.kelompok_id is null or s.kelompok_id = j.kelompok_id)
   and (not s.hanya_generus
        or private.termasuk_generus(j.tanggal_lahir, j.tahun_lahir, j.status_pernikahan, j.status_sekolah))
   and s.mulai <= now()
   and s.mulai >= j.created_at - interval '1 day'
  left join public.absensi a on a.sesi_id = s.id and a.jamaah_id = j.id
  order by s.mulai desc
  limit least(greatest(coalesce(p_batas, 120), 1), 500);
$$;
revoke all on function public.kehadiran_saya(integer) from public, anon;
grant execute on function public.kehadiran_saya(integer) to authenticated;
