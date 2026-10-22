-- =====================================================================
-- Tes migrasi 20261022110000_jaga_pengembang: peran tingkat sistem milik
-- sendiri tidak bisa dicabut, dan pengembang aktif terakhir tidak bisa
-- dicabut/dinonaktifkan. Satu transaksi, di-rollback.
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

create function uji.galat(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlerrm;
end $$;
grant execute on all functions in schema uji to anon, authenticated;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000f1'),  -- admin desa
  ('00000000-0000-0000-0000-0000000000f2'),  -- pengembang 1
  ('00000000-0000-0000-0000-0000000000f3'),  -- pengembang 2 (ditambah belakangan)
  ('00000000-0000-0000-0000-0000000000f4');  -- admin kelompok 1
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-0000000000f1', 'Desa'), ('00000000-0000-0000-0000-0000000000f2', 'Dev 1'),
  ('00000000-0000-0000-0000-0000000000f3', 'Dev 2'), ('00000000-0000-0000-0000-0000000000f4', 'Kelompok 1');
insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
  select '00000000-0000-0000-0000-0000000000f1', id, null from public.peran where kode = 'admin_desa';
insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
  select '00000000-0000-0000-0000-0000000000f2', id, null from public.peran where kode = 'pengembang';
insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
  select '00000000-0000-0000-0000-0000000000f4', p.id, k.id from public.peran p, public.kelompok k
  where p.kode = 'admin_kelompok' and k.nomor = 1;

-- Satu pengembang
select uji.cek('Pemilik DB: pengembang terakhir tidak bisa dicabut (hint pengembang_terakhir)',
  uji.galat($q$ delete from public.penugasan_peran where user_id = '00000000-0000-0000-0000-0000000000f2' $q$)
    like '%pengembang terakhir%');
select uji.cek('Pemilik DB: pengembang terakhir tidak bisa dinonaktifkan',
  uji.galat($q$ update public.admin set aktif = false where user_id = '00000000-0000-0000-0000-0000000000f2' $q$)
    like '%pengembang terakhir%');
select uji.cek('Pemilik DB: pengembang terakhir tidak bisa dipindah ke peran lain',
  uji.galat($q$ update public.penugasan_peran set peran_id = (select id from public.peran where kode = 'admin_desa')
               where user_id = '00000000-0000-0000-0000-0000000000f2' $q$) like '%pengembang terakhir%');
select uji.harus_berhasil('Perubahan yang tidak menyentuh peran (updated_at) tetap boleh',
  $q$ update public.penugasan_peran set updated_at = now() where user_id = '00000000-0000-0000-0000-0000000000f2' returning 1 $q$);
select uji.harus_berhasil('Peran bukan sistem tetap bisa dicabut seperti biasa',
  $q$ delete from public.penugasan_peran where user_id = '00000000-0000-0000-0000-0000000000f4' returning 1 $q$);

set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000f2');
select uji.cek('Pengembang: tidak bisa mencabut peran pengembang miliknya sendiri',
  uji.galat($q$ delete from public.penugasan_peran where user_id = '00000000-0000-0000-0000-0000000000f2' $q$)
    like '%milikmu sendiri%');
reset role;

-- Dua pengembang
insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
  select '00000000-0000-0000-0000-0000000000f3', id, null from public.peran where kode = 'pengembang';

set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000f2');
select uji.cek('Dua pengembang: tetap tidak bisa mencabut milik sendiri',
  uji.galat($q$ delete from public.penugasan_peran where user_id = '00000000-0000-0000-0000-0000000000f2' $q$)
    like '%milikmu sendiri%');
select uji.harus_berhasil('Dua pengembang: Dev 1 boleh mencabut peran pengembang Dev 2',
  $q$ delete from public.penugasan_peran where user_id = '00000000-0000-0000-0000-0000000000f3' returning 1 $q$);
select uji.sebagai('00000000-0000-0000-0000-0000000000f3');
select uji.harus_berhasil('Dua pengembang: Dev 2 boleh mencabut peran pengembang Dev 1',
  $q$ delete from public.penugasan_peran where user_id = '00000000-0000-0000-0000-0000000000f2' returning 1 $q$);
reset role;
select uji.harus_berhasil('Dua pengembang: salah satu boleh dinonaktifkan',
  $q$ update public.admin set aktif = false where user_id = '00000000-0000-0000-0000-0000000000f3' returning 1 $q$);

-- Pengembang kedua nonaktif → yang aktif terhitung terakhir
update public.admin set aktif = false where user_id = '00000000-0000-0000-0000-0000000000f3';
select uji.cek('Pengembang lain nonaktif: yang aktif tetap terhitung terakhir',
  uji.galat($q$ delete from public.penugasan_peran where user_id = '00000000-0000-0000-0000-0000000000f2' $q$)
    like '%pengembang terakhir%');

select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 11, 'Jumlah skenario jaga pengembang');
select * from finish();
rollback;
