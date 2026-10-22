-- =====================================================================
-- Tes migrasi 20261022130000_absensi_tepat_waktu: sesi absensi hanya bisa
-- dibuat paling cepat 2 jam sebelum mulai. Satu transaksi, di-rollback.
-- =====================================================================
\set ON_ERROR_STOP 1
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select throws_ok(
  $q$ insert into public.sesi_absensi (nama, mulai) values ('Besok', now() + interval '1 day') $q$,
  '22023', 'Absensi bisa dibuka paling cepat 2 jam sebelum mulai',
  'Sesi besok ditolak');
select throws_ok(
  $q$ insert into public.sesi_absensi (nama, mulai) values ('Tiga jam lagi', now() + interval '3 hours') $q$,
  '22023', 'Absensi bisa dibuka paling cepat 2 jam sebelum mulai',
  'Sesi 3 jam lagi ditolak');
select lives_ok(
  $q$ insert into public.sesi_absensi (nama, mulai) values ('Satu jam lagi', now() + interval '1 hour') $q$,
  'Sesi 1 jam lagi boleh');
select lives_ok(
  $q$ insert into public.sesi_absensi (nama, mulai) values ('Sekarang', now()) $q$,
  'Sesi yang sedang berlangsung boleh');
select lives_ok(
  $q$ insert into public.sesi_absensi (nama, mulai) values ('Susulan', now() - interval '3 days') $q$,
  'Sesi yang sudah lewat (susulan) boleh');

select * from finish();
rollback;
