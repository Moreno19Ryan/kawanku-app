-- =====================================================================
-- Cadangan data (F3, keputusan Reno 26 Okt 2026)
--
-- Admin desa (seluruh desa) dan admin kelompok (kelompoknya) bisa mengunduh
-- cadangan data dalam satu file Excel: jamaah, kontak, alamat & orang tua,
-- keluarga, kegiatan, dan absensi, TANPA NIK/No. KK. Isi file mengikuti RLS
-- (sesi pengguna), jadi tidak ada data di luar wewenangnya. Setiap unduhan
-- dicatat (siapa, kapan, wilayah mana, jumlah baris) dan terlihat oleh
-- pengembang; pengembang sendiri tidak bisa mengunduh.
-- =====================================================================

insert into public.izin (kode, deskripsi)
values ('cadangan.unduh', 'Mengunduh cadangan data wilayahnya (Excel, tanpa NIK/No. KK)');

insert into public.peran_izin (peran_id, izin_kode)
select p.id, 'cadangan.unduh' from public.peran p
where p.kode in ('admin_desa', 'admin_kelompok')
on conflict do nothing;

create table public.unduhan_cadangan (
  id           uuid primary key default gen_random_uuid(),
  oleh         uuid default auth.uid() references auth.users (id) on delete set null,
  -- null = seluruh desa
  kelompok_id  uuid references public.kelompok (id) on delete restrict,
  -- Jumlah baris per lembar, mis. {"jamaah": 98, "absensi": 1200}.
  ringkasan    jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.unduhan_cadangan is
  'Catatan setiap unduhan cadangan data (Pengaturan → Cadangan data).';
create index unduhan_cadangan_waktu_idx on public.unduhan_cadangan (created_at desc);
create index unduhan_cadangan_oleh_idx on public.unduhan_cadangan (oleh);
create index unduhan_cadangan_kelompok_idx on public.unduhan_cadangan (kelompok_id);
create trigger set_updated_at before update on public.unduhan_cadangan
  for each row execute function private.set_updated_at();

revoke all on public.unduhan_cadangan from anon, authenticated;
grant select, insert on public.unduhan_cadangan to authenticated;
alter table public.unduhan_cadangan enable row level security;

-- Pengunduh melihat catatannya; pengembang (sistem.kelola) melihat semua.
create policy unduhan_cadangan_select on public.unduhan_cadangan
  for select to authenticated
  using (oleh = (select auth.uid()) or private.boleh('sistem.kelola', null));
-- Dicatat atas nama sendiri, hanya untuk wilayah yang boleh diunduhnya
-- (seluruh desa → penugasan desa; kelompok → penugasan desa/kelompok itu).
create policy unduhan_cadangan_insert on public.unduhan_cadangan
  for insert to authenticated
  with check (oleh = (select auth.uid()) and private.boleh('cadangan.unduh', kelompok_id));

alter publication supabase_realtime add table public.unduhan_cadangan;
