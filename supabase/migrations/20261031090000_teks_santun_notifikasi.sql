-- =====================================================================
-- Teks santun (Pedoman Bahasa, Reno 27 Okt 2026): kalimat notifikasi HP
-- yang disusun database. Pengingat H-1 & rapor bulanan generus, serta
-- peringatan sistem untuk pengembang (cadangan & ruang database).
-- Hanya teks yang berubah; logika fungsi sama dengan versi sebelumnya
-- (20261029090000_cadangan_otomatis, 20261030090000_kawan_pagi_rapor).
-- =====================================================================

CREATE OR REPLACE FUNCTION private.buat_cadangan(p_jenis text, p_oleh uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      'Cadangan ' || p_jenis || ' belum berhasil', left('Mohon diperiksa di Panel pengembang. Keterangan: ' || sqlerrm, 300));
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
$function$
;

CREATE OR REPLACE FUNCTION private.periksa_cadangan(p_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      'Pemeriksaan cadangan menemukan masalah', 'Mohon maaf, cadangan tidak bisa dibuka atau isinya tidak cocok. Silakan buat cadangan baru, lalu periksa Panel pengembang.');
  end if;
  return v_hasil;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.cadangan_terjadwal(p_sekarang timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      'Terpakai ' || pg_size_pretty(v_ukuran) || ' dari 500 MB (paket Free). Mohon kurangi jumlah cadangan yang disimpan, atau pertimbangkan menaikkan paket.');
  end if;
  return v_jumlah;
end;
$function$
;


create or replace function private.notifikasi_jatuh_tempo(p_sekarang timestamptz default now())
returns table (user_id uuid, kunci text, judul text, isi text, url text)
language sql
volatile
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
        || case x.jenis when 'h1' then '. InsyaAllah hadir, ya. Bila berhalangan, silakan ajukan izin dari sekarang.'
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
  ),
  admin_pagi as (
    -- Ringkasan pagi: sekali sehari per admin (kunci per tanggal), bila ada isinya.
    select a.user_id, 'pagi:' || (p_sekarang at time zone 'Asia/Jakarta')::date as kunci,
           'Ringkasan hari ini' as judul,
           private.kalimat_ringkasan(private.ringkasan_hari_untuk(a.user_id, p_sekarang)) as isi,
           '/dashboard' as url
    from public.admin a
    where a.aktif
      and (p_sekarang at time zone 'Asia/Jakarta')::time between time '05:30' and time '08:59:59'
      and exists (select 1 from public.langganan_notifikasi l where l.user_id = a.user_id and l.aktif)
      and not exists (
        select 1 from public.notifikasi_terkirim n
        where n.user_id = a.user_id and n.kunci = 'pagi:' || (p_sekarang at time zone 'Asia/Jakarta')::date)
  ),
  rapor as (
    -- Tanggal 1: rapor kehadiran bulan lalu untuk generus yang berlangganan.
    select ag.user_id, 'rapor:' || to_char(b.awal, 'YYYY-MM') as kunci,
           'Rapor kehadiran ' || (array['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
             'Agustus', 'September', 'Oktober', 'November', 'Desember'])[extract(month from b.awal)::int] as judul,
           case when n.hadir > 0
             then 'Alhamdulillah, bulan lalu kamu hadir ' || n.hadir || ' kali. Silakan lihat rapor lengkapnya.'
             else 'Rapor bulan lalu sudah siap. Silakan dilihat; semoga bulan ini lebih semangat.' end as isi,
           '/saya/rapor' as url
    from (select (date_trunc('month', p_sekarang at time zone 'Asia/Jakarta') - interval '1 month')::date as awal) b
    join public.akun_generus ag on ag.aktif and ag.created_at < (b.awal + interval '1 month')
    join public.jamaah j on j.id = ag.jamaah_id and j.aktif
    cross join lateral (
      select count(*) as hadir
      from public.absensi a
      join public.sesi_absensi s on s.id = a.sesi_id
      where a.jamaah_id = j.id and a.status = 'hadir'
        and (s.mulai at time zone 'Asia/Jakarta')::date >= b.awal
        and (s.mulai at time zone 'Asia/Jakarta')::date < (b.awal + interval '1 month')::date
    ) n
    where extract(day from p_sekarang at time zone 'Asia/Jakarta') = 1
      and extract(hour from p_sekarang at time zone 'Asia/Jakarta') between 9 and 20
      and exists (select 1 from public.langganan_notifikasi l where l.user_id = ag.user_id and l.aktif)
  )
  select * from generus
  union all
  select * from sistem
  union all
  select * from admin_pagi where isi is not null
  union all
  select * from rapor;
$$;
revoke all on function private.notifikasi_jatuh_tempo(timestamptz) from public, anon, authenticated;
