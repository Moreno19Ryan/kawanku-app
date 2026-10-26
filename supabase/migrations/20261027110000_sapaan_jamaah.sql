-- =====================================================================
-- Tindak lanjut "perlu disapa" (F4, Reno 26 Okt 2026)
--
-- Jamaah yang tidak hadir 3 pertemuan terakhir (Laporan kehadiran) bisa
-- dicatat sapaannya oleh pengurus absensi: hasilnya (tersambung / belum
-- tersambung / sedang berhalangan) dan catatan singkat. Riwayat tidak bisa
-- diubah/dihapus; asisten tidak lagi mengingatkan jamaah yang sudah disapa
-- dalam 14 hari terakhir.
-- =====================================================================

create table public.sapaan_jamaah (
  id          uuid primary key default gen_random_uuid(),
  jamaah_id   uuid not null references public.jamaah (id) on delete cascade,
  hasil       text not null check (hasil in ('tersambung', 'belum_tersambung', 'berhalangan')),
  catatan     text check (length(catatan) <= 300),
  oleh        uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.sapaan_jamaah is
  'Catatan tindak lanjut jamaah yang perlu disapa (Laporan kehadiran).';
create index sapaan_jamaah_jamaah_idx on public.sapaan_jamaah (jamaah_id, created_at desc);
create index sapaan_jamaah_oleh_idx on public.sapaan_jamaah (oleh);
create trigger set_updated_at before update on public.sapaan_jamaah
  for each row execute function private.set_updated_at();

revoke all on public.sapaan_jamaah from anon, authenticated;
grant select, insert on public.sapaan_jamaah to authenticated;
alter table public.sapaan_jamaah enable row level security;

-- Lihat: yang boleh melihat absensi jamaah itu. Catat: pengelola absensinya,
-- atas nama sendiri.
create policy sapaan_jamaah_select on public.sapaan_jamaah
  for select to authenticated
  using (private.boleh_jamaah('absensi.lihat', jamaah_id));
create policy sapaan_jamaah_insert on public.sapaan_jamaah
  for insert to authenticated
  with check (oleh = (select auth.uid()) and private.boleh_jamaah('absensi.kelola', jamaah_id));

alter publication supabase_realtime add table public.sapaan_jamaah;
