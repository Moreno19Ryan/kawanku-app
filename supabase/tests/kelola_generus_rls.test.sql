-- =====================================================================
-- Tes pengelolaan akun admin generus per wilayah
-- (migrasi 20261021100000_kelola_admin_generus). Satu transaksi, di-rollback.
--   * generus kelompok N → dikelola admin kelompok N (bukan admin desa)
--   * generus desa → dikelola admin desa
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
  ('00000000-0000-0000-0000-0000000000c1'),  -- admin desa
  ('00000000-0000-0000-0000-0000000000c2'),  -- admin kelompok 1
  ('00000000-0000-0000-0000-0000000000c3'),  -- admin kelompok 2
  ('00000000-0000-0000-0000-0000000000c4'),  -- admin generus kelompok 1
  ('00000000-0000-0000-0000-0000000000c5'),  -- admin generus kelompok 2
  ('00000000-0000-0000-0000-0000000000c6'),  -- admin generus desa
  ('00000000-0000-0000-0000-0000000000c7'),  -- pengembang
  ('00000000-0000-0000-0000-0000000000c8'),  -- akun baru (belum jadi admin)
  ('00000000-0000-0000-0000-0000000000c9');  -- akun baru kedua
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-0000000000c1', 'Desa'), ('00000000-0000-0000-0000-0000000000c2', 'Kelompok 1'), ('00000000-0000-0000-0000-0000000000c3', 'Kelompok 2'),
  ('00000000-0000-0000-0000-0000000000c4', 'Generus K1'), ('00000000-0000-0000-0000-0000000000c5', 'Generus K2'), ('00000000-0000-0000-0000-0000000000c6', 'Generus Desa'),
  ('00000000-0000-0000-0000-0000000000c7', 'Dev');
create function uji.beri(p_user uuid, p_peran text, p_nomor int) returns void language sql as $$
  insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
  select p_user, p.id, (select id from public.kelompok where nomor = p_nomor)
  from public.peran p where p.kode = p_peran;
$$;
select uji.beri('00000000-0000-0000-0000-0000000000c1', 'admin_desa', null);
select uji.beri('00000000-0000-0000-0000-0000000000c2', 'admin_kelompok', 1);
select uji.beri('00000000-0000-0000-0000-0000000000c3', 'admin_kelompok', 2);
select uji.beri('00000000-0000-0000-0000-0000000000c4', 'admin_generus', 1);
select uji.beri('00000000-0000-0000-0000-0000000000c5', 'admin_generus', 2);
select uji.beri('00000000-0000-0000-0000-0000000000c6', 'admin_generus', null);
select uji.beri('00000000-0000-0000-0000-0000000000c7', 'pengembang', null);

select uji.cek('Seed: akses.kelola_generus dipegang admin_kelompok & pengembang, bukan admin_desa',
  (select array_agg(p.kode order by p.kode) from public.peran_izin pi join public.peran p on p.id = pi.peran_id
   where pi.izin_kode = 'akses.kelola_generus') = array['admin_kelompok', 'pengembang']);

set local role authenticated;

-- ---------------------------------------------------------------------
-- Admin kelompok 1
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000c2');
select uji.cek('K1: melihat akun generus K1', exists (select 1 from public.admin where user_id = '00000000-0000-0000-0000-0000000000c4'));
select uji.cek('K1: TIDAK melihat akun generus K2', not exists (select 1 from public.admin where user_id = '00000000-0000-0000-0000-0000000000c5'));
select uji.cek('K1: TIDAK melihat akun admin desa', not exists (select 1 from public.admin where user_id = '00000000-0000-0000-0000-0000000000c1'));
select uji.cek('K1: TIDAK melihat akun generus desa', not exists (select 1 from public.admin where user_id = '00000000-0000-0000-0000-0000000000c6'));
select uji.cek('K1: melihat penugasan generus K1', exists (select 1 from public.penugasan_peran where user_id = '00000000-0000-0000-0000-0000000000c4'));
select uji.cek('K1: akun_dapat_dikelola() = hanya generus K1',
  (select array_agg(x) from public.akun_dapat_dikelola() x) = array['00000000-0000-0000-0000-0000000000c4'::uuid]);
select uji.harus_berhasil('K1: menonaktifkan generus K1',
  $q$ update public.admin set aktif = false where user_id = '00000000-0000-0000-0000-0000000000c4' returning 1 $q$);
select uji.harus_berhasil('K1: mengubah nama generus K1',
  $q$ update public.admin set nama = 'Baru' where user_id = '00000000-0000-0000-0000-0000000000c4' returning 1 $q$);
select uji.harus_ditolak('K1: mencabut peran terakhir generus K1 (akun masih aktif) ditolak',
  $q$ delete from public.penugasan_peran where user_id = '00000000-0000-0000-0000-0000000000c4' returning 1 $q$);
select uji.harus_ditolak('K1: menonaktifkan generus K2 ditolak',
  $q$ update public.admin set aktif = false where user_id = '00000000-0000-0000-0000-0000000000c5' returning 1 $q$);
select uji.harus_ditolak('K1: menonaktifkan generus desa ditolak',
  $q$ update public.admin set aktif = false where user_id = '00000000-0000-0000-0000-0000000000c6' returning 1 $q$);
select uji.harus_ditolak('K1: menonaktifkan admin kelompok 2 ditolak',
  $q$ update public.admin set aktif = false where user_id = '00000000-0000-0000-0000-0000000000c3' returning 1 $q$);
select uji.harus_ditolak('K1: menonaktifkan admin desa ditolak',
  $q$ update public.admin set aktif = false where user_id = '00000000-0000-0000-0000-0000000000c1' returning 1 $q$);
select uji.harus_berhasil('K1: membuat profil admin untuk akun baru',
  $q$ insert into public.admin (user_id, nama) values ('00000000-0000-0000-0000-0000000000c8', 'Calon') returning 1 $q$);
insert into public.admin (user_id, nama) values ('00000000-0000-0000-0000-0000000000c8', 'Calon');
select uji.harus_berhasil('K1: memberi akun baru peran generus K1',
  $q$ insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
      select '00000000-0000-0000-0000-0000000000c8', p.id, k.id from public.peran p, public.kelompok k
      where p.kode = 'admin_generus' and k.nomor = 1 returning 1 $q$);
select uji.harus_ditolak('K1: memberi akun baru peran generus K2 ditolak',
  $q$ insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
      select '00000000-0000-0000-0000-0000000000c8', p.id, k.id from public.peran p, public.kelompok k
      where p.kode = 'admin_generus' and k.nomor = 2 returning 1 $q$);
select uji.harus_ditolak('K1: memberi akun baru peran generus DESA ditolak',
  $q$ insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
      select '00000000-0000-0000-0000-0000000000c8', id, null from public.peran where kode = 'admin_generus' returning 1 $q$);
select uji.harus_ditolak('K1: memberi akun baru peran admin kelompok 1 ditolak',
  $q$ insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
      select '00000000-0000-0000-0000-0000000000c8', p.id, k.id from public.peran p, public.kelompok k
      where p.kode = 'admin_kelompok' and k.nomor = 1 returning 1 $q$);
select uji.harus_ditolak('K1: memberi dirinya peran generus K1 ditolak (akunnya bukan akun generus)',
  $q$ insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
      select '00000000-0000-0000-0000-0000000000c2', p.id, k.id from public.peran p, public.kelompok k
      where p.kode = 'admin_generus' and k.nomor = 1 returning 1 $q$);
select uji.harus_ditolak('K1: menambah peran generus K1 ke akun admin desa ditolak',
  $q$ insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
      select '00000000-0000-0000-0000-0000000000c1', p.id, k.id from public.peran p, public.kelompok k
      where p.kode = 'admin_generus' and k.nomor = 1 returning 1 $q$);
select uji.cek('K1: boleh_beri_peran(generus, K1) = true',
  public.boleh_beri_peran((select id from public.peran where kode = 'admin_generus'),
                          (select id from public.kelompok where nomor = 1)));
select uji.cek('K1: boleh_beri_peran(generus, K2) = false',
  not public.boleh_beri_peran((select id from public.peran where kode = 'admin_generus'),
                              (select id from public.kelompok where nomor = 2)));

-- ---------------------------------------------------------------------
-- Admin desa
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000c1');
select uji.cek('Desa: tetap melihat semua akun (termasuk generus kelompok)',
  (select count(*) from public.admin) >= 7);
select uji.harus_ditolak('Desa: menonaktifkan generus K1 ditolak',
  $q$ update public.admin set aktif = false where user_id = '00000000-0000-0000-0000-0000000000c4' returning 1 $q$);
select uji.harus_ditolak('Desa: mengubah nama generus K2 ditolak',
  $q$ update public.admin set nama = 'X' where user_id = '00000000-0000-0000-0000-0000000000c5' returning 1 $q$);
select uji.harus_ditolak('Desa: mencabut peran generus K1 ditolak',
  $q$ delete from public.penugasan_peran where user_id = '00000000-0000-0000-0000-0000000000c4' returning 1 $q$);
select uji.harus_berhasil('Desa: menonaktifkan generus desa boleh',
  $q$ update public.admin set aktif = false where user_id = '00000000-0000-0000-0000-0000000000c6' returning 1 $q$);
select uji.harus_berhasil('Desa: menonaktifkan admin kelompok 1 boleh',
  $q$ update public.admin set aktif = false where user_id = '00000000-0000-0000-0000-0000000000c2' returning 1 $q$);
insert into public.admin (user_id, nama) values ('00000000-0000-0000-0000-0000000000c9', 'Calon 2');
select uji.harus_berhasil('Desa: memberi akun baru peran generus DESA boleh',
  $q$ insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
      select '00000000-0000-0000-0000-0000000000c9', id, null from public.peran where kode = 'admin_generus' returning 1 $q$);
select uji.harus_ditolak('Desa: memberi akun baru peran generus K1 ditolak',
  $q$ insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
      select '00000000-0000-0000-0000-0000000000c9', p.id, k.id from public.peran p, public.kelompok k
      where p.kode = 'admin_generus' and k.nomor = 1 returning 1 $q$);
select uji.harus_berhasil('Desa: memberi akun baru peran admin kelompok boleh',
  $q$ insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
      select '00000000-0000-0000-0000-0000000000c9', p.id, k.id from public.peran p, public.kelompok k
      where p.kode = 'admin_kelompok' and k.nomor = 3 returning 1 $q$);
select uji.cek('Desa: akun_dapat_dikelola() tidak memuat generus kelompok',
  not exists (select 1 from public.akun_dapat_dikelola() x
              where x in ('00000000-0000-0000-0000-0000000000c4'::uuid, '00000000-0000-0000-0000-0000000000c5'::uuid)));

-- ---------------------------------------------------------------------
-- Admin generus K1 (tanpa izin akses apa pun)
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000c4');
select uji.cek('Generus K1: hanya melihat akunnya sendiri', (select count(*) = 1 from public.admin));
select uji.harus_ditolak('Generus K1: membuat profil admin ditolak',
  $q$ insert into public.admin (user_id, nama) values ('00000000-0000-0000-0000-0000000000c9', 'X') returning 1 $q$);
select uji.harus_ditolak('Generus K1: mengubah nama sendiri ditolak',
  $q$ update public.admin set nama = 'X' where user_id = '00000000-0000-0000-0000-0000000000c4' returning 1 $q$);

-- ---------------------------------------------------------------------
-- Pengembang: boleh mengelola generus kelompok (pemulihan akses)
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000c7');
select uji.harus_berhasil('Pengembang: menonaktifkan generus K2 boleh',
  $q$ update public.admin set aktif = false where user_id = '00000000-0000-0000-0000-0000000000c5' returning 1 $q$);
select uji.harus_berhasil('Pengembang: memberi peran generus K2 boleh',
  $q$ insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
      select '00000000-0000-0000-0000-0000000000c9', p.id, k.id from public.peran p, public.kelompok k
      where p.kode = 'admin_generus' and k.nomor = 2 returning 1 $q$);

-- Anon tidak bisa memanggil fungsi baru
reset role;
set local role anon;
select uji.harus_ditolak('Anon: akun_dapat_dikelola() ditolak',
  $q$ select * from public.akun_dapat_dikelola() $q$);
reset role;

-- ---------------------------------------------------------------------
-- Hasil
-- ---------------------------------------------------------------------
select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 35, 'Jumlah skenario admin generus');
select * from finish();
rollback;
