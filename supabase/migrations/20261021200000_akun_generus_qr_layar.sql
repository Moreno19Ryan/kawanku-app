-- =====================================================================
-- Fase 2b: akun generus (username + PIN) dan absen lewat QR layar (jalur 2).
-- Dokumen: docs/absensi.md. Diterapkan ke produksi hanya setelah
-- "OK, jalankan".
--
-- Keputusan Reno (21 Okt 2026):
--   - Username dari nama lengkap atau nama panggilan.
--   - PIN awal = tanggal lahir DDMMYY (wajib diganti saat login pertama).
--   - Akun dikelola pengelola absensi wilayahnya (izin akun_generus.kelola).
--   - Setelah login, generus hanya bisa absen + melihat riwayatnya sendiri.
--
-- Akun generus = user Supabase Auth (email sintetis, tidak pernah dipakai
-- mengirim email) + baris akun_generus. Akun generus TIDAK punya baris admin,
-- jadi semua kebijakan admin tetap menolaknya.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabel
-- ---------------------------------------------------------------------
create table public.akun_generus (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  jamaah_id       uuid not null unique references public.jamaah (id) on delete cascade,
  username        text not null unique check (username ~ '^[a-z0-9]+(\.[a-z0-9]+)*$' and length(username) between 3 and 30),
  aktif           boolean not null default true,
  -- PIN masih PIN awal (tanggal lahir / dari admin) → wajib diganti.
  pin_awal        boolean not null default true,
  gagal_login     integer not null default 0,
  terkunci_sampai timestamptz,
  login_terakhir  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by      uuid references auth.users (id) on delete set null
);

-- Rahasia penanda tangan QR layar per sesi. Hanya dibaca fungsi security
-- definer (RLS aktif tanpa kebijakan = tertutup untuk semua peran API).
create table public.sesi_layar (
  sesi_id     uuid primary key references public.sesi_absensi (id) on delete cascade,
  rahasia     bytea not null default extensions.gen_random_bytes(32),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger set_updated_at before update on public.akun_generus
  for each row execute function private.set_updated_at();
create trigger set_updated_by before insert or update on public.akun_generus
  for each row execute function private.set_updated_by();
create trigger set_updated_at before update on public.sesi_layar
  for each row execute function private.set_updated_at();

create index akun_generus_created_by_idx on public.akun_generus (created_by);
create index akun_generus_updated_by_idx on public.akun_generus (updated_by);

-- ---------------------------------------------------------------------
-- 2. Fungsi bantu
-- ---------------------------------------------------------------------

-- Jamaah milik akun generus yang sedang login (null bila bukan generus aktif).
create or replace function private.jamaah_saya()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select g.jamaah_id from public.akun_generus g
  join public.jamaah j on j.id = g.jamaah_id and j.aktif
  where g.user_id = (select auth.uid()) and g.aktif;
$$;

-- Hanya jamaah generus yang boleh diberi akun.
create or replace function private.cek_akun_generus()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jamaah public.jamaah;
begin
  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.jamaah_id <> old.jamaah_id) then
    raise exception 'Pemilik akun generus tidak bisa diubah';
  end if;
  if tg_op = 'INSERT' then
    select * into v_jamaah from public.jamaah where id = new.jamaah_id;
    if not private.termasuk_generus(v_jamaah.tanggal_lahir, v_jamaah.tahun_lahir,
                                    v_jamaah.status_pernikahan, v_jamaah.status_sekolah) then
      raise exception 'Akun hanya untuk jamaah generus';
    end if;
    if exists (select 1 from public.admin where user_id = new.user_id) then
      raise exception 'Akun admin tidak bisa dijadikan akun generus';
    end if;
  end if;
  return new;
end;
$$;

create trigger cek_akun_generus before insert or update on public.akun_generus
  for each row execute function private.cek_akun_generus();

-- Sebaliknya: akun generus tidak bisa dijadikan admin.
create or replace function private.cek_admin_bukan_generus()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.akun_generus where user_id = new.user_id) then
    raise exception 'Akun generus tidak bisa dijadikan admin';
  end if;
  return new;
end;
$$;

create trigger cek_admin_bukan_generus before insert on public.admin
  for each row execute function private.cek_admin_bukan_generus();

-- ---------------------------------------------------------------------
-- 3. RPC
-- ---------------------------------------------------------------------

-- Boleh membuat/mengelola akun generus untuk jamaah ini (dicek aplikasi
-- SEBELUM memakai secret key untuk Auth Admin API).
create or replace function public.boleh_kelola_akun_generus(p_jamaah_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.boleh_jamaah('akun_generus.kelola', p_jamaah_id);
$$;

-- Langkah 1 login generus (dipanggil tanpa sesi): username → email sintetis.
-- Null bila tidak ada / nonaktif; terkunci_sampai diisi bila sedang dikunci.
create or replace function public.mulai_login_generus(p_username text)
returns table (email text, terkunci_sampai timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select u.email::text, case when g.terkunci_sampai > now() then g.terkunci_sampai end
  from public.akun_generus g
  join auth.users u on u.id = g.user_id
  join public.jamaah j on j.id = g.jamaah_id and j.aktif
  where g.username = lower(trim(p_username)) and g.aktif;
$$;

-- PIN salah: tambah hitungan; 5x berturut-turut → kunci 15 menit.
create or replace function public.gagal_login_generus(p_username text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.akun_generus
  set gagal_login = case when gagal_login + 1 >= 5 then 0 else gagal_login + 1 end,
      terkunci_sampai = case when gagal_login + 1 >= 5 then now() + interval '15 minutes'
                             else terkunci_sampai end
  where username = lower(trim(p_username));
$$;

-- Login berhasil (dipanggil dengan sesi generus): reset hitungan gagal.
create or replace function public.login_generus_berhasil()
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  update public.akun_generus
  set gagal_login = 0, terkunci_sampai = null, login_terakhir = now()
  where user_id = (select auth.uid()) and aktif
  returning pin_awal;
$$;

-- PIN sudah diganti generus sendiri (setelah auth.updateUser berhasil).
create or replace function public.pin_generus_diganti()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.akun_generus set pin_awal = false where user_id = (select auth.uid());
$$;

-- Token QR layar untuk sesi yang sedang dibuka: "<sesi_id>.<detik>.<tanda>".
-- Hanya pengelola absensi yang boleh mencatat di sesi ini.
create or replace function public.token_layar(p_sesi_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sesi    public.sesi_absensi;
  v_rahasia bytea;
  v_detik   bigint := floor(extract(epoch from now()));
begin
  select * into v_sesi from public.sesi_absensi where id = p_sesi_id;
  if not found or not private.boleh_lihat_sesi('absensi.kelola', v_sesi.kelompok_id) then
    raise exception 'Tidak berhak' using errcode = '42501';
  end if;
  if v_sesi.ditutup then
    return null;
  end if;
  insert into public.sesi_layar (sesi_id) values (p_sesi_id) on conflict (sesi_id) do nothing;
  select rahasia into v_rahasia from public.sesi_layar where sesi_id = p_sesi_id;
  return p_sesi_id::text || '.' || v_detik || '.' ||
    translate(encode(substr(extensions.hmac(convert_to(p_sesi_id::text || '.' || v_detik, 'UTF8'),
                                            v_rahasia, 'sha256'), 1, 16), 'base64'), '+/=', '-_');
end;
$$;

-- Generus absen dari QR layar. Token berlaku 90 detik sejak dibuat
-- (QR berganti tiap 60 detik). Hasil (jsonb) seperti catat_absensi_kode,
-- ditambah: kedaluwarsa | qr_tidak_sah | bukan_generus.
create or replace function public.absen_layar(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_bagian  text[] := string_to_array(coalesce(p_token, ''), '.');
  v_sesi_id uuid;
  v_detik   bigint;
  v_rahasia bytea;
  v_tanda   text;
  v_jamaah  uuid := private.jamaah_saya();
  v_sesi    public.sesi_absensi;
  v_lama    public.absensi;
  v_hint    text;
begin
  if v_jamaah is null then
    return jsonb_build_object('hasil', 'bukan_generus');
  end if;
  if cardinality(v_bagian) <> 3 or v_bagian[1] !~ '^[0-9a-f-]{36}$' or v_bagian[2] !~ '^[0-9]{1,12}$' then
    return jsonb_build_object('hasil', 'qr_tidak_sah');
  end if;
  v_sesi_id := v_bagian[1]::uuid;
  v_detik := v_bagian[2]::bigint;
  select rahasia into v_rahasia from public.sesi_layar where sesi_id = v_sesi_id;
  if not found then
    return jsonb_build_object('hasil', 'qr_tidak_sah');
  end if;
  v_tanda := translate(encode(substr(extensions.hmac(convert_to(v_sesi_id::text || '.' || v_detik, 'UTF8'),
                                                     v_rahasia, 'sha256'), 1, 16), 'base64'), '+/=', '-_');
  if v_tanda <> v_bagian[3] then
    return jsonb_build_object('hasil', 'qr_tidak_sah');
  end if;

  select * into v_sesi from public.sesi_absensi where id = v_sesi_id;
  if floor(extract(epoch from now())) - v_detik > 90 or v_detik - floor(extract(epoch from now())) > 10 then
    return jsonb_build_object('hasil', 'kedaluwarsa', 'sesi', v_sesi.nama);
  end if;
  if v_sesi.ditutup then
    return jsonb_build_object('hasil', 'sesi_ditutup', 'sesi', v_sesi.nama);
  end if;

  select * into v_lama from public.absensi where sesi_id = v_sesi_id and jamaah_id = v_jamaah;
  if found and v_lama.status = 'hadir' then
    return jsonb_build_object('hasil', 'sudah', 'sesi', v_sesi.nama, 'dicatat_at', v_lama.dicatat_at);
  end if;
  begin
    insert into public.absensi (sesi_id, jamaah_id, status, jalur)
    values (v_sesi_id, v_jamaah, 'hadir', 'layar')
    on conflict (sesi_id, jamaah_id) do update
      set status = 'hadir', alasan_izin = null, jalur = 'layar', dicatat_at = now();
  exception when raise_exception then
    get stacked diagnostics v_hint = pg_exception_hint;
    return jsonb_build_object('hasil', coalesce(nullif(v_hint, ''), 'bukan_peserta'), 'sesi', v_sesi.nama);
  end;
  return jsonb_build_object('hasil', 'tercatat', 'sesi', v_sesi.nama, 'dicatat_at', now());
end;
$$;

revoke all on function private.jamaah_saya() from public, anon;
grant execute on function private.jamaah_saya() to authenticated;
revoke all on function public.boleh_kelola_akun_generus(uuid), public.login_generus_berhasil(),
  public.pin_generus_diganti(), public.token_layar(uuid), public.absen_layar(text)
  from public, anon;
grant execute on function public.boleh_kelola_akun_generus(uuid), public.login_generus_berhasil(),
  public.pin_generus_diganti(), public.token_layar(uuid), public.absen_layar(text)
  to authenticated;
-- Langkah login generus dipanggil server action tanpa sesi (anon).
revoke all on function public.mulai_login_generus(text), public.gagal_login_generus(text) from public;
grant execute on function public.mulai_login_generus(text), public.gagal_login_generus(text)
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------
alter table public.akun_generus enable row level security;
alter table public.sesi_layar   enable row level security;

create policy akun_generus_select on public.akun_generus
  for select to authenticated
  using (user_id = (select auth.uid()) or private.boleh_jamaah('akun_generus.kelola', jamaah_id));
create policy akun_generus_insert on public.akun_generus
  for insert to authenticated with check (private.boleh_jamaah('akun_generus.kelola', jamaah_id));
create policy akun_generus_update on public.akun_generus
  for update to authenticated
  using (private.boleh_jamaah('akun_generus.kelola', jamaah_id))
  with check (private.boleh_jamaah('akun_generus.kelola', jamaah_id));
create policy akun_generus_delete on public.akun_generus
  for delete to authenticated using (private.boleh_jamaah('akun_generus.kelola', jamaah_id));

-- Generus: profil & catatan absensinya sendiri, dan sesi yang ia ikuti.
-- Digabung ke kebijakan select yang ada (satu kebijakan per tabel per
-- perintah, lihat tes fase1).
create or replace function private.sesi_saya(p_sesi_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.absensi
                 where sesi_id = p_sesi_id and jamaah_id = private.jamaah_saya());
$$;
revoke all on function private.sesi_saya(uuid) from public, anon;
grant execute on function private.sesi_saya(uuid) to authenticated;

alter policy jamaah_select on public.jamaah
  using (private.boleh('jamaah.lihat', kelompok_id, tanggal_lahir, tahun_lahir, status_pernikahan, status_sekolah)
         or id = private.jamaah_saya());
alter policy absensi_select on public.absensi
  using (private.boleh_jamaah('absensi.lihat', jamaah_id) or jamaah_id = private.jamaah_saya());
alter policy sesi_absensi_select on public.sesi_absensi
  using (private.boleh_lihat_sesi('absensi.lihat', kelompok_id) or private.sesi_saya(id));

revoke all on public.akun_generus, public.sesi_layar from anon, authenticated;
grant select, insert, update, delete on public.akun_generus to authenticated;

-- ---------------------------------------------------------------------
-- 5. Izin
-- ---------------------------------------------------------------------
insert into public.izin (kode, deskripsi) values
  ('akun_generus.kelola', 'Membuat dan mengelola akun login generus (username + PIN)');

insert into public.peran_izin (peran_id, izin_kode)
select id, 'akun_generus.kelola' from public.peran
where kode in ('admin_desa', 'admin_kelompok', 'admin_generus')
on conflict do nothing;
