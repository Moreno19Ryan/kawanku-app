-- =====================================================================
-- KawanKu: login generus lebih aman (audit keamanan 22 Okt 2026)
-- =====================================================================
-- Masalah sebelumnya: kata sandi Auth akun generus = PIN 6 angka (sebagian
-- besar masih tanggal lahir), dan batas 5x salah hanya dicek di browser.
-- Siapa pun yang tahu username + tanggal lahir bisa login langsung ke Auth,
-- dan siapa pun bisa mengunci akun orang lain lewat gagal_login_generus.
--
-- Sekarang:
--   - Hash PIN disimpan di private.pin_generus (tidak terbaca siapa pun lewat
--     API). Kata sandi Auth generus diacak; aplikasi (server, secret key)
--     memeriksa PIN + kunci 5x salah lewat cek_pin_generus, lalu memberi
--     kata sandi sekali pakai yang baru untuk login dari HP generus.
--   - Hash PIN akun lama dipindah apa adanya dari auth.users (bcrypt yang
--     sama), jadi generus tetap memakai PIN lamanya.
--   - RPC login lama (mulai/gagal/berhasil, pin_generus_diganti) ditutup.
--   - Pengumuman khusus admin hanya terbaca admin aktif.
-- =====================================================================

create table private.pin_generus (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  pin_hash    text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table private.pin_generus enable row level security;
revoke all on private.pin_generus from public, anon, authenticated;

-- Pindahkan hash PIN (bcrypt) akun yang ada, lalu acak kata sandi Auth-nya.
insert into private.pin_generus (user_id, pin_hash)
select u.id, u.encrypted_password
from auth.users u
join public.akun_generus g on g.user_id = u.id
where coalesce(u.encrypted_password, '') <> '';

update auth.users u
set encrypted_password = extensions.crypt(encode(extensions.gen_random_bytes(32), 'hex'), extensions.gen_salt('bf'))
from public.akun_generus g
where g.user_id = u.id;

-- ---------------------------------------------------------------------
-- Periksa PIN (hanya server dengan secret key / service_role)
-- ---------------------------------------------------------------------
-- hasil: ok | salah | terkunci. Username tak dikenal = salah (tidak
-- membedakan, supaya username tidak bisa ditebak-tebak).
create or replace function public.cek_pin_generus(p_username text, p_pin text)
returns table (hasil text, user_id uuid, email text, pin_awal boolean, terkunci_sampai timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_akun public.akun_generus;
  v_hash text;
  v_email text;
begin
  select g.* into v_akun
  from public.akun_generus g
  join public.jamaah j on j.id = g.jamaah_id and j.aktif
  where g.username = lower(trim(p_username)) and g.aktif;
  if not found then
    return query select 'salah'::text, null::uuid, null::text, null::boolean, null::timestamptz;
    return;
  end if;
  if v_akun.terkunci_sampai > now() then
    return query select 'terkunci'::text, null::uuid, null::text, null::boolean, v_akun.terkunci_sampai;
    return;
  end if;

  select p.pin_hash into v_hash from private.pin_generus p where p.user_id = v_akun.user_id;
  if v_hash is not null and coalesce(p_pin, '') ~ '^\d{6}$' and extensions.crypt(p_pin, v_hash) = v_hash then
    update public.akun_generus
       set gagal_login = 0, terkunci_sampai = null, login_terakhir = now()
     where public.akun_generus.user_id = v_akun.user_id;
    select u.email::text into v_email from auth.users u where u.id = v_akun.user_id;
    return query select 'ok'::text, v_akun.user_id, v_email, v_akun.pin_awal, null::timestamptz;
    return;
  end if;

  -- Salah: 5x berturut-turut → kunci 15 menit.
  update public.akun_generus g
     set gagal_login = case when g.gagal_login + 1 >= 5 then 0 else g.gagal_login + 1 end,
         terkunci_sampai = case when g.gagal_login + 1 >= 5 then now() + interval '15 minutes' else g.terkunci_sampai end
   where g.user_id = v_akun.user_id
  returning g.terkunci_sampai into v_akun.terkunci_sampai;
  if v_akun.terkunci_sampai > now() then
    return query select 'terkunci'::text, null::uuid, null::text, null::boolean, v_akun.terkunci_sampai;
  else
    return query select 'salah'::text, null::uuid, null::text, null::boolean, null::timestamptz;
  end if;
end;
$$;
revoke all on function public.cek_pin_generus(text, text) from public, anon, authenticated;
grant execute on function public.cek_pin_generus(text, text) to service_role;

-- ---------------------------------------------------------------------
-- Atur PIN oleh pengelola akun (buat akun / atur ulang PIN)
-- ---------------------------------------------------------------------
-- PIN awal: wajib diganti generus saat login berikutnya; kunci dibuka.
create or replace function public.atur_pin_generus(p_user_id uuid, p_pin text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_jamaah uuid;
begin
  select g.jamaah_id into v_jamaah from public.akun_generus g where g.user_id = p_user_id;
  if v_jamaah is null or not private.boleh_jamaah('akun_generus.kelola', v_jamaah) then
    raise exception 'Tidak berhak' using errcode = '42501';
  end if;
  if coalesce(p_pin, '') !~ '^\d{6}$' then
    raise exception 'PIN harus 6 angka' using hint = 'pin';
  end if;
  insert into private.pin_generus (user_id, pin_hash)
  values (p_user_id, extensions.crypt(p_pin, extensions.gen_salt('bf', 10)))
  on conflict (user_id) do update set pin_hash = excluded.pin_hash, updated_at = now();
  update public.akun_generus
     set pin_awal = true, gagal_login = 0, terkunci_sampai = null
   where user_id = p_user_id;
end;
$$;
revoke all on function public.atur_pin_generus(uuid, text) from public, anon;
grant execute on function public.atur_pin_generus(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Generus mengganti PIN-nya sendiri
-- ---------------------------------------------------------------------
create or replace function public.ganti_pin_saya(p_pin text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_hash text;
begin
  if not exists (select 1 from public.akun_generus g where g.user_id = v_user and g.aktif) then
    raise exception 'Bukan akun generus' using errcode = '42501';
  end if;
  if coalesce(p_pin, '') !~ '^\d{6}$' then
    raise exception 'PIN harus 6 angka' using hint = 'pin';
  end if;
  select p.pin_hash into v_hash from private.pin_generus p where p.user_id = v_user;
  if v_hash is not null and extensions.crypt(p_pin, v_hash) = v_hash then
    raise exception 'PIN baru sama dengan PIN lama' using hint = 'sama';
  end if;
  insert into private.pin_generus (user_id, pin_hash)
  values (v_user, extensions.crypt(p_pin, extensions.gen_salt('bf', 10)))
  on conflict (user_id) do update set pin_hash = excluded.pin_hash, updated_at = now();
  update public.akun_generus set pin_awal = false where user_id = v_user;
end;
$$;
revoke all on function public.ganti_pin_saya(text) from public, anon;
grant execute on function public.ganti_pin_saya(text) to authenticated;

-- ---------------------------------------------------------------------
-- RPC login lama ditutup (tidak dipakai aplikasi lagi; dibiarkan tanpa
-- hak eksekusi supaya migrasi tidak memuat DROP)
-- ---------------------------------------------------------------------
revoke all on function public.mulai_login_generus(text), public.gagal_login_generus(text),
  public.login_generus_berhasil(), public.pin_generus_diganti()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Pengumuman khusus admin hanya untuk admin aktif
-- ---------------------------------------------------------------------
alter policy pengumuman_select on public.pengumuman
  using (
    private.adalah_admin()
    or (sasaran <> 'admin' and private.kegiatan_untuk_saya(kelompok_id))
  );
