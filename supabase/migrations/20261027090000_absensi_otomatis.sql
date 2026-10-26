-- =====================================================================
-- Absensi otomatis penuh (F2, keputusan Reno 26 Okt 2026)
--
-- 1. Setiap kegiatan memilih jendela absensi: 15, 30 (bawaan), 45, atau 60
--    menit sebelum mulai s.d. sesudah selesai (kegiatan.jendela_menit).
--    Sesi menyalin jendelanya (sesi_absensi.jendela_menit) dan ikut berubah
--    bila kegiatannya diubah.
-- 2. Database membuka absensi sendiri tiap menit lewat pg_cron
--    (private.buka_absensi_otomatis): pertemuan terjadwal yang sedang di
--    jendelanya dan belum punya sesi langsung dibuatkan, tanpa menunggu
--    admin membuka halaman. Menutup tetap otomatis lewat jendela waktu.
--    Saklar fitur `absensi` per kelompok dihormati.
-- =====================================================================

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------
-- 1. Jendela per kegiatan
-- ---------------------------------------------------------------------
alter table public.kegiatan add column jendela_menit smallint not null default 30
  constraint kegiatan_jendela_menit check (jendela_menit in (15, 30, 45, 60));
comment on column public.kegiatan.jendela_menit is
  'Absensi terbuka sekian menit sebelum mulai s.d. sekian menit setelah selesai.';

alter table public.sesi_absensi add column jendela_menit smallint not null default 30
  constraint sesi_absensi_jendela_menit check (jendela_menit in (15, 30, 45, 60));

-- Sesi lama mengikuti kegiatannya (semua masih 30).
update public.sesi_absensi s set jendela_menit = k.jendela_menit
from public.pertemuan p join public.kegiatan k on k.id = p.kegiatan_id
where p.id = s.pertemuan_id and s.jendela_menit <> k.jendela_menit;

-- atur_sesi (sama seperti 20261024090000) + salin jendela kegiatan.
create or replace function private.atur_sesi()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pertemuan public.pertemuan;
  v_kegiatan  public.kegiatan;
begin
  if new.pertemuan_id is null then
    raise exception 'Absensi hanya bisa dibuka dari pertemuan di Kegiatan'
      using errcode = '23502', hint = 'tanpa_pertemuan';
  end if;
  select * into v_pertemuan from public.pertemuan where id = new.pertemuan_id;
  if not found then
    raise exception 'Pertemuan tidak ditemukan' using errcode = '23503', hint = 'tanpa_pertemuan';
  end if;
  if v_pertemuan.status = 'dibatalkan' then
    raise exception 'Pertemuan ini dibatalkan' using errcode = '22023', hint = 'dibatalkan';
  end if;
  select * into v_kegiatan from public.kegiatan where id = v_pertemuan.kegiatan_id;
  new.nama := private.nama_sesi_pertemuan(v_pertemuan.id);
  new.kelompok_id := v_pertemuan.kelompok_id;
  new.hanya_generus := v_kegiatan.hanya_generus;
  new.mulai := v_pertemuan.mulai;
  new.selesai := v_pertemuan.mulai + make_interval(mins => v_kegiatan.durasi_menit);
  new.jendela_menit := v_kegiatan.jendela_menit;
  return new;
end;
$$;

-- Jendela kegiatan diubah → sesinya ikut.
create or replace function private.sinkron_jendela_sesi()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.sesi_absensi s
  set jendela_menit = new.jendela_menit
  from public.pertemuan p
  where p.id = s.pertemuan_id and p.kegiatan_id = new.id;
  return null;
end;
$$;
revoke all on function private.sinkron_jendela_sesi() from public, anon, authenticated;

create trigger sinkron_jendela_sesi after update of jendela_menit on public.kegiatan
  for each row when (new.jendela_menit is distinct from old.jendela_menit)
  execute function private.sinkron_jendela_sesi();

-- null = boleh scan sekarang; selain itu 'belum_waktunya' / 'lewat_waktu'.
create or replace function private.waktu_scan_sesi(p_mulai timestamptz, p_selesai timestamptz, p_menit integer)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when now() < p_mulai - make_interval(mins => p_menit) then 'belum_waktunya'
    when now() > coalesce(p_selesai, p_mulai) + make_interval(mins => p_menit) then 'lewat_waktu'
  end;
$$;
grant execute on function private.waktu_scan_sesi(timestamptz, timestamptz, integer) to authenticated;

-- Sesi paling cepat dibuat sesuai jendela kegiatannya.
create or replace function private.cek_waktu_sesi()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.mulai > now() + make_interval(mins => new.jendela_menit) then
    raise exception 'Absensi baru terbuka % menit sebelum mulai', new.jendela_menit
      using errcode = '22023', hint = 'belum_waktunya';
  end if;
  return new;
end;
$$;

-- Scan, QR layar, absen generus: sama seperti sebelumnya, jendela per sesi.
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
  v_waktu     text;
begin
  select * into v_sesi from public.sesi_absensi where id = p_sesi_id;
  if not found then
    return jsonb_build_object('hasil', 'tidak_berhak');
  end if;
  if v_sesi.ditutup then
    return jsonb_build_object('hasil', 'sesi_ditutup');
  end if;
  v_waktu := private.waktu_scan_sesi(v_sesi.mulai, v_sesi.selesai, v_sesi.jendela_menit);
  if v_waktu is not null then
    return jsonb_build_object('hasil', v_waktu);
  end if;

  if v_kode ~ '^KW-[2-9A-HJKMNP-Z]{6}$' then
    select id into v_jamaah_id from public.jamaah where kode = v_kode;
    v_jalur := 'manual';
  elsif v_kode ~ '^[2-9A-HJKMNP-Z]{16}$' then
    select * into v_kartu from public.kartu_qr where token = v_kode;
    if found and not v_kartu.aktif then
      return jsonb_build_object('hasil', 'kartu_dicabut', 'jamaah_id', v_kartu.jamaah_id);
    end if;
    if found and not private.boleh_kartu_fisik(v_kartu.jamaah_id) then
      return jsonb_build_object('hasil', 'pakai_akun', 'jamaah_id', v_kartu.jamaah_id);
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
  if not found or not private.boleh_absensi_di(v_sesi.kelompok_id) then
    raise exception 'Tidak berhak' using errcode = '42501';
  end if;
  if v_sesi.ditutup or private.waktu_scan_sesi(v_sesi.mulai, v_sesi.selesai, v_sesi.jendela_menit) is not null then
    return null;
  end if;
  insert into public.sesi_layar (sesi_id) values (p_sesi_id) on conflict (sesi_id) do nothing;
  select rahasia into v_rahasia from public.sesi_layar where sesi_id = p_sesi_id;
  return p_sesi_id::text || '.' || v_detik || '.' ||
    translate(encode(substr(extensions.hmac(convert_to(p_sesi_id::text || '.' || v_detik, 'UTF8'),
                                            v_rahasia, 'sha256'), 1, 16), 'base64'), '+/=', '-_');
end;
$$;

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
  v_waktu   text;
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
  v_waktu := private.waktu_scan_sesi(v_sesi.mulai, v_sesi.selesai, v_sesi.jendela_menit);
  if v_waktu is not null then
    return jsonb_build_object('hasil', v_waktu, 'sesi', v_sesi.nama);
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

-- ---------------------------------------------------------------------
-- 2. Buka absensi otomatis (pg_cron, tiap menit)
-- ---------------------------------------------------------------------

-- Saklar fitur `absensi` (panel pengembang), fail-open seperti aplikasi.
create or replace function private.absensi_menyala(p_kelompok_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select f.aktif and (
      f.semua_kelompok
      or (p_kelompok_id is null and exists (select 1 from public.fitur_kelompok fk where fk.fitur_id = f.id))
      or exists (select 1 from public.fitur_kelompok fk where fk.fitur_id = f.id and fk.kelompok_id = p_kelompok_id)
    )
    from public.fitur f where f.kode = 'absensi'
  ), true);
$$;
revoke all on function private.absensi_menyala(uuid) from public, anon, authenticated;

-- Pertemuan (dari jadwal rutin ±1 hari, atau baris pertemuan/agenda) yang
-- terjadwal, sedang di jendela absensinya, dan belum punya sesi: buat
-- pertemuan (bila belum ada) lalu sesinya. Mengembalikan jumlah sesi baru.
-- Satu pertemuan yang gagal tidak menghentikan yang lain.
create or replace function private.buka_absensi_otomatis(p_sekarang timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r       record;
  v_id    uuid;
  v_sesi  uuid;
  v_jumlah integer := 0;
begin
  for r in
    with hari as (
      select (p_sekarang at time zone 'Asia/Jakarta')::date + d as tgl from generate_series(-1, 1) d
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
             p.id as pertemuan_id, coalesce(p.status, 'terjadwal') as status, p.sesi_id
      from dari_jadwal d
      left join public.pertemuan p
        on p.kegiatan_id = d.kegiatan_id and p.kelompok_id is not distinct from d.kelompok_id
       and p.tanggal = d.tanggal
      union
      select p.kegiatan_id, p.kelompok_id, p.tanggal, p.mulai, p.id, p.status, p.sesi_id
      from public.pertemuan p
      join public.kegiatan k on k.id = p.kegiatan_id
      where k.aktif and p.mulai between p_sekarang - interval '1 day' and p_sekarang + interval '1 day'
    )
    select c.*, k.durasi_menit, k.jendela_menit
    from kandidat c
    join public.kegiatan k on k.id = c.kegiatan_id
    where c.status = 'terjadwal' and c.sesi_id is null
      and p_sekarang >= c.mulai - make_interval(mins => k.jendela_menit)
      and p_sekarang <= c.mulai + make_interval(mins => k.durasi_menit + k.jendela_menit)
      and private.absensi_menyala(c.kelompok_id)
  loop
    begin
      v_id := r.pertemuan_id;
      if v_id is null then
        insert into public.pertemuan (kegiatan_id, kelompok_id, tanggal, mulai)
        values (r.kegiatan_id, r.kelompok_id, r.tanggal, r.mulai)
        on conflict (kegiatan_id, kelompok_id, tanggal) do nothing
        returning id into v_id;
        if v_id is null then
          select id into v_id from public.pertemuan
          where kegiatan_id = r.kegiatan_id and kelompok_id is not distinct from r.kelompok_id
            and tanggal = r.tanggal;
        end if;
      end if;
      v_sesi := null;
      insert into public.sesi_absensi (pertemuan_id) values (v_id)
      on conflict (pertemuan_id) do nothing
      returning id into v_sesi;
      if v_sesi is not null then
        v_jumlah := v_jumlah + 1;
      end if;
    exception when others then
      raise warning 'buka_absensi_otomatis: kegiatan % tanggal %: %', r.kegiatan_id, r.tanggal, sqlerrm;
    end;
  end loop;
  return v_jumlah;
end;
$$;
revoke all on function private.buka_absensi_otomatis(timestamptz) from public, anon, authenticated;

select cron.schedule('kawanku-buka-absensi', '* * * * *', 'select private.buka_absensi_otomatis()');
