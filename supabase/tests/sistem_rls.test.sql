-- =====================================================================
-- Tes panel pengembang (migrasi 20261021090000_panel_pengembang):
-- pengaturan_sistem, pengumuman, fitur, fitur_kelompok.
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
  ('00000000-0000-0000-0000-0000000000b1'),  -- admin desa
  ('00000000-0000-0000-0000-0000000000b2'),  -- pengembang
  ('00000000-0000-0000-0000-0000000000b3');  -- admin kelompok 1
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-0000000000b1', 'Desa'),
  ('00000000-0000-0000-0000-0000000000b2', 'Dev'),
  ('00000000-0000-0000-0000-0000000000b3', 'Kelompok 1');
insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
  select '00000000-0000-0000-0000-0000000000b1', id, null from public.peran where kode = 'admin_desa';
insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
  select '00000000-0000-0000-0000-0000000000b2', id, null from public.peran where kode = 'pengembang';
insert into public.penugasan_peran (user_id, peran_id, kelompok_id)
  select '00000000-0000-0000-0000-0000000000b3', p.id, k.id from public.peran p, public.kelompok k
  where p.kode = 'admin_kelompok' and k.nomor = 1;
insert into public.pengumuman (pesan) values ('Pengumuman contoh');

-- Seed & struktur
select uji.cek('Seed: pengaturan_sistem tepat satu baris, perawatan mati',
  (select count(*) = 1 and bool_and(not mode_perawatan) from public.pengaturan_sistem));
select uji.harus_ditolak('Struktur: baris kedua pengaturan_sistem ditolak (unique tunggal)',
  $q$ insert into public.pengaturan_sistem (mode_perawatan) values (true) returning 1 $q$);
select uji.cek('Seed: tiga fitur (jamaah, kegiatan, absensi), semuanya mati',
  (select array_agg(kode order by kode) = array['absensi','jamaah','kegiatan'] and bool_and(not aktif)
   from public.fitur));
select uji.cek('Seed: pengumuman.kelola hanya dipegang pengembang',
  (select array_agg(p.kode) = array['pengembang'] from public.peran_izin pi
   join public.peran p on p.id = pi.peran_id where pi.izin_kode = 'pengumuman.kelola'));
select uji.cek('RLS aktif di keempat tabel baru',
  (select bool_and(relrowsecurity) from pg_class
   where oid in ('public.pengaturan_sistem'::regclass, 'public.pengumuman'::regclass,
                 'public.fitur'::regclass, 'public.fitur_kelompok'::regclass)));
select uji.harus_ditolak('Pengumuman: berakhir sebelum mulai ditolak (check)',
  $q$ insert into public.pengumuman (pesan, mulai, berakhir)
      values ('x', now(), now() - interval '1 day') returning 1 $q$);

-- ---------------------------------------------------------------------
-- Admin desa: baca boleh, ubah tidak
-- ---------------------------------------------------------------------
set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000b1');
select uji.cek('Admin desa: membaca pengaturan_sistem', exists (select 1 from public.pengaturan_sistem));
select uji.cek('Admin desa: membaca pengumuman', exists (select 1 from public.pengumuman));
select uji.cek('Admin desa: membaca fitur', (select count(*) = 3 from public.fitur));
select uji.harus_ditolak('Admin desa: menyalakan mode perawatan ditolak',
  $q$ update public.pengaturan_sistem set mode_perawatan = true returning 1 $q$);
select uji.harus_ditolak('Admin desa: membuat pengumuman ditolak',
  $q$ insert into public.pengumuman (pesan) values ('x') returning 1 $q$);
select uji.harus_ditolak('Admin desa: mengubah pengumuman ditolak',
  $q$ update public.pengumuman set aktif = false returning 1 $q$);
select uji.harus_ditolak('Admin desa: menghapus pengumuman ditolak',
  $q$ delete from public.pengumuman returning 1 $q$);
select uji.harus_ditolak('Admin desa: menyalakan fitur ditolak',
  $q$ update public.fitur set aktif = true returning 1 $q$);
select uji.harus_ditolak('Admin desa: menambah fitur ditolak',
  $q$ insert into public.fitur (kode, nama) values ('x', 'X') returning 1 $q$);
select uji.harus_ditolak('Admin desa: memilih kelompok untuk fitur ditolak',
  $q$ insert into public.fitur_kelompok (fitur_id, kelompok_id)
      select f.id, k.id from public.fitur f, public.kelompok k
      where f.kode = 'jamaah' and k.nomor = 1 returning 1 $q$);
select uji.harus_ditolak('Admin desa: mencabut pengumuman.kelola dari peran pengembang ditolak (peran sistem)',
  $q$ delete from public.peran_izin where izin_kode = 'pengumuman.kelola' returning 1 $q$);

-- Admin kelompok
select uji.sebagai('00000000-0000-0000-0000-0000000000b3');
select uji.cek('Admin kelompok: membaca pengaturan_sistem', exists (select 1 from public.pengaturan_sistem));
select uji.harus_ditolak('Admin kelompok: menyalakan mode perawatan ditolak',
  $q$ update public.pengaturan_sistem set mode_perawatan = true returning 1 $q$);

-- ---------------------------------------------------------------------
-- Pengembang: boleh semua
-- ---------------------------------------------------------------------
select uji.sebagai('00000000-0000-0000-0000-0000000000b2');
select uji.harus_berhasil('Pengembang: menyalakan mode perawatan + pesan',
  $q$ update public.pengaturan_sistem set mode_perawatan = true, pesan_perawatan = 'Sebentar'
      returning 1 $q$);
select uji.harus_berhasil('Pengembang: membuat pengumuman',
  $q$ insert into public.pengumuman (pesan, nada) values ('Halo', 'peringatan') returning 1 $q$);
select uji.harus_berhasil('Pengembang: menonaktifkan pengumuman',
  $q$ update public.pengumuman set aktif = false returning 1 $q$);
select uji.harus_berhasil('Pengembang: menghapus pengumuman',
  $q$ delete from public.pengumuman returning 1 $q$);
select uji.harus_berhasil('Pengembang: menyalakan fitur jamaah (pilih kelompok)',
  $q$ update public.fitur set aktif = true, semua_kelompok = false where kode = 'jamaah' returning 1 $q$);
select uji.harus_berhasil('Pengembang: memilih Kelompok 1 untuk fitur jamaah',
  $q$ insert into public.fitur_kelompok (fitur_id, kelompok_id)
      select f.id, k.id from public.fitur f, public.kelompok k
      where f.kode = 'jamaah' and k.nomor = 1 returning 1 $q$);
update public.pengaturan_sistem set pesan_perawatan = 'Uji jejak';
select uji.cek('Pengembang: updated_by terisi otomatis saat mengubah pengaturan_sistem',
  (select updated_by = '00000000-0000-0000-0000-0000000000b2' from public.pengaturan_sistem));

reset role;

-- ---------------------------------------------------------------------
-- Anon: tidak bisa membaca apa pun
-- ---------------------------------------------------------------------
set local role anon;
select uji.harus_ditolak('Anon: membaca pengaturan_sistem ditolak',
  $q$ select 1 from public.pengaturan_sistem $q$);
select uji.harus_ditolak('Anon: membaca pengumuman ditolak',
  $q$ select 1 from public.pengumuman $q$);
select uji.harus_ditolak('Anon: membaca fitur ditolak',
  $q$ select 1 from public.fitur $q$);
reset role;

-- ---------------------------------------------------------------------
-- Hasil
-- ---------------------------------------------------------------------
select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 25, 'Jumlah skenario panel pengembang');
select * from finish();
rollback;
