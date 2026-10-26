-- =====================================================================
-- "Kawan" (F7, Reno 26 Okt 2026)
--
-- 1. Ringkasan hari ini untuk admin: pertemuan hari ini, pertemuan
--    hari ini/besok yang belum ada pemateri, izin menunggu persetujuan,
--    dan jamaah yang milad hari ini. Dihitung dengan fungsi izin yang
--    sama dengan RLS (private.boleh*), jadi tiap admin hanya melihat
--    wilayah & sasarannya. Tampil di Beranda (RPC ringkasan_hari_ini)
--    dan dikirim ke HP admin tiap pagi (05.30–08.59 WIB, sekali sehari,
--    hanya bila ada isinya).
-- 2. Rapor bulanan generus: tanggal 1 (09.00–20.59 WIB) notifikasi HP
--    "Rapor kehadiran <bulan lalu>" → /saya/rapor.
-- =====================================================================

-- Kalender pertemuan antara dua tanggal (WIB): jadwal rutin + baris
-- pertemuan (agenda, pindah, batal). Satu baris per kegiatan/wilayah/tanggal.
create function private.kejadian_antara(p_dari date, p_sampai date)
returns table (kegiatan_id uuid, kelompok_id uuid, tanggal date, mulai timestamptz, status text, pemateri_nama text)
language sql
stable
security definer
set search_path = ''
as $$
  with jadwal as (
    select k.id as kegiatan_id, k.kelompok_id, h.tgl::date as tanggal,
           (h.tgl::date + j.jam) at time zone 'Asia/Jakarta' as mulai
    from public.kegiatan k
    join public.kegiatan_jadwal j on j.kegiatan_id = k.id
    cross join generate_series(p_dari::timestamp, p_sampai::timestamp, interval '1 day') as h (tgl)
    where k.aktif and k.jenis = 'rutin'
      and extract(dow from h.tgl)::smallint = j.hari
      and not (ceil(extract(day from h.tgl) / 7.0)::smallint = any (j.kecuali_pekan_ke))
      and h.tgl::date >= k.berlaku_mulai
      and (k.berlaku_sampai is null or h.tgl::date <= k.berlaku_sampai)
  ),
  semua as (
    select p.kegiatan_id, p.kelompok_id, p.tanggal, p.mulai, p.status, p.pemateri_nama, 0 as urut
    from public.pertemuan p
    join public.kegiatan k on k.id = p.kegiatan_id
    where k.aktif and p.tanggal between p_dari and p_sampai
    union all
    select d.kegiatan_id, d.kelompok_id, d.tanggal, d.mulai, 'terjadwal', null, 1 from jadwal d
  )
  select distinct on (s.kegiatan_id, s.kelompok_id, s.tanggal)
         s.kegiatan_id, s.kelompok_id, s.tanggal, s.mulai, s.status, s.pemateri_nama
  from semua s
  order by s.kegiatan_id, s.kelompok_id, s.tanggal, s.urut;
$$;
revoke all on function private.kejadian_antara(date, date) from public, anon, authenticated;

-- Ringkasan untuk admin yang sedang login (auth.uid()); null bila bukan admin.
create function private.ringkasan_hari(p_sekarang timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with t as (select (p_sekarang at time zone 'Asia/Jakarta')::date as tgl)
  select jsonb_build_object(
    'pertemuan', (
      select count(*) from private.kejadian_antara(t.tgl, t.tgl) k
      where k.status = 'terjadwal' and private.boleh_lihat_kegiatan(k.kegiatan_id, k.kelompok_id)),
    'tanpa_pemateri', (
      select count(*) from private.kejadian_antara(t.tgl, t.tgl + 1) k
      where k.status = 'terjadwal' and k.pemateri_nama is null and k.mulai > p_sekarang
        and private.boleh_kelola_pertemuan(k.kegiatan_id, k.kelompok_id)),
    'izin', (
      select count(*) from public.pengajuan_izin i
      where i.status = 'menunggu'
        and private.boleh_jamaah('absensi.kelola', i.jamaah_id)
        and private.boleh_absensi_di(i.kelompok_id)),
    'milad', coalesce((
      select jsonb_agg(x.nama order by x.nama) from (
        select coalesce(j.nama_panggilan, j.nama_lengkap) as nama
        from public.jamaah j
        where j.aktif and j.tanggal_lahir is not null
          and to_char(j.tanggal_lahir, 'MM-DD') = to_char(t.tgl, 'MM-DD')
          and private.boleh_jamaah('jamaah.lihat', j.id)
        order by 1
        limit 10) x), '[]'::jsonb)
  )
  from t
  where private.adalah_admin();
$$;
revoke all on function private.ringkasan_hari(timestamptz) from public, anon, authenticated;

create function public.ringkasan_hari_ini() returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.ringkasan_hari(now());
$$;
revoke all on function public.ringkasan_hari_ini() from public, anon;
grant execute on function public.ringkasan_hari_ini() to authenticated;

-- Hitung ringkasan "sebagai" admin tertentu (untuk notifikasi pagi dari
-- pg_cron, tanpa sesi): identitas JWT diganti sementara di transaksi ini
-- lalu dikembalikan, supaya aturan izinnya persis sama dengan RLS.
create function private.ringkasan_hari_untuk(p_user uuid, p_sekarang timestamptz)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sub    text := current_setting('request.jwt.claim.sub', true);
  v_claims text := current_setting('request.jwt.claims', true);
  v_hasil  jsonb;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  begin
    v_hasil := private.ringkasan_hari(p_sekarang);
  exception when others then
    v_hasil := null;
  end;
  perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  return v_hasil;
end;
$$;
revoke all on function private.ringkasan_hari_untuk(uuid, timestamptz) from public, anon, authenticated;

-- Kalimat ringkasan (dipakai notifikasi; sama dengan kartu di Beranda).
create function private.kalimat_ringkasan(r jsonb) returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(concat_ws(' · ',
    case when (r->>'pertemuan')::int > 0 then (r->>'pertemuan') || ' pertemuan hari ini' end,
    case when (r->>'izin')::int > 0 then (r->>'izin') || ' izin menunggu persetujuan' end,
    case when (r->>'tanpa_pemateri')::int > 0 then (r->>'tanpa_pemateri') || ' pertemuan belum ada pemateri' end,
    case when jsonb_array_length(r->'milad') > 0 then 'Milad hari ini: '
      || (select string_agg(v, ', ') from (select jsonb_array_elements_text(r->'milad') v limit 3) x)
      || case when jsonb_array_length(r->'milad') > 3 then ' dkk.' else '' end end
  ), '');
$$;
revoke all on function private.kalimat_ringkasan(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Notifikasi jatuh tempo: + ringkasan pagi admin & rapor bulanan generus
-- ---------------------------------------------------------------------
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
             then 'Alhamdulillah, bulan lalu kamu hadir ' || n.hadir || ' kali. Yuk lihat rapor lengkapnya.'
             else 'Rapor bulan lalu sudah siap. Yuk lihat, lalu semangat lagi bulan ini.' end as isi,
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
