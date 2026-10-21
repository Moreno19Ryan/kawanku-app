-- =====================================================================
-- Tes migrasi 20261022000000_alamat_mandiri_generus: generus melihat &
-- mengubah alamatnya sendiri (hanya alamat, hanya miliknya) lewat ubah_alamat_saya().
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

create function uji.ubah(p_jalan text, p_sama boolean default true) returns void language sql as $$
  select public.ubah_alamat_saya('32.16', 'Jawa Barat, Kab. Bekasi', p_jalan, 1::smallint, 2::smallint, '17510',
    p_sama, '32.16', 'Jawa Barat, Kab. Bekasi', 'Jl. Kos', 3::smallint, 4::smallint, '17511');
$$;
grant execute on all functions in schema uji to anon, authenticated;

-- ---------------------------------------------------------------------
-- Data contoh (sebagai pemilik DB)
-- ---------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'desa@uji.id'),
  ('00000000-0000-0000-0000-0000000000c1', 'g-satu@generus.kawanku.invalid'),
  ('00000000-0000-0000-0000-0000000000c2', 'g-dua@generus.kawanku.invalid'),
  ('00000000-0000-0000-0000-0000000000c3', 'g-tiga@generus.kawanku.invalid');
insert into public.admin (user_id, nama) values ('00000000-0000-0000-0000-0000000000b1', 'Desa');
insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
select '00000000-0000-0000-0000-0000000000b1', id, null from public.peran where kode = 'admin_desa';

-- f1 generus (PIN sudah diganti, sudah ada alamat), f2 generus lain,
-- f3 generus PIN awal, f4 generus tanpa baris jamaah_pribadi
insert into public.jamaah (id, kelompok_id, nama_lengkap, jenis_kelamin, kode, status_pernikahan, status_sekolah, tahun_lahir)
select v.id::uuid, (select id from public.kelompok where nomor = 1), v.nama, 'L', 'x', 'lajang', 'smp', 2012
from (values
  ('00000000-0000-0000-0000-0000000000f1', 'Generus Satu'),
  ('00000000-0000-0000-0000-0000000000f2', 'Generus Dua'),
  ('00000000-0000-0000-0000-0000000000f3', 'Generus Tiga'),
  ('00000000-0000-0000-0000-0000000000f4', 'Generus Empat')
) v(id, nama);
insert into public.akun_generus (user_id, jamaah_id, username, pin_awal) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', 'satu', false),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000f4', 'empat', false),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000f3', 'tiga', true);
insert into public.jamaah_pribadi (jamaah_id, nama_ayah, ktp_jalan, domisili_sama_ktp, dom_jalan) values
  ('00000000-0000-0000-0000-0000000000f1', 'Ayah Satu', 'Jl. Lama', false, 'Jl. Domisili'),
  ('00000000-0000-0000-0000-0000000000f2', 'Ayah Dua', 'Jl. Dua', true, null);

set local role authenticated;

-- ---------------------------------------------------------------------
-- Generus satu
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000c1');
select uji.cek('Gen: hanya melihat baris pribadinya sendiri',
  (select array_agg(nama_ayah) from public.jamaah_pribadi) = array['Ayah Satu']);
select uji.harus_ditolak('Gen: tidak bisa update jamaah_pribadi langsung',
  $q$ update public.jamaah_pribadi set nama_ayah = 'Ganti' returning 1 $q$);
select uji.harus_ditolak('Gen: tidak bisa insert jamaah_pribadi langsung',
  $q$ insert into public.jamaah_pribadi (jamaah_id) values ('00000000-0000-0000-0000-0000000000f2') returning 1 $q$);
select uji.ubah('Jl. Baru', true);
select uji.cek('Gen: alamat KTP/KIA berubah lewat RPC',
  (select ktp_jalan = 'Jl. Baru' and ktp_rt = 1 and ktp_kode_wilayah = '32.16' from public.jamaah_pribadi));
select uji.cek('Gen: domisili sama → kolom dom_* dikosongkan',
  (select domisili_sama_ktp and dom_jalan is null and dom_rt is null from public.jamaah_pribadi));
select uji.cek('Gen: nama orang tua tidak tersentuh',
  (select nama_ayah = 'Ayah Satu' from public.jamaah_pribadi));
select uji.cek('Gen: updated_by = akunnya sendiri',
  (select updated_by = '00000000-0000-0000-0000-0000000000c1' from public.jamaah_pribadi));
select uji.ubah('Jl. Baru', false);
select uji.cek('Gen: domisili berbeda tersimpan',
  (select not domisili_sama_ktp and dom_jalan = 'Jl. Kos' and dom_rw = 4 from public.jamaah_pribadi));
select uji.harus_ditolak('Gen: isian tidak valid ditolak constraint',
  $q$ select public.ubah_alamat_saya('xx', null, null, null, null, '123', true,
       null, null, null, null, null, null) $q$);

-- ---------------------------------------------------------------------
-- Generus empat: belum ada baris → dibuat
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000c2');
select uji.cek('Gen4: belum ada baris pribadi', not exists (select 1 from public.jamaah_pribadi));
select uji.ubah('Jl. Empat');
select uji.cek('Gen4: baris pribadi dibuat untuk dirinya',
  (select jamaah_id = '00000000-0000-0000-0000-0000000000f4' and ktp_jalan = 'Jl. Empat' from public.jamaah_pribadi));

-- ---------------------------------------------------------------------
-- Generus tiga (PIN awal) & admin & anon
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000c3');
select uji.harus_ditolak('Gen PIN awal: belum boleh mengubah alamat', $q$ select uji.ubah('Jl. Tiga') $q$);

select uji.sebagai('00000000-0000-0000-0000-0000000000b1');
select uji.harus_ditolak('Admin (bukan akun generus): RPC ditolak', $q$ select uji.ubah('Jl. Admin') $q$);
select uji.cek('Admin desa: tetap melihat semua baris pribadi', (select count(*) from public.jamaah_pribadi) = 3);
select uji.cek('Admin desa: alamat Dua tidak berubah',
  (select ktp_jalan = 'Jl. Dua' from public.jamaah_pribadi where jamaah_id = '00000000-0000-0000-0000-0000000000f2'));

reset role;
select uji.cek('Anon: tidak bisa memanggil ubah_alamat_saya',
  not has_function_privilege('anon', 'public.ubah_alamat_saya(text, text, text, smallint, smallint, text, boolean, text, text, text, smallint, smallint, text)', 'execute'));

select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 15, 'Jumlah skenario alamat mandiri');
select * from finish();
rollback;
