-- =====================================================================
-- Fase 2a: absensi lewat kartu QR (jalur 1) + catat manual.
-- Dokumen: docs/absensi.md. Diterapkan ke produksi hanya setelah
-- "OK, jalankan".
--
-- Keputusan Reno (21 Okt 2026):
--   - Absensi untuk semua jamaah (kartu QR untuk semua); jalur 2 (QR layar)
--     khusus generus menyusul di Fase 2b.
--   - Status: hadir, izin (kuliah / kerja / lainnya), sakit. Tanpa
--     keterangan bebas (data kesehatan tidak disimpan).
--   - Sesi dibuat sesuai wilayah: admin desa (seluruh desa / kelompok mana
--     pun), admin kelompok (kelompoknya), admin generus (sesi generus di
--     wilayahnya).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tipe
-- ---------------------------------------------------------------------
create type public.status_absensi as enum ('hadir', 'izin', 'sakit');
create type public.alasan_izin as enum ('kuliah', 'kerja', 'lainnya');
-- kartu = scan kartu QR; manual = dicatat admin (kode/nama/izin/sakit);
-- layar = generus scan QR di layar admin (Fase 2b).
create type public.jalur_absensi as enum ('kartu', 'manual', 'layar');

-- ---------------------------------------------------------------------
-- 2. Tabel
-- ---------------------------------------------------------------------

-- Satu sesi = satu kegiatan yang diabsen (mis. "Pengajian Kelompok 1").
-- kelompok_id kosong = tingkat desa (peserta dari semua kelompok).
create table public.sesi_absensi (
  id             uuid primary key default gen_random_uuid(),
  nama           text not null check (length(trim(nama)) between 1 and 120),
  kelompok_id    uuid references public.kelompok (id) on delete restrict,
  hanya_generus  boolean not null default false,
  mulai          timestamptz not null,
  selesai        timestamptz,
  -- Sesi ditutup: scan kartu ditolak; koreksi manual (izin/sakit) tetap boleh.
  ditutup        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by     uuid references auth.users (id) on delete set null,
  check (selesai is null or selesai > mulai)
);

-- Kartu QR jalur 1. Token acak terpisah dari jamaah.kode supaya kartu yang
-- hilang bisa dicabut tanpa mengubah identitas jamaah. Satu kartu aktif per
-- jamaah; kartu lama tetap tersimpan (nonaktif) sebagai riwayat.
create table public.kartu_qr (
  id          uuid primary key default gen_random_uuid(),
  jamaah_id   uuid not null references public.jamaah (id) on delete cascade,
  token       text not null unique check (token ~ '^[2-9A-HJKMNP-Z]{16}$'),
  aktif       boolean not null default true,
  dicabut_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by  uuid references auth.users (id) on delete set null,
  check (aktif = (dicabut_at is null))
);
create unique index kartu_qr_satu_aktif on public.kartu_qr (jamaah_id) where aktif;

create table public.absensi (
  id           uuid primary key default gen_random_uuid(),
  sesi_id      uuid not null references public.sesi_absensi (id) on delete cascade,
  jamaah_id    uuid not null references public.jamaah (id) on delete cascade,
  status       public.status_absensi not null default 'hadir',
  alasan_izin  public.alasan_izin,
  jalur        public.jalur_absensi not null default 'manual',
  dicatat_at   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by   uuid references auth.users (id) on delete set null,
  -- Satu jamaah satu catatan per sesi, walau scan diulang / dua admin scan.
  unique (sesi_id, jamaah_id),
  -- Alasan hanya untuk izin, dan izin wajib beralasan.
  check ((status = 'izin') = (alasan_izin is not null))
);

-- ---------------------------------------------------------------------
-- 3. Fungsi
-- ---------------------------------------------------------------------

-- Token kartu: 16 karakter dari alfabet tanpa huruf/angka mirip (≈79 bit).
create or replace function private.buat_token_kartu()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_alfabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_token  text;
  v_bytes  bytea;
  v_byte   int;
  v_i      int;
begin
  for v_percobaan in 1..20 loop
    v_token := '';
    while length(v_token) < 16 loop
      v_bytes := uuid_send(gen_random_uuid());
      for v_i in 0..15 loop
        v_byte := get_byte(v_bytes, v_i);
        if v_byte < 248 and length(v_token) < 16 then
          v_token := v_token || substr(v_alfabet, (v_byte % 31) + 1, 1);
        end if;
      end loop;
    end loop;
    if not exists (select 1 from public.kartu_qr where token = v_token) then
      return v_token;
    end if;
  end loop;
  raise exception 'Gagal membuat token kartu unik setelah 20 percobaan';
end;
$$;

-- Token selalu dibuat server dan tidak bisa diubah.
create or replace function private.atur_token_kartu()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.token := private.buat_token_kartu();
  elsif new.token is distinct from old.token or new.jamaah_id is distinct from old.jamaah_id then
    raise exception 'Token dan pemilik kartu tidak bisa diubah; cabut lalu buat kartu baru';
  elsif old.dicabut_at is not null and new.aktif then
    raise exception 'Kartu yang sudah dicabut tidak bisa diaktifkan lagi';
  end if;
  return new;
end;
$$;

-- Boleh MELIHAT sesi: punya izin di wilayah sesi. Sesi tingkat desa juga
-- terlihat oleh admin kelompok (anggotanya bisa ikut), dan sesi umum terlihat
-- oleh admin generus (generusnya bisa ikut). Catatan absensi yang terlihat
-- tetap dibatasi per jamaah lewat boleh_jamaah.
create or replace function private.boleh_lihat_sesi(p_izin text, p_kelompok_id uuid)
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
    join public.peran_izin pi on pi.peran_id = pp.peran_id and pi.izin_kode = p_izin
    where pp.user_id = (select auth.uid())
      and (pp.kelompok_id is null or p_kelompok_id is null or pp.kelompok_id = p_kelompok_id)
  );
$$;

-- Boleh MENGELOLA sesi (buat/ubah/tutup/hapus): wilayah penugasan mencakup
-- sesi (sesi desa → hanya penugasan tingkat desa), dan peran khusus generus
-- hanya untuk sesi generus.
create or replace function private.boleh_kelola_sesi(p_kelompok_id uuid, p_hanya_generus boolean)
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
    join public.peran_izin pi on pi.peran_id = p.id and pi.izin_kode = 'absensi.kelola'
    where pp.user_id = (select auth.uid())
      and (pp.kelompok_id is null or pp.kelompok_id = p_kelompok_id)
      and (not p.hanya_generus or p_hanya_generus)
  );
$$;

create or replace function private.boleh_lihat_sesi_id(p_izin text, p_sesi_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sesi_absensi s
    where s.id = p_sesi_id and private.boleh_lihat_sesi(p_izin, s.kelompok_id)
  );
$$;

-- Validasi catatan absensi: jamaah aktif dan termasuk peserta sesi
-- (kelompoknya cocok; sesi generus → jamaah generus).
create or replace function private.cek_absensi()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sesi   public.sesi_absensi;
  v_jamaah public.jamaah;
begin
  if tg_op = 'UPDATE' and (new.sesi_id <> old.sesi_id or new.jamaah_id <> old.jamaah_id) then
    raise exception 'Sesi dan jamaah pada catatan absensi tidak bisa diubah';
  end if;
  -- Koreksi status catatan lama tetap boleh walau jamaah kini nonaktif.
  if tg_op = 'UPDATE' then
    return new;
  end if;
  select * into v_sesi from public.sesi_absensi where id = new.sesi_id;
  select * into v_jamaah from public.jamaah where id = new.jamaah_id;
  if not v_jamaah.aktif then
    raise exception 'Jamaah tidak aktif' using errcode = 'P0001', hint = 'jamaah_nonaktif';
  end if;
  if v_sesi.kelompok_id is not null and v_sesi.kelompok_id <> v_jamaah.kelompok_id then
    raise exception 'Jamaah bukan peserta sesi ini (beda kelompok)'
      using errcode = 'P0001', hint = 'bukan_peserta';
  end if;
  if v_sesi.hanya_generus and not private.termasuk_generus(
       v_jamaah.tanggal_lahir, v_jamaah.tahun_lahir,
       v_jamaah.status_pernikahan, v_jamaah.status_sekolah) then
    raise exception 'Jamaah bukan peserta sesi ini (sesi khusus generus)'
      using errcode = 'P0001', hint = 'bukan_peserta';
  end if;
  return new;
end;
$$;

-- Sesi tingkat desa / khusus generus tidak boleh diubah sasarannya setelah
-- ada catatan, supaya catatan lama tetap sah.
create or replace function private.cek_ubah_sesi()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.kelompok_id is distinct from old.kelompok_id or new.hanya_generus <> old.hanya_generus)
     and exists (select 1 from public.absensi where sesi_id = old.id) then
    raise exception 'Wilayah/sasaran sesi tidak bisa diubah setelah ada catatan absensi';
  end if;
  return new;
end;
$$;

-- Catat kehadiran dari hasil scan scanner USB atau ketikan admin.
-- p_kode: token kartu (16 karakter) atau kode jamaah (KW-XXXXXX).
-- SECURITY INVOKER: semua batas akses tetap RLS (kartu_qr, jamaah, absensi).
-- Hasil (jsonb): hasil = tercatat | sudah | tidak_dikenal | kartu_dicabut |
-- sesi_ditutup | bukan_peserta | jamaah_nonaktif | tidak_berhak.
create or replace function public.catat_absensi_kode(p_sesi_id uuid, p_kode text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_kode      text := upper(regexp_replace(coalesce(p_kode, ''), '\s', '', 'g'));
  v_sesi      public.sesi_absensi;
  v_kartu     public.kartu_qr;
  v_jamaah_id uuid;
  v_jalur     public.jalur_absensi;
  v_lama      public.absensi;
  v_hasil     text;
  v_hint      text;
begin
  select * into v_sesi from public.sesi_absensi where id = p_sesi_id;
  if not found then
    return jsonb_build_object('hasil', 'tidak_berhak');
  end if;
  if v_sesi.ditutup then
    return jsonb_build_object('hasil', 'sesi_ditutup');
  end if;

  if v_kode ~ '^KW-[2-9A-HJKMNP-Z]{6}$' then
    select id into v_jamaah_id from public.jamaah where kode = v_kode;
    v_jalur := 'manual';
  elsif v_kode ~ '^[2-9A-HJKMNP-Z]{16}$' then
    select * into v_kartu from public.kartu_qr where token = v_kode;
    if found and not v_kartu.aktif then
      return jsonb_build_object('hasil', 'kartu_dicabut', 'jamaah_id', v_kartu.jamaah_id);
    end if;
    v_jamaah_id := v_kartu.jamaah_id;
    v_jalur := 'kartu';
  end if;
  if v_jamaah_id is null then
    return jsonb_build_object('hasil', 'tidak_dikenal');
  end if;

  select * into v_lama from public.absensi where sesi_id = p_sesi_id and jamaah_id = v_jamaah_id;
  if found and v_lama.status = 'hadir' then
    v_hasil := 'sudah';
  else
    begin
      insert into public.absensi (sesi_id, jamaah_id, status, jalur)
      values (p_sesi_id, v_jamaah_id, 'hadir', v_jalur)
      on conflict (sesi_id, jamaah_id) do update
        set status = 'hadir', alasan_izin = null, jalur = excluded.jalur, dicatat_at = now();
      v_hasil := 'tercatat';
    exception
      when insufficient_privilege then
        return jsonb_build_object('hasil', 'tidak_berhak');
      when raise_exception then
        get stacked diagnostics v_hint = pg_exception_hint;
        return jsonb_build_object('hasil', coalesce(nullif(v_hint, ''), 'tidak_berhak'),
                                  'jamaah_id', v_jamaah_id);
    end;
  end if;
  return jsonb_build_object('hasil', v_hasil, 'jamaah_id', v_jamaah_id, 'jalur', v_jalur);
end;
$$;

-- Ganti kartu (hilang/rusak): cabut kartu aktif lalu buat yang baru, dalam
-- satu transaksi. Juga dipakai untuk kartu pertama.
create or replace function public.ganti_kartu_qr(p_jamaah_id uuid)
returns public.kartu_qr
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_baru public.kartu_qr;
begin
  update public.kartu_qr set aktif = false, dicabut_at = now()
  where jamaah_id = p_jamaah_id and aktif;
  insert into public.kartu_qr (jamaah_id, token) values (p_jamaah_id, '')
  returning * into v_baru;
  return v_baru;
end;
$$;

-- Buat kartu untuk semua jamaah aktif (yang boleh dikelola pemanggil) di
-- satu kelompok yang belum punya kartu aktif. Mengembalikan jumlah kartu baru.
create or replace function public.buat_kartu_qr_kelompok(p_kelompok_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_jumlah integer;
begin
  insert into public.kartu_qr (jamaah_id, token)
  select j.id, '' from public.jamaah j
  where j.kelompok_id = p_kelompok_id and j.aktif
    and private.boleh_jamaah('absensi.kelola', j.id)
    and not exists (select 1 from public.kartu_qr k where k.jamaah_id = j.id and k.aktif);
  get diagnostics v_jumlah = row_count;
  return v_jumlah;
end;
$$;

revoke all on function private.buat_token_kartu(), private.boleh_lihat_sesi(text, uuid),
  private.boleh_kelola_sesi(uuid, boolean), private.boleh_lihat_sesi_id(text, uuid)
  from public, anon;
grant execute on function private.boleh_lihat_sesi(text, uuid),
  private.boleh_kelola_sesi(uuid, boolean), private.boleh_lihat_sesi_id(text, uuid)
  to authenticated;
revoke all on function public.catat_absensi_kode(uuid, text), public.ganti_kartu_qr(uuid),
  public.buat_kartu_qr_kelompok(uuid) from public, anon;
grant execute on function public.catat_absensi_kode(uuid, text), public.ganti_kartu_qr(uuid),
  public.buat_kartu_qr_kelompok(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Trigger
-- ---------------------------------------------------------------------
create trigger set_updated_at before update on public.sesi_absensi
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.kartu_qr
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.absensi
  for each row execute function private.set_updated_at();
create trigger set_updated_by before insert or update on public.sesi_absensi
  for each row execute function private.set_updated_by();
create trigger set_updated_by before insert or update on public.kartu_qr
  for each row execute function private.set_updated_by();
create trigger set_updated_by before insert or update on public.absensi
  for each row execute function private.set_updated_by();

create trigger atur_token before insert or update on public.kartu_qr
  for each row execute function private.atur_token_kartu();
create trigger cek_absensi before insert or update on public.absensi
  for each row execute function private.cek_absensi();
create trigger cek_ubah_sesi before update on public.sesi_absensi
  for each row execute function private.cek_ubah_sesi();

-- ---------------------------------------------------------------------
-- 5. Index
-- ---------------------------------------------------------------------
create index sesi_absensi_kelompok_mulai_idx on public.sesi_absensi (kelompok_id, mulai desc);
create index sesi_absensi_mulai_idx on public.sesi_absensi (mulai desc);
create index absensi_jamaah_idx on public.absensi (jamaah_id);
create index absensi_created_by_idx on public.absensi (created_by);
create index absensi_updated_by_idx on public.absensi (updated_by);
create index sesi_absensi_created_by_idx on public.sesi_absensi (created_by);
create index sesi_absensi_updated_by_idx on public.sesi_absensi (updated_by);
create index kartu_qr_jamaah_idx on public.kartu_qr (jamaah_id);
create index kartu_qr_created_by_idx on public.kartu_qr (created_by);
create index kartu_qr_updated_by_idx on public.kartu_qr (updated_by);

-- ---------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------
alter table public.sesi_absensi enable row level security;
alter table public.kartu_qr     enable row level security;
alter table public.absensi      enable row level security;

create policy sesi_absensi_select on public.sesi_absensi
  for select to authenticated using (private.boleh_lihat_sesi('absensi.lihat', kelompok_id));
create policy sesi_absensi_insert on public.sesi_absensi
  for insert to authenticated with check (private.boleh_kelola_sesi(kelompok_id, hanya_generus));
create policy sesi_absensi_update on public.sesi_absensi
  for update to authenticated
  using (private.boleh_kelola_sesi(kelompok_id, hanya_generus))
  with check (private.boleh_kelola_sesi(kelompok_id, hanya_generus));
create policy sesi_absensi_delete on public.sesi_absensi
  for delete to authenticated using (private.boleh_kelola_sesi(kelompok_id, hanya_generus));

-- Token kartu hanya untuk pengelola absensi (untuk mencetak / scan).
create policy kartu_qr_select on public.kartu_qr
  for select to authenticated using (private.boleh_jamaah('absensi.kelola', jamaah_id));
create policy kartu_qr_insert on public.kartu_qr
  for insert to authenticated with check (private.boleh_jamaah('absensi.kelola', jamaah_id));
create policy kartu_qr_update on public.kartu_qr
  for update to authenticated
  using (private.boleh_jamaah('absensi.kelola', jamaah_id))
  with check (private.boleh_jamaah('absensi.kelola', jamaah_id));
-- Tidak ada delete: kartu dicabut (riwayat tetap ada); ikut terhapus bila
-- jamaahnya dihapus.

-- Catatan absensi: per jamaah (admin generus hanya generus), dan sesinya
-- harus terlihat oleh pencatat.
create policy absensi_select on public.absensi
  for select to authenticated using (private.boleh_jamaah('absensi.lihat', jamaah_id));
create policy absensi_insert on public.absensi
  for insert to authenticated with check (
    private.boleh_jamaah('absensi.kelola', jamaah_id)
    and private.boleh_lihat_sesi_id('absensi.kelola', sesi_id));
create policy absensi_update on public.absensi
  for update to authenticated
  using (private.boleh_jamaah('absensi.kelola', jamaah_id)
         and private.boleh_lihat_sesi_id('absensi.kelola', sesi_id))
  with check (private.boleh_jamaah('absensi.kelola', jamaah_id)
              and private.boleh_lihat_sesi_id('absensi.kelola', sesi_id));
create policy absensi_delete on public.absensi
  for delete to authenticated using (
    private.boleh_jamaah('absensi.kelola', jamaah_id)
    and private.boleh_lihat_sesi_id('absensi.kelola', sesi_id));

-- ---------------------------------------------------------------------
-- 7. GRANT
-- ---------------------------------------------------------------------
revoke all on public.sesi_absensi, public.kartu_qr, public.absensi from anon, authenticated;
grant select, insert, update, delete on public.sesi_absensi, public.absensi to authenticated;
grant select, insert, update on public.kartu_qr to authenticated;

-- ---------------------------------------------------------------------
-- 8. Izin
-- ---------------------------------------------------------------------
insert into public.izin (kode, deskripsi) values
  ('absensi.lihat',  'Melihat sesi dan rekap absensi'),
  ('absensi.kelola', 'Membuat sesi absensi, mencatat kehadiran, dan mengelola kartu QR');

-- Admin desa/kelompok/generus: lihat + kelola (dibatasi wilayah & sasaran
-- perannya). Pengembang: hanya lihat.
insert into public.peran_izin (peran_id, izin_kode)
select p.id, i.kode
from public.peran p
join public.izin i on i.kode in ('absensi.lihat', 'absensi.kelola')
where p.kode in ('admin_desa', 'admin_kelompok', 'admin_generus')
on conflict do nothing;
insert into public.peran_izin (peran_id, izin_kode)
select id, 'absensi.lihat' from public.peran where kode = 'pengembang'
on conflict do nothing;
