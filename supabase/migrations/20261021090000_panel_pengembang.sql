-- Panel pengembang: mode perawatan, pengumuman, saklar fitur per kelompok.
-- Usulan: docs/panel-pengembang.md. Diterapkan ke produksi hanya setelah
-- Reno menjawab "OK, jalankan".
--
-- Semua tabel di sini dibaca pengguna login (tidak sensitif) dan hanya
-- diubah pemegang izin terkait:
--   * pengaturan_sistem, fitur, fitur_kelompok → sistem.kelola (pengembang)
--   * pengumuman → pengumuman.kelola (izin baru; awalnya hanya pengembang,
--     bisa diberikan ke peran lain lewat data)

-- ---------------------------------------------------------------------
-- 1. Tabel
-- ---------------------------------------------------------------------

-- Satu baris saja (dijaga kolom `tunggal`).
create table public.pengaturan_sistem (
  id                 uuid primary key default gen_random_uuid(),
  tunggal            boolean not null default true unique check (tunggal),
  mode_perawatan     boolean not null default false,
  pesan_perawatan    text check (length(pesan_perawatan) <= 500),
  perkiraan_selesai  timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users (id) on delete set null
);

create type public.nada_pengumuman as enum ('info', 'peringatan');

create table public.pengumuman (
  id          uuid primary key default gen_random_uuid(),
  pesan       text not null check (length(trim(pesan)) between 1 and 300),
  nada        public.nada_pengumuman not null default 'info',
  aktif       boolean not null default true,
  mulai       timestamptz not null default now(),
  berakhir    timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by  uuid references auth.users (id) on delete set null,
  check (berakhir is null or berakhir > mulai)
);

-- Fitur aktif untuk sebuah kelompok bila: aktif dan (semua_kelompok atau
-- kelompok itu ada di fitur_kelompok).
create table public.fitur (
  id              uuid primary key default gen_random_uuid(),
  kode            text not null unique,
  nama            text not null,
  deskripsi       text,
  aktif           boolean not null default false,
  semua_kelompok  boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null
);

create table public.fitur_kelompok (
  fitur_id     uuid not null references public.fitur (id) on delete cascade,
  kelompok_id  uuid not null references public.kelompok (id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (fitur_id, kelompok_id)
);
create index fitur_kelompok_kelompok_id_idx on public.fitur_kelompok (kelompok_id);
create index pengumuman_aktif_idx on public.pengumuman (aktif, mulai);

-- ---------------------------------------------------------------------
-- 2. Trigger updated_at / updated_by
-- ---------------------------------------------------------------------
create trigger set_updated_at before update on public.pengaturan_sistem
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.pengumuman
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.fitur
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.fitur_kelompok
  for each row execute function private.set_updated_at();

create trigger set_updated_by before insert or update on public.pengaturan_sistem
  for each row execute function private.set_updated_by();
create trigger set_updated_by before insert or update on public.pengumuman
  for each row execute function private.set_updated_by();
create trigger set_updated_by before insert or update on public.fitur
  for each row execute function private.set_updated_by();

-- ---------------------------------------------------------------------
-- 3. GRANT eksplisit
-- ---------------------------------------------------------------------
revoke all on public.pengaturan_sistem, public.pengumuman, public.fitur, public.fitur_kelompok
  from anon, authenticated;
grant select, update on public.pengaturan_sistem to authenticated;
grant select, insert, update, delete on public.pengumuman, public.fitur, public.fitur_kelompok
  to authenticated;

-- ---------------------------------------------------------------------
-- 4. RLS (satu policy per perintah)
-- ---------------------------------------------------------------------
alter table public.pengaturan_sistem enable row level security;
alter table public.pengumuman        enable row level security;
alter table public.fitur             enable row level security;
alter table public.fitur_kelompok    enable row level security;

-- pengaturan_sistem: dibaca semua pengguna login; hanya diubah pengembang.
-- Tidak ada policy insert/delete: barisnya tunggal dan dibuat migrasi.
create policy pengaturan_sistem_select on public.pengaturan_sistem
  for select to authenticated using (true);
create policy pengaturan_sistem_update on public.pengaturan_sistem
  for update to authenticated
  using (private.boleh('sistem.kelola', null))
  with check (private.boleh('sistem.kelola', null));

create policy pengumuman_select on public.pengumuman
  for select to authenticated using (true);
create policy pengumuman_insert on public.pengumuman
  for insert to authenticated with check (private.boleh('pengumuman.kelola', null));
create policy pengumuman_update on public.pengumuman
  for update to authenticated
  using (private.boleh('pengumuman.kelola', null))
  with check (private.boleh('pengumuman.kelola', null));
create policy pengumuman_delete on public.pengumuman
  for delete to authenticated using (private.boleh('pengumuman.kelola', null));

create policy fitur_select on public.fitur
  for select to authenticated using (true);
create policy fitur_insert on public.fitur
  for insert to authenticated with check (private.boleh('sistem.kelola', null));
create policy fitur_update on public.fitur
  for update to authenticated
  using (private.boleh('sistem.kelola', null))
  with check (private.boleh('sistem.kelola', null));
create policy fitur_delete on public.fitur
  for delete to authenticated using (private.boleh('sistem.kelola', null));

create policy fitur_kelompok_select on public.fitur_kelompok
  for select to authenticated using (true);
create policy fitur_kelompok_insert on public.fitur_kelompok
  for insert to authenticated with check (private.boleh('sistem.kelola', null));
create policy fitur_kelompok_update on public.fitur_kelompok
  for update to authenticated
  using (private.boleh('sistem.kelola', null))
  with check (private.boleh('sistem.kelola', null));
create policy fitur_kelompok_delete on public.fitur_kelompok
  for delete to authenticated using (private.boleh('sistem.kelola', null));

-- ---------------------------------------------------------------------
-- 5. Data awal
-- ---------------------------------------------------------------------
insert into public.pengaturan_sistem (mode_perawatan) values (false);

insert into public.izin (kode, deskripsi) values
  ('pengumuman.kelola', 'Membuat dan mengelola pengumuman di aplikasi');

insert into public.peran_izin (peran_id, izin_kode)
select id, 'pengumuman.kelola' from public.peran where kode = 'pengembang';

-- Modul aplikasi. Semua mati dulu; dinyalakan dari panel pengembang setelah
-- modulnya siap (mis. Jamaah untuk Kelompok 1 dulu).
insert into public.fitur (kode, nama, deskripsi, aktif, semua_kelompok) values
  ('jamaah',   'Jamaah',   'Database jamaah: daftar, tambah, ubah', false, false),
  ('kegiatan', 'Kegiatan', 'Monitoring kegiatan (Fase 3)',          false, false),
  ('absensi',  'Absensi',  'Absensi QR (Fase 2)',                   false, false);
