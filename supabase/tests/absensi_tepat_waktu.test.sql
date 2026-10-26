-- =====================================================================
-- Tes migrasi 20261022130000_absensi_tepat_waktu: sesi absensi hanya bisa
-- dibuka paling cepat 2 jam sebelum mulai (waktu mulai sesi = waktu
-- pertemuannya, migrasi 20261024090000). Satu transaksi, di-rollback.
-- =====================================================================
\set ON_ERROR_STOP 1
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

create function pg_temp.pertemuan(p_mulai timestamptz) returns uuid language plpgsql as $$
declare v_kegiatan uuid; v_pertemuan uuid;
begin
  insert into public.kegiatan (nama, jenis, berlaku_mulai)
  values ('Acara', 'agenda', (p_mulai at time zone 'Asia/Jakarta')::date) returning id into v_kegiatan;
  insert into public.pertemuan (kegiatan_id, tanggal, mulai)
  values (v_kegiatan, (p_mulai at time zone 'Asia/Jakarta')::date, p_mulai) returning id into v_pertemuan;
  return v_pertemuan;
end $$;

select throws_ok(
  $q$ insert into public.sesi_absensi (pertemuan_id) values (pg_temp.pertemuan(now() + interval '1 day')) $q$,
  '22023', 'Absensi baru terbuka 30 menit sebelum mulai',
  'Sesi besok ditolak');
select throws_ok(
  $q$ insert into public.sesi_absensi (pertemuan_id) values (pg_temp.pertemuan(now() + interval '1 hour')) $q$,
  '22023', 'Absensi baru terbuka 30 menit sebelum mulai',
  'Sesi 1 jam lagi ditolak');
select lives_ok(
  $q$ insert into public.sesi_absensi (pertemuan_id) values (pg_temp.pertemuan(now() + interval '20 minutes')) $q$,
  'Sesi 20 menit lagi boleh');
select lives_ok(
  $q$ insert into public.sesi_absensi (pertemuan_id) values (pg_temp.pertemuan(now())) $q$,
  'Sesi yang sedang berlangsung boleh');
select lives_ok(
  $q$ insert into public.sesi_absensi (pertemuan_id) values (pg_temp.pertemuan(now() - interval '3 days')) $q$,
  'Sesi yang sudah lewat (susulan) boleh');

select * from finish();
rollback;
