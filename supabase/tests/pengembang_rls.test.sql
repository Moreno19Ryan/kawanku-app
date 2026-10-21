-- =====================================================================
-- Tes peran Pengembang (migrasi 20261021071500_peran_pengembang).
-- Admin desa (akses.kelola) tidak bisa menyentuh peran/izin/akun tingkat
-- sistem; pengembang bisa, tapi tidak otomatis melihat data jamaah.
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

-- ---------------------------------------------------------------------
-- Data contoh (sebagai pemilik DB)
-- ---------------------------------------------------------------------
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),  -- admin desa
  ('00000000-0000-0000-0000-0000000000a2'),  -- pengembang
  ('00000000-0000-0000-0000-0000000000a3'),  -- admin kelompok 1
  ('00000000-0000-0000-0000-0000000000a4'),  -- admin baru tanpa peran
  ('00000000-0000-0000-0000-0000000000a5');  -- akun Auth yang belum jadi admin
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-0000000000a1', 'Desa'),
  ('00000000-0000-0000-0000-0000000000a2', 'Dev'),
  ('00000000-0000-0000-0000-0000000000a3', 'Kelompok 1'),
  ('00000000-0000-0000-0000-0000000000a4', 'Baru');
insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
  select '00000000-0000-0000-0000-0000000000a1', id, null from public.peran where kode = 'admin_desa';
insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
  select '00000000-0000-0000-0000-0000000000a2', id, null from public.peran where kode = 'pengembang';
insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
  select '00000000-0000-0000-0000-0000000000a3', p.id, k.id from public.peran p, public.kelompok k
  where p.kode = 'admin_kelompok' and k.nomor = 1;
insert into public.jamaah (kelompok_id, nama_lengkap, jenis_kelamin, kode)
  select id, 'Jamaah Uji', 'L', 'KW-ABCDEF' from public.kelompok where nomor = 1;

-- Seed peran pengembang
select uji.cek('Seed: peran pengembang ada, tingkat desa, bukan hanya_generus',
  exists (select 1 from public.peran where kode = 'pengembang' and wilayah = 'desa' and not hanya_generus));
select uji.cek('Seed: pengembang = sistem.kelola + akses.kelola saja',
  (select array_agg(pi.izin_kode order by pi.izin_kode) from public.peran_izin pi
   join public.peran p on p.id = pi.peran_id where p.kode = 'pengembang')
  = array['akses.kelola', 'sistem.kelola']);
select uji.cek('Seed: tidak ada peran lain yang memegang sistem.kelola',
  (select count(*) from public.peran_izin where izin_kode = 'sistem.kelola') = 1);

-- ---------------------------------------------------------------------
-- Admin desa
-- ---------------------------------------------------------------------
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a1');

select uji.cek('Admin desa: melihat akun pengembang (daftar admin)',
  exists (select 1 from public.admin where user_id = '00000000-0000-0000-0000-0000000000a2'));
select uji.harus_ditolak('Admin desa: menonaktifkan pengembang ditolak',
  $q$ update public.admin set aktif = false where user_id = '00000000-0000-0000-0000-0000000000a2' returning 1 $q$);
select uji.harus_ditolak('Admin desa: mengubah nama pengembang ditolak',
  $q$ update public.admin set nama = 'X' where user_id = '00000000-0000-0000-0000-0000000000a2' returning 1 $q$);
select uji.harus_ditolak('Admin desa: menghapus profil pengembang ditolak',
  $q$ delete from public.admin where user_id = '00000000-0000-0000-0000-0000000000a2' returning 1 $q$);
select uji.harus_ditolak('Admin desa: mencabut peran pengembang ditolak',
  $q$ delete from public.penugasan_peran where user_id = '00000000-0000-0000-0000-0000000000a2' returning 1 $q$);
select uji.harus_ditolak('Admin desa: menambah peran lain ke akun pengembang ditolak',
  $q$ insert into public.penugasan_peran (user_id, peran_id)
      select '00000000-0000-0000-0000-0000000000a2', id from public.peran where kode = 'admin_desa' returning 1 $q$);
select uji.harus_ditolak('Admin desa: memberi peran pengembang ke admin lain ditolak',
  $q$ insert into public.penugasan_peran (user_id, peran_id)
      select '00000000-0000-0000-0000-0000000000a4', id from public.peran where kode = 'pengembang' returning 1 $q$);
select uji.harus_ditolak('Admin desa: memberi dirinya peran pengembang ditolak',
  $q$ insert into public.penugasan_peran (user_id, peran_id)
      select '00000000-0000-0000-0000-0000000000a1', id from public.peran where kode = 'pengembang' returning 1 $q$);
select uji.harus_ditolak('Admin desa: menambah sistem.kelola ke peran admin_desa ditolak',
  $q$ insert into public.peran_izin (peran_id, izin_kode)
      select id, 'sistem.kelola' from public.peran where kode = 'admin_desa' returning 1 $q$);
select uji.harus_ditolak('Admin desa: mencabut izin dari peran pengembang ditolak',
  $q$ delete from public.peran_izin where izin_kode = 'akses.kelola'
      and peran_id = (select id from public.peran where kode = 'pengembang') returning 1 $q$);
select uji.harus_ditolak('Admin desa: mengubah data peran pengembang ditolak',
  $q$ update public.peran set nama = 'X' where kode = 'pengembang' returning 1 $q$);
select uji.harus_ditolak('Admin desa: menghapus peran pengembang ditolak',
  $q$ delete from public.peran where kode = 'pengembang' returning 1 $q$);
select uji.harus_ditolak('Admin desa: mengganti kode izin sistem.kelola ditolak',
  $q$ update public.izin set kode = 'x.kelola' where kode = 'sistem.kelola' returning 1 $q$);
select uji.harus_ditolak('Admin desa: menghapus izin sistem.kelola ditolak',
  $q$ delete from public.izin where kode = 'sistem.kelola' returning 1 $q$);

-- Yang tetap boleh untuk admin desa (tidak terganggu migrasi ini)
select uji.harus_berhasil('Admin desa: menonaktifkan admin kelompok tetap boleh',
  $q$ update public.admin set aktif = false where user_id = '00000000-0000-0000-0000-0000000000a3' returning 1 $q$);
select uji.harus_berhasil('Admin desa: mengubah nama admin kelompok tetap boleh',
  $q$ update public.admin set nama = 'K1 Baru' where user_id = '00000000-0000-0000-0000-0000000000a3' returning 1 $q$);
select uji.harus_berhasil('Admin desa: memberi admin baru peran admin_generus tetap boleh',
  $q$ insert into public.penugasan_peran (user_id, peran_id)
      select '00000000-0000-0000-0000-0000000000a4', id from public.peran where kode = 'admin_generus' returning 1 $q$);
select uji.harus_berhasil('Admin desa: mencabut peran admin kelompok tetap boleh',
  $q$ delete from public.penugasan_peran where user_id = '00000000-0000-0000-0000-0000000000a3' returning 1 $q$);
select uji.harus_berhasil('Admin desa: mengubah izin peran admin_kelompok tetap boleh',
  $q$ insert into public.peran_izin (peran_id, izin_kode)
      select id, 'kelompok.kelola' from public.peran where kode = 'admin_kelompok' returning 1 $q$);
select uji.harus_berhasil('Admin desa: membuat profil admin baru tetap boleh',
  $q$ insert into public.admin (user_id, nama)
      values ('00000000-0000-0000-0000-0000000000a5', 'Calon') returning 1 $q$);

-- ---------------------------------------------------------------------
-- Pengembang
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000a2');

select uji.cek('Pengembang: tidak bisa melihat data jamaah',
  not exists (select 1 from public.jamaah));
select uji.harus_ditolak('Pengembang: tidak bisa menambah jamaah',
  $q$ insert into public.jamaah (kelompok_id, nama_lengkap, jenis_kelamin)
      select id, 'X', 'L' from public.kelompok where nomor = 1 returning 1 $q$);
select uji.cek('Pengembang: melihat daftar admin (akses.kelola)',
  (select count(*) from public.admin) = 4);
select uji.harus_berhasil('Pengembang: menonaktifkan admin desa boleh (pemulihan akses)',
  $q$ update public.admin set aktif = false where user_id = '00000000-0000-0000-0000-0000000000a1' returning 1 $q$);
select uji.harus_berhasil('Pengembang: memberi peran pengembang ke admin lain boleh',
  $q$ insert into public.penugasan_peran (user_id, peran_id)
      select '00000000-0000-0000-0000-0000000000a4', id from public.peran where kode = 'pengembang' returning 1 $q$);
select uji.harus_berhasil('Pengembang: mengubah nama akunnya sendiri boleh',
  $q$ update public.admin set nama = 'Dev Baru' where user_id = '00000000-0000-0000-0000-0000000000a2' returning 1 $q$);
select uji.harus_berhasil('Pengembang: mengubah data peran pengembang boleh',
  $q$ update public.peran set deskripsi = 'Uji' where kode = 'pengembang' returning 1 $q$);

-- ---------------------------------------------------------------------
-- Admin kelompok (tanpa akses.kelola) tetap tidak bisa apa-apa di sini
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000a3');
select uji.harus_ditolak('Admin kelompok: memberi dirinya peran pengembang ditolak',
  $q$ insert into public.penugasan_peran (user_id, peran_id)
      select '00000000-0000-0000-0000-0000000000a3', id from public.peran where kode = 'pengembang' returning 1 $q$);

reset role;

-- ---------------------------------------------------------------------
-- Hasil
-- ---------------------------------------------------------------------
select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 25, 'Jumlah skenario pengembang');
select * from finish();
rollback;
