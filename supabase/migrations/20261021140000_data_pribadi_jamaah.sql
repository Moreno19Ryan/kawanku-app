-- Data jamaah tambahan + data sensitif (opsional), keputusan Reno 21 Okt 2026.
-- Usulan: docs/data-pribadi-jamaah.md. Diterapkan ke produksi hanya setelah
-- "OK, jalankan".
--
-- Prinsip (CLAUDE.md): data yang lebih sensitif dari profil biasa disimpan
-- di TABEL TERPISAH dengan izin sendiri, bukan kolom di `jamaah`.
--   * jamaah (kolom baru, data biasa): tempat lahir, pendidikan terakhir,
--     kegiatan/pekerjaan, status muballigh (+ MT/MS), paket caberawit.
--   * jamaah_kontak     : no. HP, no. HP orang tua/wali, email
--                         → kontak.*   (desa, kelompok; generus hanya lihat)
--   * jamaah_pribadi    : nama ayah/ibu kandung, alamat KTP & domisili
--                         → pribadi.*  (desa, kelompok)
--   * jamaah_identitas  : NIK, No. KK (opsional; bukan ID, ID tetap kode KW-)
--                         → identitas.* (hanya admin desa)
-- Pengembang tidak mendapat izin apa pun di atas (hanya jamaah.lihat).

-- ---------------------------------------------------------------------
-- 1. Tipe enum
-- ---------------------------------------------------------------------
create type public.pendidikan as enum
  ('belum_sekolah', 'sd', 'smp', 'sma_smk', 'diploma', 's1', 's2', 's3');
-- MT = Muballigh/ot Tugasan, MS = Muballigh/ot Setempat.
create type public.jenis_muballigh as enum ('tugasan', 'setempat');
create type public.paket_caberawit as enum ('A', 'B', 'C', 'D', 'E', 'F');

-- ---------------------------------------------------------------------
-- 2. Kolom baru di jamaah (data biasa, semuanya opsional)
-- ---------------------------------------------------------------------
alter table public.jamaah
  add column tempat_lahir         text check (length(trim(tempat_lahir)) between 1 and 80),
  add column pendidikan_terakhir  public.pendidikan,
  add column kegiatan             text check (length(trim(kegiatan)) between 1 and 120),
  add column muballigh            boolean not null default false,
  add column jenis_muballigh      public.jenis_muballigh,
  add column paket_caberawit      public.paket_caberawit,
  -- MT/MS hanya bila berstatus muballigh/muballighot.
  add constraint jamaah_jenis_muballigh_perlu_muballigh
    check (jenis_muballigh is null or muballigh);

-- View lama memakai j.* (kolomnya dibekukan saat dibuat) → buat ulang supaya
-- kolom baru ikut. Definisi lain tidak berubah.
drop view public.jamaah_tanpa_kategori;
drop view public.jamaah_dengan_kategori;

create view public.jamaah_dengan_kategori
with (security_invoker = true) as
select
  j.*,
  private.usia(j.tanggal_lahir, j.tahun_lahir) as usia,
  k.id               as kategori_jamaah_id,
  k.kode             as kategori_jamaah_kode,
  k.nama             as kategori_jamaah_nama,
  coalesce(k.termasuk_generus, false) as termasuk_generus
from public.jamaah j
left join public.kategori_jamaah k
  on k.id = private.kategori_jamaah_id(
       j.tanggal_lahir, j.tahun_lahir, j.status_pernikahan, j.status_sekolah);

create view public.jamaah_tanpa_kategori
with (security_invoker = true) as
select *
from public.jamaah_dengan_kategori
where aktif and kategori_jamaah_id is null;

revoke all on public.jamaah_dengan_kategori, public.jamaah_tanpa_kategori from anon, authenticated;
grant select on public.jamaah_dengan_kategori, public.jamaah_tanpa_kategori to authenticated;

-- ---------------------------------------------------------------------
-- 3. Tabel data sensitif (satu baris per jamaah, ikut terhapus bersama jamaah)
-- ---------------------------------------------------------------------
-- No. HP disimpan ternormalisasi: hanya angka, diawali 08.
create table public.jamaah_kontak (
  jamaah_id   uuid primary key references public.jamaah (id) on delete cascade,
  no_hp       text check (no_hp ~ '^08[0-9]{8,12}$'),
  no_hp_wali  text check (no_hp_wali ~ '^08[0-9]{8,12}$'),
  email       text check (length(email) <= 120 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by  uuid references auth.users (id) on delete set null
);

-- Alamat: kode wilayah Kemendagri (provinsi/kab/kec/desa, sedalam yang
-- dipilih) + nama lengkapnya (disimpan saat menyimpan, untuk tampilan).
-- Daftar wilayahnya data statis di aplikasi (src/lib/wilayah).
create table public.jamaah_pribadi (
  jamaah_id          uuid primary key references public.jamaah (id) on delete cascade,
  nama_ayah          text check (length(trim(nama_ayah)) between 1 and 120),
  nama_ibu           text check (length(trim(nama_ibu)) between 1 and 120),
  ktp_kode_wilayah   text check (ktp_kode_wilayah ~ '^[0-9]{2}(\.[0-9]{2}(\.[0-9]{2}(\.[0-9]{4})?)?)?$'),
  ktp_wilayah        text check (length(ktp_wilayah) <= 300),
  ktp_jalan          text check (length(trim(ktp_jalan)) between 1 and 200),
  ktp_rt             smallint check (ktp_rt between 0 and 999),
  ktp_rw             smallint check (ktp_rw between 0 and 999),
  ktp_kode_pos       text check (ktp_kode_pos ~ '^[0-9]{5}$'),
  -- true = alamat domisili (saat ini) sama dengan KTP; kolom dom_* diabaikan.
  domisili_sama_ktp  boolean not null default false,
  dom_kode_wilayah   text check (dom_kode_wilayah ~ '^[0-9]{2}(\.[0-9]{2}(\.[0-9]{2}(\.[0-9]{4})?)?)?$'),
  dom_wilayah        text check (length(dom_wilayah) <= 300),
  dom_jalan          text check (length(trim(dom_jalan)) between 1 and 200),
  dom_rt             smallint check (dom_rt between 0 and 999),
  dom_rw             smallint check (dom_rw between 0 and 999),
  dom_kode_pos       text check (dom_kode_pos ~ '^[0-9]{5}$'),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by         uuid references auth.users (id) on delete set null
);

-- NIK & No. KK: opsional, BUKAN identitas utama (itu kode KW-).
create table public.jamaah_identitas (
  jamaah_id   uuid primary key references public.jamaah (id) on delete cascade,
  nik         text check (nik ~ '^[0-9]{16}$'),
  no_kk       text check (no_kk ~ '^[0-9]{16}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by  uuid references auth.users (id) on delete set null
);
-- Satu NIK hanya untuk satu jamaah (No. KK boleh sama: satu keluarga).
create unique index jamaah_identitas_nik_unik on public.jamaah_identitas (nik) where nik is not null;

create index jamaah_kontak_created_by_idx    on public.jamaah_kontak (created_by);
create index jamaah_pribadi_created_by_idx   on public.jamaah_pribadi (created_by);
create index jamaah_identitas_created_by_idx on public.jamaah_identitas (created_by);

-- ---------------------------------------------------------------------
-- 4. Trigger updated_at / updated_by
-- ---------------------------------------------------------------------
create trigger set_updated_at before update on public.jamaah_kontak
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.jamaah_pribadi
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.jamaah_identitas
  for each row execute function private.set_updated_at();
create trigger set_updated_by before insert or update on public.jamaah_kontak
  for each row execute function private.set_updated_by();
create trigger set_updated_by before insert or update on public.jamaah_pribadi
  for each row execute function private.set_updated_by();
create trigger set_updated_by before insert or update on public.jamaah_identitas
  for each row execute function private.set_updated_by();

-- ---------------------------------------------------------------------
-- 5. GRANT & RLS (wilayah + sasaran generus lewat private.boleh_jamaah)
-- ---------------------------------------------------------------------
revoke all on public.jamaah_kontak, public.jamaah_pribadi, public.jamaah_identitas
  from anon, authenticated;
grant select, insert, update, delete
  on public.jamaah_kontak, public.jamaah_pribadi, public.jamaah_identitas
  to authenticated;

alter table public.jamaah_kontak    enable row level security;
alter table public.jamaah_pribadi   enable row level security;
alter table public.jamaah_identitas enable row level security;

create policy jamaah_kontak_select on public.jamaah_kontak
  for select to authenticated using (private.boleh_jamaah('kontak.lihat', jamaah_id));
create policy jamaah_kontak_insert on public.jamaah_kontak
  for insert to authenticated with check (private.boleh_jamaah('kontak.kelola', jamaah_id));
create policy jamaah_kontak_update on public.jamaah_kontak
  for update to authenticated
  using (private.boleh_jamaah('kontak.kelola', jamaah_id))
  with check (private.boleh_jamaah('kontak.kelola', jamaah_id));
create policy jamaah_kontak_delete on public.jamaah_kontak
  for delete to authenticated using (private.boleh_jamaah('kontak.kelola', jamaah_id));

create policy jamaah_pribadi_select on public.jamaah_pribadi
  for select to authenticated using (private.boleh_jamaah('pribadi.lihat', jamaah_id));
create policy jamaah_pribadi_insert on public.jamaah_pribadi
  for insert to authenticated with check (private.boleh_jamaah('pribadi.kelola', jamaah_id));
create policy jamaah_pribadi_update on public.jamaah_pribadi
  for update to authenticated
  using (private.boleh_jamaah('pribadi.kelola', jamaah_id))
  with check (private.boleh_jamaah('pribadi.kelola', jamaah_id));
create policy jamaah_pribadi_delete on public.jamaah_pribadi
  for delete to authenticated using (private.boleh_jamaah('pribadi.kelola', jamaah_id));

create policy jamaah_identitas_select on public.jamaah_identitas
  for select to authenticated using (private.boleh_jamaah('identitas.lihat', jamaah_id));
create policy jamaah_identitas_insert on public.jamaah_identitas
  for insert to authenticated with check (private.boleh_jamaah('identitas.kelola', jamaah_id));
create policy jamaah_identitas_update on public.jamaah_identitas
  for update to authenticated
  using (private.boleh_jamaah('identitas.kelola', jamaah_id))
  with check (private.boleh_jamaah('identitas.kelola', jamaah_id));
create policy jamaah_identitas_delete on public.jamaah_identitas
  for delete to authenticated using (private.boleh_jamaah('identitas.kelola', jamaah_id));

-- ---------------------------------------------------------------------
-- 6. Data: izin baru & pemetaan peran
-- ---------------------------------------------------------------------
insert into public.izin (kode, deskripsi) values
  ('kontak.lihat',     'Melihat no. HP, no. HP orang tua/wali, dan email jamaah'),
  ('kontak.kelola',    'Mengisi/mengubah no. HP, no. HP orang tua/wali, dan email jamaah'),
  ('pribadi.lihat',    'Melihat nama orang tua dan alamat jamaah'),
  ('pribadi.kelola',   'Mengisi/mengubah nama orang tua dan alamat jamaah'),
  ('identitas.lihat',  'Melihat NIK dan No. KK jamaah'),
  ('identitas.kelola', 'Mengisi/mengubah NIK dan No. KK jamaah');

insert into public.peran_izin (peran_id, izin_kode)
select p.id, i.kode
from public.peran p
join public.izin i on
  (p.kode = 'admin_desa' and i.kode in (
     'kontak.lihat', 'kontak.kelola', 'pribadi.lihat', 'pribadi.kelola',
     'identitas.lihat', 'identitas.kelola'))
  or (p.kode = 'admin_kelompok' and i.kode in (
     'kontak.lihat', 'kontak.kelola', 'pribadi.lihat', 'pribadi.kelola'))
  or (p.kode = 'admin_generus' and i.kode = 'kontak.lihat');
