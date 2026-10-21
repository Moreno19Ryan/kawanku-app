-- =====================================================================
-- Fase 3a: kegiatan (jadwal rutin & agenda) dan pertemuan.
-- Dokumen: docs/kegiatan.md. Diterapkan ke produksi hanya setelah
-- "OK, jalankan".
--
-- Model:
--   - kegiatan        : satu kegiatan (rutin berjadwal atau agenda sekali).
--   - kegiatan_jadwal : aturan berulang (hari, jam, kecuali pekan ke-N).
--   - pertemuan       : satu kejadian. Untuk kegiatan rutin, kalender
--                       dihitung dari jadwal; baris pertemuan hanya dibuat
--                       bila ada isian (pemateri, materi, batal, pindah,
--                       absensi). Agenda selalu punya baris pertemuan.
--   - "Serentak di setiap kelompok" (per_kelompok): kegiatan tingkat desa
--     yang dijalankan tiap kelompok sendiri; pertemuannya per kelompok.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabel
-- ---------------------------------------------------------------------
create table public.kegiatan (
  id              uuid primary key default gen_random_uuid(),
  nama            text not null check (length(trim(nama)) between 1 and 120),
  jenis           text not null default 'rutin' check (jenis in ('rutin', 'agenda')),
  -- null = tingkat desa
  kelompok_id     uuid references public.kelompok (id) on delete restrict,
  -- Tingkat desa tapi dijalankan di setiap kelompok (serentak).
  per_kelompok    boolean not null default false,
  hanya_generus   boolean not null default false,
  lokasi          text check (length(lokasi) <= 120),
  keterangan      text check (length(keterangan) <= 500),
  durasi_menit    smallint not null default 90 check (durasi_menit between 15 and 720),
  aktif           boolean not null default true,
  berlaku_mulai   date not null default current_date,
  berlaku_sampai  date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by      uuid references auth.users (id) on delete set null,
  check (not per_kelompok or kelompok_id is null),
  check (berlaku_sampai is null or berlaku_sampai >= berlaku_mulai)
);

create table public.kegiatan_jadwal (
  id                uuid primary key default gen_random_uuid(),
  kegiatan_id       uuid not null references public.kegiatan (id) on delete cascade,
  -- 0 = Minggu … 6 = Sabtu
  hari              smallint not null check (hari between 0 and 6),
  jam               time not null,
  -- Pekan ke-N dalam bulan yang libur (mis. {3} = Minggu ke-3 libur).
  kecuali_pekan_ke  smallint[] not null default '{}'
                    check (kecuali_pekan_ke <@ array[1, 2, 3, 4, 5]::smallint[]),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (kegiatan_id, hari, jam)
);

create table public.pertemuan (
  id                  uuid primary key default gen_random_uuid(),
  kegiatan_id         uuid not null references public.kegiatan (id) on delete cascade,
  -- Kelompok pelaksana (diisi otomatis; null = tingkat desa).
  kelompok_id         uuid references public.kelompok (id) on delete restrict,
  -- Tanggal sesuai jadwal (kunci kalender), tetap walau dipindah.
  tanggal             date not null,
  -- Waktu sebenarnya (bisa dipindah).
  mulai               timestamptz not null,
  status              text not null default 'terjadwal' check (status in ('terjadwal', 'dibatalkan')),
  alasan_batal        text check (length(alasan_batal) <= 200),
  pemateri_jamaah_id  uuid references public.jamaah (id) on delete set null,
  -- Nama pemateri (salinan, supaya tetap terbaca lintas kelompok / pemateri luar).
  pemateri_nama       text check (length(pemateri_nama) <= 120),
  materi              text check (length(materi) <= 300),
  catatan             text check (length(catatan) <= 1000),
  sesi_id             uuid unique references public.sesi_absensi (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by          uuid references auth.users (id) on delete set null,
  unique nulls not distinct (kegiatan_id, kelompok_id, tanggal),
  check ((status = 'dibatalkan') or alasan_batal is null)
);

-- ---------------------------------------------------------------------
-- 2. Fungsi
-- ---------------------------------------------------------------------

-- Generik: boleh mengelola sesuatu di wilayah ini dengan izin p_izin
-- (sesi desa → hanya penugasan tingkat desa; peran khusus generus → hanya
-- untuk sasaran generus). Sama dengan boleh_kelola_sesi tapi izinnya bebas.
create or replace function private.boleh_kelola_wilayah(p_izin text, p_kelompok_id uuid, p_hanya_generus boolean)
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
      and (not p.hanya_generus or p_hanya_generus)
  );
$$;

-- Generus yang login boleh melihat kegiatan di wilayahnya (desa atau
-- kelompoknya sendiri).
create or replace function private.kegiatan_untuk_saya(p_kelompok_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.jamaah j
    where j.id = private.jamaah_saya() and (p_kelompok_id is null or j.kelompok_id = p_kelompok_id)
  );
$$;

create or replace function private.boleh_lihat_kegiatan(p_kegiatan_id uuid, p_kelompok_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.boleh_lihat_sesi('kegiatan.lihat', p_kelompok_id)
      or private.kegiatan_untuk_saya(p_kelompok_id);
$$;

-- Kelola pertemuan: wilayah pertemuan (kelompok pelaksana) + sasaran kegiatan.
create or replace function private.boleh_kelola_pertemuan(p_kegiatan_id uuid, p_kelompok_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.kegiatan k
    where k.id = p_kegiatan_id
      and private.boleh_kelola_wilayah('kegiatan.kelola', p_kelompok_id, k.hanya_generus)
  );
$$;

-- Isi kelompok_id pertemuan dari kegiatan & cek konsistensi.
create or replace function private.atur_pertemuan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kegiatan public.kegiatan;
begin
  select * into v_kegiatan from public.kegiatan where id = new.kegiatan_id;
  if v_kegiatan.per_kelompok then
    if new.kelompok_id is null then
      raise exception 'Pertemuan kegiatan serentak harus punya kelompok pelaksana';
    end if;
  else
    new.kelompok_id := v_kegiatan.kelompok_id;
  end if;
  if tg_op = 'UPDATE' and (new.kegiatan_id <> old.kegiatan_id or new.tanggal <> old.tanggal
                           or new.kelompok_id is distinct from old.kelompok_id) then
    raise exception 'Kegiatan, kelompok, dan tanggal jadwal pertemuan tidak bisa diubah (ubah waktu lewat kolom mulai)';
  end if;
  if new.status = 'terjadwal' then
    new.alasan_batal := null;
  end if;
  return new;
end;
$$;

-- Wilayah/sasaran kegiatan tidak boleh diubah setelah ada pertemuan.
create or replace function private.cek_ubah_kegiatan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.kelompok_id is distinct from old.kelompok_id or new.per_kelompok <> old.per_kelompok
      or new.hanya_generus <> old.hanya_generus or new.jenis <> old.jenis)
     and exists (select 1 from public.pertemuan where kegiatan_id = old.id) then
    raise exception 'Wilayah, sasaran, dan jenis kegiatan tidak bisa diubah setelah ada pertemuan tercatat';
  end if;
  return new;
end;
$$;

-- Buka absensi untuk satu pertemuan (rutin: dibuat bila belum ada):
-- membuat sesi_absensi lalu menautkannya. Security invoker → RLS berlaku.
create or replace function public.buka_absensi_pertemuan(
  p_kegiatan_id uuid, p_kelompok_id uuid, p_tanggal date, p_mulai timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_kegiatan  public.kegiatan;
  v_pertemuan public.pertemuan;
  v_kelompok  text;
  v_sesi      uuid;
begin
  select * into v_kegiatan from public.kegiatan where id = p_kegiatan_id;
  if not found then
    raise exception 'Kegiatan tidak ditemukan' using errcode = '42501';
  end if;
  insert into public.pertemuan (kegiatan_id, kelompok_id, tanggal, mulai)
  values (p_kegiatan_id, case when v_kegiatan.per_kelompok then p_kelompok_id end, p_tanggal, p_mulai)
  on conflict (kegiatan_id, kelompok_id, tanggal) do nothing;
  select * into v_pertemuan from public.pertemuan
  where kegiatan_id = p_kegiatan_id
    and kelompok_id is not distinct from (case when v_kegiatan.per_kelompok then p_kelompok_id else v_kegiatan.kelompok_id end)
    and tanggal = p_tanggal;
  if v_pertemuan.sesi_id is not null then
    return v_pertemuan.sesi_id;
  end if;
  if v_pertemuan.status = 'dibatalkan' then
    raise exception 'Pertemuan ini dibatalkan';
  end if;
  select nama into v_kelompok from public.kelompok where id = v_pertemuan.kelompok_id;
  insert into public.sesi_absensi (nama, kelompok_id, hanya_generus, mulai, selesai)
  values (
    left(v_kegiatan.nama || case when v_kegiatan.per_kelompok then ' · ' || v_kelompok else '' end, 120),
    v_pertemuan.kelompok_id, v_kegiatan.hanya_generus, v_pertemuan.mulai,
    v_pertemuan.mulai + make_interval(mins => v_kegiatan.durasi_menit)
  )
  returning id into v_sesi;
  update public.pertemuan set sesi_id = v_sesi where id = v_pertemuan.id;
  return v_sesi;
end;
$$;

revoke all on function private.boleh_kelola_wilayah(text, uuid, boolean), private.kegiatan_untuk_saya(uuid),
  private.boleh_lihat_kegiatan(uuid, uuid), private.boleh_kelola_pertemuan(uuid, uuid)
  from public, anon;
grant execute on function private.boleh_kelola_wilayah(text, uuid, boolean), private.kegiatan_untuk_saya(uuid),
  private.boleh_lihat_kegiatan(uuid, uuid), private.boleh_kelola_pertemuan(uuid, uuid)
  to authenticated;
revoke all on function public.buka_absensi_pertemuan(uuid, uuid, date, timestamptz) from public, anon;
grant execute on function public.buka_absensi_pertemuan(uuid, uuid, date, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Trigger & index
-- ---------------------------------------------------------------------
create trigger set_updated_at before update on public.kegiatan
  for each row execute function private.set_updated_at();
create trigger set_updated_by before insert or update on public.kegiatan
  for each row execute function private.set_updated_by();
create trigger set_updated_at before update on public.kegiatan_jadwal
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.pertemuan
  for each row execute function private.set_updated_at();
create trigger set_updated_by before insert or update on public.pertemuan
  for each row execute function private.set_updated_by();
create trigger atur_pertemuan before insert or update on public.pertemuan
  for each row execute function private.atur_pertemuan();
create trigger cek_ubah_kegiatan before update on public.kegiatan
  for each row execute function private.cek_ubah_kegiatan();

create index kegiatan_kelompok_idx on public.kegiatan (kelompok_id);
create index kegiatan_created_by_idx on public.kegiatan (created_by);
create index kegiatan_updated_by_idx on public.kegiatan (updated_by);
create index kegiatan_jadwal_kegiatan_idx on public.kegiatan_jadwal (kegiatan_id);
create index pertemuan_tanggal_idx on public.pertemuan (tanggal);
create index pertemuan_kelompok_idx on public.pertemuan (kelompok_id);
create index pertemuan_pemateri_idx on public.pertemuan (pemateri_jamaah_id);
create index pertemuan_created_by_idx on public.pertemuan (created_by);
create index pertemuan_updated_by_idx on public.pertemuan (updated_by);

-- ---------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------
alter table public.kegiatan        enable row level security;
alter table public.kegiatan_jadwal enable row level security;
alter table public.pertemuan       enable row level security;

create policy kegiatan_select on public.kegiatan
  for select to authenticated using (private.boleh_lihat_kegiatan(id, kelompok_id));
create policy kegiatan_insert on public.kegiatan
  for insert to authenticated
  with check (private.boleh_kelola_wilayah('kegiatan.kelola', kelompok_id, hanya_generus));
create policy kegiatan_update on public.kegiatan
  for update to authenticated
  using (private.boleh_kelola_wilayah('kegiatan.kelola', kelompok_id, hanya_generus))
  with check (private.boleh_kelola_wilayah('kegiatan.kelola', kelompok_id, hanya_generus));
create policy kegiatan_delete on public.kegiatan
  for delete to authenticated
  using (private.boleh_kelola_wilayah('kegiatan.kelola', kelompok_id, hanya_generus));

create policy kegiatan_jadwal_select on public.kegiatan_jadwal
  for select to authenticated using (exists (
    select 1 from public.kegiatan k where k.id = kegiatan_id
      and private.boleh_lihat_kegiatan(k.id, k.kelompok_id)));
create policy kegiatan_jadwal_insert on public.kegiatan_jadwal
  for insert to authenticated with check (exists (
    select 1 from public.kegiatan k where k.id = kegiatan_id
      and private.boleh_kelola_wilayah('kegiatan.kelola', k.kelompok_id, k.hanya_generus)));
create policy kegiatan_jadwal_update on public.kegiatan_jadwal
  for update to authenticated
  using (exists (select 1 from public.kegiatan k where k.id = kegiatan_id
    and private.boleh_kelola_wilayah('kegiatan.kelola', k.kelompok_id, k.hanya_generus)))
  with check (exists (select 1 from public.kegiatan k where k.id = kegiatan_id
    and private.boleh_kelola_wilayah('kegiatan.kelola', k.kelompok_id, k.hanya_generus)));
create policy kegiatan_jadwal_delete on public.kegiatan_jadwal
  for delete to authenticated using (exists (
    select 1 from public.kegiatan k where k.id = kegiatan_id
      and private.boleh_kelola_wilayah('kegiatan.kelola', k.kelompok_id, k.hanya_generus)));

create policy pertemuan_select on public.pertemuan
  for select to authenticated using (private.boleh_lihat_kegiatan(kegiatan_id, kelompok_id));
create policy pertemuan_insert on public.pertemuan
  for insert to authenticated with check (private.boleh_kelola_pertemuan(kegiatan_id, kelompok_id));
create policy pertemuan_update on public.pertemuan
  for update to authenticated
  using (private.boleh_kelola_pertemuan(kegiatan_id, kelompok_id))
  with check (private.boleh_kelola_pertemuan(kegiatan_id, kelompok_id));
create policy pertemuan_delete on public.pertemuan
  for delete to authenticated using (private.boleh_kelola_pertemuan(kegiatan_id, kelompok_id));

revoke all on public.kegiatan, public.kegiatan_jadwal, public.pertemuan from anon, authenticated;
grant select, insert, update, delete on public.kegiatan, public.kegiatan_jadwal, public.pertemuan to authenticated;

-- ---------------------------------------------------------------------
-- 5. Izin
-- ---------------------------------------------------------------------
insert into public.izin (kode, deskripsi) values
  ('kegiatan.lihat',  'Melihat jadwal kegiatan, pertemuan, pemateri, dan materi'),
  ('kegiatan.kelola', 'Membuat/mengubah kegiatan & jadwal, mengisi pemateri/materi, membatalkan/memindah pertemuan');

insert into public.peran_izin (peran_id, izin_kode)
select p.id, i.kode
from public.peran p
join public.izin i on i.kode in ('kegiatan.lihat', 'kegiatan.kelola')
where p.kode in ('admin_desa', 'admin_kelompok', 'admin_generus')
on conflict do nothing;
insert into public.peran_izin (peran_id, izin_kode)
select id, 'kegiatan.lihat' from public.peran where kode = 'pengembang'
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 6. Data awal (jadwal rutin dari Reno, 21 Okt 2026; bisa diubah lewat aplikasi)
-- ---------------------------------------------------------------------
with k as (
  insert into public.kegiatan (nama, jenis, kelompok_id, per_kelompok, durasi_menit, keterangan, created_by)
  values ('Pengajian Rutin Sambung Kelompok', 'rutin', null, true, 90,
          'Serentak di setiap kelompok. Minggu ke-3 libur (Hari Keluarga se-Daerah).', null)
  returning id
)
insert into public.kegiatan_jadwal (kegiatan_id, hari, jam, kecuali_pekan_ke)
select id, 0, time '20:00', '{3}'::smallint[] from k
union all
select id, 2, time '20:00', '{}'::smallint[] from k;

with k as (
  insert into public.kegiatan (nama, jenis, kelompok_id, per_kelompok, durasi_menit, created_by)
  values ('Pengajian Rutin Sambung Desa', 'rutin', null, false, 90, null)
  returning id
)
insert into public.kegiatan_jadwal (kegiatan_id, hari, jam)
select id, 4, time '20:00' from k;
