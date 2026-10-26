-- =====================================================================
-- Tes migrasi 20261027090000_absensi_otomatis: jendela absensi per
-- kegiatan (15/30/45/60 menit) dan pembukaan absensi otomatis oleh
-- database (private.buka_absensi_otomatis, pg_cron tiap menit).
-- Satu transaksi, di-rollback.
-- =====================================================================
\set ON_ERROR_STOP 1
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- Kegiatan rutin K1 dengan jadwal tepat pada waktu `p_mulai` (WIB).
create function pg_temp.rutin(p_nama text, p_mulai timestamptz, p_jendela smallint, p_nomor int default 1)
returns uuid language plpgsql as $$
declare v_id uuid; v_wib timestamp := p_mulai at time zone 'Asia/Jakarta';
begin
  insert into public.kegiatan (nama, jenis, kelompok_id, durasi_menit, jendela_menit, berlaku_mulai)
  select p_nama, 'rutin', id, 60, p_jendela, v_wib::date - 7 from public.kelompok where nomor = p_nomor
  returning id into v_id;
  insert into public.kegiatan_jadwal (kegiatan_id, hari, jam)
  values (v_id, extract(dow from v_wib)::smallint, v_wib::time);
  return v_id;
end $$;
create function pg_temp.sesi(p_kegiatan uuid) returns public.sesi_absensi language sql as $$
  select s.* from public.sesi_absensi s join public.pertemuan p on p.id = s.pertemuan_id
  where p.kegiatan_id = p_kegiatan;
$$;

select ok(exists (select 1 from cron.job where jobname = 'kawanku-buka-absensi' and schedule = '* * * * *'),
  'pg_cron: tugas buka absensi tiap menit terdaftar');
select throws_ok(
  $q$ insert into public.kegiatan (nama, jendela_menit) values ('X', 20) $q$,
  '23514', null, 'Jendela hanya 15/30/45/60 menit');

-- a: mulai 10 menit lalu (30) → buka; b: 20 menit lagi (15) → belum;
-- c: 40 menit lagi (45) → buka; d: selesai 50 menit lalu (30) → lewat;
-- e: nonaktif → tidak; f: dibatalkan → tidak; g: K2 dengan fitur absensi
-- hanya untuk K1 → tidak; h: agenda K1 25 menit lagi (30) → buka.
create temp table keg (kode text primary key, id uuid);
insert into keg values
  ('a', pg_temp.rutin('A', now() - interval '10 minutes', 30::smallint)),
  ('b', pg_temp.rutin('B', now() + interval '20 minutes', 15::smallint)),
  ('c', pg_temp.rutin('C', now() + interval '40 minutes', 45::smallint)),
  ('d', pg_temp.rutin('D', now() - interval '110 minutes', 30::smallint)),
  ('e', pg_temp.rutin('E', now(), 30::smallint)),
  ('f', pg_temp.rutin('F', now(), 30::smallint)),
  ('g', pg_temp.rutin('G', now(), 30::smallint, 2));
update public.kegiatan set aktif = false where id = (select id from keg where kode = 'e');
insert into public.pertemuan (kegiatan_id, tanggal, mulai, status, alasan_batal)
select id, (now() at time zone 'Asia/Jakarta')::date, now(), 'dibatalkan', 'Libur'
from keg where kode = 'f';
update public.fitur set aktif = true, semua_kelompok = false where kode = 'absensi';
insert into public.fitur_kelompok (fitur_id, kelompok_id)
select f.id, k.id from public.fitur f, public.kelompok k where f.kode = 'absensi' and k.nomor = 1;
insert into public.kegiatan (nama, jenis, kelompok_id, durasi_menit)
select 'H', 'agenda', id, 60 from public.kelompok where nomor = 1;
insert into keg select 'h', id from public.kegiatan where nama = 'H';
insert into public.pertemuan (kegiatan_id, tanggal, mulai)
select id, ((now() + interval '25 minutes') at time zone 'Asia/Jakarta')::date, now() + interval '25 minutes'
from keg where kode = 'h';

select is(private.buka_absensi_otomatis(), 3, 'Otomatis: 3 absensi dibuka (a, c, h)');
select ok((pg_temp.sesi((select id from keg where kode = 'a'))).id is not null, 'a: sedang berjalan → terbuka');
select ok((pg_temp.sesi((select id from keg where kode = 'b'))).id is null, 'b: 20 menit lagi, jendela 15 → belum');
select ok((pg_temp.sesi((select id from keg where kode = 'c'))).id is not null, 'c: 40 menit lagi, jendela 45 → terbuka');
select ok((pg_temp.sesi((select id from keg where kode = 'd'))).id is null, 'd: lewat jendela → tidak dibuka');
select ok((pg_temp.sesi((select id from keg where kode = 'e'))).id is null
          and (pg_temp.sesi((select id from keg where kode = 'f'))).id is null,
  'e/f: kegiatan nonaktif & pertemuan dibatalkan → tidak dibuka');
select ok((pg_temp.sesi((select id from keg where kode = 'g'))).id is null, 'g: fitur absensi K2 mati → tidak dibuka');
select is((pg_temp.sesi((select id from keg where kode = 'c'))).jendela_menit, 45::smallint,
  'Sesi menyalin jendela kegiatannya');
select ok(exists (select 1 from public.pertemuan p join keg on keg.id = p.kegiatan_id
                  where keg.kode = 'a' and p.sesi_id is not null),
  'Pertemuan rutin dibuat & tertaut ke sesinya');
select is(private.buka_absensi_otomatis(), 0, 'Dipanggil lagi: tidak ada sesi ganda');

-- Jendela & scan
select is(private.waktu_scan_sesi(now() + interval '20 minutes', now() + interval '80 minutes', 15), 'belum_waktunya',
  'Jendela 15: 20 menit sebelum mulai belum bisa scan');
select is(private.waktu_scan_sesi(now() + interval '20 minutes', now() + interval '80 minutes', 30), null,
  'Jendela 30: 20 menit sebelum mulai sudah bisa scan');
select is(private.waktu_scan_sesi(now() - interval '100 minutes', now() - interval '40 minutes', 45), null,
  'Jendela 45: 40 menit setelah selesai masih bisa scan');
update public.kegiatan set jendela_menit = 60 where id = (select id from keg where kode = 'a');
select is((pg_temp.sesi((select id from keg where kode = 'a'))).jendela_menit, 60::smallint,
  'Jendela kegiatan diubah → sesinya ikut');
select throws_ok(
  $q$ insert into public.pertemuan (kegiatan_id, tanggal, mulai)
      select id, ((now() + interval '20 minutes') at time zone 'Asia/Jakarta')::date + 1, now() + interval '20 minutes'
      from keg where kode = 'b';
      insert into public.sesi_absensi (pertemuan_id)
      select p.id from public.pertemuan p join keg on keg.id = p.kegiatan_id where keg.kode = 'b' $q$,
  '22023', 'Absensi baru terbuka 15 menit sebelum mulai',
  'Sesi manual 20 menit sebelum mulai ditolak untuk jendela 15');

select * from finish();
rollback;
