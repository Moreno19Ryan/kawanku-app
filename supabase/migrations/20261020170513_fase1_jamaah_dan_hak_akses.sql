-- Migrasi Fase 1: kelompok, keluarga, jamaah, peran sebagai data, RLS.
-- Sumber: docs/schema-proposal.md §6 (disetujui Reno: "OK, jalankan").

-- ---------------------------------------------------------------------
-- 0. Skema privat untuk fungsi helper (tidak terekspos lewat Data API)
-- ---------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Mengisi updated_by dengan pengguna yang sedang login (null bila lewat SQL/
-- service role).
create or replace function private.set_updated_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by = auth.uid();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. Tipe enum (nilai bisa ditambah nanti dengan ALTER TYPE ... ADD VALUE)
-- ---------------------------------------------------------------------
create type public.jenis_kelamin as enum ('L', 'P');
create type public.status_pernikahan as enum ('lajang', 'menikah', 'janda_duda');
-- Keterangan janda/duda: hanya jenisnya (cerai hidup / cerai mati), tanpa
-- alasan atau detail lain. Disimpan di tabel terbatas jamaah_janda_duda.
create type public.jenis_janda_duda as enum ('cerai_hidup', 'cerai_mati');
create type public.status_sekolah as enum
  ('belum_sekolah', 'paud_tk', 'sd', 'smp', 'sma_smk', 'kuliah', 'bekerja', 'lainnya');
create type public.wilayah_peran as enum ('desa', 'kelompok', 'fleksibel');
create type public.hubungan_keluarga as enum
  ('kepala_keluarga', 'pasangan', 'anak', 'orang_tua', 'lainnya');

-- ---------------------------------------------------------------------
-- 2. Tabel master
-- ---------------------------------------------------------------------
create table public.kelompok (
  id          uuid primary key default gen_random_uuid(),
  nomor       smallint not null unique check (nomor > 0),
  nama        text not null check (length(trim(nama)) > 0),
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Kategori jamaah sebagai DATA, berbasis aturan (usia, status sekolah, status
-- pernikahan). Kategori cocok bila SEMUA syarat yang terisi terpenuhi; bila
-- beberapa cocok, `urutan` terkecil menang. Lihat private.kategori_jamaah_id.
-- Syarat kosong (null atau array kosong) = tidak dipakai.
create table public.kategori_jamaah (
  id                         uuid primary key default gen_random_uuid(),
  kode                       text not null unique,
  nama                       text not null,
  usia_min                   smallint check (usia_min >= 0),
  usia_max                   smallint check (usia_max >= 0),
  status_sekolah_berlaku     public.status_sekolah[],
  status_pernikahan_berlaku  public.status_pernikahan[],
  termasuk_generus           boolean not null default false,
  urutan                     smallint not null unique,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint kategori_jamaah_rentang_usia check (
    usia_min is null or usia_max is null or usia_max >= usia_min
  )
);

-- ---------------------------------------------------------------------
-- 3. Keluarga & jamaah
-- ---------------------------------------------------------------------
create table public.keluarga (
  id           uuid primary key default gen_random_uuid(),
  kelompok_id  uuid not null references public.kelompok (id) on delete restrict,
  nama         text not null check (length(trim(nama)) > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by   uuid references auth.users (id) on delete set null,
  -- Target FK komposit dari jamaah: menjamin keluarga & jamaah satu kelompok.
  unique (id, kelompok_id)
);

create table public.jamaah (
  id                 uuid primary key default gen_random_uuid(),
  -- Kode unik per individu (KW-XXXXXX), diisi otomatis, tidak bisa diubah.
  -- BUKAN token QR (token kartu ada di tabel kartu_qr, Fase 2).
  kode               text not null unique,
  kelompok_id        uuid not null references public.kelompok (id) on delete restrict,
  keluarga_id        uuid,
  hubungan_keluarga  public.hubungan_keluarga,
  nama_lengkap       text not null check (length(trim(nama_lengkap)) > 0),
  nama_panggilan     text,
  tanggal_lahir      date check (tanggal_lahir > date '1900-01-01'),
  -- Cadangan bila tanggal lahir lengkap tidak diketahui.
  tahun_lahir        smallint check (tahun_lahir between 1900 and 2100),
  jenis_kelamin      public.jenis_kelamin not null,
  -- kosong = belum diisi
  status_pernikahan  public.status_pernikahan,
  status_sekolah     public.status_sekolah,
  -- Diisi trigger setiap status_sekolah berubah (untuk pengingat tahun ajaran).
  status_sekolah_diperbarui  date,
  aktif              boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by         uuid references auth.users (id) on delete set null,
  constraint jamaah_tahun_sesuai_tanggal check (
    tanggal_lahir is null
    or tahun_lahir is null
    or tahun_lahir = extract(year from tanggal_lahir)::int
  ),
  constraint jamaah_keluarga_satu_kelompok
    foreign key (keluarga_id, kelompok_id)
    references public.keluarga (id, kelompok_id)
    on delete set null (keluarga_id)
);

-- Status keringanan di tabel terpisah: RLS bekerja per baris, bukan per
-- kolom. Dengan tabel sendiri, penanda ini tetap tersembunyi walaupun nanti
-- generus boleh membaca profilnya sendiri (Fase 2).
create table public.jamaah_keringanan (
  jamaah_id   uuid primary key references public.jamaah (id) on delete cascade,
  jenis       text not null default 'tanpa_hp' check (jenis in ('tanpa_hp')),
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by  uuid references auth.users (id) on delete set null
);

-- Keterangan janda/duda (cerai hidup/mati) di tabel terpisah dengan izin
-- sendiri (janda_duda.lihat/kelola; default hanya admin desa). Tidak ada baris
-- = belum diketahui. Alasan RLS sama dengan jamaah_keringanan.
create table public.jamaah_janda_duda (
  jamaah_id   uuid primary key references public.jamaah (id) on delete cascade,
  jenis       public.jenis_janda_duda not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by  uuid references auth.users (id) on delete set null
);

-- Hanya boleh untuk jamaah berstatus janda_duda.
create or replace function private.cek_jamaah_janda_duda()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.jamaah
    where id = new.jamaah_id and status_pernikahan = 'janda_duda'
  ) then
    raise exception 'Keterangan janda/duda hanya untuk jamaah berstatus janda_duda';
  end if;
  return new;
end;
$$;

create trigger jamaah_janda_duda_cek
  before insert or update on public.jamaah_janda_duda
  for each row execute function private.cek_jamaah_janda_duda();

-- Saat status berubah dari janda_duda (mis. menikah lagi), keterangan dihapus
-- otomatis. Admin yang mengubah status tidak perlu (dan tidak bisa) melihat
-- keterangan ini, dan tidak mendapat error yang membocorkan keberadaannya.
create or replace function private.hapus_jamaah_janda_duda()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status_pernikahan = 'janda_duda'
     and new.status_pernikahan is distinct from 'janda_duda' then
    delete from public.jamaah_janda_duda where jamaah_id = new.id;
  end if;
  return new;
end;
$$;

create trigger jamaah_hapus_janda_duda
  after update of status_pernikahan on public.jamaah
  for each row execute function private.hapus_jamaah_janda_duda();

-- ---------------------------------------------------------------------
-- 4. Peran & hak akses sebagai data
-- ---------------------------------------------------------------------
-- Dua sumbu terpisah:
--   wilayah        : 'desa' (kelompok_id penugasan wajib kosong),
--                    'kelompok' (wajib terisi), 'fleksibel' (boleh keduanya)
--   hanya_generus  : true = hanya jamaah berkategori generus
create table public.peran (
  id             uuid primary key default gen_random_uuid(),
  kode           text not null unique,
  nama           text not null,
  wilayah        public.wilayah_peran not null,
  hanya_generus  boolean not null default false,
  deskripsi      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.izin (
  kode       text primary key,
  deskripsi  text not null
);

create table public.peran_izin (
  peran_id   uuid not null references public.peran (id) on delete cascade,
  izin_kode  text not null references public.izin (kode) on update cascade on delete cascade,
  primary key (peran_id, izin_kode)
);

-- Profil admin (1:1 dengan auth.users). Akun generus TIDAK di sini (Fase 2).
create table public.admin (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  nama        text not null check (length(trim(nama)) > 0),
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- kelompok_id kosong = seluruh desa; terisi = hanya kelompok itu.
create table public.penugasan_peran (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.admin (user_id) on delete cascade,
  peran_id     uuid not null references public.peran (id) on delete restrict,
  kelompok_id  uuid references public.kelompok (id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by   uuid references auth.users (id) on delete set null,
  unique nulls not distinct (user_id, peran_id, kelompok_id)
);

-- Validasi wilayah peran terhadap kelompok_id penugasan.
create or replace function private.cek_penugasan_peran()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_wilayah public.wilayah_peran;
begin
  select wilayah into v_wilayah from public.peran where id = new.peran_id;
  if v_wilayah = 'desa' and new.kelompok_id is not null then
    raise exception 'Peran tingkat desa tidak boleh memiliki kelompok_id';
  elsif v_wilayah = 'kelompok' and new.kelompok_id is null then
    raise exception 'Peran tingkat kelompok wajib memiliki kelompok_id';
  end if;
  return new;
end;
$$;

create trigger penugasan_peran_cek
  before insert or update on public.penugasan_peran
  for each row execute function private.cek_penugasan_peran();

-- ---------------------------------------------------------------------
-- 5. Kode jamaah: otomatis, acak, unik lintas kelompok, tidak bisa diubah
-- ---------------------------------------------------------------------
-- Alfabet tanpa karakter ambigu (tanpa 0, O, 1, I, L): 31 karakter.
-- 6 karakter = 31^6 ≈ 887 juta kombinasi.
-- security definer: pengecekan tabrakan melihat SEMUA baris, termasuk
-- kelompok lain yang tidak terlihat oleh RLS pemanggil.
create or replace function private.buat_kode_jamaah()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_alfabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_kode   text;
  v_bytes  bytea;
  v_byte   int;
  v_i      int;
begin
  for v_percobaan in 1..20 loop
    v_kode := '';
    while length(v_kode) < 6 loop
      v_bytes := uuid_send(gen_random_uuid());
      for v_i in 0..15 loop
        v_byte := get_byte(v_bytes, v_i);
        -- Tolak byte >= 248 (31 × 8) agar distribusi merata.
        if v_byte < 248 and length(v_kode) < 6 then
          v_kode := v_kode || substr(v_alfabet, (v_byte % 31) + 1, 1);
        end if;
      end loop;
    end loop;
    v_kode := 'KW-' || v_kode;
    if not exists (select 1 from public.jamaah where kode = v_kode) then
      return v_kode;
    end if;
  end loop;
  raise exception 'Gagal membuat kode jamaah unik setelah 20 percobaan';
end;
$$;

create or replace function private.atur_kode_jamaah()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Selalu dibuat server; nilai dari klien diabaikan.
    new.kode := private.buat_kode_jamaah();
  elsif new.kode is distinct from old.kode then
    raise exception 'Kode jamaah tidak boleh diubah';
  end if;
  return new;
end;
$$;

create trigger jamaah_kode
  before insert or update on public.jamaah
  for each row execute function private.atur_kode_jamaah();

-- status_sekolah_diperbarui: diisi tanggal hari ini saat status_sekolah diisi
-- atau berubah; selain itu dipertahankan (nilai dari klien diabaikan).
create or replace function private.atur_status_sekolah_diperbarui()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.status_sekolah_diperbarui :=
      case when new.status_sekolah is not null then current_date end;
  elsif new.status_sekolah is distinct from old.status_sekolah then
    new.status_sekolah_diperbarui := current_date;
  else
    new.status_sekolah_diperbarui := old.status_sekolah_diperbarui;
  end if;
  return new;
end;
$$;

create trigger jamaah_status_sekolah_diperbarui
  before insert or update on public.jamaah
  for each row execute function private.atur_status_sekolah_diperbarui();

-- ---------------------------------------------------------------------
-- 6. Trigger updated_at & updated_by
-- ---------------------------------------------------------------------
create trigger set_updated_at before update on public.kelompok
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.kategori_jamaah
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.keluarga
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.jamaah
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.jamaah_keringanan
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.jamaah_janda_duda
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.peran
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.admin
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.penugasan_peran
  for each row execute function private.set_updated_at();

create trigger set_updated_by before insert or update on public.keluarga
  for each row execute function private.set_updated_by();
create trigger set_updated_by before insert or update on public.jamaah
  for each row execute function private.set_updated_by();
create trigger set_updated_by before insert or update on public.jamaah_keringanan
  for each row execute function private.set_updated_by();
create trigger set_updated_by before insert or update on public.jamaah_janda_duda
  for each row execute function private.set_updated_by();
create trigger set_updated_by before insert or update on public.penugasan_peran
  for each row execute function private.set_updated_by();

-- ---------------------------------------------------------------------
-- 7. Index (FK & kolom yang dipakai RLS)
-- ---------------------------------------------------------------------
create index keluarga_kelompok_id_idx       on public.keluarga (kelompok_id);
create index jamaah_kelompok_id_idx         on public.jamaah (kelompok_id);
create index jamaah_keluarga_id_idx         on public.jamaah (keluarga_id, kelompok_id);
create index peran_izin_izin_kode_idx       on public.peran_izin (izin_kode);
create index penugasan_peran_user_id_idx    on public.penugasan_peran (user_id);
create index penugasan_peran_peran_id_idx   on public.penugasan_peran (peran_id);
create index penugasan_peran_kelompok_idx   on public.penugasan_peran (kelompok_id);

-- ---------------------------------------------------------------------
-- 8. Fungsi pusat usia & kategori, dan helper RLS
-- ---------------------------------------------------------------------
-- SATU-SATUNYA tempat usia dihitung: dari tanggal_lahir bila ada, kalau
-- tidak dari selisih tahun (tahun ini - tahun_lahir). Null bila keduanya kosong.
create or replace function private.usia(p_tanggal_lahir date, p_tahun_lahir smallint)
returns int
language sql
stable
set search_path = ''
as $$
  select coalesce(
    extract(year from age(current_date, p_tanggal_lahir))::int,
    extract(year from current_date)::int - p_tahun_lahir
  );
$$;

-- Kategori jamaah. Cocok bila SEMUA syarat yang terisi terpenuhi:
--   usia_min/usia_max  : usia (private.usia) dalam rentang;
--   status_*_berlaku   : nilai jamaah ada di dalam array.
-- Syarat yang terisi tetapi nilai jamaahnya kosong = TIDAK cocok.
-- Bila beberapa cocok, `urutan` terkecil menang. Bila tidak ada, null.
create or replace function private.kategori_jamaah_id(
  p_tanggal_lahir date,
  p_tahun_lahir smallint,
  p_status_pernikahan public.status_pernikahan,
  p_status_sekolah public.status_sekolah
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select k.id
  from public.kategori_jamaah k
  cross join lateral (select private.usia(p_tanggal_lahir, p_tahun_lahir) as usia) u
  where (k.usia_min is null or u.usia >= k.usia_min)
    and (k.usia_max is null or u.usia <= k.usia_max)
    and (coalesce(cardinality(k.status_sekolah_berlaku), 0) = 0
         or p_status_sekolah = any (k.status_sekolah_berlaku))
    and (coalesce(cardinality(k.status_pernikahan_berlaku), 0) = 0
         or p_status_pernikahan = any (k.status_pernikahan_berlaku))
  order by k.urutan
  limit 1;
$$;

create or replace function private.termasuk_generus(
  p_tanggal_lahir date,
  p_tahun_lahir smallint,
  p_status_pernikahan public.status_pernikahan,
  p_status_sekolah public.status_sekolah
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select k.termasuk_generus
     from public.kategori_jamaah k
     where k.id = private.kategori_jamaah_id(
       p_tanggal_lahir, p_tahun_lahir, p_status_pernikahan, p_status_sekolah)),
    false
  );
$$;

-- Inti hak akses. Lolos bila pengguna punya penugasan aktif yang:
--   (a) perannya memiliki izin p_izin;
--   (b) wilayahnya cocok: penugasan tanpa kelompok_id lolos untuk semua
--       kelompok; dengan kelompok_id hanya untuk kelompok itu. Izin global
--       (p_kelompok_id null) hanya lolos untuk penugasan tanpa kelompok_id;
--   (c) bila perannya hanya_generus: hanya untuk jamaah generus, dan izin
--       global otomatis tidak lolos. Sasaran generus ditentukan kategori
--       jamaah (status sekolah/pernikahan/usia), bukan umur semata.
create or replace function private.boleh(
  p_izin text,
  p_kelompok_id uuid,
  p_tanggal_lahir date default null,
  p_tahun_lahir smallint default null,
  p_status_pernikahan public.status_pernikahan default null,
  p_status_sekolah public.status_sekolah default null
)
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
    join public.peran p       on p.id = pp.peran_id
    join public.peran_izin pi on pi.peran_id = p.id and pi.izin_kode = p_izin
    where pp.user_id = (select auth.uid())
      and (pp.kelompok_id is null or pp.kelompok_id = p_kelompok_id)
      and (
        not p.hanya_generus
        or (
          p_kelompok_id is not null
          and private.termasuk_generus(
            p_tanggal_lahir, p_tahun_lahir, p_status_pernikahan, p_status_sekolah)
        )
      )
  );
$$;

-- Versi untuk tabel yang hanya punya jamaah_id.
create or replace function private.boleh_jamaah(p_izin text, p_jamaah_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.jamaah j
    where j.id = p_jamaah_id
      and private.boleh(p_izin, j.kelompok_id, j.tanggal_lahir, j.tahun_lahir,
                       j.status_pernikahan, j.status_sekolah)
  );
$$;

-- Admin aktif = punya baris admin aktif DAN minimal satu penugasan peran.
-- Akun generus (Fase 2) juga berperan `authenticated`, tapi bukan admin.
create or replace function private.adalah_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin a
    join public.penugasan_peran pp on pp.user_id = a.user_id
    where a.user_id = (select auth.uid()) and a.aktif
  );
$$;

revoke all on all functions in schema private from public;
grant execute on function
  private.usia(date, smallint),
  private.kategori_jamaah_id(date, smallint, public.status_pernikahan, public.status_sekolah),
  private.termasuk_generus(date, smallint, public.status_pernikahan, public.status_sekolah),
  private.boleh(text, uuid, date, smallint, public.status_pernikahan, public.status_sekolah),
  private.boleh_jamaah(text, uuid),
  private.adalah_admin()
to authenticated;

-- ---------------------------------------------------------------------
-- 9. View jamaah + usia + kategori (security_invoker → tetap tunduk RLS jamaah)
-- ---------------------------------------------------------------------
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

-- Untuk membersihkan data awal: jamaah aktif yang tidak cocok dengan kategori
-- mana pun (mis. status sekolah belum diisi). Tetap tunduk RLS jamaah.
create view public.jamaah_tanpa_kategori
with (security_invoker = true) as
select *
from public.jamaah_dengan_kategori
where aktif and kategori_jamaah_id is null;

-- ---------------------------------------------------------------------
-- 10. GRANT eksplisit (tidak bergantung pada default grant Supabase)
-- ---------------------------------------------------------------------
revoke all on
  public.kelompok, public.kategori_jamaah, public.keluarga, public.jamaah,
  public.jamaah_keringanan, public.jamaah_janda_duda, public.peran, public.izin, public.peran_izin,
  public.admin, public.penugasan_peran, public.jamaah_dengan_kategori,
  public.jamaah_tanpa_kategori
from anon, authenticated;

grant select, insert, update, delete on
  public.kelompok, public.kategori_jamaah, public.keluarga, public.jamaah,
  public.jamaah_keringanan, public.jamaah_janda_duda, public.peran, public.izin, public.peran_izin,
  public.admin, public.penugasan_peran
to authenticated;

grant select on public.jamaah_dengan_kategori, public.jamaah_tanpa_kategori to authenticated;

-- ---------------------------------------------------------------------
-- 11. Row Level Security (satu policy per tabel per perintah)
-- ---------------------------------------------------------------------
alter table public.kelompok           enable row level security;
alter table public.kategori_jamaah    enable row level security;
alter table public.keluarga           enable row level security;
alter table public.jamaah             enable row level security;
alter table public.jamaah_keringanan  enable row level security;
alter table public.jamaah_janda_duda  enable row level security;
alter table public.peran              enable row level security;
alter table public.izin               enable row level security;
alter table public.peran_izin         enable row level security;
alter table public.admin              enable row level security;
alter table public.penugasan_peran    enable row level security;

-- kelompok: dibaca semua pengguna login; kelola = izin global.
create policy kelompok_select on public.kelompok
  for select to authenticated using (true);
create policy kelompok_insert on public.kelompok
  for insert to authenticated with check (private.boleh('kelompok.kelola', null));
create policy kelompok_update on public.kelompok
  for update to authenticated
  using (private.boleh('kelompok.kelola', null))
  with check (private.boleh('kelompok.kelola', null));
create policy kelompok_delete on public.kelompok
  for delete to authenticated using (private.boleh('kelompok.kelola', null));

-- kategori_jamaah: dibaca semua pengguna login; kelola = izin global.
create policy kategori_jamaah_select on public.kategori_jamaah
  for select to authenticated using (true);
create policy kategori_jamaah_insert on public.kategori_jamaah
  for insert to authenticated with check (private.boleh('pengaturan.kelola', null));
create policy kategori_jamaah_update on public.kategori_jamaah
  for update to authenticated
  using (private.boleh('pengaturan.kelola', null))
  with check (private.boleh('pengaturan.kelola', null));
create policy kategori_jamaah_delete on public.kategori_jamaah
  for delete to authenticated using (private.boleh('pengaturan.kelola', null));

-- keluarga: per kelompok (peran hanya_generus tidak lolos karena keluarga
-- tidak punya kategori).
create policy keluarga_select on public.keluarga
  for select to authenticated using (private.boleh('keluarga.lihat', kelompok_id));
create policy keluarga_insert on public.keluarga
  for insert to authenticated with check (private.boleh('keluarga.kelola', kelompok_id));
create policy keluarga_update on public.keluarga
  for update to authenticated
  using (private.boleh('keluarga.kelola', kelompok_id))
  with check (private.boleh('keluarga.kelola', kelompok_id));
create policy keluarga_delete on public.keluarga
  for delete to authenticated using (private.boleh('keluarga.kelola', kelompok_id));

-- jamaah: wilayah + sasaran generus (kategori jamaah).
create policy jamaah_select on public.jamaah
  for select to authenticated
  using (private.boleh('jamaah.lihat', kelompok_id, tanggal_lahir, tahun_lahir, status_pernikahan, status_sekolah));
create policy jamaah_insert on public.jamaah
  for insert to authenticated
  with check (private.boleh('jamaah.tambah', kelompok_id, tanggal_lahir, tahun_lahir, status_pernikahan, status_sekolah));
create policy jamaah_update on public.jamaah
  for update to authenticated
  using (private.boleh('jamaah.ubah', kelompok_id, tanggal_lahir, tahun_lahir, status_pernikahan, status_sekolah))
  with check (private.boleh('jamaah.ubah', kelompok_id, tanggal_lahir, tahun_lahir, status_pernikahan, status_sekolah));
create policy jamaah_delete on public.jamaah
  for delete to authenticated
  using (private.boleh('jamaah.hapus', kelompok_id, tanggal_lahir, tahun_lahir, status_pernikahan, status_sekolah));

-- jamaah_keringanan: hanya admin dengan izin keringanan.*.
create policy jamaah_keringanan_select on public.jamaah_keringanan
  for select to authenticated using (private.boleh_jamaah('keringanan.lihat', jamaah_id));
create policy jamaah_keringanan_insert on public.jamaah_keringanan
  for insert to authenticated with check (private.boleh_jamaah('keringanan.kelola', jamaah_id));
create policy jamaah_keringanan_update on public.jamaah_keringanan
  for update to authenticated
  using (private.boleh_jamaah('keringanan.kelola', jamaah_id))
  with check (private.boleh_jamaah('keringanan.kelola', jamaah_id));
create policy jamaah_keringanan_delete on public.jamaah_keringanan
  for delete to authenticated using (private.boleh_jamaah('keringanan.kelola', jamaah_id));

-- jamaah_janda_duda: hanya pemegang izin janda_duda.* (default admin desa),
-- tetap dibatasi wilayah lewat boleh_jamaah.
create policy jamaah_janda_duda_select on public.jamaah_janda_duda
  for select to authenticated using (private.boleh_jamaah('janda_duda.lihat', jamaah_id));
create policy jamaah_janda_duda_insert on public.jamaah_janda_duda
  for insert to authenticated with check (private.boleh_jamaah('janda_duda.kelola', jamaah_id));
create policy jamaah_janda_duda_update on public.jamaah_janda_duda
  for update to authenticated
  using (private.boleh_jamaah('janda_duda.kelola', jamaah_id))
  with check (private.boleh_jamaah('janda_duda.kelola', jamaah_id));
create policy jamaah_janda_duda_delete on public.jamaah_janda_duda
  for delete to authenticated using (private.boleh_jamaah('janda_duda.kelola', jamaah_id));

-- peran / izin / peran_izin: dibaca admin aktif saja; diubah pemegang
-- akses.kelola. Dipecah per perintah (tanpa `for all`).
create policy peran_select on public.peran
  for select to authenticated using (private.adalah_admin());
create policy peran_insert on public.peran
  for insert to authenticated with check (private.boleh('akses.kelola', null));
create policy peran_update on public.peran
  for update to authenticated
  using (private.boleh('akses.kelola', null))
  with check (private.boleh('akses.kelola', null));
create policy peran_delete on public.peran
  for delete to authenticated using (private.boleh('akses.kelola', null));

create policy izin_select on public.izin
  for select to authenticated using (private.adalah_admin());
create policy izin_insert on public.izin
  for insert to authenticated with check (private.boleh('akses.kelola', null));
create policy izin_update on public.izin
  for update to authenticated
  using (private.boleh('akses.kelola', null))
  with check (private.boleh('akses.kelola', null));
create policy izin_delete on public.izin
  for delete to authenticated using (private.boleh('akses.kelola', null));

create policy peran_izin_select on public.peran_izin
  for select to authenticated using (private.adalah_admin());
create policy peran_izin_insert on public.peran_izin
  for insert to authenticated with check (private.boleh('akses.kelola', null));
create policy peran_izin_update on public.peran_izin
  for update to authenticated
  using (private.boleh('akses.kelola', null))
  with check (private.boleh('akses.kelola', null));
create policy peran_izin_delete on public.peran_izin
  for delete to authenticated using (private.boleh('akses.kelola', null));

-- admin & penugasan_peran: lihat milik sendiri; kelola = akses.kelola.
create policy admin_select on public.admin
  for select to authenticated
  using (user_id = (select auth.uid()) or private.boleh('akses.kelola', null));
create policy admin_insert on public.admin
  for insert to authenticated with check (private.boleh('akses.kelola', null));
create policy admin_update on public.admin
  for update to authenticated
  using (private.boleh('akses.kelola', null))
  with check (private.boleh('akses.kelola', null));
create policy admin_delete on public.admin
  for delete to authenticated using (private.boleh('akses.kelola', null));

create policy penugasan_peran_select on public.penugasan_peran
  for select to authenticated
  using (user_id = (select auth.uid()) or private.boleh('akses.kelola', null));
create policy penugasan_peran_insert on public.penugasan_peran
  for insert to authenticated with check (private.boleh('akses.kelola', null));
create policy penugasan_peran_update on public.penugasan_peran
  for update to authenticated
  using (private.boleh('akses.kelola', null))
  with check (private.boleh('akses.kelola', null));
create policy penugasan_peran_delete on public.penugasan_peran
  for delete to authenticated using (private.boleh('akses.kelola', null));

-- ---------------------------------------------------------------------
-- 12. Data awal (seed) — nilai DRAF, bisa diubah lewat data tanpa migrasi
-- ---------------------------------------------------------------------
insert into public.kelompok (nomor, nama) values
  (1, 'Kelompok 1'),
  (2, 'Kelompok 2'),
  (3, 'Kelompok 3'),
  (4, 'Kelompok 4');

insert into public.peran (kode, nama, wilayah, hanya_generus, deskripsi) values
  ('admin_desa',     'Admin Desa',     'desa',      false, 'Seluruh jamaah di seluruh desa'),
  ('admin_kelompok', 'Admin Kelompok', 'kelompok',  false, 'Seluruh jamaah di satu kelompok'),
  ('admin_generus',  'Admin Generus',  'fleksibel', true,  'Jamaah generus; tingkat desa (tanpa kelompok) atau satu kelompok');

insert into public.izin (kode, deskripsi) values
  ('kelompok.kelola',   'Menambah/mengubah/menghapus kelompok'),
  ('pengaturan.kelola', 'Mengubah pengaturan desa (mis. kategori jamaah)'),
  ('akses.kelola',      'Mengelola admin, peran, dan izin'),
  ('keluarga.lihat',    'Melihat data keluarga'),
  ('keluarga.kelola',   'Menambah/mengubah/menghapus keluarga'),
  ('jamaah.lihat',      'Melihat profil jamaah'),
  ('jamaah.tambah',     'Menambah jamaah'),
  ('jamaah.ubah',       'Mengubah profil jamaah'),
  ('jamaah.hapus',      'Menghapus jamaah secara permanen'),
  ('keringanan.lihat',  'Melihat penanda keringanan'),
  ('keringanan.kelola', 'Memberi/mencabut penanda keringanan'),
  ('janda_duda.lihat',  'Melihat keterangan janda/duda (cerai hidup/mati)'),
  ('janda_duda.kelola', 'Mengisi/mengubah keterangan janda/duda');

-- Pemetaan default (DRAF — detail hak akses menunggu pengurus).
-- janda_duda.* hanya untuk admin_desa (lewat baris pertama di bawah).
insert into public.peran_izin (peran_id, izin_kode)
select p.id, i.kode
from public.peran p
join public.izin i on
  (p.kode = 'admin_desa')
  or (p.kode = 'admin_kelompok' and i.kode in (
        'keluarga.lihat', 'keluarga.kelola',
        'jamaah.lihat', 'jamaah.tambah', 'jamaah.ubah',
        'keringanan.lihat', 'keringanan.kelola'))
  or (p.kode = 'admin_generus' and i.kode in (
        'jamaah.lihat', 'jamaah.ubah',
        'keringanan.lihat', 'keringanan.kelola'));

-- Kategori jamaah — DRAF, akan diubah Reno/pengurus lewat data tanpa migrasi.
-- Caberawit s.d. remaja dewasa TIDAK memakai umur; hanya lansia yang memakai usia.
insert into public.kategori_jamaah
  (urutan, kode, nama, usia_min, usia_max,
   status_sekolah_berlaku, status_pernikahan_berlaku, termasuk_generus)
values
  (1, 'lansia',        'Lansia',
      60, null, null, null, false),
  (2, 'berkeluarga',   'Berkeluarga',
      null, null, null, '{menikah,janda_duda}', false),
  (3, 'caberawit',     'Caberawit',
      null, null, '{belum_sekolah,paud_tk,sd}', null, false),
  (4, 'pra_remaja',    'Pra-Remaja',
      null, null, '{smp}', null, true),
  (5, 'remaja_muda',   'Remaja Muda',
      null, null, '{sma_smk}', null, true),
  (6, 'remaja_dewasa', 'Remaja Dewasa / Usia Mandiri / Pra-Nikah',
      null, null, '{kuliah,bekerja,lainnya}', null, true);
