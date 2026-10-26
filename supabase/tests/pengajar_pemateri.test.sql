-- =====================================================================
-- Tes migrasi 20261022140000_pengajar_pemateri: daftar pengajar rutin per
-- wilayah, sesi-sesi pemateri dalam pertemuan (simpan_materi_pertemuan) &
-- ringkasannya. Satu transaksi, di-rollback.
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
create function uji.keg(p_nama text) returns uuid language sql stable security definer as $$
  select id from public.kegiatan where nama = p_nama;
$$;
create function uji.kegk(p_nomor int) returns uuid language sql stable security definer as $$
  select k.id from public.kegiatan k join public.kelompok g on g.id = k.kelompok_id
  where k.nama = 'Pengajian Rutin Sambung Kelompok' and g.nomor = p_nomor;
$$;
grant execute on all functions in schema uji to anon, authenticated;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000a3'), ('00000000-0000-0000-0000-0000000000a4'),
  ('00000000-0000-0000-0000-0000000000a5'), ('00000000-0000-0000-0000-0000000000c1');
insert into public.admin (user_id, nama) values
  ('00000000-0000-0000-0000-0000000000a1', 'Desa'), ('00000000-0000-0000-0000-0000000000a2', 'K1'),
  ('00000000-0000-0000-0000-0000000000a3', 'K2'), ('00000000-0000-0000-0000-0000000000a4', 'Gen K1'),
  ('00000000-0000-0000-0000-0000000000a5', 'Dev');
select uji.beri('00000000-0000-0000-0000-0000000000a1', 'admin_desa', null);
select uji.beri('00000000-0000-0000-0000-0000000000a2', 'admin_kelompok', 1);
select uji.beri('00000000-0000-0000-0000-0000000000a3', 'admin_kelompok', 2);
select uji.beri('00000000-0000-0000-0000-0000000000a4', 'admin_generus', 1);
select uji.beri('00000000-0000-0000-0000-0000000000a5', 'pengembang', null);
insert into public.jamaah (id, kelompok_id, nama_lengkap, jenis_kelamin, kode, status_pernikahan, status_sekolah, tahun_lahir)
values ('00000000-0000-0000-0000-0000000000f1', uji.kel(1), 'Generus K1', 'L', 'x', 'lajang', 'smp', 2012);
insert into public.akun_generus (user_id, jamaah_id, username)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', 'genk1');


-- Pertemuan sambung kelompok K1 & K2 (dibuat superuser).
insert into public.pertemuan (id, kegiatan_id, kelompok_id, tanggal, mulai) values
  ('00000000-0000-0000-0000-0000000000e1', uji.kegk(1), uji.kel(1), '2026-10-25', '2026-10-25 20:00+07'),
  ('00000000-0000-0000-0000-0000000000e2', uji.kegk(2), uji.kel(2), '2026-10-25', '2026-10-25 20:00+07');
-- Muballigh dari data jamaah
insert into public.jamaah (id, kelompok_id, nama_lengkap, jenis_kelamin, kode, status_pernikahan, status_sekolah, tahun_lahir, muballigh)
values ('00000000-0000-0000-0000-0000000000f2', uji.kel(1), 'Ust. Jamaah', 'L', 'x', 'menikah', 'bekerja', 1980, true);

set local role authenticated;

-- Pengajar
select uji.sebagai('00000000-0000-0000-0000-0000000000a1');
insert into public.pengajar (id, nama, keterangan, kelompok_id)
values ('00000000-0000-0000-0000-0000000000d1', 'Ust. Desa', 'MT', null);
select uji.harus_ditolak('Desa: menambah pengajar kelompok ditolak (wewenang kelompok)',
  $q$ insert into public.pengajar (nama, kelompok_id) values ('X', uji.kel(1)) returning 1 $q$);
select uji.sebagai('00000000-0000-0000-0000-0000000000a2');
insert into public.pengajar (id, nama, kelompok_id) values ('00000000-0000-0000-0000-0000000000d2', 'Ust. Kelompok Satu', uji.kel(1));
select uji.harus_ditolak('K1: menambah pengajar tingkat desa ditolak',
  $q$ insert into public.pengajar (nama, kelompok_id) values ('X', null) returning 1 $q$);
select uji.harus_ditolak('K1: menambah pengajar untuk K2 ditolak',
  $q$ insert into public.pengajar (nama, kelompok_id) values ('X', uji.kel(2)) returning 1 $q$);
select uji.harus_ditolak('K1: nama pengajar kembar di wilayah yang sama ditolak',
  $q$ insert into public.pengajar (nama, kelompok_id) values ('  ust. kelompok satu ', uji.kel(1)) returning 1 $q$);
select uji.cek('K1: melihat pengajar desa & kelompoknya',
  (select array_agg(nama order by nama) from public.pengajar) = array['Ust. Desa', 'Ust. Kelompok Satu']);
select uji.harus_ditolak('K1: mengubah pengajar desa ditolak',
  $q$ update public.pengajar set nama = 'Ganti' where id = '00000000-0000-0000-0000-0000000000d1' returning 1 $q$);
select uji.sebagai('00000000-0000-0000-0000-0000000000a3');
select uji.cek('K2: tidak melihat pengajar K1', (select array_agg(nama) from public.pengajar) = array['Ust. Desa']);
select uji.sebagai('00000000-0000-0000-0000-0000000000a4');
select uji.harus_berhasil('Admin generus K1: boleh menambah pengajar kelompoknya',
  $q$ insert into public.pengajar (nama, kelompok_id) values ('Ust. Generus', uji.kel(1)) returning 1 $q$);
select uji.sebagai('00000000-0000-0000-0000-0000000000c1');
select uji.cek('Generus: tidak melihat daftar pengajar', not exists (select 1 from public.pengajar));

-- Simpan beberapa sesi
select uji.sebagai('00000000-0000-0000-0000-0000000000a2');
select public.simpan_materi_pertemuan('00000000-0000-0000-0000-0000000000e1', jsonb_build_array(
  jsonb_build_object('pengajar_id', '00000000-0000-0000-0000-0000000000d2', 'nama', 'diabaikan', 'materi', 'Makna Quran Juz 3'),
  jsonb_build_object('jamaah_id', '00000000-0000-0000-0000-0000000000f2', 'materi', 'Hadits Bab Sholat'),
  jsonb_build_object('nama', '', 'materi', ''),
  jsonb_build_object('nama', '  Tamu   Luar ', 'materi', null),
  jsonb_build_object('pengajar_id', '00000000-0000-0000-0000-0000000000d2', 'materi', 'Nasehat')));
reset role;
select uji.cek('Sesi tersimpan urut, nama dari pengajar/jamaah, baris kosong dilewati',
  (select array_agg(urutan || ':' || coalesce(pemateri_nama, '-') || ':' || coalesce(materi, '-') order by urutan)
   from public.pertemuan_materi where pertemuan_id = '00000000-0000-0000-0000-0000000000e1')
  = array['1:Ust. Kelompok Satu:Makna Quran Juz 3', '2:Ust. Jamaah:Hadits Bab Sholat', '3:Tamu Luar:-',
          '4:Ust. Kelompok Satu:Nasehat']);
select uji.cek('Ringkasan pertemuan: nama unik urut, materi digabung, jamaah pemateri pertama',
  (select pemateri_nama = 'Ust. Kelompok Satu, Ust. Jamaah, Tamu Luar'
          and materi = 'Makna Quran Juz 3 · Hadits Bab Sholat · Nasehat'
          and pemateri_jamaah_id = '00000000-0000-0000-0000-0000000000f2'
   from public.pertemuan where id = '00000000-0000-0000-0000-0000000000e1'));

set local role authenticated;
select uji.sebagai('00000000-0000-0000-0000-0000000000a2');
select public.simpan_materi_pertemuan('00000000-0000-0000-0000-0000000000e1', jsonb_build_array(
  jsonb_build_object('pengajar_id', '00000000-0000-0000-0000-0000000000d1', 'materi', 'Kitab Sholat')));
select uji.cek('Simpan ulang mengganti seluruh sesi',
  (select count(*) = 1 from public.pertemuan_materi where pertemuan_id = '00000000-0000-0000-0000-0000000000e1')
  and (select pemateri_nama = 'Ust. Desa' and materi = 'Kitab Sholat' and pemateri_jamaah_id is null
       from public.pertemuan where id = '00000000-0000-0000-0000-0000000000e1'));
select uji.harus_ditolak('K1: menyimpan sesi pertemuan K2 ditolak',
  $q$ select public.simpan_materi_pertemuan('00000000-0000-0000-0000-0000000000e2', '[{"nama":"X"}]') $q$);
select uji.harus_ditolak('Lebih dari 10 sesi ditolak',
  $q$ select public.simpan_materi_pertemuan('00000000-0000-0000-0000-0000000000e1',
        (select jsonb_agg(jsonb_build_object('nama', 'P' || g)) from generate_series(1, 11) g)) $q$);
select uji.harus_ditolak('Pengajar yang tidak terlihat ditolak',
  $q$ select public.simpan_materi_pertemuan('00000000-0000-0000-0000-0000000000e1',
        '[{"pengajar_id":"00000000-0000-0000-0000-0000000000ff"}]') $q$);
select uji.harus_ditolak('K1: menulis pertemuan_materi langsung untuk K2 ditolak',
  $q$ insert into public.pertemuan_materi (pertemuan_id, urutan, pemateri_nama)
      values ('00000000-0000-0000-0000-0000000000e2', 1, 'X') returning 1 $q$);

select uji.sebagai('00000000-0000-0000-0000-0000000000a3');
select uji.cek('K2: tidak melihat sesi pertemuan K1',
  not exists (select 1 from public.pertemuan_materi where pertemuan_id = '00000000-0000-0000-0000-0000000000e1'));
select uji.sebagai('00000000-0000-0000-0000-0000000000c1');
select uji.cek('Generus K1: melihat sesi pertemuan kelompoknya',
  exists (select 1 from public.pertemuan_materi where pertemuan_id = '00000000-0000-0000-0000-0000000000e1'));
select uji.harus_ditolak('Generus: tidak bisa menyimpan sesi',
  $q$ select public.simpan_materi_pertemuan('00000000-0000-0000-0000-0000000000e1', '[]') $q$);
reset role;

-- Pengajar dihapus: nama di sesi tetap
delete from public.pengajar where id = '00000000-0000-0000-0000-0000000000d1';
select uji.cek('Pengajar dihapus: nama sesi tetap, tautan kosong',
  (select pemateri_nama = 'Ust. Desa' and pengajar_id is null from public.pertemuan_materi
   where pertemuan_id = '00000000-0000-0000-0000-0000000000e1'));

set local role anon;
select uji.harus_ditolak('Anon: tidak bisa membaca pengajar', $q$ select 1 from public.pengajar $q$);
reset role;

select ok(lulus, nama || coalesce(' — ' || catatan, '')) from uji.hasil order by no;
select cmp_ok((select count(*)::int from uji.hasil), '>=', 20, 'Jumlah skenario pengajar & pemateri');
select * from finish();
rollback;
