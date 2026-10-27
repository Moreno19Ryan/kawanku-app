-- =====================================================================
-- Tes migrasi 20261101110000_mfa_pengembang: akun yang sudah punya MFA
-- hanya bisa memakai data bila sesinya aal2. Satu transaksi, di-rollback.
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

create function uji.sebagai(p_uid text, p_aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_uid, true);
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', p_aal)::text, true);
$$;
grant execute on all functions in schema uji to anon, authenticated;

grant execute on all functions in schema uji to anon, authenticated;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a5');
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-0000000000a1', 'Desa'), ('00000000-0000-0000-0000-0000000000a5', 'Dev');
insert into public.penugasan_peran (user_id, peran_id)
select '00000000-0000-0000-0000-0000000000a1', id from public.peran where kode = 'admin_desa';
insert into public.penugasan_peran (user_id, peran_id)
select '00000000-0000-0000-0000-0000000000a5', id from public.peran where kode = 'pengembang';

select uji.cek('Kebijakan wajib_aal2 ada di semua tabel public',
  not exists (select 1 from pg_tables t where t.schemaname = 'public'
    and not exists (select 1 from pg_policies p where p.schemaname = 'public'
      and p.tablename = t.tablename and p.policyname = 'wajib_aal2' and p.permissive = 'RESTRICTIVE')));

-- Sebelum MFA: aal1 cukup
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a5');
select uji.cek('Tanpa MFA: pengembang aal1 membaca data admin', (select count(*) = 2 from public.admin));
select uji.harus_berhasil('Tanpa MFA: RPC pengembang jalan', $q$ select 1 from public.ukuran_database() $q$);
reset role;

-- Pengembang mendaftarkan MFA (faktor terverifikasi)
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
values (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a5', 'HP', 'totp', 'verified', now(), now(), 'x');

set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a5');
select uji.cek('MFA + aal1: data tidak terbaca', not exists (select 1 from public.admin));
select uji.cek('MFA + aal1: data jamaah/kelompok tidak terbaca', not exists (select 1 from public.kelompok));
select uji.harus_ditolak('MFA + aal1: RPC pengembang ditolak', $q$ select 1 from public.ukuran_database() $q$);
select uji.harus_ditolak('MFA + aal1: tidak bisa menulis',
  $q$ update public.pengaturan_sistem set pesan_perawatan = 'x' returning 1 $q$);

select uji.sebagai('00000000-0000-0000-0000-0000000000a5', 'aal2');
select uji.cek('MFA + aal2: data terbaca', (select count(*) = 2 from public.admin));
select uji.harus_berhasil('MFA + aal2: RPC pengembang jalan', $q$ select 1 from public.ukuran_database() $q$);
select uji.harus_berhasil('MFA + aal2: bisa menulis',
  $q$ update public.pengaturan_sistem set pesan_perawatan = 'x' returning 1 $q$);

select uji.sebagai('00000000-0000-0000-0000-0000000000a1');
select uji.cek('Admin lain tanpa MFA: tetap normal di aal1', (select count(*) = 2 from public.admin));
reset role;

-- Faktor yang belum diverifikasi (baru mendaftar) tidak mengunci akun
delete from auth.mfa_factors where user_id = '00000000-0000-0000-0000-0000000000a5';
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
values (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a5', 'HP', 'totp', 'unverified', now(), now(), 'x');
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a5');
select uji.cek('Faktor belum diverifikasi: aal1 masih bisa', (select count(*) = 2 from public.admin));
reset role;

select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 12, 'Jumlah skenario MFA');
select * from finish();
rollback;
