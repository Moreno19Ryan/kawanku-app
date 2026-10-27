-- =====================================================================
-- Tes migrasi 20261101100000_bantuan_akun: cari akun, buka kunci PIN,
-- keluarkan dari semua perangkat, dan log-nya. Hanya pengembang.
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

grant execute on all functions in schema uji to anon, authenticated;

insert into auth.users (id, email, last_sign_in_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'desa@uji.id', now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000a5', 'dev@uji.id', now()),
  ('00000000-0000-0000-0000-0000000000b1', 'kw-x@generus.kawanku.invalid', null);
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin Desa'), ('00000000-0000-0000-0000-0000000000a5', 'Dev');
insert into public.penugasan_peran (user_id, peran_id)
select '00000000-0000-0000-0000-0000000000a1', id from public.peran where kode = 'admin_desa';
insert into public.penugasan_peran (user_id, peran_id)
select '00000000-0000-0000-0000-0000000000a5', id from public.peran where kode = 'pengembang';
insert into public.kelompok (nama, nomor) values ('Kelompok Uji', 91);
insert into public.jamaah (nama_lengkap, jenis_kelamin, kelompok_id, tahun_lahir, status_pernikahan, status_sekolah)
select 'Fajar Generus', 'L', id, 2009, 'lajang', 'sma_smk' from public.kelompok where nomor = 91;
insert into public.akun_generus (user_id, jamaah_id, username, gagal_login, terkunci_sampai, login_terakhir)
select '00000000-0000-0000-0000-0000000000b1', id, 'fajar', 0, now() + interval '10 minutes', now() - interval '2 hours'
from public.jamaah where nama_lengkap = 'Fajar Generus';
insert into auth.sessions (id, user_id) values
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000000b1'),
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000000b1');

set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a1');
select uji.harus_ditolak('Admin desa: cari_akun ditolak', $q$ select 1 from public.cari_akun('fajar') $q$);
select uji.harus_ditolak('Admin desa: buka kunci ditolak',
  $q$ select 1 from public.buka_kunci_akun('00000000-0000-0000-0000-0000000000b1') $q$);
select uji.harus_ditolak('Admin desa: keluarkan ditolak',
  $q$ select 1 from public.keluarkan_akun('00000000-0000-0000-0000-0000000000b1') $q$);
select uji.cek('Admin desa: log tidak terlihat', not exists (select 1 from public.bantuan_akun_log));

select uji.sebagai('00000000-0000-0000-0000-0000000000a5');
select uji.cek('Cari kosong: semua akun, terakhir masuk lebih dulu',
  (select array_agg(nama) = array['Dev', 'Fajar Generus', 'Admin Desa'] from public.cari_akun(null)));
select uji.cek('Cari username generus: terkunci & 2 sesi',
  (select jenis = 'generus' and terkunci_sampai > now() and sesi_aktif = 2 and kelompok = 'Kelompok Uji'
   from public.cari_akun('FAJ')));
select uji.cek('Cari email admin: peran terbaca',
  (select jenis = 'admin' and 'Admin Desa' = any (peran) from public.cari_akun('desa@')));
select uji.cek('Cari kode jamaah',
  (select count(*) = 1 from public.cari_akun((select lower(kode) from public.jamaah where nama_lengkap = 'Fajar Generus'))));
select uji.cek('Cari tanpa hasil', not exists (select 1 from public.cari_akun('tidakada')));

select public.buka_kunci_akun('00000000-0000-0000-0000-0000000000b1');
select uji.harus_ditolak('Buka kunci akun admin ditolak (bukan generus)',
  $q$ select 1 from public.buka_kunci_akun('00000000-0000-0000-0000-0000000000a1') $q$);
select uji.cek('Keluarkan: 2 sesi dihapus',
  (select public.keluarkan_akun('00000000-0000-0000-0000-0000000000b1', 'HP hilang') = 2));
select uji.cek('Cari: bantuan terakhir terbaca',
  (select bantuan_terakhir = 'keluarkan' and bantuan_terakhir_at is not null from public.cari_akun('fajar')));
select uji.harus_ditolak('Keluarkan akun tak dikenal ditolak',
  $q$ select 1 from public.keluarkan_akun('00000000-0000-0000-0000-0000000000ff') $q$);
select uji.cek('Log tercatat oleh pengembang',
  (select count(*) = 2 and bool_and(oleh = '00000000-0000-0000-0000-0000000000a5') from public.bantuan_akun_log));
select uji.harus_ditolak('Log tidak bisa diubah langsung',
  $q$ update public.bantuan_akun_log set catatan = 'x' returning 1 $q$);
reset role;
select uji.cek('Buka kunci: kunci & hitungan salah dihapus',
  (select terkunci_sampai is null and gagal_login = 0 from public.akun_generus
   where user_id = '00000000-0000-0000-0000-0000000000b1'));
select uji.cek('Sesi generus benar-benar terhapus',
  not exists (select 1 from auth.sessions where user_id = '00000000-0000-0000-0000-0000000000b1'));

set local role anon;
select uji.harus_ditolak('Anon: cari_akun ditolak', $q$ select 1 from public.cari_akun(null) $q$);
reset role;

select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 18, 'Jumlah skenario bantuan akun');
select * from finish();
rollback;
