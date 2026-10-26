-- =====================================================================
-- Tes migrasi 20261027100000_cadangan_data: izin cadangan.unduh hanya untuk
-- admin desa & admin kelompok, catatan unduhan per wilayah, pengembang
-- melihat semua catatan tapi tidak bisa mengunduh. Satu transaksi, di-rollback.
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
create function uji.kel(p_nomor int) returns uuid language sql stable as $$
  select id from public.kelompok where nomor = p_nomor;
$$;
grant execute on all functions in schema uji to anon, authenticated;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000a3'), ('00000000-0000-0000-0000-0000000000a5');
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-0000000000a1', 'Desa'), ('00000000-0000-0000-0000-0000000000a2', 'K1'),
  ('00000000-0000-0000-0000-0000000000a3', 'Gen K1'), ('00000000-0000-0000-0000-0000000000a5', 'Dev');
select uji.beri('00000000-0000-0000-0000-0000000000a1', 'admin_desa', null);
select uji.beri('00000000-0000-0000-0000-0000000000a2', 'admin_kelompok', 1);
select uji.beri('00000000-0000-0000-0000-0000000000a3', 'admin_generus', 1);
select uji.beri('00000000-0000-0000-0000-0000000000a5', 'pengembang', null);

select uji.cek('Seed: cadangan.unduh untuk admin desa & admin kelompok saja',
  (select array_agg(p.kode order by p.kode) from public.peran_izin pi join public.peran p on p.id = pi.peran_id
   where pi.izin_kode = 'cadangan.unduh') = array['admin_desa', 'admin_kelompok']);

set local role authenticated;

select uji.sebagai('00000000-0000-0000-0000-0000000000a1');
select uji.harus_berhasil('Desa: mencatat unduhan seluruh desa',
  $q$ insert into public.unduhan_cadangan (kelompok_id, ringkasan) values (null, '{"jamaah": 3}') returning 1 $q$);
insert into public.unduhan_cadangan (kelompok_id) values (null);
select uji.harus_berhasil('Desa: mencatat unduhan satu kelompok',
  $q$ insert into public.unduhan_cadangan (kelompok_id) values (uji.kel(2)) returning 1 $q$);
select uji.harus_ditolak('Desa: tidak bisa mencatat atas nama orang lain',
  $q$ insert into public.unduhan_cadangan (oleh, kelompok_id)
      values ('00000000-0000-0000-0000-0000000000a2', null) returning 1 $q$);

select uji.sebagai('00000000-0000-0000-0000-0000000000a2');
select uji.harus_berhasil('K1: mencatat unduhan kelompoknya',
  $q$ insert into public.unduhan_cadangan (kelompok_id) values (uji.kel(1)) returning 1 $q$);
insert into public.unduhan_cadangan (kelompok_id) values (uji.kel(1));
select uji.harus_ditolak('K1: unduhan seluruh desa ditolak',
  $q$ insert into public.unduhan_cadangan (kelompok_id) values (null) returning 1 $q$);
select uji.harus_ditolak('K1: unduhan kelompok lain ditolak',
  $q$ insert into public.unduhan_cadangan (kelompok_id) values (uji.kel(2)) returning 1 $q$);
select uji.cek('K1: hanya melihat catatannya sendiri', (select count(*) from public.unduhan_cadangan) = 1);
select uji.harus_ditolak('K1: catatan tidak bisa diubah',
  $q$ update public.unduhan_cadangan set ringkasan = '{}' returning 1 $q$);

select uji.sebagai('00000000-0000-0000-0000-0000000000a3');
select uji.harus_ditolak('Admin generus: tidak bisa mengunduh cadangan',
  $q$ insert into public.unduhan_cadangan (kelompok_id) values (uji.kel(1)) returning 1 $q$);

select uji.sebagai('00000000-0000-0000-0000-0000000000a5');
select uji.harus_ditolak('Pengembang: tidak bisa mengunduh cadangan',
  $q$ insert into public.unduhan_cadangan (kelompok_id) values (null) returning 1 $q$);
select uji.cek('Pengembang: melihat semua catatan unduhan', (select count(*) from public.unduhan_cadangan) = 2);
reset role;

set local role anon;
select uji.harus_ditolak('Anon: tidak bisa membaca catatan', $q$ select 1 from public.unduhan_cadangan $q$);
reset role;

select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 13, 'Jumlah skenario cadangan');
select * from finish();
rollback;
