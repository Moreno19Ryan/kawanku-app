-- =====================================================================
-- Bantuan akun untuk pengembang (Reno, 27 Okt 2026)
--
-- Supaya keluhan ringan ("tidak bisa masuk", "akun terkunci", "HP hilang")
-- bisa ditangani sendiri dari Pengaturan → Bantuan akun:
--   - cari_akun(): cari akun admin & generus beserta keadaannya (aktif,
--     terakhir masuk, PIN terkunci, jumlah perangkat yang sedang masuk).
--   - buka_kunci_akun(): hapus kunci 5x PIN salah pada akun generus.
--   - keluarkan_akun(): akhiri semua sesi masuk sebuah akun (mis. HP
--     hilang); akun tetap aktif dan bisa masuk lagi.
-- Hanya pemegang sistem.kelola (private.wajib_pengembang). Setiap tindakan
-- tercatat di bantuan_akun_log.
-- =====================================================================

create table public.bantuan_akun_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete set null,
  tindakan   text not null check (tindakan in ('buka_kunci', 'keluarkan')),
  oleh       uuid default auth.uid() references auth.users (id) on delete set null,
  catatan    text check (length(catatan) <= 300),
  -- clock_timestamp: urutan tetap benar walau beberapa tindakan dalam satu transaksi.
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default now()
);
comment on table public.bantuan_akun_log is 'Tindakan Bantuan akun oleh pengembang (buka kunci, keluarkan).';
create index bantuan_akun_log_user_idx on public.bantuan_akun_log (user_id, created_at desc);
create index bantuan_akun_log_oleh_idx on public.bantuan_akun_log (oleh);
create trigger set_updated_at before update on public.bantuan_akun_log
  for each row execute function private.set_updated_at();
revoke all on public.bantuan_akun_log from anon, authenticated;
grant select on public.bantuan_akun_log to authenticated;
alter table public.bantuan_akun_log enable row level security;
create policy bantuan_akun_log_select on public.bantuan_akun_log
  for select to authenticated using (private.boleh('sistem.kelola', null));

-- ---------------------------------------------------------------------
-- Cari akun (nama, email, username, atau kode jamaah). Kosong = yang
-- terakhir masuk.
-- ---------------------------------------------------------------------
create function public.cari_akun(p_cari text default null)
returns table (
  user_id        uuid,
  jenis          text,
  nama           text,
  login          text,
  aktif          boolean,
  peran          text[],
  kelompok       text,
  terakhir_masuk timestamptz,
  terkunci_sampai timestamptz,
  gagal_login    integer,
  pin_awal       boolean,
  sesi_aktif     integer,
  dibuat_at      timestamptz,
  bantuan_terakhir    text,
  bantuan_terakhir_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cari text := nullif(btrim(lower(p_cari)), '');
begin
  perform private.wajib_pengembang();
  return query
  with akun as (
    select a.user_id, 'admin'::text as jenis, a.nama, u.email::text as login, a.aktif,
           (select array_agg(distinct p.nama order by p.nama)
              from public.penugasan_peran pp join public.peran p on p.id = pp.peran_id
             where pp.user_id = a.user_id) as peran,
           (select string_agg(distinct k.nama, ', ' order by k.nama)
              from public.penugasan_peran pp join public.kelompok k on k.id = pp.kelompok_id
             where pp.user_id = a.user_id) as kelompok,
           u.last_sign_in_at as terakhir_masuk,
           null::timestamptz as terkunci_sampai, null::integer as gagal_login, null::boolean as pin_awal,
           u.created_at as dibuat_at, ''::text as kode
    from public.admin a
    join auth.users u on u.id = a.user_id
    union all
    select g.user_id, 'generus', j.nama_lengkap, g.username, g.aktif and j.aktif,
           null, k.nama, g.login_terakhir, g.terkunci_sampai, g.gagal_login, g.pin_awal,
           g.created_at, lower(j.kode)
    from public.akun_generus g
    join public.jamaah j on j.id = g.jamaah_id
    left join public.kelompok k on k.id = j.kelompok_id
  )
  select a.user_id, a.jenis, a.nama, a.login, a.aktif, a.peran, a.kelompok, a.terakhir_masuk,
         a.terkunci_sampai, a.gagal_login, a.pin_awal,
         (select count(*)::integer from auth.sessions s
           where s.user_id = a.user_id and (s.not_after is null or s.not_after > now())),
         a.dibuat_at, b.tindakan, b.created_at
  from akun a
  left join lateral (
    select l.tindakan, l.created_at from public.bantuan_akun_log l
    where l.user_id = a.user_id order by l.created_at desc limit 1
  ) b on true
  where v_cari is null
     or lower(a.nama) like '%' || v_cari || '%'
     or lower(a.login) like '%' || v_cari || '%'
     or a.kode = v_cari
  order by a.terakhir_masuk desc nulls last, a.nama
  limit 30;
end;
$$;

-- ---------------------------------------------------------------------
-- Buka kunci PIN generus (setelah 5x salah).
-- ---------------------------------------------------------------------
create function public.buka_kunci_akun(p_user_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.wajib_pengembang();
  update public.akun_generus
     set gagal_login = 0, terkunci_sampai = null
   where user_id = p_user_id;
  if not found then
    raise exception 'Akun generus tidak ditemukan' using errcode = 'P0002', hint = 'akun_tidak_ada';
  end if;
  insert into public.bantuan_akun_log (user_id, tindakan) values (p_user_id, 'buka_kunci');
end;
$$;

-- ---------------------------------------------------------------------
-- Keluarkan dari semua perangkat: hapus semua sesi masuk akun tersebut.
-- ---------------------------------------------------------------------
create function public.keluarkan_akun(p_user_id uuid, p_catatan text default null) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jumlah integer;
begin
  perform private.wajib_pengembang();
  if not exists (select 1 from public.admin where user_id = p_user_id)
     and not exists (select 1 from public.akun_generus where user_id = p_user_id) then
    raise exception 'Akun tidak ditemukan' using errcode = 'P0002', hint = 'akun_tidak_ada';
  end if;
  delete from auth.sessions where user_id = p_user_id;
  get diagnostics v_jumlah = row_count;
  insert into public.bantuan_akun_log (user_id, tindakan, catatan)
  values (p_user_id, 'keluarkan', left(nullif(btrim(p_catatan), ''), 300));
  return v_jumlah;
end;
$$;

revoke all on function public.cari_akun(text), public.buka_kunci_akun(uuid),
  public.keluarkan_akun(uuid, text) from public, anon;
grant execute on function public.cari_akun(text), public.buka_kunci_akun(uuid),
  public.keluarkan_akun(uuid, text) to authenticated;
