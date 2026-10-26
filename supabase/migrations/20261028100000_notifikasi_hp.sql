-- =====================================================================
-- Notifikasi HP (F5b, Reno 26 Okt 2026)
--
-- Generus yang menyalakan notifikasi di HP-nya (Web Push) mendapat
-- pengingat pengajian:
--   - H-1: malam sebelumnya (18.00–21.59 WIB);
--   - sebentar lagi: ±1 jam sebelum mulai.
-- Tidak dikirim bila pertemuan diliburkan atau izinnya sudah disetujui.
--
-- Alur: pg_cron tiap 5 menit → private.kirim_notifikasi() menghitung
-- pengingat yang jatuh tempo (sekali per orang per pertemuan, dicatat di
-- notifikasi_terkirim) → pg_net POST ke /api/notifikasi/kirim (dengan
-- rahasia bersama) → server aplikasi mengirim Web Push dengan kunci VAPID.
-- Langganan yang sudah tidak berlaku dimatikan lewat
-- langganan_kedaluwarsa(). Tidak ada secret key Supabase yang dipakai.
--
-- Prasyarat produksi (sekali, oleh Reno): ekstensi pg_net dinyalakan, dan
-- dua secret di Vault:
--   kawanku_notifikasi_url     alamat aplikasi, mis. https://inikawanku.com
--   kawanku_notifikasi_rahasia sama dengan env NOTIFIKASI_RAHASIA di Vercel
-- Selama salah satunya belum ada, kirim_notifikasi() tidak melakukan apa-apa.
-- =====================================================================

create extension if not exists pg_net;

-- ---------------------------------------------------------------------
-- Langganan per perangkat (satu baris per browser/HP)
-- ---------------------------------------------------------------------
create table public.langganan_notifikasi (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  endpoint             text not null unique check (endpoint like 'https://%' and length(endpoint) <= 1000),
  p256dh               text not null check (length(p256dh) <= 200),
  auth_key             text not null check (length(auth_key) <= 100),
  perangkat            text check (length(perangkat) <= 120),
  aktif                boolean not null default true,
  terakhir_terkirim_at timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
comment on table public.langganan_notifikasi is
  'Langganan Web Push per perangkat (notifikasi pengingat pengajian).';
create index langganan_notifikasi_user_idx on public.langganan_notifikasi (user_id) where aktif;
create trigger set_updated_at before update on public.langganan_notifikasi
  for each row execute function private.set_updated_at();

revoke all on public.langganan_notifikasi from anon, authenticated;
grant select on public.langganan_notifikasi to authenticated;
alter table public.langganan_notifikasi enable row level security;
create policy langganan_notifikasi_select on public.langganan_notifikasi
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Simpan / pindahkan langganan perangkat ini ke akun yang sedang login
-- (satu perangkat bisa berganti akun).
create function public.simpan_langganan_notifikasi(
  p_endpoint text, p_p256dh text, p_auth text, p_perangkat text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Harus login' using errcode = '42501';
  end if;
  insert into public.langganan_notifikasi (user_id, endpoint, p256dh, auth_key, perangkat)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_perangkat, 120))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth_key = excluded.auth_key,
        perangkat = excluded.perangkat, aktif = true;
end;
$$;

create function public.matikan_langganan_notifikasi(p_endpoint text) returns void
language sql
security definer
set search_path = ''
as $$
  update public.langganan_notifikasi set aktif = false
  where endpoint = p_endpoint and user_id = auth.uid();
$$;

revoke all on function public.simpan_langganan_notifikasi(text, text, text, text),
  public.matikan_langganan_notifikasi(text) from public, anon;
grant execute on function public.simpan_langganan_notifikasi(text, text, text, text),
  public.matikan_langganan_notifikasi(text) to authenticated;

-- ---------------------------------------------------------------------
-- Catatan pengingat yang sudah dikirim (supaya tidak dobel)
-- ---------------------------------------------------------------------
create table public.notifikasi_terkirim (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kunci      text not null check (length(kunci) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kunci)
);
comment on table public.notifikasi_terkirim is
  'Pengingat yang sudah dikirim (jenis:kegiatan:kelompok:tanggal), hanya untuk sistem.';
create trigger set_updated_at before update on public.notifikasi_terkirim
  for each row execute function private.set_updated_at();
revoke all on public.notifikasi_terkirim from anon, authenticated;
alter table public.notifikasi_terkirim enable row level security;

-- ---------------------------------------------------------------------
-- Secret dari Vault (null bila belum diisi)
-- ---------------------------------------------------------------------
create function private.rahasia_vault(p_nama text) returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(btrim(decrypted_secret), '') from vault.decrypted_secrets where name = p_nama limit 1;
$$;
revoke all on function private.rahasia_vault(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Pengingat yang jatuh tempo pada p_sekarang
-- ---------------------------------------------------------------------
create function private.notifikasi_jatuh_tempo(p_sekarang timestamptz default now())
returns table (user_id uuid, kunci text, judul text, isi text, url text)
language sql
stable
security definer
set search_path = ''
as $$
  with hari as (
    select (p_sekarang at time zone 'Asia/Jakarta')::date + d as tgl from generate_series(0, 1) d
  ),
  dari_jadwal as (
    select k.id as kegiatan_id, k.kelompok_id, h.tgl as tanggal,
           (h.tgl + j.jam) at time zone 'Asia/Jakarta' as mulai_jadwal
    from public.kegiatan k
    join public.kegiatan_jadwal j on j.kegiatan_id = k.id
    cross join hari h
    where k.aktif and k.jenis = 'rutin'
      and extract(dow from h.tgl)::smallint = j.hari
      and not (ceil(extract(day from h.tgl) / 7.0)::smallint = any (j.kecuali_pekan_ke))
      and h.tgl >= k.berlaku_mulai
      and (k.berlaku_sampai is null or h.tgl <= k.berlaku_sampai)
  ),
  kandidat as (
    select d.kegiatan_id, d.kelompok_id, d.tanggal, coalesce(p.mulai, d.mulai_jadwal) as mulai,
           coalesce(p.status, 'terjadwal') as status, p.pemateri_nama
    from dari_jadwal d
    left join public.pertemuan p
      on p.kegiatan_id = d.kegiatan_id and p.kelompok_id is not distinct from d.kelompok_id
     and p.tanggal = d.tanggal
    union
    select p.kegiatan_id, p.kelompok_id, p.tanggal, p.mulai, p.status, p.pemateri_nama
    from public.pertemuan p
    join public.kegiatan k on k.id = p.kegiatan_id
    where k.aktif and p.mulai between p_sekarang and p_sekarang + interval '2 days'
  ),
  jatuh as (
    select c.*, k.nama, k.lokasi, k.hanya_generus,
           case
             when c.mulai > p_sekarang and c.mulai <= p_sekarang + interval '70 minutes' then 'jam'
             when (c.mulai at time zone 'Asia/Jakarta')::date = (p_sekarang at time zone 'Asia/Jakarta')::date + 1
              and extract(hour from p_sekarang at time zone 'Asia/Jakarta') between 18 and 21 then 'h1'
           end as jenis
    from kandidat c
    join public.kegiatan k on k.id = c.kegiatan_id
    where c.status = 'terjadwal'
  )
  select distinct on (ag.user_id, x.jenis, x.kegiatan_id, x.kelompok_id, x.tanggal)
    ag.user_id,
    x.jenis || ':' || x.kegiatan_id || ':' || coalesce(x.kelompok_id::text, 'desa') || ':' || x.tanggal,
    case x.jenis when 'h1' then 'Besok: ' else 'Sebentar lagi: ' end || x.nama,
    'Pukul ' || to_char(x.mulai at time zone 'Asia/Jakarta', 'HH24.MI') || ' WIB'
      || coalesce(', bersama ' || x.pemateri_nama, '')
      || coalesce(' di ' || x.lokasi, '')
      || case x.jenis when 'h1' then '. InsyaAllah hadir. Berhalangan? Ajukan izin dari sekarang.'
                      else '. InsyaAllah sampai jumpa.' end,
    '/saya/jadwal'
  from jatuh x
  join public.akun_generus ag on ag.aktif
  join public.jamaah j on j.id = ag.jamaah_id and j.aktif
  where x.jenis is not null
    and (x.kelompok_id is null or x.kelompok_id = j.kelompok_id)
    and (not x.hanya_generus
         or private.termasuk_generus(j.tanggal_lahir, j.tahun_lahir, j.status_pernikahan, j.status_sekolah))
    and exists (select 1 from public.langganan_notifikasi l where l.user_id = ag.user_id and l.aktif)
    and not exists (
      select 1 from public.pengajuan_izin i
      where i.jamaah_id = j.id and i.kegiatan_id = x.kegiatan_id and i.tanggal = x.tanggal
        and i.kelompok_id is not distinct from x.kelompok_id and i.status = 'disetujui')
  order by ag.user_id, x.jenis, x.kegiatan_id, x.kelompok_id, x.tanggal;
$$;
revoke all on function private.notifikasi_jatuh_tempo(timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Kirim (dipanggil pg_cron tiap 5 menit)
-- ---------------------------------------------------------------------
create function private.kirim_notifikasi(p_sekarang timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url     text := private.rahasia_vault('kawanku_notifikasi_url');
  v_rahasia text := private.rahasia_vault('kawanku_notifikasi_rahasia');
  v_pesan   jsonb;
begin
  if v_url is null or v_rahasia is null then
    return 0;
  end if;

  with tempo as (
    select * from private.notifikasi_jatuh_tempo(p_sekarang)
  ),
  baru as (
    insert into public.notifikasi_terkirim (user_id, kunci)
    select t.user_id, t.kunci from tempo t
    on conflict (user_id, kunci) do nothing
    returning user_id, kunci
  )
  select jsonb_agg(jsonb_build_object(
           'endpoint', l.endpoint, 'p256dh', l.p256dh, 'auth', l.auth_key,
           'judul', t.judul, 'isi', t.isi, 'url', t.url, 'tag', t.kunci))
    into v_pesan
  from baru b
  join tempo t on t.user_id = b.user_id and t.kunci = b.kunci
  join public.langganan_notifikasi l on l.user_id = b.user_id and l.aktif;

  if v_pesan is null then
    return 0;
  end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/notifikasi/kirim',
    body := jsonb_build_object('pesan', v_pesan),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_rahasia),
    timeout_milliseconds := 15000
  );
  return jsonb_array_length(v_pesan);
end;
$$;
revoke all on function private.kirim_notifikasi(timestamptz) from public, anon, authenticated;

-- Dipanggil server aplikasi (tanpa sesi) setelah mengirim: matikan
-- langganan yang ditolak layanan push (404/410) & catat waktu terkirim.
create function public.hasil_kirim_notifikasi(p_rahasia text, p_terkirim text[], p_kedaluwarsa text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rahasia text := private.rahasia_vault('kawanku_notifikasi_rahasia');
begin
  if v_rahasia is null or p_rahasia is distinct from v_rahasia then
    raise exception 'Tidak berhak' using errcode = '42501';
  end if;
  update public.langganan_notifikasi set terakhir_terkirim_at = now()
  where endpoint = any (coalesce(p_terkirim, '{}'));
  update public.langganan_notifikasi set aktif = false
  where endpoint = any (coalesce(p_kedaluwarsa, '{}'));
end;
$$;
revoke all on function public.hasil_kirim_notifikasi(text, text[], text[]) from public;
grant execute on function public.hasil_kirim_notifikasi(text, text[], text[]) to anon, authenticated;

select cron.schedule('kawanku-kirim-notifikasi', '*/5 * * * *', 'select private.kirim_notifikasi()');
