-- =====================================================================
-- KawanKu: pengajuan izin/sakit dari HP generus (perlu persetujuan admin)
-- =====================================================================
-- Keputusan Reno (21 Okt 2026): generus mengajukan izin (kuliah / kerja /
-- lainnya) atau sakit untuk satu pertemuan kegiatan sebelum pengajian;
-- admin pengelola absensi jamaahnya menyetujui atau menolak.
--   - Pengajuan menunjuk satu kejadian kalender (kegiatan, kelompok
--     pelaksana, tanggal), sama dengan kunci tabel pertemuan, jadi bisa
--     diajukan walau absensinya belum dibuka.
--   - Disetujui → tercatat di absensi (status izin/sakit, jalur manual)
--     begitu sesinya ada: langsung bila sudah dibuka, atau otomatis saat
--     admin membuka absensi pertemuan itu. Catatan hadir tidak ditimpa.
--   - Sakit tanpa keterangan bebas (data kesehatan tidak disimpan).
-- =====================================================================

create table public.pengajuan_izin (
  id            uuid primary key default gen_random_uuid(),
  jamaah_id     uuid not null references public.jamaah (id) on delete cascade,
  kegiatan_id   uuid not null references public.kegiatan (id) on delete cascade,
  -- Kelompok pelaksana (diisi otomatis seperti pertemuan; null = desa).
  kelompok_id   uuid references public.kelompok (id) on delete restrict,
  tanggal       date not null,
  jenis         public.status_absensi not null check (jenis in ('izin', 'sakit')),
  alasan_izin   public.alasan_izin,
  keterangan    text check (length(trim(keterangan)) between 1 and 150),
  status        text not null default 'menunggu' check (status in ('menunggu', 'disetujui', 'ditolak')),
  tanggapan     text check (length(tanggapan) <= 200),
  ditangani_by  uuid references auth.users (id) on delete set null,
  ditangani_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by    uuid references auth.users (id) on delete set null,
  check ((jenis = 'izin') = (alasan_izin is not null)),
  check (jenis = 'izin' or keterangan is null)
);
-- Satu pengajuan aktif (menunggu/disetujui) per jamaah per pertemuan.
create unique index pengajuan_izin_satu_aktif
  on public.pengajuan_izin (jamaah_id, kegiatan_id, kelompok_id, tanggal) nulls not distinct
  where status <> 'ditolak';
create index pengajuan_izin_kejadian_idx on public.pengajuan_izin (kegiatan_id, tanggal);
create index pengajuan_izin_status_idx on public.pengajuan_izin (status, tanggal);
create index pengajuan_izin_kelompok_idx on public.pengajuan_izin (kelompok_id);
create index pengajuan_izin_created_by_idx on public.pengajuan_izin (created_by);
create index pengajuan_izin_updated_by_idx on public.pengajuan_izin (updated_by);
create index pengajuan_izin_ditangani_by_idx on public.pengajuan_izin (ditangani_by);

-- ---------------------------------------------------------------------
-- Validasi & pengisian otomatis
-- ---------------------------------------------------------------------
create or replace function private.atur_pengajuan_izin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kegiatan  public.kegiatan;
  v_jamaah    public.jamaah;
  v_pertemuan public.pertemuan;
  v_hari_ini  date := (now() at time zone 'Asia/Jakarta')::date;
  v_ditutup   boolean;
begin
  if tg_op = 'UPDATE' then
    if new.jamaah_id <> old.jamaah_id or new.kegiatan_id <> old.kegiatan_id
       or new.kelompok_id is distinct from old.kelompok_id or new.tanggal <> old.tanggal
       or new.jenis <> old.jenis or new.alasan_izin is distinct from old.alasan_izin
       or new.keterangan is distinct from old.keterangan then
      raise exception 'Isi pengajuan tidak bisa diubah';
    end if;
    if new.status <> old.status then
      new.ditangani_by := (select auth.uid());
      new.ditangani_at := case when new.status = 'menunggu' then null else now() end;
    end if;
    return new;
  end if;

  new.status := 'menunggu';
  new.tanggapan := null;
  new.ditangani_by := null;
  new.ditangani_at := null;

  select * into v_kegiatan from public.kegiatan where id = new.kegiatan_id;
  select * into v_jamaah from public.jamaah where id = new.jamaah_id;
  if not found or not v_jamaah.aktif or not v_kegiatan.aktif then
    raise exception 'Kegiatan tidak tersedia' using hint = 'tidak_ada_jadwal';
  end if;
  if v_kegiatan.kelompok_id is not null and v_kegiatan.kelompok_id <> v_jamaah.kelompok_id then
    raise exception 'Kegiatan ini bukan untuk kelompokmu' using hint = 'bukan_wilayah';
  end if;
  new.kelompok_id := case when v_kegiatan.per_kelompok then v_jamaah.kelompok_id else v_kegiatan.kelompok_id end;

  if new.tanggal < v_hari_ini or new.tanggal > v_hari_ini + 60 then
    raise exception 'Tanggal pengajuan di luar jangkauan' using hint = 'tanggal';
  end if;
  if new.tanggal < v_kegiatan.berlaku_mulai
     or (v_kegiatan.berlaku_sampai is not null and new.tanggal > v_kegiatan.berlaku_sampai) then
    raise exception 'Tidak ada jadwal pada tanggal itu' using hint = 'tidak_ada_jadwal';
  end if;

  select * into v_pertemuan from public.pertemuan p
  where p.kegiatan_id = new.kegiatan_id and p.kelompok_id is not distinct from new.kelompok_id
    and p.tanggal = new.tanggal;
  if found then
    if v_pertemuan.status = 'dibatalkan' then
      raise exception 'Pertemuan ini dibatalkan' using hint = 'dibatalkan';
    end if;
    select s.ditutup into v_ditutup from public.sesi_absensi s where s.id = v_pertemuan.sesi_id;
    if coalesce(v_ditutup, false) then
      raise exception 'Absensi pertemuan ini sudah ditutup' using hint = 'ditutup';
    end if;
  elsif not exists (
    select 1 from public.kegiatan_jadwal j
    where j.kegiatan_id = new.kegiatan_id
      and j.hari = extract(dow from new.tanggal)
      and not (ceil(extract(day from new.tanggal) / 7.0)::smallint = any (j.kecuali_pekan_ke))
  ) then
    raise exception 'Tidak ada jadwal pada tanggal itu' using hint = 'tidak_ada_jadwal';
  end if;
  return new;
end;
$$;

-- Catat izin/sakit yang disetujui ke absensi sesi pertemuannya (bila sesi
-- sudah ada). Catatan hadir tidak ditimpa; peserta yang tidak cocok dilewati.
create or replace function private.terapkan_pengajuan_izin(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aju  public.pengajuan_izin;
  v_sesi uuid;
begin
  select * into v_aju from public.pengajuan_izin where id = p_id and status = 'disetujui';
  if not found then
    return;
  end if;
  select p.sesi_id into v_sesi from public.pertemuan p
  where p.kegiatan_id = v_aju.kegiatan_id and p.kelompok_id is not distinct from v_aju.kelompok_id
    and p.tanggal = v_aju.tanggal and p.status = 'terjadwal';
  if v_sesi is null then
    return;
  end if;
  begin
    insert into public.absensi (sesi_id, jamaah_id, status, alasan_izin, jalur)
    values (v_sesi, v_aju.jamaah_id, v_aju.jenis, v_aju.alasan_izin, 'manual')
    on conflict (sesi_id, jamaah_id) do update
      set status = excluded.status, alasan_izin = excluded.alasan_izin, dicatat_at = now()
      where public.absensi.status <> 'hadir';
  exception when raise_exception then
    null;
  end;
end;
$$;
revoke all on function private.terapkan_pengajuan_izin(uuid) from public, anon, authenticated;

create or replace function private.setelah_pengajuan_izin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'disetujui' and old.status <> 'disetujui' then
    perform private.terapkan_pengajuan_izin(new.id);
  end if;
  return null;
end;
$$;
revoke all on function private.setelah_pengajuan_izin() from public, anon, authenticated;

-- Absensi pertemuan baru dibuka → terapkan pengajuan yang sudah disetujui.
create or replace function private.terapkan_izin_pertemuan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if new.sesi_id is not null and (tg_op = 'INSERT' or old.sesi_id is distinct from new.sesi_id) then
    for v_id in
      select a.id from public.pengajuan_izin a
      where a.kegiatan_id = new.kegiatan_id and a.kelompok_id is not distinct from new.kelompok_id
        and a.tanggal = new.tanggal and a.status = 'disetujui'
    loop
      perform private.terapkan_pengajuan_izin(v_id);
    end loop;
  end if;
  return null;
end;
$$;
revoke all on function private.terapkan_izin_pertemuan() from public, anon, authenticated;

create trigger atur_pengajuan before insert or update on public.pengajuan_izin
  for each row execute function private.atur_pengajuan_izin();
create trigger setelah_pengajuan after update on public.pengajuan_izin
  for each row execute function private.setelah_pengajuan_izin();
create trigger set_updated_at before update on public.pengajuan_izin
  for each row execute function private.set_updated_at();
create trigger set_updated_by before insert or update on public.pengajuan_izin
  for each row execute function private.set_updated_by();
create trigger terapkan_izin after insert or update of sesi_id on public.pertemuan
  for each row execute function private.terapkan_izin_pertemuan();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
revoke all on public.pengajuan_izin from anon, authenticated;
grant select, insert, update, delete on public.pengajuan_izin to authenticated;
alter table public.pengajuan_izin enable row level security;

-- Lihat: admin yang boleh melihat absensi jamaahnya, dan generus pemiliknya.
create policy pengajuan_izin_select on public.pengajuan_izin
  for select to authenticated
  using (private.boleh_jamaah('absensi.lihat', jamaah_id) or jamaah_id = private.jamaah_saya());
-- Ajukan: hanya generus untuk dirinya sendiri.
create policy pengajuan_izin_insert on public.pengajuan_izin
  for insert to authenticated with check (jamaah_id = private.jamaah_saya());
-- Setujui/tolak: admin pengelola absensi jamaahnya.
create policy pengajuan_izin_update on public.pengajuan_izin
  for update to authenticated
  using (private.boleh_jamaah('absensi.kelola', jamaah_id))
  with check (private.boleh_jamaah('absensi.kelola', jamaah_id));
-- Batalkan: generus pemilik, selama masih menunggu.
create policy pengajuan_izin_delete on public.pengajuan_izin
  for delete to authenticated
  using (jamaah_id = private.jamaah_saya() and status = 'menunggu');
