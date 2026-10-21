-- =====================================================================
-- Tes absensi Fase 2a (migrasi 20261021180000_absensi_kartu_qr):
-- sesi per wilayah & sasaran, kartu QR, catat lewat kode, privasi catatan.
-- Satu transaksi, di-rollback.
-- =====================================================================
\set ON_ERROR_STOP 1
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create schema uji;
grant usage on schema uji to anon, authenticated;
create table uji.hasil (no serial primary key, nama text not null, lulus boolean not null, catatan text);
grant insert, select on uji.hasil to anon, authenticated;
grant usage on sequence uji.hasil_no_seq to anon, authenticated;

create function uji.cek(p_nama text, p_kondisi boolean) returns void language plpgsql as $$
begin
  insert into uji.hasil (nama, lulus) values (p_nama, coalesce(p_kondisi, false));
end $$;

-- Lulus bila p_sql GAGAL atau tidak mengubah baris apa pun (RLS diam-diam
-- menyaring update/delete). p_sql harus diakhiri `returning 1` untuk
-- update/delete supaya jumlah baris bisa dihitung.
create function uji.harus_ditolak(p_nama text, p_sql text)
returns void language plpgsql as $$
declare v_pesan text; v_baris int;
begin
  begin
    execute 'with t as (' || p_sql || ') select count(*) from t' into v_baris;
    raise exception 'BARIS:%', v_baris;
  exception when others then
    v_pesan := sqlerrm;
  end;
  insert into uji.hasil (nama, lulus, catatan) values (
    p_nama, v_pesan not like 'BARIS:%' or v_pesan = 'BARIS:0', v_pesan);
end $$;

-- Lulus bila p_sql mengubah minimal satu baris (efeknya dibatalkan).
create function uji.harus_berhasil(p_nama text, p_sql text)
returns void language plpgsql as $$
declare v_pesan text; v_baris int;
begin
  begin
    execute 'with t as (' || p_sql || ') select count(*) from t' into v_baris;
    raise exception 'BARIS:%', v_baris;
  exception when others then
    v_pesan := sqlerrm;
  end;
  insert into uji.hasil (nama, lulus, catatan) values (
    p_nama, v_pesan like 'BARIS:%' and v_pesan <> 'BARIS:0', v_pesan);
end $$;

create function uji.sebagai(p_uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_uid, true);
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
grant execute on all functions in schema uji to anon, authenticated;

create function uji.beri(p_user uuid, p_peran text, p_nomor int) returns void language sql as $$
  insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
  select p_user, p.id, (select id from public.kelompok where nomor = p_nomor)
  from public.peran p where p.kode = p_peran;
$$;
create function uji.catat(p_sesi uuid, p_kode text) returns text language sql as $$
  select public.catat_absensi_kode(p_sesi, p_kode) ->> 'hasil';
$$;
grant execute on all functions in schema uji to anon, authenticated;

-- ---------------------------------------------------------------------
-- Data contoh (sebagai pemilik DB)
-- ---------------------------------------------------------------------
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000d1'),  -- admin desa
  ('00000000-0000-0000-0000-0000000000d2'),  -- admin kelompok 1
  ('00000000-0000-0000-0000-0000000000d3'),  -- admin generus kelompok 1
  ('00000000-0000-0000-0000-0000000000d4'),  -- admin generus desa
  ('00000000-0000-0000-0000-0000000000d5');  -- pengembang
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-0000000000d1', 'Desa'), ('00000000-0000-0000-0000-0000000000d2', 'Kelompok 1'),
  ('00000000-0000-0000-0000-0000000000d3', 'Generus K1'), ('00000000-0000-0000-0000-0000000000d4', 'Generus Desa'),
  ('00000000-0000-0000-0000-0000000000d5', 'Dev');
select uji.beri('00000000-0000-0000-0000-0000000000d1', 'admin_desa', null);
select uji.beri('00000000-0000-0000-0000-0000000000d2', 'admin_kelompok', 1);
select uji.beri('00000000-0000-0000-0000-0000000000d3', 'admin_generus', 1);
select uji.beri('00000000-0000-0000-0000-0000000000d4', 'admin_generus', null);
select uji.beri('00000000-0000-0000-0000-0000000000d5', 'pengembang', null);

-- f1 generus K1, f2 dewasa K1, f3 generus K2, f4 nonaktif K1
insert into public.jamaah (id, kelompok_id, nama_lengkap, jenis_kelamin, kode, status_pernikahan, status_sekolah, tahun_lahir, aktif)
select v.id::uuid, k.id, v.nama, 'L', 'x', v.nikah::public.status_pernikahan, v.sekolah::public.status_sekolah, v.tahun, v.aktif
from (values
  ('00000000-0000-0000-0000-0000000000f1', 1, 'Generus K1', 'lajang',  'smp',     2012, true),
  ('00000000-0000-0000-0000-0000000000f2', 1, 'Dewasa K1',  'menikah', 'bekerja', 1985, true),
  ('00000000-0000-0000-0000-0000000000f3', 2, 'Generus K2', 'lajang',  'smp',     2012, true),
  ('00000000-0000-0000-0000-0000000000f4', 1, 'Nonaktif K1','lajang',  'smp',     2012, false)
) v(id, nomor, nama, nikah, sekolah, tahun, aktif)
join public.kelompok k on k.nomor = v.nomor;
-- Generus K1 memakai kartu fisik → berpenanda keringanan (migrasi 20261022010000).
insert into public.jamaah_keringanan (jamaah_id) values ('00000000-0000-0000-0000-0000000000f1');
-- Kode jamaah dibaca sebagai pemilik DB, supaya tes tidak bergantung pada RLS jamaah.
create table uji.kode_j as select id, kode from public.jamaah;
grant select on uji.kode_j to anon, authenticated;

-- e1 umum K1, e2 generus K1, e3 umum desa, e4 umum K2
insert into public.sesi_absensi (id, nama, kelompok_id, hanya_generus, mulai)
select v.id::uuid, v.nama, (select id from public.kelompok where nomor = v.nomor), v.generus, now()
from (values
  ('00000000-0000-0000-0000-0000000000e1', 'Pengajian K1',  1,    false),
  ('00000000-0000-0000-0000-0000000000e2', 'Generus K1',    1,    true),
  ('00000000-0000-0000-0000-0000000000e3', 'Pengajian Desa', null, false),
  ('00000000-0000-0000-0000-0000000000e4', 'Pengajian K2',  2,    false)
) v(id, nama, nomor, generus);

select uji.cek('Seed: absensi.lihat + kelola untuk admin desa/kelompok/generus; pengembang hanya lihat',
  (select array_agg(p.kode || ':' || pi.izin_kode order by p.kode, pi.izin_kode)
   from public.peran_izin pi join public.peran p on p.id = pi.peran_id
   where pi.izin_kode like 'absensi.%')
  = array['admin_desa:absensi.kelola', 'admin_desa:absensi.lihat',
          'admin_generus:absensi.kelola', 'admin_generus:absensi.lihat',
          'admin_kelompok:absensi.kelola', 'admin_kelompok:absensi.lihat',
          'pengembang:absensi.lihat']);

set local role authenticated;

-- ---------------------------------------------------------------------
-- Admin kelompok 1
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000d2');
select uji.cek('K1: melihat sesi K1, generus K1, dan desa; TIDAK sesi K2',
  (select array_agg(nama order by nama) from public.sesi_absensi)
  = array['Generus K1', 'Pengajian Desa', 'Pengajian K1']);
select uji.harus_berhasil('K1: membuat sesi K1',
  $q$ insert into public.sesi_absensi (nama, kelompok_id, mulai)
      select 'X', id, now() from public.kelompok where nomor = 1 returning 1 $q$);
select uji.harus_ditolak('K1: membuat sesi K2 ditolak',
  $q$ insert into public.sesi_absensi (nama, kelompok_id, mulai)
      select 'X', id, now() from public.kelompok where nomor = 2 returning 1 $q$);
select uji.harus_ditolak('K1: membuat sesi tingkat desa ditolak',
  $q$ insert into public.sesi_absensi (nama, kelompok_id, mulai) values ('X', null, now()) returning 1 $q$);
select uji.harus_ditolak('K1: mengubah sesi desa ditolak',
  $q$ update public.sesi_absensi set nama = 'Y' where id = '00000000-0000-0000-0000-0000000000e3' returning 1 $q$);

-- Kartu QR
select uji.cek('K1: buat kartu massal = 2 (jamaah aktif K1 saja)',
  public.buat_kartu_qr_kelompok((select id from public.kelompok where nomor = 1)) = 2);
select uji.cek('K1: buat kartu massal lagi = 0 (sudah punya kartu aktif)',
  public.buat_kartu_qr_kelompok((select id from public.kelompok where nomor = 1)) = 0);
select uji.cek('K1: buat kartu massal K2 = 0 (di luar wilayah)',
  public.buat_kartu_qr_kelompok((select id from public.kelompok where nomor = 2)) = 0);
select uji.cek('K1: token 16 karakter dibuat server',
  (select bool_and(token ~ '^[2-9A-HJKMNP-Z]{16}$') from public.kartu_qr));
select uji.harus_ditolak('K1: token kartu tidak bisa diubah',
  $q$ update public.kartu_qr set token = 'AAAAAAAAAAAAAAAA' returning 1 $q$);
select uji.harus_ditolak('K1: tidak bisa menghapus kartu',
  $q$ delete from public.kartu_qr returning 1 $q$);

create temp table kartu_lama on commit drop as
  select token from public.kartu_qr where jamaah_id = '00000000-0000-0000-0000-0000000000f1';
select uji.cek('K1: ganti kartu membuat token baru',
  (public.ganti_kartu_qr('00000000-0000-0000-0000-0000000000f1')).token <> (select token from kartu_lama));
select uji.cek('K1: kartu lama dicabut, tetap satu kartu aktif',
  (select count(*) from public.kartu_qr where jamaah_id = '00000000-0000-0000-0000-0000000000f1' and aktif) = 1
  and (select not aktif and dicabut_at is not null from public.kartu_qr where token = (select token from kartu_lama)));
select uji.harus_ditolak('K1: kartu dicabut tidak bisa diaktifkan lagi',
  $q$ update public.kartu_qr set aktif = true, dicabut_at = null where token = (select token from kartu_lama) returning 1 $q$);

-- Catat lewat kode
select uji.cek('K1: scan kartu aktif → tercatat',
  uji.catat('00000000-0000-0000-0000-0000000000e1',
    (select token from public.kartu_qr where jamaah_id = '00000000-0000-0000-0000-0000000000f1' and aktif)) = 'tercatat');
select uji.cek('K1: scan ulang → sudah',
  uji.catat('00000000-0000-0000-0000-0000000000e1',
    (select lower(token) from public.kartu_qr where jamaah_id = '00000000-0000-0000-0000-0000000000f1' and aktif)) = 'sudah');
select uji.cek('K1: catatan jalur kartu, status hadir',
  (select jalur = 'kartu' and status = 'hadir' from public.absensi
   where sesi_id = '00000000-0000-0000-0000-0000000000e1' and jamaah_id = '00000000-0000-0000-0000-0000000000f1'));
select uji.cek('K1: scan kartu lama → kartu_dicabut',
  uji.catat('00000000-0000-0000-0000-0000000000e1', (select token from kartu_lama)) = 'kartu_dicabut');
select uji.cek('K1: kode jamaah KW- → tercatat (jalur manual)',
  uji.catat('00000000-0000-0000-0000-0000000000e1',
    (select kode from uji.kode_j where id = '00000000-0000-0000-0000-0000000000f2')) = 'tercatat');
select uji.cek('K1: catatan kode KW- berjalur manual',
  (select jalur = 'manual' from public.absensi
       where sesi_id = '00000000-0000-0000-0000-0000000000e1' and jamaah_id = '00000000-0000-0000-0000-0000000000f2'));
select uji.cek('K1: kode tak dikenal → tidak_dikenal',
  uji.catat('00000000-0000-0000-0000-0000000000e1', 'ZZZZZZZZZZZZZZZZ') = 'tidak_dikenal');
select uji.cek('K1: jamaah non-generus di sesi generus → bukan_peserta',
  uji.catat('00000000-0000-0000-0000-0000000000e2',
    (select kode from uji.kode_j where id = '00000000-0000-0000-0000-0000000000f2')) = 'bukan_peserta');
select uji.cek('K1: jamaah nonaktif → jamaah_nonaktif',
  uji.catat('00000000-0000-0000-0000-0000000000e1',
    (select kode from uji.kode_j where id = '00000000-0000-0000-0000-0000000000f4')) = 'jamaah_nonaktif');
select uji.cek('K1: anggota K1 di sesi desa → tercatat',
  uji.catat('00000000-0000-0000-0000-0000000000e3',
    (select kode from uji.kode_j where id = '00000000-0000-0000-0000-0000000000f1')) = 'tercatat');
select uji.cek('K1: sesi K2 (tidak terlihat) → tidak_berhak',
  uji.catat('00000000-0000-0000-0000-0000000000e4',
    (select kode from uji.kode_j where id = '00000000-0000-0000-0000-0000000000f1')) = 'tidak_berhak');
select uji.harus_ditolak('K1: izin tanpa alasan ditolak',
  $q$ update public.absensi set status = 'izin'
      where jamaah_id = '00000000-0000-0000-0000-0000000000f2' and sesi_id = '00000000-0000-0000-0000-0000000000e1' returning 1 $q$);
select uji.harus_berhasil('K1: tandai izin (kerja)',
  $q$ update public.absensi set status = 'izin', alasan_izin = 'kerja'
      where jamaah_id = '00000000-0000-0000-0000-0000000000f2' and sesi_id = '00000000-0000-0000-0000-0000000000e1' returning 1 $q$);
select uji.harus_ditolak('K1: alasan izin pada status sakit ditolak',
  $q$ update public.absensi set status = 'sakit', alasan_izin = 'kerja'
      where jamaah_id = '00000000-0000-0000-0000-0000000000f2' returning 1 $q$);
select uji.harus_ditolak('K1: mengubah kelompok sesi setelah ada catatan ditolak',
  $q$ update public.sesi_absensi set hanya_generus = true where id = '00000000-0000-0000-0000-0000000000e1' returning 1 $q$);

-- Tutup sesi
update public.sesi_absensi set ditutup = true where id = '00000000-0000-0000-0000-0000000000e1';
select uji.cek('K1: scan di sesi ditutup → sesi_ditutup',
  uji.catat('00000000-0000-0000-0000-0000000000e1',
    (select token from public.kartu_qr where jamaah_id = '00000000-0000-0000-0000-0000000000f1' and aktif)) = 'sesi_ditutup');
select uji.harus_berhasil('K1: koreksi manual setelah sesi ditutup tetap boleh',
  $q$ update public.absensi set status = 'sakit'
      where jamaah_id = '00000000-0000-0000-0000-0000000000f1' and sesi_id = '00000000-0000-0000-0000-0000000000e1' returning 1 $q$);

-- ---------------------------------------------------------------------
-- Admin generus kelompok 1
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000d3');
select uji.cek('Gen K1: melihat sesi K1 & desa (umum + generus), TIDAK K2',
  (select array_agg(nama order by nama) from public.sesi_absensi)
  = array['Generus K1', 'Pengajian Desa', 'Pengajian K1']);
select uji.harus_ditolak('Gen K1: membuat sesi umum ditolak',
  $q$ insert into public.sesi_absensi (nama, kelompok_id, mulai)
      select 'X', id, now() from public.kelompok where nomor = 1 returning 1 $q$);
select uji.harus_berhasil('Gen K1: membuat sesi generus K1',
  $q$ insert into public.sesi_absensi (nama, kelompok_id, hanya_generus, mulai)
      select 'X', id, true, now() from public.kelompok where nomor = 1 returning 1 $q$);
select uji.harus_ditolak('Gen K1: mengubah sesi umum K1 ditolak',
  $q$ update public.sesi_absensi set nama = 'Y' where id = '00000000-0000-0000-0000-0000000000e1' returning 1 $q$);
select uji.cek('Gen K1: catatan sesi K1 yang terlihat hanya generus',
  (select array_agg(jamaah_id) from public.absensi where sesi_id = '00000000-0000-0000-0000-0000000000e1')
  = array['00000000-0000-0000-0000-0000000000f1'::uuid]);
select uji.cek('Gen K1: kartu yang terlihat hanya milik generus',
  (select bool_and(jamaah_id = '00000000-0000-0000-0000-0000000000f1') from public.kartu_qr));
select uji.cek('Gen K1: scan generus di sesi generus → tercatat',
  uji.catat('00000000-0000-0000-0000-0000000000e2',
    (select token from public.kartu_qr where jamaah_id = '00000000-0000-0000-0000-0000000000f1' and aktif)) = 'tercatat');
select uji.cek('Gen K1: kode jamaah dewasa → tidak_dikenal (tidak terlihat)',
  uji.catat('00000000-0000-0000-0000-0000000000e3',
    (select kode from uji.kode_j where id = '00000000-0000-0000-0000-0000000000f2')) = 'tidak_dikenal');

-- ---------------------------------------------------------------------
-- Admin generus desa
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000d4');
select uji.cek('Gen desa: melihat semua sesi',
  (select count(*) from public.sesi_absensi where id::text like '00000000-0000-0000-0000-0000000000e%') = 4);
select uji.harus_berhasil('Gen desa: membuat sesi generus tingkat desa',
  $q$ insert into public.sesi_absensi (nama, kelompok_id, hanya_generus, mulai) values ('X', null, true, now()) returning 1 $q$);
select uji.harus_ditolak('Gen desa: membuat sesi umum tingkat desa ditolak',
  $q$ insert into public.sesi_absensi (nama, kelompok_id, hanya_generus, mulai) values ('X', null, false, now()) returning 1 $q$);

-- ---------------------------------------------------------------------
-- Pengembang: hanya lihat
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000d5');
select uji.cek('Dev: melihat sesi',
  (select count(*) from public.sesi_absensi where id::text like '00000000-0000-0000-0000-0000000000e%') = 4);
select uji.cek('Dev: melihat catatan absensi', (select count(*) from public.absensi) >= 3);
select uji.cek('Dev: TIDAK melihat token kartu', not exists (select 1 from public.kartu_qr));
select uji.harus_ditolak('Dev: membuat sesi ditolak',
  $q$ insert into public.sesi_absensi (nama, kelompok_id, mulai) values ('X', null, now()) returning 1 $q$);
select uji.harus_ditolak('Dev: mencatat absensi ditolak',
  $q$ insert into public.absensi (sesi_id, jamaah_id)
      values ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000f3') returning 1 $q$);
select uji.cek('Dev: catat lewat kode → tidak_berhak',
  uji.catat('00000000-0000-0000-0000-0000000000e3',
    (select kode from uji.kode_j where id = '00000000-0000-0000-0000-0000000000f3')) = 'tidak_berhak');
select uji.harus_ditolak('Dev: menghapus catatan ditolak',
  $q$ delete from public.absensi returning 1 $q$);

-- ---------------------------------------------------------------------
-- Admin desa
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000d1');
select uji.cek('Desa: anggota K2 di sesi K1 → bukan_peserta',
  uji.catat('00000000-0000-0000-0000-0000000000e4',
    (select kode from uji.kode_j where id = '00000000-0000-0000-0000-0000000000f1')) = 'bukan_peserta');
select uji.harus_berhasil('Desa: membuat sesi tingkat desa',
  $q$ insert into public.sesi_absensi (nama, kelompok_id, mulai) values ('X', null, now()) returning 1 $q$);
select uji.harus_berhasil('Desa: menghapus sesi (catatan ikut terhapus)',
  $q$ delete from public.sesi_absensi where id = '00000000-0000-0000-0000-0000000000e3' returning 1 $q$);

-- Anon tidak bisa apa-apa
reset role;
set local role anon;
select uji.harus_ditolak('Anon: membaca sesi ditolak', $q$ select 1 from public.sesi_absensi $q$);
select uji.harus_ditolak('Anon: catat_absensi_kode ditolak',
  $q$ select public.catat_absensi_kode('00000000-0000-0000-0000-0000000000e1', 'X') $q$);

reset role;
select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 50, 'Jumlah skenario absensi');
select * from finish();
rollback;
