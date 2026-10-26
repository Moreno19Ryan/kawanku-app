-- =====================================================================
-- Tes migrasi 20261027110000_sapaan_jamaah: catatan sapaan jamaah yang
-- perlu disapa. Satu transaksi, di-rollback.
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
grant execute on all functions in schema uji to anon, authenticated;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000a3'), ('00000000-0000-0000-0000-0000000000a5');
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-0000000000a1', 'Desa'), ('00000000-0000-0000-0000-0000000000a2', 'K1'),
  ('00000000-0000-0000-0000-0000000000a3', 'K2'), ('00000000-0000-0000-0000-0000000000a5', 'Dev');
select uji.beri('00000000-0000-0000-0000-0000000000a1', 'admin_desa', null);
select uji.beri('00000000-0000-0000-0000-0000000000a2', 'admin_kelompok', 1);
select uji.beri('00000000-0000-0000-0000-0000000000a3', 'admin_kelompok', 2);
select uji.beri('00000000-0000-0000-0000-0000000000a5', 'pengembang', null);
insert into public.jamaah (id, kelompok_id, nama_lengkap, jenis_kelamin, kode, status_pernikahan, status_sekolah, tahun_lahir)
select '00000000-0000-0000-0000-0000000000f1', id, 'Jamaah K1', 'L', 'x', 'menikah', 'bekerja', 1980
from public.kelompok where nomor = 1;

set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a2');
select uji.harus_berhasil('K1: mencatat sapaan jamaahnya',
  $q$ insert into public.sapaan_jamaah (jamaah_id, hasil, catatan)
      values ('00000000-0000-0000-0000-0000000000f1', 'tersambung', 'Sedang kerja shift malam') returning 1 $q$);
insert into public.sapaan_jamaah (jamaah_id, hasil) values ('00000000-0000-0000-0000-0000000000f1', 'berhalangan');
select uji.harus_ditolak('Hasil di luar pilihan ditolak',
  $q$ insert into public.sapaan_jamaah (jamaah_id, hasil) values ('00000000-0000-0000-0000-0000000000f1', 'x') returning 1 $q$);
select uji.harus_ditolak('Catatan tidak bisa diubah',
  $q$ update public.sapaan_jamaah set catatan = 'ubah' returning 1 $q$);
select uji.harus_ditolak('Catatan tidak bisa dihapus',
  $q$ delete from public.sapaan_jamaah returning 1 $q$);

select uji.sebagai('00000000-0000-0000-0000-0000000000a3');
select uji.cek('K2: tidak melihat sapaan jamaah K1', not exists (select 1 from public.sapaan_jamaah));
select uji.harus_ditolak('K2: tidak bisa mencatat sapaan jamaah K1',
  $q$ insert into public.sapaan_jamaah (jamaah_id, hasil) values ('00000000-0000-0000-0000-0000000000f1', 'tersambung') returning 1 $q$);

select uji.sebagai('00000000-0000-0000-0000-0000000000a1');
select uji.cek('Desa: melihat sapaan, tercatat oleh K1',
  (select count(*) = 1 and bool_and(oleh = '00000000-0000-0000-0000-0000000000a2') from public.sapaan_jamaah));
select uji.harus_ditolak('Desa: tidak bisa mencatat atas nama orang lain',
  $q$ insert into public.sapaan_jamaah (jamaah_id, hasil, oleh)
      values ('00000000-0000-0000-0000-0000000000f1', 'tersambung', '00000000-0000-0000-0000-0000000000a2') returning 1 $q$);

select uji.sebagai('00000000-0000-0000-0000-0000000000a5');
select uji.harus_ditolak('Pengembang: tidak bisa mencatat sapaan',
  $q$ insert into public.sapaan_jamaah (jamaah_id, hasil) values ('00000000-0000-0000-0000-0000000000f1', 'tersambung') returning 1 $q$);
reset role;

set local role anon;
select uji.harus_ditolak('Anon: tidak bisa membaca', $q$ select 1 from public.sapaan_jamaah $q$);
reset role;

select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 10, 'Jumlah skenario sapaan');
select * from finish();
rollback;
