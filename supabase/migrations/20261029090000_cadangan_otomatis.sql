-- =====================================================================
-- Cadangan otomatis sistem, lapis 1 (F6a, Reno 26 Okt 2026)
--
-- Potret semua tabel data aplikasi (schema public, kecuali tabel teknis)
-- disimpan TERENKRIPSI di schema private (pgp_sym_encrypt, kunci acak di
-- Vault `kawanku_cadangan_kunci`). Jadwal bertingkat yang bisa diatur
-- pengembang: harian (simpan 7), mingguan/Ahad (5), bulanan/tanggal 1 (12),
-- tahunan/1 Januari (5); pg_cron `kawanku-cadangan` tiap 02.00 WIB.
-- "Cadangkan sekarang" = jenis manual (simpan 10).
--
-- Pemeriksaan otomatis: tiap tanggal 1 cadangan terakhir dibuka lagi dan
-- dicocokkan (jumlah baris + sidik md5). Pengembang bisa memulihkan SATU
-- baris (tabel ber-primary key tunggal) dari cadangan; setiap pemulihan
-- tercatat. Gagal cadangan / gagal periksa / ruang database > 80% batas
-- paket Free (500 MB) → notifikasi HP ke pengembang (notifikasi_sistem).
--
-- Lapis 2 (di luar Supabase) = GitHub Actions `.github/workflows/cadangan.yml`.
-- Semua akses hanya pemegang sistem.kelola (pengembang).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Kunci enkripsi (dibuat sekali, tidak pernah keluar dari database)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'kawanku_cadangan_kunci') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'kawanku_cadangan_kunci',
      'Kunci enkripsi cadangan otomatis KawanKu (lapis 1). Jangan diubah: cadangan lama tidak bisa dibuka.');
  end if;
end $$;

-- Pengembang aktif (pemegang sistem.kelola tingkat desa), untuk notifikasi.
create function private.pengembang_aktif() returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct a.user_id
  from public.admin a
  join public.penugasan_peran pp on pp.user_id = a.user_id and pp.kelompok_id is null
  join public.peran p on p.id = pp.peran_id and not p.hanya_generus
  join public.peran_izin pi on pi.peran_id = p.id and pi.izin_kode = 'sistem.kelola'
  where a.aktif;
$$;
revoke all on function private.pengembang_aktif() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Tabel
-- ---------------------------------------------------------------------
create table public.cadangan_jadwal (
  jenis      text primary key check (jenis in ('harian', 'mingguan', 'bulanan', 'tahunan')),
  aktif      boolean not null default true,
  simpan     smallint not null check (simpan between 1 and 60),
  urutan     smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.cadangan_jadwal is 'Jadwal cadangan otomatis & jumlah yang disimpan (Panel pengembang).';
insert into public.cadangan_jadwal (jenis, simpan, urutan) values
  ('harian', 7, 1), ('mingguan', 5, 2), ('bulanan', 12, 3), ('tahunan', 5, 4);

create table public.cadangan (
  id            uuid primary key default gen_random_uuid(),
  jenis         text not null check (jenis in ('harian', 'mingguan', 'bulanan', 'tahunan', 'manual')),
  status        text not null default 'berjalan' check (status in ('berjalan', 'berhasil', 'gagal')),
  ukuran_byte   bigint,
  jumlah_tabel  integer,
  jumlah_baris  bigint,
  pesan         text check (length(pesan) <= 500),
  dibuat_oleh   uuid references auth.users (id) on delete set null,
  selesai_at    timestamptz,
  diperiksa_at  timestamptz,
  hasil_periksa text check (hasil_periksa in ('cocok', 'rusak')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.cadangan is 'Daftar cadangan lapis 1 (isinya terenkripsi di private.cadangan_isi).';
create index cadangan_jenis_idx on public.cadangan (jenis, created_at desc);

create table private.cadangan_isi (
  cadangan_id uuid not null references public.cadangan (id) on delete cascade,
  tabel       text not null,
  jumlah      integer not null,
  sidik       text not null,
  isi         bytea not null,
  primary key (cadangan_id, tabel)
);

create table public.pemulihan_cadangan (
  id          uuid primary key default gen_random_uuid(),
  cadangan_id uuid references public.cadangan (id) on delete set null,
  tabel       text not null,
  baris_id    text not null,
  oleh        uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.pemulihan_cadangan is 'Riwayat pemulihan baris dari cadangan (oleh pengembang).';

-- Pesan sistem untuk pengembang (dikirim lewat jalur notifikasi HP).
create table public.notifikasi_sistem (
  id         uuid primary key default gen_random_uuid(),
  kunci      text not null unique check (length(kunci) <= 200),
  judul      text not null check (length(judul) <= 120),
  isi        text not null check (length(isi) <= 300),
  url        text not null default '/pengaturan/cadangan',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.notifikasi_sistem is 'Peringatan sistem untuk pengembang (cadangan gagal, ruang database).';

do $$
declare t text;
begin
  foreach t in array array['cadangan_jadwal', 'cadangan', 'pemulihan_cadangan', 'notifikasi_sistem'] loop
    execute format('create trigger set_updated_at before update on public.%I
      for each row execute function private.set_updated_at()', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated
      using (private.boleh(''sistem.kelola'', null))', t || '_select', t);
  end loop;
end $$;
grant select on public.cadangan_jadwal, public.cadangan, public.pemulihan_cadangan, public.notifikasi_sistem to authenticated;
grant update (aktif, simpan) on public.cadangan_jadwal to authenticated;
create policy cadangan_jadwal_update on public.cadangan_jadwal
  for update to authenticated
  using (private.boleh('sistem.kelola', null))
  with check (private.boleh('sistem.kelola', null));

-- ---------------------------------------------------------------------
-- Inti
-- ---------------------------------------------------------------------

-- Tabel yang ikut dicadangkan: semua tabel public kecuali yang teknis.
create function private.tabel_cadangan() returns setof text
language sql
stable
set search_path = ''
as $$
  select c.relname::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and c.relname not in ('cadangan', 'cadangan_jadwal', 'pemulihan_cadangan', 'notifikasi_sistem',
                          'galat_aplikasi', 'langganan_notifikasi', 'notifikasi_terkirim', 'sesi_layar',
                          'tempat_sampah')
  order by 1;
$$;
revoke all on function private.tabel_cadangan() from public, anon, authenticated;

create function private.kunci_cadangan() returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'kawanku_cadangan_kunci' limit 1;
$$;
revoke all on function private.kunci_cadangan() from public, anon, authenticated;

create function private.catat_notifikasi_sistem(p_kunci text, p_judul text, p_isi text, p_url text default '/pengaturan/cadangan')
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifikasi_sistem (kunci, judul, isi, url)
  values (left(p_kunci, 200), left(p_judul, 120), left(p_isi, 300), p_url)
  on conflict (kunci) do nothing;
$$;
revoke all on function private.catat_notifikasi_sistem(text, text, text, text) from public, anon, authenticated;

create function private.buat_cadangan(p_jenis text, p_oleh uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     uuid;
  v_kunci  text := private.kunci_cadangan();
  v_tabel  text;
  v_json   text;
  v_jumlah integer;
  v_simpan integer;
begin
  -- clock_timestamp: urutan rotasi tetap benar walau beberapa cadangan dibuat dalam satu transaksi.
  insert into public.cadangan (jenis, dibuat_oleh, created_at)
  values (p_jenis, p_oleh, clock_timestamp()) returning id into v_id;
  begin
    if v_kunci is null then
      raise exception 'Kunci cadangan tidak ada di Vault';
    end if;
    for v_tabel in select * from private.tabel_cadangan() loop
      execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb)::text, count(*)::int from public.%I t', v_tabel)
        into v_json, v_jumlah;
      insert into private.cadangan_isi (cadangan_id, tabel, jumlah, sidik, isi)
      values (v_id, v_tabel, v_jumlah, md5(v_json), extensions.pgp_sym_encrypt(v_json, v_kunci, 'cipher-algo=aes256'));
    end loop;
    update public.cadangan c set
      status = 'berhasil', selesai_at = now(),
      jumlah_tabel = s.n, jumlah_baris = s.baris, ukuran_byte = s.ukuran
    from (select count(*)::int n, sum(jumlah)::bigint baris, sum(length(isi))::bigint ukuran
          from private.cadangan_isi where cadangan_id = v_id) s
    where c.id = v_id;
  exception when others then
    -- Isi sebagian sudah otomatis dibatalkan (subtransaksi); catat gagalnya.
    update public.cadangan set status = 'gagal', selesai_at = now(), pesan = left(sqlerrm, 500) where id = v_id;
    perform private.catat_notifikasi_sistem('cadangan-gagal:' || v_id,
      'Cadangan ' || p_jenis || ' gagal', left('Pesan: ' || sqlerrm, 300));
    return v_id;
  end;

  -- Rotasi: simpan N terakhir yang berhasil per jenis (yang gagal: 10 terakhir).
  v_simpan := coalesce((select simpan from public.cadangan_jadwal where jenis = p_jenis), 10);
  delete from public.cadangan
  where jenis = p_jenis and status = 'berhasil'
    and id not in (select id from public.cadangan where jenis = p_jenis and status = 'berhasil'
                   order by created_at desc limit v_simpan);
  delete from public.cadangan
  where jenis = p_jenis and status = 'gagal'
    and id not in (select id from public.cadangan where jenis = p_jenis and status = 'gagal'
                   order by created_at desc limit 10);
  return v_id;
end;
$$;
revoke all on function private.buat_cadangan(text, uuid) from public, anon, authenticated;

-- Buka lagi setiap tabel cadangan & cocokkan jumlah baris + sidik.
create function private.periksa_cadangan(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kunci text := private.kunci_cadangan();
  r       record;
  v_json  text;
  v_hasil text := 'cocok';
begin
  if not exists (select 1 from public.cadangan where id = p_id and status = 'berhasil') then
    return null;
  end if;
  for r in select * from private.cadangan_isi where cadangan_id = p_id loop
    begin
      v_json := extensions.pgp_sym_decrypt(r.isi, v_kunci);
      if md5(v_json) <> r.sidik or jsonb_array_length(v_json::jsonb) <> r.jumlah then
        v_hasil := 'rusak';
      end if;
    exception when others then
      v_hasil := 'rusak';
    end;
  end loop;
  update public.cadangan set diperiksa_at = now(), hasil_periksa = v_hasil where id = p_id;
  if v_hasil = 'rusak' then
    perform private.catat_notifikasi_sistem('cadangan-rusak:' || p_id,
      'Pemeriksaan cadangan GAGAL', 'Cadangan tidak bisa dibuka atau isinya tidak cocok. Buat cadangan baru & cek Panel pengembang.');
  end if;
  return v_hasil;
end;
$$;
revoke all on function private.periksa_cadangan(uuid) from public, anon, authenticated;

-- Dipanggil pg_cron tiap 02.00 WIB: jalankan jenis yang jatuh tempo hari ini.
create function private.cadangan_terjadwal(p_sekarang timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tgl    date := (p_sekarang at time zone 'Asia/Jakarta')::date;
  v_jumlah integer := 0;
  r        record;
  v_ukuran bigint;
begin
  for r in select * from public.cadangan_jadwal where aktif order by urutan loop
    if r.jenis = 'harian'
       or (r.jenis = 'mingguan' and extract(dow from v_tgl) = 0)
       or (r.jenis = 'bulanan' and extract(day from v_tgl) = 1)
       or (r.jenis = 'tahunan' and extract(day from v_tgl) = 1 and extract(month from v_tgl) = 1) then
      perform private.buat_cadangan(r.jenis);
      v_jumlah := v_jumlah + 1;
    end if;
  end loop;

  -- Pemeriksaan bulanan: cadangan terakhir yang berhasil.
  if extract(day from v_tgl) = 1 then
    perform private.periksa_cadangan(
      (select id from public.cadangan where status = 'berhasil' order by created_at desc limit 1));
  end if;

  -- Ruang database (paket Free: 500 MB).
  v_ukuran := pg_database_size(current_database());
  if v_ukuran > 400 * 1024 * 1024 then
    perform private.catat_notifikasi_sistem('ruang:' || to_char(v_tgl, 'IYYY-IW'),
      'Ruang database hampir penuh',
      'Terpakai ' || pg_size_pretty(v_ukuran) || ' dari 500 MB (paket Free). Kurangi jumlah cadangan yang disimpan atau naikkan paket.');
  end if;
  return v_jumlah;
end;
$$;
revoke all on function private.cadangan_terjadwal(timestamptz) from public, anon, authenticated;

select cron.schedule('kawanku-cadangan', '0 19 * * *', 'select private.cadangan_terjadwal()');

-- ---------------------------------------------------------------------
-- RPC untuk Panel pengembang
-- ---------------------------------------------------------------------
create function private.wajib_pengembang() returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.boleh('sistem.kelola', null) then
    raise exception 'Khusus pengembang' using errcode = '42501';
  end if;
end;
$$;

create function public.cadangkan_sekarang() returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.wajib_pengembang();
  return private.buat_cadangan('manual', auth.uid());
end;
$$;

create function public.periksa_cadangan(p_id uuid) returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.wajib_pengembang();
  return private.periksa_cadangan(p_id);
end;
$$;

-- Ringkasan per tabel sebuah cadangan (tanpa isi).
create function public.tabel_dalam_cadangan(p_id uuid)
returns table (tabel text, jumlah integer, bisa_dipulihkan boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.wajib_pengembang();
  return query
    select i.tabel, i.jumlah,
           (select count(*) = 1 from pg_index x
            where x.indrelid = to_regclass('public.' || quote_ident(i.tabel)) and x.indisprimary
              and array_length(x.indkey::int2[], 1) = 1)
    from private.cadangan_isi i where i.cadangan_id = p_id order by i.tabel;
end;
$$;

-- Primary key tunggal sebuah tabel public (null bila tidak ada / komposit).
create function private.pk_tunggal(p_tabel text) returns text
language sql
stable
set search_path = ''
as $$
  select a.attname::text
  from pg_index x
  join pg_attribute a on a.attrelid = x.indrelid and a.attnum = x.indkey[0]
  where x.indrelid = to_regclass('public.' || quote_ident(p_tabel)) and x.indisprimary
    and array_length(x.indkey::int2[], 1) = 1;
$$;

-- Cari baris di cadangan (maks. 30), dibandingkan dengan data sekarang.
create function public.cari_di_cadangan(p_id uuid, p_tabel text, p_cari text default '')
returns table (baris_id text, di_cadangan jsonb, sekarang jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pk   text := private.pk_tunggal(p_tabel);
  v_json jsonb;
begin
  perform private.wajib_pengembang();
  if v_pk is null then
    raise exception 'Tabel ini tidak bisa dipulihkan per baris' using errcode = '22023';
  end if;
  select extensions.pgp_sym_decrypt(i.isi, private.kunci_cadangan())::jsonb into v_json
  from private.cadangan_isi i where i.cadangan_id = p_id and i.tabel = p_tabel;
  if v_json is null then
    return;
  end if;
  return query execute format(
    'select e->>%L, e, (select to_jsonb(t) from public.%I t where t.%I::text = e->>%L)
     from jsonb_array_elements($1) e
     where $2 = '''' or e::text ilike ''%%'' || $2 || ''%%''
     limit 30', v_pk, p_tabel, v_pk, v_pk)
    using v_json, coalesce(btrim(p_cari), '');
end;
$$;

-- Pulihkan satu baris (insert atau timpa) dari cadangan. Kolom yang
-- dihasilkan otomatis dilewati; trigger & aturan tabel tetap berlaku.
create function public.pulihkan_dari_cadangan(p_id uuid, p_tabel text, p_baris text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pk    text := private.pk_tunggal(p_tabel);
  v_baris jsonb;
  v_kolom text;
  v_set   text;
begin
  perform private.wajib_pengembang();
  if v_pk is null then
    raise exception 'Tabel ini tidak bisa dipulihkan per baris' using errcode = '22023';
  end if;
  select e into v_baris
  from private.cadangan_isi i,
       jsonb_array_elements(extensions.pgp_sym_decrypt(i.isi, private.kunci_cadangan())::jsonb) e
  where i.cadangan_id = p_id and i.tabel = p_tabel and e->>v_pk = p_baris;
  if v_baris is null then
    raise exception 'Baris tidak ada di cadangan' using errcode = 'P0002';
  end if;

  select string_agg(quote_ident(attname), ', ' order by attnum),
         string_agg(format('%1$I = excluded.%1$I', attname), ', ' order by attnum)
           filter (where attname <> v_pk)
    into v_kolom, v_set
  from pg_attribute
  where attrelid = to_regclass('public.' || quote_ident(p_tabel)) and attnum > 0
    and not attisdropped and attgenerated = '';

  -- Penanda pemulihan (lokal transaksi): trigger yang biasanya membuat nilai
  -- baru (mis. kode jamaah KW-) mempertahankan nilai dari cadangan.
  perform set_config('kawanku.pemulihan', 'on', true);
  execute format(
    'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1)
     on conflict (%3$I) do update set %4$s',
    p_tabel, v_kolom, v_pk, coalesce(v_set, format('%1$I = excluded.%1$I', v_pk)))
    using v_baris;
  perform set_config('kawanku.pemulihan', '', true);

  insert into public.pemulihan_cadangan (cadangan_id, tabel, baris_id) values (p_id, p_tabel, p_baris);
end;
$$;

-- Kode jamaah: saat pemulihan dari cadangan, kode lama (KW-, tercetak di
-- kartu QR) dipertahankan; selain itu tetap selalu dibuat server.
create or replace function private.atur_kode_jamaah()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not (coalesce(current_setting('kawanku.pemulihan', true), '') = 'on' and new.kode is not null) then
      new.kode := private.buat_kode_jamaah();
    end if;
  elsif new.kode is distinct from old.kode then
    raise exception 'Kode jamaah tidak boleh diubah';
  end if;
  return new;
end;
$$;

-- Ukuran database (untuk panel).
create function public.ukuran_database() returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.wajib_pengembang();
  return pg_database_size(current_database());
end;
$$;

revoke all on function public.cadangkan_sekarang(), public.periksa_cadangan(uuid),
  public.tabel_dalam_cadangan(uuid), public.cari_di_cadangan(uuid, text, text),
  public.pulihkan_dari_cadangan(uuid, text, text), public.ukuran_database()
  from public, anon;
grant execute on function public.cadangkan_sekarang(), public.periksa_cadangan(uuid),
  public.tabel_dalam_cadangan(uuid), public.cari_di_cadangan(uuid, text, text),
  public.pulihkan_dari_cadangan(uuid, text, text), public.ukuran_database()
  to authenticated;
revoke all on function private.wajib_pengembang(), private.pk_tunggal(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Notifikasi HP ke pengembang: sumber kedua untuk pengingat jatuh tempo
-- ---------------------------------------------------------------------
create or replace function private.notifikasi_jatuh_tempo(p_sekarang timestamptz default now())
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
  ),
  generus as (
    select distinct on (ag.user_id, x.jenis, x.kegiatan_id, x.kelompok_id, x.tanggal)
      ag.user_id,
      x.jenis || ':' || x.kegiatan_id || ':' || coalesce(x.kelompok_id::text, 'desa') || ':' || x.tanggal as kunci,
      case x.jenis when 'h1' then 'Besok: ' else 'Sebentar lagi: ' end || x.nama as judul,
      'Pukul ' || to_char(x.mulai at time zone 'Asia/Jakarta', 'HH24.MI') || ' WIB'
        || coalesce(', bersama ' || x.pemateri_nama, '')
        || coalesce(' di ' || x.lokasi, '')
        || case x.jenis when 'h1' then '. InsyaAllah hadir. Berhalangan? Ajukan izin dari sekarang.'
                        else '. InsyaAllah sampai jumpa.' end as isi,
      '/saya/jadwal' as url
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
    order by ag.user_id, x.jenis, x.kegiatan_id, x.kelompok_id, x.tanggal
  ),
  sistem as (
    -- Peringatan sistem 2 hari terakhir → setiap pengembang yang berlangganan.
    select u.id as user_id, 'sistem:' || s.kunci as kunci, s.judul, s.isi, s.url
    from public.notifikasi_sistem s
    cross join lateral (select * from private.pengembang_aktif() as id) u
    where s.created_at > p_sekarang - interval '2 days'
      and exists (select 1 from public.langganan_notifikasi l where l.user_id = u.id and l.aktif)
  )
  select * from generus
  union all
  select * from sistem;
$$;
revoke all on function private.notifikasi_jatuh_tempo(timestamptz) from public, anon, authenticated;
